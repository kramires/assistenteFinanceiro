from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth.router import router as auth_router
from app.categorias.router import router as categorias_router
from app.transacoes.router import router as transacoes_router
from app.orcamentos.router import router as orcamentos_router
from app.dashboard.router import router as dashboard_router
from app.transporte.router import router as transporte_router
from app.extrato.router import router as extrato_router
from app.ia_proxy.router import router as ia_proxy_router

app = FastAPI(title="financas-api", version="2.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PREFIX = "/api"
app.include_router(auth_router, prefix=_PREFIX)
app.include_router(categorias_router, prefix=_PREFIX)
app.include_router(transacoes_router, prefix=_PREFIX)
app.include_router(orcamentos_router, prefix=_PREFIX)
app.include_router(dashboard_router, prefix=_PREFIX)
app.include_router(transporte_router, prefix=_PREFIX)
app.include_router(extrato_router, prefix=_PREFIX)
app.include_router(ia_proxy_router, prefix=_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}
