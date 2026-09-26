import os
from pathlib import Path

from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def _database_url() -> str:
    """Return the configured persistent database URL.

    SQLite remains available for local development. Render must receive a
    PostgreSQL DATABASE_URL (the Supabase transaction-pooler URL is suitable).
    """
    value = os.getenv("DATABASE_URL", "sqlite:///./process_engineering_workbench.db")
    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://") :]
    if value.startswith("postgresql://"):
        value = "postgresql+psycopg://" + value[len("postgresql://") :]
    return value


DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=not IS_SQLITE,
    pool_recycle=300 if not IS_SQLITE else -1,
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
