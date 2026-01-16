# Productivity Management Dashboard API

A robust backend API for a productivity management system that empowers users to organize, track, and analyze their tasks efficiently. Built with a focus on clean architecture, security, and reliability.

## 📋 Overview

This API provides a complete task management solution with advanced features including role-based access control, recurring task automation, productivity analytics, and comprehensive test coverage. Perfect for teams and individuals looking to streamline their workflow management.

## ✨ Key Features

- **Authentication & Security**
  - JWT-based authentication (register & login)
  - Secure password hashing with bcrypt
  - Token-based authorization

- **Task Management**
  - Full CRUD operations for tasks
  - Advanced filtering and search capabilities
  - Priority-based task organization
  - Status tracking (PENDING, IN_PROGRESS, COMPLETED)
  - Deadline management with overdue detection

- **Smart Automation**
  - Recurring tasks (daily / weekly recurrence)
  - Automatic task generation for recurring items
  - Overdue task detection and tracking

- **Access Control & Analytics**
  - Role-based access control (USER / ADMIN)
  - Admin-only productivity dashboard
  - Detailed analytics and completion metrics

- **Developer Experience**
  - Automated database seeding
  - Comprehensive integration test suite
  - Centralized error handling
  - Structured logging with Winston

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | SQLite with Prisma ORM |
| **Authentication** | JWT |
| **Password Hashing** | bcrypt |
| **Logging** | Winston |
| **Testing** | Jest & Supertest |

---

## 📦 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd GDG-BACKEND-REPO-Arihant_Gupta
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
PORT=5000
JWT_SECRET=your_super_secret_key_here
DATABASE_URL="file:./dev.db"
```

4. **Set up the database**
```bash
npx prisma migrate dev
```

5. **Seed the database (optional)**
```bash
node src/scripts/seed.js
```
This creates 5 test users (1 admin, 4 regular users) with 10 sample tasks each.

6. **Start the server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000/api`

---

## 🔐 Authentication

All protected routes require a valid JWT token in the request header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens expire after 7 days.

---

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register a New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Task Management Endpoints

#### Create a Task
```http
POST /api/tasks
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Finish backend implementation",
  "description": "Complete API endpoints",
  "priority": "HIGH",
  "deadline": "2026-01-20",
  "recurrence": "DAILY"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "Finish backend implementation",
  "priority": "HIGH",
  "status": "PENDING",
  "deadline": "2026-01-20T00:00:00Z",
  "recurrence": "DAILY"
}
```

#### Get All Tasks
```http
GET /api/tasks?status=PENDING&priority=HIGH&search=backend
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
| Parameter | Values | Description |
|-----------|--------|-------------|
| `status` | PENDING, IN_PROGRESS, COMPLETED | Filter by task status |
| `priority` | LOW, MEDIUM, HIGH | Filter by priority |
| `search` | string | Search in task titles |
| `from` | date (YYYY-MM-DD) | Filter tasks with deadline from date |
| `to` | date (YYYY-MM-DD) | Filter tasks with deadline until date |

#### Update a Task
```http
PUT /api/tasks/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "status": "COMPLETED",
  "priority": "MEDIUM"
}
```

> **Note:** For recurring tasks, marking as COMPLETED automatically creates the next occurrence with an updated deadline.

#### Delete a Task
```http
DELETE /api/tasks/:id
Authorization: Bearer <JWT_TOKEN>
```

---

### Special Task Features

#### Recurring Tasks
Tasks can be set to recur automatically:

| Type | Behavior |
|------|----------|
| **DAILY** | New task created with deadline +1 day |
| **WEEKLY** | New task created with deadline +7 days |
| **None** | One-time task (default) |

When you complete a recurring task, the system automatically generates the next occurrence.

#### Overdue Detection
A task is marked as overdue when:
- The deadline has passed
- The task status is not COMPLETED

Example response:
```json
{
  "id": 1,
  "title": "Submit report",
  "isOverdue": true,
  "deadline": "2026-01-15T00:00:00Z"
}
```

---

### Dashboard Endpoints (Admin Only)

#### Get Productivity Overview
```http
GET /api/dashboard/overview?range=month
Authorization: Bearer <ADMIN_TOKEN>
```

**Query Parameters:**
| Parameter | Values | Description |
|-----------|--------|-------------|
| `range` | day, week, month | Time period for metrics |
| `from` | date (YYYY-MM-DD) | Custom start date |
| `to` | date (YYYY-MM-DD) | Custom end date |

**Response (200 OK):**
```json
{
  "totalTasks": 50,
  "completedTasks": 18,
  "overdueTasks": 6,
  "completionRate": 36
}
```

#### Get All Tasks (Admin)
```http
GET /api/tasks/admin/all
Authorization: Bearer <ADMIN_TOKEN>
```

Returns all tasks from all users across the system.

---

## 👥 Role-Based Access Control

| Role | Permissions |
|------|------------|
| **USER** | ✅ Create, read, update, delete own tasks |
| **ADMIN** | ✅ View all user tasks<br>✅ Access productivity dashboard<br>✅ View system-wide analytics |

---

## 🧪 Testing

This project includes comprehensive integration tests covering all major features.

### Run Tests
```bash
NODE_ENV=test npm test
```

### What's Tested
- ✅ User authentication (register & login)
- ✅ Task CRUD operations
- ✅ Authorization and role-based access
- ✅ Task filtering and search
- ✅ Admin dashboard access control
- ✅ Error handling

### Test Database
Tests use an isolated SQLite database (`test.db`) to prevent affecting production data.

---

## 🌱 Database Seeding

The seed script pre-populates the database with test data:

```bash
node src/scripts/seed.js
```

**What it creates:**
- 5 test users:
  - 1 ADMIN user: `seed1@test.com`
  - 4 regular users: `seed2-5@test.com`
- 10 sample tasks per user with varied priorities and deadlines

**All users:** password = `password123`

---

## 📊 Project Structure

```
src/
├── app.js                 # Express app configuration
├── server.js             # Server entry point
├── config/
│   └── prisma.js         # Prisma client configuration
├── controllers/          # Route handlers
│   ├── auth.controller.js
│   ├── task.controller.js
│   └── dashboard.controller.js
├── middleware/           # Express middleware
│   ├── auth.middleware.js
│   ├── error.middleware.js
│   └── role.middleware.js
├── routes/              # API route definitions
├── scripts/             # Utility scripts
│   └── seed.js
├── tests/               # Integration tests
├── utils/               # Helper utilities
│   └── logger.js
└── validators/          # Input validation
```

---

## 🛡️ Error Handling & Logging

- **Centralized Error Middleware** - All errors are handled consistently with appropriate HTTP status codes
- **Structured Logging** - Important operations are logged using Winston for debugging and monitoring
- **Input Validation** - Request data is validated before processing
- **Security** - Passwords are hashed, sensitive data is not logged

---

## 📝 Available Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run integration tests
npm test

# Run tests in watch mode
npm test -- --watch
```

---

## 🚀 Deployment Checklist

- [ ] Update `.env` with production database and secret
- [ ] Run `npx prisma migrate deploy`
- [ ] Set `NODE_ENV=production`
- [ ] Use a production-grade database (PostgreSQL recommended)
- [ ] Enable HTTPS
- [ ] Set up environment-specific logging
- [ ] Configure CORS appropriately
- [ ] Run full test suite before deploying


## 📄 License

ISC

---

## 👤 Author

**Arihant Gupta**

---

**Status:** ✅ Complete with all required and optional features implemented