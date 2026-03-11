import os
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", str(PROJECT_DIR / "frontend")))
UPLOADS_DIR = BACKEND_DIR / "uploads"
PROFILE_PIC_DIR = UPLOADS_DIR / "profile_pics"
MESSAGE_FILE_DIR = UPLOADS_DIR / "messages"

PROFILE_PIC_DIR.mkdir(parents=True, exist_ok=True)
MESSAGE_FILE_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_MESSAGE_CHARS = int(os.getenv("MAX_MESSAGE_CHARS", "2000"))
MAX_LINKS_PER_MESSAGE = int(os.getenv("MAX_LINKS_PER_MESSAGE", "4"))
MAX_REPEAT_CHARS = int(os.getenv("MAX_REPEAT_CHARS", "14"))

MESSAGE_RATE_LIMIT_COUNT = int(os.getenv("MESSAGE_RATE_LIMIT_COUNT", "40"))
MESSAGE_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("MESSAGE_RATE_LIMIT_WINDOW_SECONDS", "60"))
FILE_RATE_LIMIT_COUNT = int(os.getenv("FILE_RATE_LIMIT_COUNT", "15"))
FILE_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("FILE_RATE_LIMIT_WINDOW_SECONDS", "60"))

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

DEFAULT_SQLITE = f"sqlite:///{(BACKEND_DIR / 'chat_app.db').as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE)

ALLOWED_MESSAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".csv",
}

ALLOWED_PROFILE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

BANNED_TERMS = {
    term.strip().lower()
    for term in os.getenv("BANNED_TERMS", "").split(",")
    if term.strip()
}
