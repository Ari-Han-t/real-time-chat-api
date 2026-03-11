import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, MESSAGE_FILE_DIR, PROFILE_PIC_DIR
from .database import Base, SessionLocal, engine
from .models import ChatMember, User
from .routers import auth, chats, users
from .schema_upgrade import apply_schema_upgrades
from .security import decode_access_token
from .websocket_manager import manager


Base.metadata.create_all(bind=engine)
apply_schema_upgrades(engine)

app = FastAPI(title="Real-Time Chat API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chats.router)

app.mount("/uploads/messages", StaticFiles(directory=MESSAGE_FILE_DIR), name="message-uploads")
app.mount("/uploads/profile_pics", StaticFiles(directory=PROFILE_PIC_DIR), name="profile-uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/chats/{chat_id}")
async def chat_ws(websocket: WebSocket, chat_id: int):
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
        if user is None:
            await websocket.close(code=4401)
            return

        membership = db.query(ChatMember).filter(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id).first()
        if membership is None:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await manager.connect(chat_id, websocket, user_id=user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            if raw.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = payload.get("type")
            if event_type == "typing":
                await manager.broadcast(
                    chat_id,
                    {
                        "type": "typing",
                        "chat_id": chat_id,
                        "user_id": user_id,
                        "is_typing": bool(payload.get("is_typing", False)),
                    },
                    exclude_user_id=user_id,
                )
    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
    except Exception:
        manager.disconnect(chat_id, websocket)
        await websocket.close(code=1011)


def _frontend_file(path: str):
    full_path = Path(FRONTEND_DIR) / path
    if not full_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    return FileResponse(full_path)


@app.get("/")
def root():
    return _frontend_file("index.html")


@app.get("/app.js")
def app_js():
    return _frontend_file("app.js")


@app.get("/styles.css")
def styles_css():
    return _frontend_file("styles.css")
