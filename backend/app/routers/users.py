from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import User
from ..schemas import UserPublic, UserUpdate
from ..storage import save_profile_picture


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserPublic)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() if payload.bio else None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/profile-picture", response_model=UserPublic)
def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename, _ = save_profile_picture(file)
    current_user.profile_picture_url = f"/uploads/profile_pics/{filename}"
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/search", response_model=list[UserPublic])
def search_users(
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q_clean = q.strip().lower()
    query = db.query(User).filter(User.is_active.is_(True), User.id != current_user.id)
    if q_clean:
        like = f"%{q_clean}%"
        query = query.filter(or_(User.username.ilike(like), User.name.ilike(like)))
    users = query.order_by(User.username.asc()).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user

