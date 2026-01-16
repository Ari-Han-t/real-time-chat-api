# GDG-BACKEND-REPO-Arihant_Gupta
# Productivity Management Dashboard API

## Features
- JWT Authentication
- Role-Based Access Control (User/Admin)
- Task CRUD with filters & search
- Recurring tasks (daily/weekly)
- Overdue task detection
- Productivity analytics
- Automated testing with Jest + Supertest

## Tech Stack
- Node.js
- Express
- Prisma + SQLite
- JWT
- Jest / Supertest

## Setup
npm install
npx prisma migrate dev
node src/scripts/seed.js
npm run dev

## Automated Testing
NODE_ENV=test npm test

## Roles
- USER: manage own tasks
- ADMIN: view system-wide analytics

## API Documentation
(brief list of endpoints)
