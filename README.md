# Real-Time Employee Attendance & Leave Management System (Backend)

## Features
- JWT-based Authentication
- Role-based Access Control (Admin & Employee)
- Employee Record Management (Create, Read, Update, Deactivate)
- Attendance Management (Check-in, Check-out, Working hours calculation, Duplicate prevention)
- Leave Management (Submit requests, Admin Approve/Reject, Status tracking)
- Date-filtered Attendance History
- Dashboard Statistics API
- Built-in SQLite database support (PostgreSQL ready for Render deployment)

## Setup & Local Run Instructions
1. Install dependencies:
   `npm install`
2. Start development server:
   `npm start`

## Default Admin Credentials
- **Email:** `admin@system.com`
- **Password:** `admin123`

## Deployment on Render
1. Upload all root files to GitHub repository.
2. Connect repo on Render -> Create Web Service.
3. Set Start Command: `node server.js`
