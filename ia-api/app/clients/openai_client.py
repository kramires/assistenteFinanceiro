from openai import AsyncOpenAI, APIError, APITimeoutError

from app.config import settings

_openai = AsyncOpenAI(api_key=settings.openai_api_key)
_deepseek = (
    AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    if settings.deepseek_api_key
    else None
)


async def chat_completion(messages: list[dict], model: str | None = None) -> str:
    """Tenta OpenAI; cai para DeepSeek em caso de erro (NR-02)."""
    target_model = model or settings.openai_model
    try:
        resp = await _openai.chat.completions.create(
            model=target_model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or ""
    except (APIError, APITimeoutError, Exception):
        if _deepseek is None:
            raise
        resp = await _deepseek.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or ""
