from fastapi import APIRouter, HTTPException, UploadFile, status

from app.clients.whisper_client import transcribe
from app.lancar_texto.service import extrair_lancamento

router = APIRouter(tags=["lancar-audio"])

_AUDIO_TYPES = {"audio/webm", "audio/wav", "audio/mpeg", "audio/ogg", "audio/mp4"}


@router.post("/lancar-audio")
async def lancar_audio(file: UploadFile):
    if file.content_type not in _AUDIO_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Formato de áudio inválido")
    try:
        audio_bytes = await file.read()
        texto = await transcribe(audio_bytes, filename=file.filename or "audio.webm")
        return await extrair_lancamento(texto, categorias=[])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
