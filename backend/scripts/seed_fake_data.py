import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Chat, ChatMember, Message, User
from app.security import hash_password


TOTAL_USERS = 100
DEFAULT_PASSWORD = "Password123!"
USERNAME_PREFIX = "student"
NAME_PREFIX = "Student"


SUBJECTS = [
    "math",
    "physics",
    "chemistry",
    "biology",
    "history",
    "geography",
    "english",
    "computer science",
    "economics",
]

QUESTION_TEMPLATES = [
    "Can you explain the main idea in {subject} chapter {chapter}?",
    "I am stuck on {subject} assignment {chapter}. Can you help?",
    "What is the easiest way to revise {subject} topic {chapter}?",
    "Can you give me a quick summary of {subject} lesson {chapter}?",
    "How should I prepare for the {subject} test on unit {chapter}?",
]


def ensure_user(db: Session, username: str, name: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user:
        return user

    user = User(
        username=username,
        name=name,
        bio=f"{name} account for chat demo data.",
        password_hash=hash_password(password),
        profile_picture_url=None,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def get_direct_chat(db: Session, user_a: int, user_b: int) -> Chat | None:
    candidate_ids = (
        db.query(Chat.id)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(Chat.is_group.is_(False), ChatMember.user_id.in_([user_a, user_b]))
        .group_by(Chat.id)
        .having(func.count(ChatMember.user_id) == 2)
        .all()
    )
    if not candidate_ids:
        return None
    ids = [item[0] for item in candidate_ids]
    return db.query(Chat).filter(Chat.id.in_(ids)).order_by(Chat.id.asc()).first()


def ensure_direct_chat(db: Session, user_a: User, user_b: User) -> Chat:
    chat = get_direct_chat(db, user_a.id, user_b.id)
    if chat:
        return chat

    chat = Chat(is_group=False, title=None)
    db.add(chat)
    db.flush()
    db.add(ChatMember(chat_id=chat.id, user_id=user_a.id))
    db.add(ChatMember(chat_id=chat.id, user_id=user_b.id))
    db.flush()
    return chat


def ensure_seed_messages(db: Session, chat: Chat, from_user: User, to_user: User, idx: int) -> None:
    existing = db.query(Message).filter(Message.chat_id == chat.id, Message.sender_id == from_user.id).first()
    if existing:
        return

    base_time = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 8), hours=random.randint(0, 22))
    subject = SUBJECTS[idx % len(SUBJECTS)]
    chapter = (idx % 18) + 1

    msg_1 = Message(
        chat_id=chat.id,
        sender_id=from_user.id,
        text=QUESTION_TEMPLATES[idx % len(QUESTION_TEMPLATES)].format(subject=subject, chapter=chapter),
        created_at=base_time,
    )
    db.add(msg_1)

    if idx % 3 == 0:
        msg_2 = Message(
            chat_id=chat.id,
            sender_id=from_user.id,
            text=f"I tried solving it, but I still do not understand part {((idx % 4) + 1)}.",
            created_at=base_time + timedelta(minutes=4),
        )
        db.add(msg_2)

    if idx % 4 == 0:
        reply = Message(
            chat_id=chat.id,
            sender_id=to_user.id,
            text="Got it. Send me what you have tried so far, then I will guide you step-by-step.",
            created_at=base_time + timedelta(minutes=8),
        )
        db.add(reply)

    chat.updated_at = base_time + timedelta(minutes=9)
    db.add(chat)


def write_seed_reports(project_dir: Path, users: list[User], responder: User, chats: list[dict]) -> tuple[Path, Path]:
    users_csv = project_dir / "seed_users.csv"
    chats_csv = project_dir / "seed_chats_to_reply.csv"

    with users_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["user_id", "name", "username", "password"])
        for user in users:
            writer.writerow([user.id, user.name, user.username, DEFAULT_PASSWORD])

    with chats_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["chat_id", "reply_as_user", "incoming_from_user", "latest_message_preview"])
        for row in chats:
            writer.writerow([row["chat_id"], responder.username, row["from_username"], row["latest_preview"]])

    return users_csv, chats_csv


def main() -> None:
    random.seed(42)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users: list[User] = []
        for i in range(1, TOTAL_USERS + 1):
            username = f"{USERNAME_PREFIX}{i:03d}"
            name = f"{NAME_PREFIX} {i:03d}"
            user = ensure_user(db, username=username, name=name, password=DEFAULT_PASSWORD)
            users.append(user)

        db.flush()

        responder = users[0]
        chat_rows: list[dict] = []
        for idx, other in enumerate(users[1:], start=1):
            chat = ensure_direct_chat(db, responder, other)
            ensure_seed_messages(db, chat=chat, from_user=other, to_user=responder, idx=idx)
            db.flush()

            latest = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.id.desc()).first()
            latest_text = (latest.text or "").strip() if latest else ""
            if not latest_text:
                latest_text = "[attachment or empty message]"
            preview = latest_text[:80] + ("..." if len(latest_text) > 80 else "")
            chat_rows.append(
                {
                    "chat_id": chat.id,
                    "from_username": other.username,
                    "latest_preview": preview,
                }
            )

        db.commit()

        backend_dir = Path(__file__).resolve().parents[1]
        users_csv, chats_csv = write_seed_reports(backend_dir, users=users, responder=responder, chats=chat_rows)

        print(f"Seed complete: {len(users)} users created/ensured.")
        print(f"Reply-as user: {responder.username} (password: {DEFAULT_PASSWORD})")
        print(f"Direct chats prepared: {len(chat_rows)}")
        print(f"Users list: {users_csv}")
        print(f"Chats list: {chats_csv}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
