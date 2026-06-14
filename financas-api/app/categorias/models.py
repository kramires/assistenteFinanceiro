from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100), unique=True)
    tipo: Mapped[str] = mapped_column(String(20))
