from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.extrato.service import processar_extrato

router = APIRouter(prefix="/extrato", tags=["extrato"])


class UploadResponse(BaseModel):
    message: str


@router.post("/upload", response_model=UploadResponse)
async def upload_extrato(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apenas arquivos .CSV são aceitos.")

    raw = await file.read()
    try:
        msg = await processar_extrato(raw, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return UploadResponse(message=msg)
