from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from ..config import (
    FILE_RATE_LIMIT_COUNT,
    FILE_RATE_LIMIT_WINDOW_SECONDS,
    MESSAGE_RATE_LIMIT_COUNT,
    MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
)
from ..deps import get_current_user, get_db
from ..models import Chat, ChatMember, Message, MessageRead, User
from ..moderation import validate_message_text
from ..rate_limit import limiter
from ..schemas import (
    ChatPublic,
    MessagePublic,
    MessageReadRequest,
    MessageUpdateRequest,
    SendMessageResponse,
    UserPublic,
)
from ..storage import delete_message_attachment, save_message_attachment
from ..websocket_manager import manager


router = APIRouter(prefix="/api/chats", tags=["chats"])


def _message_read_map(db: Session, message_ids: list[int]) -> dict[int, set[int]]:
    if not message_ids:
        return {}
    rows = db.query(MessageRead).filter(MessageRead.message_id.in_(message_ids)).all()
    out: dict[int, set[int]] = {}
    for row in rows:
        out.setdefault(row.message_id, set()).add(row.user_id)
    return out


def _serialize_message(message: Message, read_map: dict[int, set[int]] | None = None) -> MessagePublic:
    read_users = set(read_map.get(message.id, set()) if read_map else set())
    read_users.add(message.sender_id)
    return MessagePublic(
        id=message.id,
        chat_id=message.chat_id,
        sender_id=message.sender_id,
        text=None if message.is_deleted else message.text,
        attachment_url=None if message.is_deleted else message.attachment_url,
        attachment_name=None if message.is_deleted else message.attachment_name,
        attachment_mime=None if message.is_deleted else message.attachment_mime,
        attachment_size=None if message.is_deleted else message.attachment_size,
        created_at=message.created_at,
        updated_at=message.updated_at,
        is_edited=message.is_edited,
        is_deleted=message.is_deleted,
        read_by_user_ids=sorted(read_users),
    )


def _serialize_chat(db: Session, chat: Chat) -> ChatPublic:
    member_payload = [UserPublic.model_validate(member.user) for member in chat.members]
    last_message = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.id.desc()).first()
    last_message_payload = None
    if last_message:
        last_map = _message_read_map(db, [last_message.id])
        last_message_payload = _serialize_message(last_message, last_map)
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


def _touch_chat(db: Session, chat_id: int) -> Chat:
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    chat.updated_at = datetime.now(timezone.utc)
    db.add(chat)
    return chat


def _mark_messages_read(db: Session, chat_id: int, user_id: int, last_message_id: int) -> list[int]:
    unread_candidates = (
        db.query(Message.id)
        .filter(
            Message.chat_id == chat_id,
            Message.id <= last_message_id,
            Message.sender_id != user_id,
        )
        .order_by(Message.id.asc())
        .all()
    )
    candidate_ids = [row[0] for row in unread_candidates]
    if not candidate_ids:
        return []

    existing = (
        db.query(MessageRead.message_id)
        .filter(MessageRead.user_id == user_id, MessageRead.message_id.in_(candidate_ids))
        .all()
    )
    existing_ids = {row[0] for row in existing}
    to_insert = [mid for mid in candidate_ids if mid not in existing_ids]
    for mid in to_insert:
        db.add(MessageRead(message_id=mid, user_id=user_id))
    return to_insert


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
    limit: int = Query(default=30, ge=1, le=200),
    before_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    query = db.query(Message).filter(Message.chat_id == chat_id)
    if before_id is not None:
        query = query.filter(Message.id < before_id)
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    ordered = list(reversed(messages))
    read_map = _message_read_map(db, [msg.id for msg in ordered])
    return [_serialize_message(msg, read_map) for msg in ordered]


@router.post("/{chat_id}/messages", response_model=SendMessageResponse)
async def send_message(
    chat_id: int,
    text: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    limiter.check(
        key=f"msg:{current_user.id}",
        max_count=MESSAGE_RATE_LIMIT_COUNT,
        window_seconds=MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
    )

    clean_text = (text or "").strip()
    if not clean_text and file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text or file is required.")
    validate_message_text(clean_text)

    attachment_url = None
    attachment_name = None
    attachment_mime = None
    attachment_size = None
    if file is not None:
        limiter.check(
            key=f"file:{current_user.id}",
            max_count=FILE_RATE_LIMIT_COUNT,
            window_seconds=FILE_RATE_LIMIT_WINDOW_SECONDS,
        )
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
    _touch_chat(db, chat_id)
    db.add(message)
    db.commit()
    db.refresh(message)

    msg_payload = _serialize_message(message)
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


@router.post("/{chat_id}/read")
async def mark_read(
    chat_id: int,
    payload: MessageReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    message_exists = db.query(Message.id).filter(Message.chat_id == chat_id, Message.id == payload.last_message_id).first()
    if not message_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target message not found in this chat.")

    inserted = _mark_messages_read(db, chat_id, current_user.id, payload.last_message_id)
    db.commit()

    await manager.broadcast(
        chat_id,
        {
            "type": "messages_read",
            "chat_id": chat_id,
            "user_id": current_user.id,
            "last_message_id": payload.last_message_id,
            "marked_count": len(inserted),
        },
        exclude_user_id=current_user.id,
    )
    return {"status": "ok", "marked_count": len(inserted)}


@router.patch("/{chat_id}/messages/{message_id}", response_model=SendMessageResponse)
async def edit_message(
    chat_id: int,
    message_id: int,
    payload: MessageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    limiter.check(
        key=f"msg:{current_user.id}",
        max_count=MESSAGE_RATE_LIMIT_COUNT,
        window_seconds=MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
    )

    message = db.query(Message).filter(Message.id == message_id, Message.chat_id == chat_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own messages.")
    if message.is_deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deleted messages cannot be edited.")

    clean_text = payload.text.strip()
    validate_message_text(clean_text)
    if not clean_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text cannot be empty.")

    message.text = clean_text
    message.updated_at = datetime.now(timezone.utc)
    message.is_edited = True
    _touch_chat(db, chat_id)
    db.add(message)
    db.commit()
    db.refresh(message)

    payload_msg = _serialize_message(message, _message_read_map(db, [message.id]))
    await manager.broadcast(
        chat_id,
        {
            "type": "message_updated",
            "chat_id": chat_id,
            "message": payload_msg.model_dump(mode="json"),
        },
    )
    return SendMessageResponse(message=payload_msg)


@router.delete("/{chat_id}/messages/{message_id}", response_model=SendMessageResponse)
async def delete_message(
    chat_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, chat_id, current_user.id)
    limiter.check(
        key=f"msg:{current_user.id}",
        max_count=MESSAGE_RATE_LIMIT_COUNT,
        window_seconds=MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
    )

    message = db.query(Message).filter(Message.id == message_id, Message.chat_id == chat_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own messages.")

    if not message.is_deleted:
        delete_message_attachment(message.attachment_url)
        message.text = None
        message.attachment_url = None
        message.attachment_name = None
        message.attachment_mime = None
        message.attachment_size = None
        message.is_deleted = True
        message.is_edited = False
        message.updated_at = datetime.now(timezone.utc)
        _touch_chat(db, chat_id)
        db.add(message)
        db.commit()
        db.refresh(message)

    payload_msg = _serialize_message(message, _message_read_map(db, [message.id]))
    await manager.broadcast(
        chat_id,
        {
            "type": "message_deleted",
            "chat_id": chat_id,
            "message": payload_msg.model_dump(mode="json"),
        },
    )
    return SendMessageResponse(message=payload_msg)
