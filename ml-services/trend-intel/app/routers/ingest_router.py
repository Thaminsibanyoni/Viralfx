"""Ingestion router for triggering data collection and processing."""
import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, desc

from ..models.schemas import (
    IngestRequest, IngestStatus, ProcessIngestRequest,
    ClusterPostsRequest, ProcessingStats, ErrorResponse
)
from ..models.database import TrendTopic, TrendHistory, IngestEvent
from ..services.text_cleaner import TextCleaner
from ..services.language_detector import LanguageDetector
from ..services.sentiment_analyzer import SentimentAnalyzer
from ..services.toxicity_filter import ToxicityFilter
from ..services.geo_classifier import GeoClassifier
from ..services.topic_cluster import TopicCluster
from ..services.virality_score import ViralityScorer
from ..utils.cache import cache_service
from ..utils.db import get_db_session
from ..utils.metrics import (
    track_ingestion_metrics, track_request_metrics,
    track_topic_creation, track_virality_score
)
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Ingestion"])

# Global service instances
text_cleaner = TextCleaner()
language_detector = LanguageDetector()
sentiment_analyzer = SentimentAnalyzer()
toxicity_filter = ToxicityFilter()
geo_classifier = GeoClassifier()
topic_cluster = TopicCluster()
virality_scorer = ViralityScorer()


def get_text_cleaner() -> TextCleaner:
    """Get text cleaner service."""
    return text_cleaner


def get_language_detector() -> LanguageDetector:
    """Get language detector service."""
    return language_detector


def get_sentiment_analyzer() -> SentimentAnalyzer:
    """Get sentiment analyzer service."""
    return sentiment_analyzer


def get_toxicity_filter() -> ToxicityFilter:
    """Get toxicity filter service."""
    return toxicity_filter


def get_geo_classifier() -> GeoClassifier:
    """Get geo classifier service."""
    return geo_classifier


def get_topic_cluster() -> TopicCluster:
    """Get topic cluster service."""
    return topic_cluster


def get_virality_scorer() -> ViralityScorer:
    """Get virality scorer service."""
    return virality_scorer


@router.post("/", response_model=IngestStatus, status_code=status.HTTP_200_OK)
async def trigger_ingestion(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
) -> IngestStatus:
    """
    Manually trigger ingestion from social media platforms.

    Args:
        request: Ingestion request parameters
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        IngestStatus with operation results

    Raises:
        HTTPException: If ingestion fails
    """
    start_time = datetime.utcnow()

    try:
        # Validate platform
        valid_platforms = ["twitter", "tiktok", "instagram", "youtube", "facebook"]
        if request.platform not in valid_platforms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid platform. Valid platforms: {', '.join(valid_platforms)}"
            )

        # Query IngestEvent table for unprocessed posts
        # Note: This processes posts that have already been collected by backend connectors
        query = select(IngestEvent).where(
            and_(
                IngestEvent.platform == request.platform.upper(),
                IngestEvent.processed == False
            )
        ).order_by(desc(IngestEvent.ingestedAt)).limit(request.limit)

        result = await db.execute(query)
        posts = result.scalars().all()

        if not posts:
            return IngestStatus(
                platform=request.platform,
                collected=0,
                processed=0,
                failed=0,
                duration_seconds=0.0,
                timestamp=start_time
            )

        # Process posts in background with full pipeline (analysis + clustering)
        background_tasks.add_task(
            process_and_cluster_posts_background,
            [post.__dict__ for post in posts]
        )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("POST", "/ingest", 200, duration)

        return IngestStatus(
            platform=request.platform,
            collected=len(posts),
            processed=0,  # Will be updated by background task
            failed=0,
            duration_seconds=0.0,
            timestamp=start_time,
            errors=[f"Started processing {len(posts)} posts in background"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger ingestion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )


@router.post("/process", response_model=ProcessingStats, status_code=status.HTTP_200_OK)
async def process_ingested_posts(
    request: ProcessIngestRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
) -> ProcessingStats:
    """
    Process existing IngestEvents that haven't been analyzed.

    Args:
        request: Processing request parameters
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        ProcessingStats with processing statistics

    Raises:
        HTTPException: If processing fails
    """
    start_time = datetime.utcnow()

    try:
        # Query unprocessed posts
        query = select(IngestEvent).where(IngestEvent.processed == False)

        if request.platform:
            query = query.where(IngestEvent.platform == request.platform.upper())

        query = query.order_by(desc(IngestEvent.ingestedAt)).limit(request.limit)

        result = await db.execute(query)
        posts = result.scalars().all()

        if not posts:
            return ProcessingStats(
                batch_size=request.limit,
                processed_count=0,
                failed_count=0,
                topics_created=0,
                duration_ms=0.0,
                success_rate=1.0
            )

        # Process posts in background
        background_tasks.add_task(
            process_and_cluster_posts_background,
            [post.__dict__ for post in posts]
        )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds() * 1000
        track_request_metrics("POST", "/ingest/process", 200, duration / 1000)

        return ProcessingStats(
            batch_size=len(posts),
            processed_count=0,  # Will be updated by background task
            failed_count=0,
            topics_created=0,
            duration_ms=0.0,
            success_rate=1.0
        )

    except Exception as e:
        logger.error(f"Failed to process posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


@router.post("/cluster", status_code=status.HTTP_200_OK)
async def cluster_recent_posts(
    request: ClusterPostsRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Cluster recent posts into topics.

    Args:
        request: Clustering request parameters
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Dictionary with clustering results

    Raises:
        HTTPException: If clustering fails
    """
    start_time = datetime.utcnow()

    try:
        # Calculate time filter
        time_delta = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24)
        }.get(request.timeframe, timedelta(hours=1))

        cutoff_time = start_time - time_delta

        # Query recent posts
        query = select(IngestEvent).where(
            and_(
                IngestEvent.ingestedAt >= cutoff_time,
                IngestEvent.processed == True  # Only process already analyzed posts
            )
        )

        if request.platform:
            query = query.where(IngestEvent.platform == request.platform.upper())

        result = await db.execute(query)
        posts = result.scalars().all()

        if not posts:
            return {
                "message": "No recent posts found for clustering",
                "posts_count": 0,
                "topics_created": 0
            }

        # Cluster posts in background
        background_tasks.add_task(
            cluster_posts_background,
            [post.__dict__ for post in posts],
            request.min_cluster_size
        )

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("POST", "/ingest/cluster", 200, duration)

        return {
            "message": f"Started clustering {len(posts)} posts",
            "posts_count": len(posts),
            "timeframe": request.timeframe,
            "min_cluster_size": request.min_cluster_size
        }

    except Exception as e:
        logger.error(f"Failed to cluster posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clustering failed: {str(e)}"
        )


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_ingestion_status(
    platform: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get ingestion status and statistics.

    Args:
        platform: Optional platform filter
        db: Database session

    Returns:
        Dictionary with ingestion statistics

    Raises:
        HTTPException: If query fails
    """
    start_time = datetime.utcnow()

    try:
        # Build base query
        base_query = select(IngestEvent)
        if platform:
            base_query = base_query.where(IngestEvent.platform == platform.upper())

        # Total posts ingested
        total_query = select(func.count(IngestEvent.id))
        if platform:
            total_query = total_query.where(IngestEvent.platform == platform.upper())
        total_result = await db.execute(total_query)
        total_posts = total_result.scalar() or 0

        # Posts processed
        processed_query = select(func.count(IngestEvent.id)).where(IngestEvent.processed == True)
        if platform:
            processed_query = processed_query.where(IngestEvent.platform == platform.upper())
        processed_result = await db.execute(processed_query)
        processed_posts = processed_result.scalar() or 0

        # Posts pending
        pending_posts = total_posts - processed_posts

        # Topics created
        topics_query = select(func.count(TrendTopic.id))
        if platform:
            # This is simplified - would need proper JSON query for platforms
            pass
        topics_result = await db.execute(topics_query)
        topics_created = topics_result.scalar() or 0

        # Last ingestion timestamp
        last_ingest_query = select(func.max(IngestEvent.ingestedAt))
        if platform:
            last_ingest_query = last_ingest_query.where(IngestEvent.platform == platform.upper())
        last_ingest_result = await db.execute(last_ingest_query)
        last_ingestion = last_ingest_result.scalar()

        # Platform breakdown
        platform_query = select(
            IngestEvent.platform,
            func.count(IngestEvent.id).label('count'),
            func.sum(func.case([(IngestEvent.processed == True, 1)], else_=0)).label('processed')
        ).group_by(IngestEvent.platform)

        if platform:
            platform_query = platform_query.where(IngestEvent.platform == platform.upper())

        platform_result = await db.execute(platform_query)
        platform_stats = {}
        for row in platform_result:
            platform_stats[row.platform] = {
                "total": row.count,
                "processed": row.processed or 0,
                "pending": row.count - (row.processed or 0)
            }

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/ingest/status", 200, duration)

        return {
            "total_posts": total_posts,
            "processed_posts": processed_posts,
            "pending_posts": pending_posts,
            "topics_created": topics_created,
            "processing_rate": processed_posts / max(total_posts, 1),
            "last_ingestion": last_ingestion.isoformat() if last_ingestion else None,
            "platform_stats": platform_stats,
            "timestamp": start_time.isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get ingestion status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get status: {str(e)}"
        )


@router.get("/stats", status_code=status.HTTP_200_OK)
async def get_ingestion_stats(
    timeframe: str = "24h",
    platform: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get detailed ingestion statistics.

    Args:
        timeframe: Timeframe for stats (1h, 6h, 24h, 7d, 30d)
        platform: Optional platform filter
        db: Database session

    Returns:
        Dictionary with detailed statistics

    Raises:
        HTTPException: If query fails
    """
    start_time = datetime.utcnow()

    try:
        # Calculate time filter
        time_delta = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }.get(timeframe, timedelta(hours=24))

        cutoff_time = start_time - time_delta

        # Build base query with time filter
        base_query = select(IngestEvent).where(IngestEvent.ingestedAt >= cutoff_time)
        if platform:
            base_query = base_query.where(IngestEvent.platform == platform.upper())

        # Posts by platform in timeframe
        platform_query = select(
            IngestEvent.platform,
            func.count(IngestEvent.id).label('count')
        ).where(IngestEvent.ingestedAt >= cutoff_time)

        if platform:
            platform_query = platform_query.where(IngestEvent.platform == platform.upper())

        platform_query = platform_query.group_by(IngestEvent.platform)
        platform_result = await db.execute(platform_query)
        posts_by_platform = {row.platform: row.count for row in platform_result}

        # Average sentiment and toxicity (would need joins with processed data)
        # This is simplified - in production you'd track these metrics during processing
        avg_sentiment = 0.1  # Placeholder
        avg_toxicity = 0.05  # Placeholder

        # Topics created in timeframe
        topics_query = select(func.count(TrendTopic.id)).where(
            TrendTopic.created_at >= cutoff_time
        )
        topics_result = await db.execute(topics_query)
        topics_created = topics_result.scalar() or 0

        # Processing errors (simplified - would track actual errors)
        processing_errors = 0

        # Track metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        track_request_metrics("GET", "/ingest/stats", 200, duration)

        return {
            "timeframe": timeframe,
            "posts_by_platform": posts_by_platform,
            "total_posts": sum(posts_by_platform.values()),
            "avg_sentiment": avg_sentiment,
            "avg_toxicity": avg_toxicity,
            "topics_created": topics_created,
            "processing_errors": processing_errors,
            "timestamp": start_time.isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get ingestion stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )


# Background processing functions
async def process_posts_background(posts: List[Dict], platform: str) -> None:
    """
    Process posts in background.

    Args:
        posts: List of post dictionaries
        platform: Platform name
    """
    try:
        logger.info(f"Starting background processing of {len(posts)} posts from {platform}")

        processed_count = 0
        failed_count = 0
        start_time = time.time()

        for post in posts:
            try:
                # Process single post
                result = await process_single_post(post)
                if result:
                    processed_count += 1
                    # Track metrics
                    track_ingestion_metrics(platform, "success", 0, 1)
                else:
                    failed_count += 1
                    track_ingestion_metrics(platform, "failed", 0, 1)
            except Exception as e:
                logger.error(f"Failed to process post {post.get('id')}: {e}")
                failed_count += 1
                track_ingestion_metrics(platform, "failed", 0, 1)

        duration = time.time() - start_time
        logger.info(f"Background processing completed: {processed_count} success, {failed_count} failed in {duration:.2f}s")

    except Exception as e:
        logger.error(f"Background processing failed: {e}")


async def process_and_cluster_posts_background(posts: List[Dict]) -> None:
    """
    Process and cluster posts in background.

    Args:
        posts: List of post dictionaries
    """
    try:
        logger.info(f"Starting background processing and clustering of {len(posts)} posts")

        # Process posts
        processed_posts = []
        for post in posts:
            try:
                result = await process_single_post(post)
                if result:
                    processed_posts.append(result)
            except Exception as e:
                logger.error(f"Failed to process post {post.get('id')}: {e}")

        # Cluster processed posts
        if processed_posts:
            await cluster_posts_background(processed_posts, 5)

        logger.info(f"Background processing and clustering completed for {len(processed_posts)} posts")

    except Exception as e:
        logger.error(f"Background processing and clustering failed: {e}")


async def cluster_posts_background(posts: List[Dict], min_cluster_size: int) -> None:
    """
    Cluster posts into topics in background.

    Args:
        posts: List of processed post dictionaries
        min_cluster_size: Minimum posts per cluster
    """
    # Create new database session for this background task
    from ..utils.db import SessionLocal

    try:
        logger.info(f"Starting background clustering of {len(posts)} posts")

        # Cluster posts
        topics = await topic_cluster.cluster_posts(posts, min_cluster_size)

        topics_created = 0

        # Use a new session for this background task
        async with SessionLocal() as db:
            for topic in topics:
                try:
                    # Calculate virality score using ViralityScorer
                    posts_in_topic = topic.get('posts', [])
                    virality_score = 0.0
                    velocity = 0.0

                    if posts_in_topic:
                        # Get virality_scorer from main
                        from app.main import virality_scorer
                        virality_score = virality_scorer.calculate_topic_virality(posts_in_topic)

                        # Calculate simple velocity (engagement growth rate)
                        total_engagement = sum(post.get('engagement', 0) for post in posts_in_topic)
                        avg_age_hours = 24.0  # Default to 24 hours for simplicity
                        velocity = total_engagement / max(avg_age_hours, 1)  # Engagement per hour

                    # Create topic in database
                    db_topic = TrendTopic(
                        title=topic['title'],
                        summary=topic.get('summary'),
                        platforms=topic.get('platforms', []),
                        categories=topic.get('categories', []),
                        sentiment=topic.get('sentiment'),
                        toxicity=topic.get('toxicity'),
                        virality_score=virality_score,
                        velocity=velocity,
                        engagement=sum(post.get('engagement', 0) for post in posts_in_topic),
                        region=topic.get('region')
                    )

                    db.add(db_topic)
                    await db.flush()

                    # Create history snapshot with calculated virality metrics
                    history = TrendHistory(
                        topic_id=db_topic.id,
                        virality_score=virality_score,
                        engagement=db_topic.engagement,
                        velocity=velocity,
                        sentiment=db_topic.sentiment
                    )

                    db.add(history)

                    # Add topic ID to the topic dictionary for mapping
                    topic['topic_id'] = str(db_topic.id)

                    topics_created += 1

                    # Track metrics
                    track_topic_creation(db_topic.region or "unknown", 1)
                    if db_topic.virality_score:
                        track_virality_score(db_topic.virality_score)

                    # Invalidate cache
                    await cache_service.delete_by_pattern("trend:*")

                except Exception as e:
                    logger.error(f"Failed to create topic: {e}")
                    await db.rollback()

            if topics_created > 0:
                await db.commit()

            # Update IngestEvent records to mark them as processed and link to topics
            topic_id_mapping = await _create_topic_id_mapping(posts, topics)
            await _update_ingest_event_flags(db, posts, topic_id_mapping)

        logger.info(f"Background clustering completed: {topics_created} topics created")

    except Exception as e:
        logger.error(f"Background clustering failed: {e}")


async def _update_ingest_event_flags(db: AsyncSession, posts: List[Dict], topic_id_mapping: Dict[str, str] = None) -> None:
    """
    Update IngestEvent records to mark them as processed and optionally link to topics.

    Args:
        db: Database session
        posts: List of processed post dictionaries
        topic_id_mapping: Optional mapping of post IDs to topic IDs
    """
    try:
        # Extract post IDs from processed posts
        post_ids = [post.get('id') for post in posts if post.get('id')]

        if not post_ids:
            return

        # Update IngestEvent records
        from ..models.database import IngestEvent
        from sqlalchemy import update, and_

        if topic_id_mapping:
            # Update with topicId linking
            updates = []
            for post_id in post_ids:
                if post_id in topic_id_mapping:
                    updates.append({
                        'id': post_id,
                        'processed': True,
                        'topicId': topic_id_mapping[post_id]
                    })

            if updates:
                # Use a direct SQL update for each post with its topicId
                for update_data in updates:
                    stmt = (
                        update(IngestEvent)
                        .where(
                            and_(
                                IngestEvent.id == update_data['id'],
                                IngestEvent.processed == False
                            )
                        )
                        .values(
                            processed=True,
                            topicId=update_data['topicId']
                        )
                    )
                    await db.execute(stmt)

                logger.info(f"Updated {len(updates)} IngestEvent records with processed=True and topicId")
        else:
            # Update without topicId linking
            stmt = (
                update(IngestEvent)
                .where(
                    and_(
                        IngestEvent.id.in_(post_ids),
                        IngestEvent.processed == False
                    )
                )
                .values(processed=True)
            )

            result = await db.execute(stmt)
            updated_count = result.rowcount

            if updated_count > 0:
                logger.info(f"Marked {updated_count} IngestEvent records as processed")

    except Exception as e:
        logger.error(f"Failed to update IngestEvent flags: {e}")


async def _create_topic_id_mapping(posts: List[Dict], topics: List[Dict]) -> Dict[str, str]:
    """
    Create mapping from post IDs to topic IDs based on clustering results.

    Args:
        posts: List of processed post dictionaries
        topics: List of topic dictionaries with posts

    Returns:
        Mapping of post_id -> topic_id
    """
    try:
        topic_id_mapping = {}

        # Create a map of post IDs to topic IDs
        for topic in topics:
            topic_id = topic.get('topic_id') or topic.get('id', f"topic_{topic['title']}")
            topic_posts = topic.get('posts', [])

            for post in topic_posts:
                post_id = post.get('id')
                if post_id:
                    topic_id_mapping[post_id] = topic_id

        logger.info(f"Created topic ID mapping for {len(topic_id_mapping)} posts")
        return topic_id_mapping

    except Exception as e:
        logger.error(f"Failed to create topic ID mapping: {e}")
        return {}


async def process_single_post(post: Dict) -> Optional[Dict]:
    """
    Process a single post through the classification pipeline.

    Args:
        post: Post dictionary

    Returns:
        Processed post dictionary or None if filtered out
    """
    try:
        # Extract text content
        text = post.get('textContent', '') or post.get('text', '')
        if not text:
            return None

        # Clean text
        cleaned_text = text_cleaner.clean_for_classification(text)

        # Detect language
        language_code, language_confidence = language_detector.detect(cleaned_text)

        # Check if supported language
        if not language_detector.is_supported_language(cleaned_text, min_confidence=0.7):
            logger.debug(f"Skipping post due to unsupported language: {language_code}")
            return None

        # Check for spam
        if text_cleaner.is_spam(cleaned_text):
            logger.debug("Skipping post due to spam detection")
            return None

        # Analyze sentiment
        sentiment_result = await sentiment_analyzer.analyze(cleaned_text)

        # Check toxicity
        toxicity_result = await toxicity_filter.analyze(cleaned_text)
        if toxicity_result.is_toxic:
            logger.debug("Skipping post due to toxicity filter")
            return None

        # Classify geo
        geo_result = await geo_classifier.classify(cleaned_text)

        # Calculate engagement metrics
        likes = post.get('likesCount', 0) or 0
        shares = post.get('sharesCount', 0) or 0
        comments = post.get('commentsCount', 0) or 0
        views = post.get('viewsCount', 0) or 0
        engagement = likes + shares + comments

        # Create processed post dict
        processed_post = {
            'id': post.get('id'),
            'platform': post.get('platform'),
            'text': text,
            'language': language_code,
            'language_confidence': language_confidence,
            'sentiment': sentiment_result.score,
            'toxicity': toxicity_result.score,
            'is_sa': geo_result.is_south_african,
            'region': geo_result.region,
            'likes': likes,
            'shares': shares,
            'comments': comments,
            'views': views,
            'engagement': engagement,
            'is_spam': False,
            'publishedAt': post.get('publishedAt')
        }

        return processed_post

    except Exception as e:
        logger.error(f"Failed to process post: {e}")
        return None