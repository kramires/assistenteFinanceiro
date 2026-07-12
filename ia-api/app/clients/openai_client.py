import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_openai = AsyncOpenAI(api_key=settings.openai_api_key)
_deepseek = (
    AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
    if settings.deepseek_api_key
    else None
)


def _deepseek_equivalente(openai_model: str) -> str:
    """Mapeia o tier OpenAI pedido pelo caller para o modelo DeepSeek."""
    if openai_model == settings.openai_model_mini:
        return settings.deepseek_model_mini
    return settings.deepseek_model


async def chat_completion(messages: list[dict], model: str | None = None) -> str:
    """Tenta DeepSeek (principal, mais barato); cai para OpenAI em caso de erro (NR-02)."""
    target_model = model or settings.openai_model

    if _deepseek is not None:
        try:
            resp = await _deepseek.chat.completions.create(
                model=_deepseek_equivalente(target_model),
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or ""
            if content:
                return content
            logger.warning("DeepSeek retornou resposta vazia; usando fallback OpenAI.")
        except Exception as exc:
            logger.warning("DeepSeek falhou (%s); usando fallback OpenAI (%s).", exc, target_model)

    resp = await _openai.chat.completions.create(
        model=target_model,
        messages=messages,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content or ""
