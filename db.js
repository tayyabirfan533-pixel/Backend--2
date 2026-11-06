import { Sequelize, DataTypes } from 'sequelize';

const databaseUrl = process.env.DATABASE_URL;

export const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: './database.sqlite',
      logging: false,
    });

// User Model
export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('Admin', 'Employee'), defaultValue: 'Employee' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

// Attendance Model
export const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
  checkIn: { type: DataTypes.DATE, allowNull: false },
  checkOut: { type: DataTypes.DATE, allowNull: true },
  totalHours: { type: DataTypes.FLOAT, defaultValue: 0 },
});

// Leave Model
export const Leave = sequelize.define('Leave', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.STRING, allowNull: false },
  endDate: { type: DataTypes.STRING, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
  },
});

// Relationships
User.hasMany(Attendance, { foreignKey: 'userId' });
Attendance.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Leave, { foreignKey: 'userId' });
Leave.belongsTo(User, { foreignKey: 'userId' });
