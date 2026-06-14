import base64
import json
from fastapi import APIRouter, HTTPException, UploadFile, status
from openai import AsyncOpenAI

from app.config import settings

router = APIRouter(tags=["nota"])
_openai = AsyncOpenAI(api_key=settings.openai_api_key)

_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/nota/upload")
async def nota_upload(file: UploadFile):
    if file.content_type not in _IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Envie uma imagem (JPEG, PNG, WEBP)")
    try:
        img_bytes = await file.read()
        b64 = base64.b64encode(img_bytes).decode()
        resp = await _openai.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extraia os dados da nota fiscal/recibo. Retorne JSON com: data (YYYY-MM-DD), descricao, valor (negativo=despesa), categoria."},
                        {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{b64}"}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
