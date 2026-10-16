from openai import AsyncOpenAI

from app.config import settings

_openai = AsyncOpenAI(api_key=settings.openai_api_key)


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcreve áudio via OpenAI (NR-03); modelo em OPENAI_TRANSCRIBE_MODEL."""
    resp = await _openai.audio.transcriptions.create(
        model=settings.openai_transcribe_model,
        file=(filename, audio_bytes),
        language="pt",
    )
    return resp.text
