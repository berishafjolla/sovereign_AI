from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, UserDB
from models import RegisterRequest, LoginRequest, LoginResponse, UserResponse
from auth import hash_password, verify_password, create_access_token, get_current_user
from storage import get_user_by_username, get_user_by_email, create_user, append_audit_log
from security import validate_password_strength
import storage

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    validate_password_strength(body.password)
    if get_user_by_username(db, body.username):
        raise HTTPException(400, "Username already taken")
    if get_user_by_email(db, body.email):
        raise HTTPException(400, "Email already registered")

    user = UserDB(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        organization=body.organization
    )
    user = create_user(db, user)
    storage.append_audit_log(db, "USER_REGISTER", user.id, user.id, "user", {"role": user.role})

    return UserResponse(
        id=user.id, username=user.username, email=user.email,
        role=user.role, organization=user.organization,
        is_active=user.is_active, created_at=user.created_at
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_username(db, body.username)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account deactivated")

    token = create_access_token(user.id, user.role)
    storage.append_audit_log(db, "USER_LOGIN", user.id, user.id, "user")

    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=user.id, username=user.username, email=user.email,
            role=user.role, organization=user.organization,
            is_active=user.is_active, created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: UserDB = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id, username=current_user.username,
        email=current_user.email, role=current_user.role,
        organization=current_user.organization,
        is_active=current_user.is_active, created_at=current_user.created_at
    )
