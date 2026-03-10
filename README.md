# Real-Time Chat Application

Production-style full stack chat app with:

- FastAPI backend
- PostgreSQL (or SQLite for local quick start)
- JWT authentication
- Real-time updates using WebSockets
- Direct messaging
- Text + attachment messages
- Profile management (name, bio, profile picture)
- 2 MB hard upload limit

## Supported Attachments

Message attachments support:

- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.mov`, `.webm`, `.mkv`
- Documents: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.txt`, `.csv`

Every upload is validated for:

- Allowed extension
- Size <= 2 MB
- Non-empty content

## Project Layout

```text
chat_fullstack/
  backend/
    app/
      routers/
      config.py
      database.py
      models.py
      main.py
    uploads/
    requirements.txt
    Dockerfile
  frontend/
    index.html
    styles.css
    app.js
  docker-compose.yml
```

## Run Locally (No Docker)

From `chat_fullstack/backend`:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open:

```text
http://localhost:8000
```

By default this uses a local SQLite file at `backend/chat_app.db`.

## Run With Docker (PostgreSQL + Backend)

From `chat_fullstack`:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8000
```

## API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/users/me/profile-picture`
- `GET /api/users/search?q=<query>`
- `POST /api/chats/direct/{other_user_id}`
- `GET /api/chats`
- `GET /api/chats/{chat_id}/messages`
- `POST /api/chats/{chat_id}/messages`
- `WS /ws/chats/{chat_id}?token=<jwt>`

## Deployment Notes

- Set strong `JWT_SECRET_KEY`.
- Use managed PostgreSQL by setting `DATABASE_URL`.
- Persist `backend/uploads` volume to retain media files.
- Put reverse proxy (Nginx/Caddy) in front of API for TLS in production.
