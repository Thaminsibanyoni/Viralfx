"""Trends router for querying and managing viral trends."""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_
from sqlalchemy.orm import joinedload

from ..models.schemas import (
    TrendTopic as TrendTopicSchema, TrendResponse, TopicHistory as TopicHistorySchema,
    ErrorResponse, ProcessingStats
)
from ..models.database import TrendTopic as TrendTopicORM, TrendHistory as TrendHistoryORM
from ..utils.cache import cache_service
from ..utils.db import get_db_session
from ..config import settings
from ..utils.metrics import track_request_metrics, track_database_operation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Trends"])


@router.get("/current", response_model=TrendResponse, status_code=status.HTTP_200_OK)
async def get_current_trends(
    limit: int = Query(default=20, ge=1, le=100, description="Number of trends to return"),
    min_virality_score: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=100.0,
        description="Minimum virality score"
    ),
    categories: Optional[List[str]] = Query(
        default=None,
        description="Filter by categories"
    ),
    db: AsyncSession = Depends(get_db_session)
) -> TrendResponse:
    """
    Get current trending topics.

    Args:
        limit: Number of trends to return
        min_virality_score: Filter by minimum virality score
        categories: Filter by categories
        db: Database session

    Returns:
        TrendResponse with current trends

    Raises:
        HTTPException: If query fails
    """
    start_time = datetime.utcnow()

    try:
        # Check cache first
        cache_key = cache_service.build_trend_key("current")
        if not min_virality_score and not categories:
            cached_trends = await cache_service.get_json(cache_key)
            if cached_trends:
                logger.info("Returning cached current trends")
                return TrendResponse(**cached_trends)

        # Build query
        query = select(TrendTopicORM)

        # Apply filters
        filters = []
        if min_virality_score is not None:
            filters.append(TrendTopicORM.virality_score >= min_virality_score)

        if categories:
            # Filter by categories - using JSON operator
            for category in categories:
                filters.append(TrendTopicORM.categories.contains([category]))

        if filters:
            query = query.where(and_(*filters))

        # Order by virality score and created_at
        query = query.order_by(
            desc(TrendTopicORM.virality_score),
            desc(TrendTopicORM.created_at)
        ).limit(limit)

        # Execute query
        result = await db.execute(query)
        topics = result.scalars().all()

        # Convert to response format
        trend_list = []
        for topic in topics:
            trend_list.append(TrendTopicModelSchema(
                id=str(topic.id),
                title=topic.title,
                summary=topic.summary,
                platforms=topic.platforms,
                categories=topic.categories,
                sentiment=topic.sentiment,
                toxicity=topic.toxicity,
                virality_score=topic.virality_score,
                velocity=topic.velocity,
                engagement=topic.engagement,
                region=topic.region,
                created_at=topic.created_at,
                updated_at=topic.updated_at,
                post_count=None  # Would need separate query
            ))

        # Create response
        response = TrendResponse(
            trends=trend_list,
            total=len(trend_list),
            region=None,
            timeframe="24h",
            generated_at=start_time,
            cache_hit=False
        )

        # Cache result if no filters
        if not min_virality_score and not categories:
            await cache_service.set_json(
                cache_key,
                response.model_dump(mode="json"),
                ttl=settings.cache_ttl_trends
            )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/trends/current", 200, duration)
        track_database_operation("select", "trend_topics", duration)

        return response

    except Exception as e:
        logger.error(f"Failed to get current trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trends: {str(e)}"
        )


@router.get("/{region}", response_model=TrendResponse, status_code=status.HTTP_200_OK)
async def get_regional_trends(
    region: str,
    limit: int = Query(default=20, ge=1, le=100, description="Number of trends to return"),
    min_virality_score: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=100.0,
        description="Minimum virality score"
    ),
    categories: Optional[List[str]] = Query(
        default=None,
        description="Filter by categories"
    ),
    timeframe: str = Query(
        default="24h",
        regex="^(1h|6h|24h|7d|30d)$",
        description="Timeframe for trends"
    ),
    db: AsyncSession = Depends(get_db_session)
) -> TrendResponse:
    """
    Get trending topics for specific SA region.

    Args:
        region: SA region code (GP, WC, KZN, EC, FS, MP, NW, NC, LP)
        limit: Number of trends to return
        min_virality_score: Filter by minimum virality score
        categories: Filter by categories
        timeframe: Timeframe for trends
        db: Database session

    Returns:
        TrendResponse with regional trends

    Raises:
        HTTPException: If query fails or invalid region
    """
    start_time = datetime.utcnow()

    try:
        # Validate region
        valid_regions = ["GP", "WC", "KZN", "EC", "FS", "MP", "NW", "NC", "LP", "ZA"]
        if region not in valid_regions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid region. Valid regions: {', '.join(valid_regions)}"
            )

        # Check cache first
        cache_key = cache_service.build_trend_key(f"region:{region}")
        if not min_virality_score and not categories and timeframe == "24h":
            cached_trends = await cache_service.get_json(cache_key)
            if cached_trends:
                logger.info(f"Returning cached trends for region: {region}")
                return TrendResponse(**cached_trends)

        # Calculate time filter
        time_delta = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }.get(timeframe, timedelta(hours=24))

        cutoff_time = start_time - time_delta

        # Build query
        query = select(TrendTopicORM).where(TrendTopicORM.created_at >= cutoff_time)

        # Add region filter
        if region != "ZA":
            query = query.where(TrendTopicORM.region == region)

        # Apply other filters
        filters = []
        if min_virality_score is not None:
            filters.append(TrendTopicORM.virality_score >= min_virality_score)

        if categories:
            for category in categories:
                filters.append(TrendTopicORM.categories.contains([category]))

        if filters:
            query = query.where(and_(*filters))

        # Order and limit
        query = query.order_by(
            desc(TrendTopicORM.virality_score),
            desc(TrendTopicORM.created_at)
        ).limit(limit)

        # Execute query
        result = await db.execute(query)
        topics = result.scalars().all()

        # Convert to response format
        trend_list = []
        for topic in topics:
            trend_list.append(TrendTopicModelSchema(
                id=str(topic.id),
                title=topic.title,
                summary=topic.summary,
                platforms=topic.platforms,
                categories=topic.categories,
                sentiment=topic.sentiment,
                toxicity=topic.toxicity,
                virality_score=topic.virality_score,
                velocity=topic.velocity,
                engagement=topic.engagement,
                region=topic.region,
                created_at=topic.created_at,
                updated_at=topic.updated_at
            ))

        # Create response
        response = TrendResponse(
            trends=trend_list,
            total=len(trend_list),
            region=region,
            timeframe=timeframe,
            generated_at=start_time,
            cache_hit=False
        )

        # Cache result
        if not min_virality_score and not categories and timeframe == "24h":
            await cache_service.set_json(
                cache_key,
                response.model_dump(mode="json"),
                ttl=settings.cache_ttl_trends
            )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", f"/trends/{region}", 200, duration)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get regional trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trends: {str(e)}"
        )


@router.get("/topic/{topic_id}", response_model=TrendTopicModelSchema, status_code=status.HTTP_200_OK)
async def get_topic_details(
    topic_id: str,
    include_history: bool = Query(default=False, description="Include historical data"),
    db: AsyncSession = Depends(get_db_session)
) -> TrendTopicModelSchema:
    """
    Get detailed information for specific topic.

    Args:
        topic_id: Topic ID (UUID)
        include_history: Whether to include historical data
        db: Database session

    Returns:
        TrendTopicModel with detailed information

    Raises:
        HTTPException: If topic not found or query fails
    """
    start_time = datetime.utcnow()

    try:
        # Check cache first
        cache_key = cache_service.build_topic_key(topic_id)
        if not include_history:
            cached_topic = await cache_service.get_json(cache_key)
            if cached_topic:
                logger.info(f"Returning cached topic: {topic_id}")
                return TrendTopicModelSchema(**cached_topic)

        # Query topic
        query = select(TrendTopicORM).where(TrendTopicORM.id == topic_id)
        result = await db.execute(query)
        topic = result.scalar_one_or_none()

        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Topic not found: {topic_id}"
            )

        # Get historical data if requested
        history = []
        if include_history:
            history_query = select(TrendHistoryORM).where(
                TrendHistoryORM.topic_id == topic_id
            ).order_by(desc(TrendHistoryORM.timestamp)).limit(100)

            history_result = await db.execute(history_query)
            history_records = history_result.scalars().all()

            for record in history_records:
                history.append(TopicHistorySchema(
                    timestamp=record.timestamp,
                    virality_score=record.virality_score,
                    engagement=record.engagement,
                    velocity=record.velocity,
                    sentiment=record.sentiment
                ))

        # Create response
        response = TrendTopicModelSchema(
            id=str(topic.id),
            title=topic.title,
            summary=topic.summary,
            platforms=topic.platforms,
            categories=topic.categories,
            sentiment=topic.sentiment,
            toxicity=topic.toxicity,
            virality_score=topic.virality_score,
            velocity=topic.velocity,
            engagement=topic.engagement,
            region=topic.region,
            created_at=topic.created_at,
            updated_at=topic.updated_at,
            post_count=len(history)  # Approximate post count
        )

        # Cache result
        if not include_history:
            await cache_service.set_json(
                cache_key,
                response.model_dump(mode="json"),
                ttl=settings.cache_ttl_topics
            )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", f"/trends/topic/{topic_id}", 200, duration)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topic details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get topic: {str(e)}"
        )


@router.get("/topic/{topic_id}/history", response_model=List[TopicHistorySchema], status_code=status.HTTP_200_OK)
async def get_topic_history(
    topic_id: str,
    timeframe: str = Query(
        default="24h",
        regex="^(1h|6h|24h|7d|30d)$",
        description="Timeframe for history"
    ),
    interval: str = Query(
        default="5m",
        regex="^(5m|15m|1h|1d)$",
        description="Data interval"
    ),
    db: AsyncSession = Depends(get_db_session)
) -> List[TopicHistorySchema]:
    """
    Get historical virality data for topic.

    Args:
        topic_id: Topic ID (UUID)
        timeframe: Timeframe for history
        interval: Data interval
        db: Database session

    Returns:
        List of TopicHistory records

    Raises:
        HTTPException: If topic not found or query fails
    """
    start_time = datetime.utcnow()

    try:
        # Verify topic exists
        topic_query = select(TrendTopicORM).where(TrendTopicORM.id == topic_id)
        topic_result = await db.execute(topic_query)
        topic = topic_result.scalar_one_or_none()

        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Topic not found: {topic_id}"
            )

        # Calculate time filter
        time_delta = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }.get(timeframe, timedelta(hours=24))

        cutoff_time = start_time - time_delta

        # Query historical data
        query = select(TrendHistoryORM).where(
            and_(
                TrendHistoryORM.topic_id == topic_id,
                TrendHistoryORM.timestamp >= cutoff_time
            )
        ).order_by(desc(TrendHistoryORM.timestamp))

        result = await db.execute(query)
        history_records = result.scalars().all()

        # Convert to response format
        history = []
        for record in history_records:
            history.append(TopicHistorySchema(
                timestamp=record.timestamp,
                virality_score=record.virality_score,
                engagement=record.engagement,
                velocity=record.velocity,
                sentiment=record.sentiment
            ))

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", f"/trends/topic/{topic_id}/history", 200, duration)

        return history

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topic history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history: {str(e)}"
        )


@router.get("/search", response_model=TrendResponse, status_code=status.HTTP_200_OK)
async def search_topics(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of results"),
    region: Optional[str] = Query(default=None, description="Filter by region"),
    categories: Optional[List[str]] = Query(default=None, description="Filter by categories"),
    db: AsyncSession = Depends(get_db_session)
) -> TrendResponse:
    """
    Search for topics by keyword.

    Args:
        q: Search query string
        limit: Number of results to return
        region: Filter by region
        categories: Filter by categories
        db: Database session

    Returns:
        TrendResponse with search results

    Raises:
        HTTPException: If search fails
    """
    start_time = datetime.utcnow()

    try:
        # Build search query
        query = select(TrendTopicORM).where(
            or_(
                TrendTopicORM.title.ilike(f"%{q}%"),
                TrendTopicORM.summary.ilike(f"%{q}%")
            )
        )

        # Apply additional filters
        if region:
            query = query.where(TrendTopicORM.region == region)

        if categories:
            filters = []
            for category in categories:
                filters.append(TrendTopicORM.categories.contains([category]))
            if filters:
                query = query.where(or_(*filters))

        # Order by relevance and virality
        query = query.order_by(
            desc(TrendTopicORM.virality_score),
            desc(TrendTopicORM.created_at)
        ).limit(limit)

        # Execute query
        result = await db.execute(query)
        topics = result.scalars().all()

        # Convert to response format
        trend_list = []
        for topic in topics:
            trend_list.append(TrendTopicModelSchema(
                id=str(topic.id),
                title=topic.title,
                summary=topic.summary,
                platforms=topic.platforms,
                categories=topic.categories,
                sentiment=topic.sentiment,
                toxicity=topic.toxicity,
                virality_score=topic.virality_score,
                velocity=topic.velocity,
                engagement=topic.engagement,
                region=topic.region,
                created_at=topic.created_at,
                updated_at=topic.updated_at
            ))

        # Create response
        response = TrendResponse(
            trends=trend_list,
            total=len(trend_list),
            region=region,
            timeframe="24h",
            generated_at=start_time,
            cache_hit=False
        )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/trends/search", 200, duration)

        return response

    except Exception as e:
        logger.error(f"Failed to search topics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/categories", status_code=status.HTTP_200_OK)
async def get_categories(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get list of available trend categories.

    Args:
        db: Database session

    Returns:
        Dictionary with categories and counts

    Raises:
        HTTPException: If query fails
    """
    start_time = datetime.utcnow()

    try:
        # Query distinct categories and their counts
        # This is a simplified approach - in production you'd want proper JSON aggregation
        query = select(TrendTopicORM.categories, func.count(TrendTopicORM.id)).group_by(TrendTopicORM.categories)
        result = await db.execute(query)
        records = result.all()

        # Aggregate categories
        category_counts = {}
        for categories, count in records:
            if categories:
                for category in categories:
                    category_counts[category] = category_counts.get(category, 0) + count

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/trends/categories", 200, duration)

        return {
            "categories": category_counts,
            "total_categories": len(category_counts),
            "generated_at": start_time.isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}"
        )


@router.get("/platforms", response_model=TrendResponse, status_code=status.HTTP_200_OK)
async def get_platform_trends(
    platform: str = Query(..., description="Platform name"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of trends"),
    db: AsyncSession = Depends(get_db_session)
) -> TrendResponse:
    """
    Get trending topics by platform.

    Args:
        platform: Social media platform
        limit: Number of trends to return
        db: Database session

    Returns:
        TrendResponse with platform-specific trends

    Raises:
        HTTPException: If query fails
    """
    start_time = datetime.utcnow()

    try:
        # Build query
        query = select(TrendTopicORM).where(
            TrendTopicORM.platforms.contains([platform])
        ).order_by(
            desc(TrendTopicORM.virality_score),
            desc(TrendTopicORM.created_at)
        ).limit(limit)

        # Execute query
        result = await db.execute(query)
        topics = result.scalars().all()

        # Convert to response format
        trend_list = []
        for topic in topics:
            trend_list.append(TrendTopicModelSchema(
                id=str(topic.id),
                title=topic.title,
                summary=topic.summary,
                platforms=topic.platforms,
                categories=topic.categories,
                sentiment=topic.sentiment,
                toxicity=topic.toxicity,
                virality_score=topic.virality_score,
                velocity=topic.velocity,
                engagement=topic.engagement,
                region=topic.region,
                created_at=topic.created_at,
                updated_at=topic.updated_at
            ))

        # Create response
        response = TrendResponse(
            trends=trend_list,
            total=len(trend_list),
            region=None,
            timeframe="24h",
            generated_at=start_time,
            cache_hit=False
        )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/trends/platforms", 200, duration)

        return response

    except Exception as e:
        logger.error(f"Failed to get platform trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get platform trends: {str(e)}"
        )