import re

from fastapi import HTTPException, status

from .config import BANNED_TERMS, MAX_LINKS_PER_MESSAGE, MAX_MESSAGE_CHARS, MAX_REPEAT_CHARS


URL_PATTERN = re.compile(r"https?://|www\.", re.IGNORECASE)


def validate_message_text(text: str) -> None:
    if not text:
        return

    if len(text) > MAX_MESSAGE_CHARS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Message exceeds {MAX_MESSAGE_CHARS} characters.",
        )

    url_count = len(URL_PATTERN.findall(text))
    if url_count > MAX_LINKS_PER_MESSAGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many links in one message (max {MAX_LINKS_PER_MESSAGE}).",
        )

    if MAX_REPEAT_CHARS > 1:
        pattern = re.compile(rf"(.)\1{{{MAX_REPEAT_CHARS},}}", re.IGNORECASE)
        if pattern.search(text):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message looks spammy due to repeated characters.",
            )

    if BANNED_TERMS:
        lowered = text.lower()
        for term in BANNED_TERMS:
            if term and term in lowered:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Message contains restricted language.",
                )
