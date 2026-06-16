from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "iat": now, "exp": expire},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        username: str | None = payload.get("sub")
        iat: float | None = payload.get("iat")
        if not username:
            raise ValueError
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verifica se o token foi emitido depois da última invalidação (logout / troca de senha)
    if iat is not None:
        result = await db.execute(
            text("SELECT token_valid_from FROM usuarios WHERE username = :u AND is_active = TRUE"),
            {"u": username},
        )
        row = result.fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
        token_issued_at = datetime.fromtimestamp(iat, tz=timezone.utc)
        if token_issued_at < row.token_valid_from:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão encerrada. Faça login novamente.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return username


async def invalidate_user_tokens(username: str, db: AsyncSession) -> None:
    """Define token_valid_from = NOW(), invalidando todos os tokens anteriores."""
    await db.execute(
        text("UPDATE usuarios SET token_valid_from = NOW() WHERE username = :u"),
        {"u": username},
    )
    await db.commit()
