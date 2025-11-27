"""Redis cache service for the Trend Intelligence service."""
import json
import logging
from typing import Any, Dict, List, Optional
import redis.asyncio as redis
from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import RedisError, ConnectionError

from ..config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Redis cache service with async support and connection pooling."""

    def __init__(
        self,
        redis_url: str = None,
        db: int = None,
        password: str = None,
        max_connections: int = 20
    ):
        """
        Initialize cache service.

        Args:
            redis_url: Redis connection URL
            db: Redis database number
            password: Redis password
            max_connections: Maximum connections in pool
        """
        self.redis_url = redis_url or settings.redis_url
        self.db = db or settings.redis_db
        self.password = password or settings.redis_password
        self.max_connections = max_connections

        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[Redis] = None
        self._connected = False

    async def connect(self) -> None:
        """Establish Redis connection."""
        try:
            # Create connection pool
            self._pool = ConnectionPool.from_url(
                self.redis_url,
                db=self.db,
                password=self.password,
                max_connections=self.max_connections,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                decode_responses=True
            )

            # Create Redis client
            self._client = Redis(connection_pool=self._pool)

            # Test connection
            await self._client.ping()
            self._connected = True

            logger.info(
                "Connected to Redis",
                redis_url=self.redis_url,
                db=self.db
            )

        except (ConnectionError, RedisError) as e:
            logger.error(
                "Failed to connect to Redis",
                error=str(e),
                redis_url=self.redis_url,
                db=self.db
            )
            self._connected = False
            raise

    async def disconnect(self) -> None:
        """Close Redis connection pool."""
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()
        self._connected = False

        logger.info("Disconnected from Redis")

    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        return self._connected

    async def get(self, key: str) -> Optional[str]:
        """Retrieve value from Redis."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, returning None")
            return None

        try:
            value = await self._client.get(key)
            return value
        except RedisError as e:
            logger.error(
                "Failed to get from Redis",
                key=key,
                error=str(e)
            )
            return None

    async def set(
        self,
        key: str,
        value: str,
        ttl: Optional[int] = None
    ) -> bool:
        """Store value in Redis."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, set failed")
            return False

        try:
            if ttl:
                success = await self._client.setex(key, ttl, value)
            else:
                success = await self._client.set(key, value)
            return bool(success)
        except RedisError as e:
            logger.error(
                "Failed to set in Redis",
                key=key,
                ttl=ttl,
                error=str(e)
            )
            return False

    async def setex(self, key: str, ttl: int, value: str) -> bool:
        """Store value with expiration in one operation."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, setex failed")
            return False

        try:
            success = await self._client.setex(key, ttl, value)
            return bool(success)
        except RedisError as e:
            logger.error(
                "Failed to setex in Redis",
                key=key,
                ttl=ttl,
                error=str(e)
            )
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from Redis."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, delete failed")
            return False

        try:
            result = await self._client.delete(key)
            return result > 0
        except RedisError as e:
            logger.error(
                "Failed to delete from Redis",
                key=key,
                error=str(e)
            )
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis."""
        if not self._client or not self._connected:
            return False

        try:
            result = await self._client.exists(key)
            return result > 0
        except RedisError as e:
            logger.error(
                "Failed to check exists in Redis",
                key=key,
                error=str(e)
            )
            return False

    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment counter atomically."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, increment failed")
            return 0

        try:
            value = await self._client.incrby(key, amount)
            return value
        except RedisError as e:
            logger.error(
                "Failed to increment in Redis",
                key=key,
                amount=amount,
                error=str(e)
            )
            return 0

    async def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve and deserialize JSON value."""
        value = await self.get(key)
        if value is None:
            return None

        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.error(
                "Failed to decode JSON from Redis",
                key=key,
                error=str(e)
            )
            return None

    async def set_json(
        self,
        key: str,
        value: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Serialize and store JSON value."""
        try:
            json_value = json.dumps(value)
            return await self.set(key, json_value, ttl)
        except (TypeError, ValueError) as e:
            logger.error(
                "Failed to encode JSON for Redis",
                key=key,
                error=str(e)
            )
            return False

    async def get_many(self, keys: List[str]) -> Dict[str, Optional[str]]:
        """Retrieve multiple keys in one operation."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, get_many failed")
            return {key: None for key in keys}

        try:
            values = await self._client.mget(keys)
            return dict(zip(keys, values))
        except RedisError as e:
            logger.error(
                "Failed to get many from Redis",
                keys=keys,
                error=str(e)
            )
            return {key: None for key in keys}

    async def set_many(
        self,
        items: Dict[str, str],
        ttl: Optional[int] = None
    ) -> bool:
        """Store multiple key-value pairs."""
        if not self._client or not self._connected:
            logger.warning("Redis not connected, set_many failed")
            return False

        try:
            # Use pipeline for atomic operations
            pipeline = self._client.pipeline()
            pipeline.mset(items)

            # Set TTL for all keys if specified
            if ttl:
                for key in items.keys():
                    pipeline.expire(key, ttl)

            await pipeline.execute()
            return True
        except RedisError as e:
            logger.error(
                "Failed to set many in Redis",
                items_count=len(items),
                ttl=ttl,
                error=str(e)
            )
            return False

    # Cache key helpers
    @staticmethod
    def build_trend_key(region: str = "current") -> str:
        """Build cache key for trends."""
        return f"trend:{region}"

    @staticmethod
    def build_classification_key(text_hash: str) -> str:
        """Build cache key for text classification."""
        return f"classify:hash:{text_hash}"

    @staticmethod
    def build_topic_key(topic_id: str) -> str:
        """Build cache key for topic."""
        return f"topic:{topic_id}"

    @staticmethod
    def build_sentiment_key(text_hash: str) -> str:
        """Build cache key for sentiment analysis."""
        return f"sentiment:hash:{text_hash}"

    @staticmethod
    def build_toxicity_key(text_hash: str) -> str:
        """Build cache key for toxicity analysis."""
        return f"toxicity:hash:{text_hash}"

    @staticmethod
    def build_geo_key(text_hash: str) -> str:
        """Build cache key for geo classification."""
        return f"geo:hash:{text_hash}"

    @staticmethod
    def build_language_key(text_hash: str) -> str:
        """Build cache key for language detection."""
        return f"language:hash:{text_hash}"

    # Health check
    async def health_check(self) -> bool:
        """Check Redis health."""
        if not self._client or not self._connected:
            return False

        try:
            await self._client.ping()
            return True
        except RedisError:
            return False

    # Pattern-based operations
    async def get_keys_by_pattern(self, pattern: str) -> List[str]:
        """Get all keys matching a pattern."""
        if not self._client or not self._connected:
            return []

        try:
            keys = await self._client.keys(pattern)
            return keys
        except RedisError as e:
            logger.error(
                "Failed to get keys by pattern",
                pattern=pattern,
                error=str(e)
            )
            return []

    async def delete_by_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        keys = await self.get_keys_by_pattern(pattern)
        if not keys:
            return 0

        try:
            result = await self._client.delete(*keys)
            return result
        except RedisError as e:
            logger.error(
                "Failed to delete by pattern",
                pattern=pattern,
                keys_count=len(keys),
                error=str(e)
            )
            return 0


# Global cache instance
cache_service = CacheService()