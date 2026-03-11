# Real-Time Chat API

Full-stack chat application with a FastAPI backend, SQL database, WebSocket real-time events, and a browser frontend.

## Features

- JWT auth (register/login)
- User profile management (name, bio, profile picture)
- Direct chats
- Text + attachment messaging (2 MB max)
- Real-time message delivery
- Typing indicators
- Read receipts
- Message edit/delete with ownership checks
- Message pagination + infinite scroll UI
- Rate limiting and moderation guards on messaging

## Attachment Support

Allowed file extensions:

- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.mov`, `.webm`, `.mkv`
- Docs: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.txt`, `.csv`

Validation:

- Size <= 2 MB
- Allowed extension only
- Non-empty upload

## Project Structure

```text
backend/
  app/
    routers/
    config.py
    database.py
    models.py
    main.py
  scripts/
  uploads/
  requirements.txt
  Dockerfile
frontend/
  index.html
  styles.css
  app.js
deploy/
  nginx/
docker-compose.yml
docker-compose.prod.yml
```

## Local Run (Python)

From repo root:

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000
```

Default local DB: `backend/chat_app.db` (SQLite).

## Local Run (Docker Dev)

From repo root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8000
```

## Production Run (Nginx + HTTPS + Postgres)

1. Copy env template:

```bash
cp .env.prod.example .env
```

2. Set strong secrets and DB credentials in `.env`.

3. Put certificate files in:

```text
deploy/nginx/certs/fullchain.pem
deploy/nginx/certs/privkey.pem
```

4. Update `server_name` in:

```text
deploy/nginx/conf.d/chat.conf
```

5. Start stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/users/me/profile-picture`
- `GET /api/users/search?q=<query>`
- `POST /api/chats/direct/{other_user_id}`
- `GET /api/chats`
- `GET /api/chats/{chat_id}/messages?limit=&before_id=`
- `POST /api/chats/{chat_id}/messages`
- `PATCH /api/chats/{chat_id}/messages/{message_id}`
- `DELETE /api/chats/{chat_id}/messages/{message_id}`
- `POST /api/chats/{chat_id}/read`
- `WS /ws/chats/{chat_id}?token=<jwt>`

## Fake Data Seeder

Generate 100 fake users + reply-ready chats:

```bash
cd backend
PYTHONPATH=. python scripts/seed_fake_data.py
```

Outputs:

- `backend/seed_users.csv`
- `backend/seed_chats_to_reply.csv`
