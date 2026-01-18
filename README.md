# Real-Time Chat API

A real-time chat backend that enables secure one-to-one messaging using REST APIs and WebSockets.  
Built with a focus on reliability, scalability, and clean backend architecture.

This project supports authenticated users, persistent chat history, real-time message delivery, and advanced features like message editing, deletion, pagination, and rate limiting.

---

## 📋 Overview

The Real-Time Chat API allows users to:
- Register and authenticate securely
- Send and receive messages instantly
- View complete chat history with pagination
- Edit or delete their own messages
- View and update their profile
- Communicate securely using JWT-authenticated WebSockets

---

## ✨ Key Features

### Authentication & Security
- JWT-based authentication
- Secure password hashing with bcrypt
- Auth-protected REST APIs
- JWT-authenticated WebSocket connections

### Messaging
- One-to-one private messaging
- Persistent message storage
- Chat history retrieval with pagination
- Accurate message timestamps

### Real-Time Communication
- Instant message delivery via Socket.IO
- User-scoped private rooms
- Reliable DB-first message delivery

### Message Controls
- Edit own messages
- Delete messages for everyone (soft delete)
- Edited and deleted message indicators

### User Management
- View own profile
- Update own profile details
- Strict authorization enforcement

### Performance & Safety
- Rate limiting for auth and messaging endpoints
- Centralized error handling
- Structured logging with Winston

---

## 🛠 Tech Stack

| Component | Technology |
|---------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Real-Time | Socket.IO |
| Database | SQLite (Prisma ORM) |
| Authentication | JWT |
| Logging | Winston |
| Rate Limiting | express-rate-limit |

---

## 📦 Getting Started

### Prerequisites
- Node.js (v16+)
- npm

### Installation

```bash
git clone <repository-url>
cd GDG-BACKEND-REPO-Arihant_Gupta
git checkout task-2-chat-api
npm install
```

### Environment Variables

Create a `.env` file:

```env
PORT=5000
JWT_SECRET=your_secret_key
DATABASE_URL="file:./dev.db"
```

### Database Setup

```bash
npx prisma migrate dev
node src/scripts/seed.js
```

### Start Server

```bash
npm run dev
```

**Base URL:**

```
http://localhost:5000/api
```

## 🔐 Authentication

All protected routes require a JWT token:

```
Authorization: Bearer <JWT_TOKEN>
```

## 📚 REST API Documentation

### Authentication

#### Register

```http
POST /api/auth/register
```

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Login

```http
POST /api/auth/login
```

**Response:**

```json
{
  "token": "jwt_token_here"
}
```

### 👤 User Profile

#### Get Own Profile

```http
GET /api/users/me
```

#### Update Own Profile

```http
PUT /api/users/me
```

**Request:**

```json
{
  "email": "newemail@example.com"
}
```

### 💬 Messaging

#### Send Message

```http
POST /api/messages
```

**Request:**

```json
{
  "receiverId": 2,
  "content": "Hello there!"
}
```

#### Get Conversation (Paginated)

```http
GET /api/messages/:userId?page=1&limit=20
```

**Response:**

```json
{
  "page": 1,
  "limit": 20,
  "totalMessages": 45,
  "totalPages": 3,
  "messages": [...]
}
```

#### Edit Message

```http
PUT /api/messages/:id
```

**Request:**

```json
{
  "content": "Updated message"
}
```

#### Delete Message (Delete for Everyone)

```http
DELETE /api/messages/:id
```

**Deleted messages appear as:**

```
"This message was deleted"
```

## 🔌 WebSocket Documentation

### Connection

```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "<JWT_TOKEN>"
  }
});
```

### Events

#### receive_message

Emitted when a new message is received in real time.

```json
{
  "id": 12,
  "senderId": 1,
  "receiverId": 2,
  "content": "Hello!",
  "createdAt": "2026-01-17T13:00:00Z"
}
```

### Room Model

Each user automatically joins a private room:

```
user:<userId>
```

Messages are emitted to the receiver's room for secure delivery.

## 🛡 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Auth | 20 requests / 15 min |
| Messages | 30 messages / minute |

## 🧪 Testing

Manual testing recommended for:

- WebSocket connections
- Real-time message delivery

REST endpoints can be verified using Postman or curl.

## 📄 License

ISC

## 👤 Author

Arihant Gupta

**Status:** ✅ Task 2 completed with all core features and multiple brownie-point enhancements
