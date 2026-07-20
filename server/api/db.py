"""
db.py – Neon PostgreSQL connection pool and table initialisation.

Tables managed here (independent of LangGraph checkpoint tables):
  • users    – Clerk user data, synced via webhook / client call
  • sessions – One per chat thread, owned by a user
  • messages – Individual turns inside a session
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import psycopg
from psycopg_pool import AsyncConnectionPool

# ---------------------------------------------------------------------------
# Module-level pool (created once on startup, closed on shutdown)
# ---------------------------------------------------------------------------

_pool: AsyncConnectionPool | None = None


async def open_pool() -> None:
    """Open the global async connection pool. Called from the FastAPI lifespan."""
    global _pool
    db_url = os.environ.get("NEON_DATABASE_POOLING_URL") or os.environ.get("NEON_DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "Neither NEON_DATABASE_POOLING_URL nor NEON_DATABASE_URL is set."
        )

    _pool = AsyncConnectionPool(
        conninfo=db_url,
        min_size=1,
        max_size=10,
        open=False,
    )
    await _pool.open()


async def close_pool() -> None:
    """Close the global async connection pool. Called from the FastAPI lifespan."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("Connection pool is not initialised. Was open_pool() called?")
    return _pool


@asynccontextmanager
async def get_conn() -> AsyncIterator[psycopg.AsyncConnection]:
    """Async context manager that yields a connection from the pool."""
    async with get_pool().connection() as conn:
        yield conn


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------

_CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(255) PRIMARY KEY,        -- Clerk user ID  (e.g. user_2abc…)
    email       VARCHAR(255) NOT NULL UNIQUE,
    first_name  VARCHAR(255),
    last_name   VARCHAR(255),
    image_url   TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    topic       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,    -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    citations   JSONB DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
"""


async def init_db() -> None:
    """Create application tables if they don't exist yet (idempotent)."""
    async with get_conn() as conn:
        await conn.execute(_CREATE_TABLES_SQL)
        await conn.commit()
