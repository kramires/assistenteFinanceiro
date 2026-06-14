from openai import AsyncOpenAI

from app.config import settings

_openai = AsyncOpenAI(api_key=settings.openai_api_key)


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcreve áudio via Whisper-1 (NR-03)."""
    resp = await _openai.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes),
    )
    return resp.text
