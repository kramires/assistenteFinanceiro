from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.service import create_access_token, verify_password
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT username, hashed_password FROM usuarios WHERE username = :u AND is_active = TRUE"),
        {"u": body.username},
    )
    row = result.fetchone()
    if not row or not verify_password(body.password, row.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    return TokenResponse(access_token=create_access_token(row.username))
