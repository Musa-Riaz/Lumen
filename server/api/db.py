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

    # Neon drops idle connections after ~5 min.
    # keepalives_idle=60  → send TCP keepalive after 60 s of silence
    # keepalives_interval=10 → retry every 10 s
    # keepalives_count=5  → give up after 5 failures
    # connect_timeout=10  → fail fast rather than hanging
    _pool = AsyncConnectionPool(
        conninfo=db_url,
        min_size=1,
        max_size=10,
        max_idle=240,           # recycle connections idle > 4 min (before Neon kills them)
        reconnect_timeout=5,    # auto-reconnect on broken connections
        kwargs={
            "keepalives": 1,
            "keepalives_idle": 60,
            "keepalives_interval": 10,
            "keepalives_count": 5,
            "connect_timeout": 10,
        },
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
    """Async context manager that yields a connection from the pool.

    Retries once if an OperationalError is raised (e.g. SSL EOF on a stale
    connection that Neon dropped) so the caller gets a fresh connection
    instead of a 500 error.
    """
    pool = get_pool()
    try:
        async with pool.connection() as conn:
            yield conn
    except psycopg.OperationalError:
        # The connection was closed by the server (SSL EOF / idle timeout).
        # Check the pool for bad connections and try once more.
        await pool.check()
        async with pool.connection() as conn:
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
