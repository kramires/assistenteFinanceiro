from typing import Optional

import httpx

from app.config import settings


async def categorizar_via_ia(descricao: str, categorias: list[str]) -> Optional[str]:
    """Call ia-api /ia/categorizar. Returns category name or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ia_api_url}/ia/categorizar",
                json={"descricao": descricao, "categorias": categorias},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("categoria") or None
    except Exception:
        return None
