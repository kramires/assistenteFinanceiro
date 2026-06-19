from fastapi import FastAPI

from app.lancar_texto.router import router as lancar_texto_router
from app.lancar_audio.router import router as lancar_audio_router
from app.categorizar.router import router as categorizar_router
from app.resumo_narrativo.router import router as resumo_router
from app.nota.router import router as nota_router
from app.extrair_fatura.router import router as extrair_fatura_router
from app.analise_financeira.router import router as analise_router

app = FastAPI(title="ia-api", version="2.0.0")

app.include_router(lancar_texto_router, prefix="/ia")
app.include_router(lancar_audio_router, prefix="/ia")
app.include_router(categorizar_router, prefix="/ia")
app.include_router(resumo_router, prefix="/ia")
app.include_router(nota_router, prefix="/ia")
app.include_router(extrair_fatura_router, prefix="/ia")
app.include_router(analise_router, prefix="/ia")


@app.get("/health")
async def health():
    return {"status": "ok"}
