import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { sequelize, User, Attendance, Leave } from './db.js';
import { generateToken, authenticateToken, requireAdmin } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

// Root Health Check Route
app.get('/', (req, res) => {
  res.send({ status: 'API is running successfully', timestamp: new Date() });
});

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'All fields are required' });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials or inactive user' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EMPLOYEE MANAGEMENT ROUTES (ADMIN ONLY)
app.post('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const employee = await User.create({ name, email, password: hashedPassword, role: role || 'Employee' });
    res.status(201).json({ message: 'Employee created successfully', employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const employees = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'] });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    const employee = await User.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (name !== undefined) employee.name = name;
    if (email !== undefined) employee.email = email;
    if (role !== undefined) employee.role = role;
    if (isActive !== undefined) employee.isActive = isActive;

    await employee.save();
    res.json({ message: 'Employee updated successfully', employee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ATTENDANCE ROUTES
app.post('/api/attendance/check-in', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ where: { userId: req.user.id, date: today } });

    if (existing) {
      return res.status(400).json({ message: 'Duplicate check-in! You have already checked in today.' });
    }

    const attendance = await Attendance.create({
      userId: req.user.id,
      date: today,
      checkIn: new Date(),
    });

    res.status(201).json({ message: 'Checked in successfully', attendance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance/check-out', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const record = await Attendance.findOne({ where: { userId: req.user.id, date: today } });

    if (!record) return res.status(400).json({ message: 'No check-in record found for today.' });
    if (record.checkOut) return res.status(400).json({ message: 'Already checked out today.' });

    const checkOutTime = new Date();
    const diffMs = checkOutTime - new Date(record.checkIn);
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    record.checkOut = checkOutTime;
    record.totalHours = totalHours;
    await record.save();

    res.json({ message: 'Checked out successfully', attendance: record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance/history', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const filter = {};

    if (req.user.role === 'Admin' && userId) {
      filter.userId = userId;
    } else if (req.user.role !== 'Admin') {
      filter.userId = req.user.id;
    }

    if (startDate && endDate) {
      filter.date = { [Op.between]: [startDate, endDate] };
    }

    const history = await Attendance.findAll({
      where: filter,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['date', 'DESC']]
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LEAVE ROUTES
app.post('/api/leaves', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Start date, end date, and reason are required' });
    }

    const leave = await Leave.create({
      userId: req.user.id,
      startDate,
      endDate,
      reason,
      status: 'Pending'
    });

    res.status(201).json({ message: 'Leave request submitted', leave });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaves', authenticateToken, async (req, res) => {
  try {
    const filter = req.user.role === 'Admin' ? {} : { userId: req.user.id };
    const leaves = await Leave.findAll({
      where: filter,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/leaves/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    }

    const leave = await Leave.findByPk(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    leave.status = status;
    await leave.save();

    res.json({ message: `Leave ${status.toLowerCase()} successfully`, leave });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DASHBOARD STATS ROUTE (ADMIN)
app.get('/api/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalEmployees = await User.count({ where: { role: 'Employee', isActive: true } });
    const presentToday = await Attendance.count({ where: { date: today } });
    const absentToday = Math.max(0, totalEmployees - presentToday);
    const pendingLeaves = await Leave.count({ where: { status: 'Pending' } });

    res.json({
      totalEmployees,
      presentEmployees: presentToday,
      absentEmployees: absentToday,
      pendingLeaveRequests: pendingLeaves,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SERVER INITIALIZATION & AUTO SEEDING
const PORT = process.env.PORT || 5000;

sequelize.sync({ alter: true }).then(async () => {
  console.log('Database connected & synced successfully.');

  const adminExists = await User.findOne({ where: { role: 'Admin' } });
  if (!adminExists) {
    const defaultPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'System Admin',
      email: 'admin@system.com',
      password: defaultPassword,
      role: 'Admin',
    });
    console.log('Default Admin Account Created: admin@system.com / admin123');
  }

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}).catch(err => {
  console.error('Database Sync Error:', err);
});
