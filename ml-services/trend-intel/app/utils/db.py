"""Database utilities for PostgreSQL connection and session management."""
from typing import AsyncGenerator, Optional
import logging
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine
)
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from ..config import settings

logger = logging.getLogger(__name__)

# Global variables
engine: Optional[AsyncEngine] = None
SessionLocal: Optional[async_sessionmaker] = None


def create_async_engine_instance(
    database_url: str,
    pool_size: int = 10,
    max_overflow: int = 20,
    echo: bool = False
) -> AsyncEngine:
    """
    Create SQLAlchemy async engine with connection pooling.

    Args:
        database_url: PostgreSQL connection string
        pool_size: Size of connection pool
        max_overflow: Max overflow connections
        echo: Whether to echo SQL queries (for debugging)

    Returns:
        Configured async engine
    """
    try:
        engine = create_async_engine(
            database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,  # Validate connections before use
            pool_recycle=3600,  # Recycle connections after 1 hour
            echo=echo,
            # Use NullPool for testing if needed
            poolclass=NullPool if "test" in database_url else None,
        )

        logger.info(
            "Created async database engine",
            database_url=database_url.split("@")[1] if "@" in database_url else "unknown",
            pool_size=pool_size,
            max_overflow=max_overflow,
            echo=echo
        )

        return engine

    except Exception as e:
        logger.error(
            "Failed to create database engine",
            error=str(e),
            database_url=database_url.split("@")[1] if "@" in database_url else "unknown"
        )
        raise


def create_async_session_factory(engine: AsyncEngine) -> async_sessionmaker:
    """
    Create session factory using async_sessionmaker.

    Args:
        engine: Async engine instance

    Returns:
        Session factory
    """
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,  # Better performance for async operations
        autoflush=False,  # Manual flush control
        autocommit=False,  # Explicit transaction management
    )

    logger.info("Created async session factory")
    return session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.

    Yields:
        AsyncSession for use in endpoints
    """
    if not SessionLocal:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db(engine: AsyncEngine) -> None:
    """
    Initialize database tables if they don't exist.

    Args:
        engine: Async engine instance
    """
    try:
        # Import Base here to avoid circular imports
        from ..models.database import Base

        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database initialized successfully")

    except Exception as e:
        logger.error(
            "Failed to initialize database",
            error=str(e)
        )
        raise


async def close_db(engine: AsyncEngine) -> None:
    """
    Dispose of engine and close all connections.

    Args:
        engine: Async engine instance
    """
    try:
        await engine.dispose()
        logger.info("Database engine closed")
    except Exception as e:
        logger.error(
            "Failed to close database engine",
            error=str(e)
        )


async def check_db_health(engine: AsyncEngine) -> bool:
    """
    Execute simple query to test database connection.

    Args:
        engine: Async engine instance

    Returns:
        True if database is accessible, False otherwise
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.first()
            return row is not None

    except Exception as e:
        logger.error(
            "Database health check failed",
            error=str(e)
        )
        return False


async def execute_raw_sql(
    engine: AsyncEngine,
    sql: str,
    params: Optional[dict] = None
) -> list:
    """
    Execute raw SQL query and return results.

    Args:
        engine: Async engine instance
        sql: SQL query string
        params: Query parameters

    Returns:
        List of result rows
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text(sql), params or {})
            rows = result.fetchall()
            return [dict(row._mapping) for row in rows]

    except Exception as e:
        logger.error(
            "Failed to execute raw SQL",
            sql=sql[:100] + "..." if len(sql) > 100 else sql,
            error=str(e)
        )
        raise


async def get_database_info(engine: AsyncEngine) -> dict:
    """
    Get database connection and version information.

    Args:
        engine: Async engine instance

    Returns:
        Dictionary with database info
    """
    try:
        async with engine.begin() as conn:
            # Get PostgreSQL version
            version_result = await conn.execute(text("SELECT version()"))
            version = version_result.scalar()

            # Get connection pool info (guarded for AsyncEngine compatibility)
            pool_info = {}
            try:
                if hasattr(engine.pool, 'size'):
                    pool_info["pool_size"] = engine.pool.size()
                if hasattr(engine.pool, 'checkedout'):
                    pool_info["pool_checked_out"] = engine.pool.checkedout()
                if hasattr(engine.pool, 'checkedin'):
                    pool_info["pool_checked_in"] = engine.pool.checkedin()
                if hasattr(engine.pool, 'overflow'):
                    pool_info["pool_overflow"] = engine.pool.overflow()
            except Exception as pool_error:
                logger.warning(f"Could not get pool info: {pool_error}")
                pool_info = {"pool_info": "not available"}

            return {
                "version": version,
                "url": engine.url.render_as_string(hide_password=True),
                **pool_info,
            }

    except Exception as e:
        logger.error(
            "Failed to get database info",
            error=str(e)
        )
        return {}


class DatabaseTransaction:
    """Context manager for database transactions."""

    def __init__(self, session: AsyncSession):
        """Initialize transaction context manager."""
        self.session = session

    async def __aenter__(self) -> AsyncSession:
        """Enter transaction context."""
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit transaction context with commit or rollback."""
        try:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
        except Exception as e:
            logger.error(
                "Transaction error",
                error=str(e),
                exc_type=exc_type.__name__ if exc_type else None
            )
            await self.session.rollback()
            raise


async def setup_database() -> None:
    """Setup database connection and initialize tables."""
    global engine, SessionLocal

    try:
        # Create engine
        engine = create_async_engine_instance(
            settings.database_url,
            settings.database_pool_size,
            settings.database_max_overflow,
            echo=settings.debug
        )

        # Create session factory
        SessionLocal = create_async_session_factory(engine)

        # Initialize database
        await init_db(engine)

        # Check database health
        is_healthy = await check_db_health(engine)
        if is_healthy:
            logger.info("Database is healthy")
        else:
            logger.warning("Database health check failed")

        # Log database info
        db_info = await get_database_info(engine)
        logger.info(
            "Database connection established",
            version=db_info.get("version", "unknown"),
            pool_size=db_info.get("pool_size", 0)
        )

    except Exception as e:
        logger.error(
            "Failed to setup database",
            error=str(e)
        )
        raise


async def teardown_database() -> None:
    """Teardown database connection."""
    global engine

    if engine:
        await close_db(engine)
        engine = None
        SessionLocal = None