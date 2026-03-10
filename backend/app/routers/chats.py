from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from ..deps import get_current_user, get_db
from ..models import Chat, ChatMember, Message, User
from ..schemas import ChatPublic, MessagePublic, SendMessageResponse, UserPublic
from ..storage import save_message_attachment
from ..websocket_manager import manager


router = APIRouter(prefix="/api/chats", tags=["chats"])


def _serialize_chat(db: Session, chat: Chat) -> ChatPublic:
    member_payload = [UserPublic.model_validate(member.user) for member in chat.members]
    last_message = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.id.desc()).first()
    last_message_payload = MessagePublic.model_validate(last_message) if last_message else None
    return ChatPublic(
        id=chat.id,
        is_group=chat.is_group,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        members=member_payload,
        last_message=last_message_payload,
    )


def _ensure_member(db: Session, chat_id: int, user_id: int) -> None:
    membership = db.query(ChatMember).filter(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id).first()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat.")


@router.post("/direct/{other_user_id}", response_model=ChatPublic)
def create_or_get_direct_chat(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if other_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create a chat with yourself.")

    other_user = db.query(User).filter(User.id == other_user_id, User.is_active.is_(True)).first()
    if not other_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    existing_chats = (
        db.query(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(Chat.is_group.is_(False), ChatMember.user_id == current_user.id)
        .options(joinedload(Chat.members).joinedload(ChatMember.user))
        .all()
    )
    for chat in existing_chats:
        member_ids = sorted(member.user_id for member in chat.members)
        if member_ids == sorted([current_user.id, other_user_id]):
            return _serialize_chat(db, chat)

    chat = Chat(is_group=False, title=None)
    db.add(chat)
    db.flush()

    db.add_all(
        [
            ChatMember(chat_id=chat.id, user_id=current_user.id),
            ChatMember(chat_id=chat.id, user_id=other_user_id),
        ]
    )
    db.commit()

    created = (
        db.query(Chat)
        .filter(Chat.id == chat.id)
        .options(joinedload(Chat.members).joinedload(ChatMember.user))
        .first()
    )
    return _serialize_chat(db, created)


@router.get("", response_model=list[ChatPublic])
def list_chats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    chats = (
        db.query(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(ChatMember.user_id == current_user.id)
        .options(joinedload(Chat.members).joinedload(ChatMember.user))
        .order_by(Chat.updated_at.desc(), Chat.id.desc())
        .all()
    )
    return [_serialize_chat(db, chat) for chat in chats]


@router.get("/{chat_id}/messages", response_model=list[MessagePublic])
def get_messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    before_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    query = db.query(Message).filter(Message.chat_id == chat_id)
    if before_id is not None:
        query = query.filter(Message.id < before_id)
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    return [MessagePublic.model_validate(msg) for msg in reversed(messages)]


@router.post("/{chat_id}/messages", response_model=SendMessageResponse)
async def send_message(
    chat_id: int,
    text: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)

    clean_text = (text or "").strip()
    if not clean_text and file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text or file is required.")

    attachment_url = None
    attachment_name = None
    attachment_mime = None
    attachment_size = None
    if file is not None:
        saved_name, size = save_message_attachment(file)
        attachment_url = f"/uploads/messages/{saved_name}"
        attachment_name = file.filename
        attachment_mime = file.content_type
        attachment_size = size

    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        text=clean_text if clean_text else None,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_mime=attachment_mime,
        attachment_size=attachment_size,
    )
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    chat.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.add(chat)
    db.commit()
    db.refresh(message)

    msg_payload = MessagePublic.model_validate(message)
    await manager.broadcast(
        chat_id,
        {
            "type": "new_message",
            "chat_id": chat_id,
            "message": msg_payload.model_dump(mode="json"),
            "sender": UserPublic.model_validate(current_user).model_dump(mode="json"),
        },
    )
    return SendMessageResponse(message=msg_payload)

