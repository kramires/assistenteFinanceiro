from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.service import (
    create_access_token,
    get_current_user,
    hash_password,
    invalidate_user_tokens,
    verify_password,
)
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str


@router.get("/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}


@router.post("/logout")
async def logout(
    username: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await invalidate_user_tokens(username, db)
    return {"message": "Sessão encerrada"}


@router.put("/perfil")
async def alterar_senha(
    body: AlterarSenhaRequest,
    username: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT hashed_password FROM usuarios WHERE username = :u AND is_active = TRUE"),
        {"u": username},
    )
    row = result.fetchone()
    if not row or not verify_password(body.senha_atual, row.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    new_hash = hash_password(body.nova_senha)
    await db.execute(
        text("UPDATE usuarios SET hashed_password = :h WHERE username = :u"),
        {"h": new_hash, "u": username},
    )
    # Invalida todos os tokens existentes — quem tiver sessão aberta precisa refazer login
    await db.execute(
        text("UPDATE usuarios SET token_valid_from = NOW() WHERE username = :u"),
        {"u": username},
    )
    await db.commit()
    return {"message": "Senha alterada com sucesso. Faça login novamente nos outros dispositivos."}


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
