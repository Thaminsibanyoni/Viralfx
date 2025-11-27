"""Health check router for service monitoring."""
import logging
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.schemas import HealthStatus
from ..services.text_cleaner import TextCleaner
from ..services.language_detector import LanguageDetector
from ..services.sentiment_analyzer import SentimentAnalyzer
from ..services.toxicity_filter import ToxicityFilter
from ..services.geo_classifier import GeoClassifier
from ..services.topic_cluster import TopicCluster
from ..utils.cache import cache_service
from ..utils.db import engine, check_db_health

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


def get_text_cleaner() -> TextCleaner:
    """Get text cleaner service."""
    from app.main import text_cleaner
    return text_cleaner


def get_language_detector() -> LanguageDetector:
    """Get language detector service."""
    from app.main import language_detector
    return language_detector


def get_sentiment_analyzer() -> SentimentAnalyzer:
    """Get sentiment analyzer service."""
    from app.main import sentiment_analyzer
    return sentiment_analyzer


def get_toxicity_filter() -> ToxicityFilter:
    """Get toxicity filter service."""
    from app.main import toxicity_filter
    return toxicity_filter


def get_geo_classifier() -> GeoClassifier:
    """Get geo classifier service."""
    from app.main import geo_classifier
    return geo_classifier


def get_topic_cluster() -> TopicCluster:
    """Get topic cluster service."""
    from app.main import topic_cluster
    return topic_cluster


@router.get("/", response_model=HealthStatus, status_code=status.HTTP_200_OK)
async def health_check(
    text_cleaner: TextCleaner = Depends(get_text_cleaner),
    language_detector: LanguageDetector = Depends(get_language_detector),
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    geo_classifier: GeoClassifier = Depends(get_geo_classifier),
    topic_cluster: TopicCluster = Depends(get_topic_cluster)
) -> HealthStatus:
    """
    Comprehensive health check of all service components.

    Returns:
        HealthStatus object with component status and overall health
    """
    start_time = datetime.utcnow()
    checks = {}
    services = {}
    overall_status = "healthy"

    # Check Redis cache
    try:
        cache_healthy = await cache_service.health_check()
        checks["redis"] = "ok" if cache_healthy else "error"
        services["cache"] = cache_healthy
        if not cache_healthy:
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        checks["redis"] = "error"
        services["cache"] = False
        overall_status = "unhealthy"

    # Check Database
    try:
        db_healthy = engine and await check_db_health(engine)
        checks["database"] = "ok" if db_healthy else "error"
        services["database"] = db_healthy
        if not db_healthy:
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        checks["database"] = "error"
        services["database"] = False
        overall_status = "unhealthy"

    # Check Text Cleaner (always available)
    try:
        # Simple test
        test_text = "Hello, world!"
        cleaned = text_cleaner.clean(test_text)
        checks["text_cleaner"] = "ok" if cleaned else "error"
        services["text_cleaner"] = True
    except Exception as e:
        logger.error(f"Text cleaner health check failed: {e}")
        checks["text_cleaner"] = "error"
        services["text_cleaner"] = False
        overall_status = "degraded" if overall_status == "healthy" else "unhealthy"

    # Check Language Detector
    try:
        if language_detector.is_loaded():
            checks["language_detector"] = "ok"
            services["language_detector"] = True
        else:
            checks["language_detector"] = "loading"
            services["language_detector"] = False
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Language detector health check failed: {e}")
        checks["language_detector"] = "error"
        services["language_detector"] = False
        overall_status = "unhealthy"

    # Check Sentiment Analyzer
    try:
        if sentiment_analyzer.is_loaded():
            checks["sentiment_analyzer"] = "ok"
            services["sentiment_analyzer"] = True
        else:
            checks["sentiment_analyzer"] = "loading"
            services["sentiment_analyzer"] = False
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Sentiment analyzer health check failed: {e}")
        checks["sentiment_analyzer"] = "error"
        services["sentiment_analyzer"] = False
        overall_status = "unhealthy"

    # Check Toxicity Filter
    try:
        if toxicity_filter.is_loaded():
            checks["toxicity_filter"] = "ok"
            services["toxicity_filter"] = True
        else:
            checks["toxicity_filter"] = "loading"
            services["toxicity_filter"] = False
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Toxicity filter health check failed: {e}")
        checks["toxicity_filter"] = "error"
        services["toxicity_filter"] = False
        overall_status = "unhealthy"

    # Check Geo Classifier
    try:
        if geo_classifier.is_loaded():
            checks["geo_classifier"] = "ok"
            services["geo_classifier"] = True
        else:
            checks["geo_classifier"] = "loading"
            services["geo_classifier"] = False
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Geo classifier health check failed: {e}")
        checks["geo_classifier"] = "error"
        services["geo_classifier"] = False
        overall_status = "unhealthy"

    # Check Topic Cluster
    try:
        if topic_cluster.is_loaded():
            checks["topic_cluster"] = "ok"
            services["topic_cluster"] = True
        else:
            checks["topic_cluster"] = "loading"
            services["topic_cluster"] = False
            overall_status = "degraded" if overall_status == "healthy" else "unhealthy"
    except Exception as e:
        logger.error(f"Topic cluster health check failed: {e}")
        checks["topic_cluster"] = "error"
        services["topic_cluster"] = False
        overall_status = "unhealthy"

    # Calculate overall uptime (simplified - would need start time tracking)
    uptime_seconds = 0.0  # Would be calculated from service start time

    return HealthStatus(
        status=overall_status,
        checks=checks,
        services=services,
        timestamp=start_time,
        uptime_seconds=uptime_seconds,
        version="1.0.0"  # Would be from version tracking
    )


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(
    language_detector: LanguageDetector = Depends(get_language_detector),
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    geo_classifier: GeoClassifier = Depends(get_geo_classifier),
    topic_cluster: TopicCluster = Depends(get_topic_cluster)
) -> Dict[str, Any]:
    """
    Readiness check for Kubernetes.

    Returns:
        Readiness status
    """
    # Check if all models are loaded
    models_ready = all([
        language_detector.is_loaded(),
        sentiment_analyzer.is_loaded(),
        toxicity_filter.is_loaded(),
        geo_classifier.is_loaded(),
        topic_cluster.is_loaded()
    ])

    # Check cache and database
    cache_ready = await cache_service.health_check()
    db_ready = engine and await check_db_health(engine)

    ready = models_ready and cache_ready and db_ready

    if ready:
        return {"status": "ready", "models_loaded": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready",
                "models_loaded": models_ready,
                "cache_ready": cache_ready,
                "db_ready": db_ready
            }
        )


@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness_check() -> Dict[str, Any]:
    """
    Liveness check for Kubernetes.

    Simple check that service is running.

    Returns:
        Liveness status
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}


@router.get("/version", status_code=status.HTTP_200_OK)
async def version_info() -> Dict[str, Any]:
    """
    Return service version information.

    Returns:
        Version information
    """
    import sys
    import os

    return {
        "service": "trend-intelligence",
        "version": "1.0.0",
        "build_date": "2024-01-15",  # Would be set during build
        "commit_hash": "abc123",  # Would be set during build
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/components", status_code=status.HTTP_200_OK)
async def component_health(
    language_detector: LanguageDetector = Depends(get_language_detector),
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    geo_classifier: GeoClassifier = Depends(get_geo_classifier),
    topic_cluster: TopicCluster = Depends(get_topic_cluster)
) -> Dict[str, Any]:
    """
    Detailed health status of all components.

    Returns:
        Detailed component health
    """
    components = {}

    # Language Detector
    components["language_detector"] = {
        "loaded": language_detector.is_loaded(),
        "model_type": language_detector.model_type,
        "supported_languages": language_detector.get_supported_languages() if language_detector.is_loaded() else [],
        "cache_size": len(language_detector.cache) if language_detector.is_loaded() else 0
    }

    # Sentiment Analyzer
    components["sentiment_analyzer"] = {
        "loaded": sentiment_analyzer.is_loaded(),
        "model_name": sentiment_analyzer.model_name,
        "cache_size": len(sentiment_analyzer.cache) if sentiment_analyzer.is_loaded() else 0
    }

    # Toxicity Filter
    components["toxicity_filter"] = {
        "loaded": toxicity_filter.is_loaded(),
        "threshold": toxicity_filter.threshold,
        "model_name": toxicity_filter.model_name,
        "cache_size": len(toxicity_filter.cache) if toxicity_filter.is_loaded() else 0
    }

    # Geo Classifier
    components["geo_classifier"] = {
        "loaded": geo_classifier.is_loaded(),
        "provinces": len(geo_classifier.sa_provinces),
        "cities": len(geo_classifier.sa_cities),
        "landmarks": len(geo_classifier.sa_landmarks)
    }

    # Topic Cluster
    components["topic_cluster"] = {
        "loaded": topic_cluster.is_loaded(),
        "model_name": topic_cluster.embedding_model_name,
        "algorithm": topic_cluster.clustering_algorithm,
        "cache_size": len(topic_cluster.embedding_cache) if topic_cluster.is_loaded() else 0
    }

    # Cache Service
    components["cache_service"] = {
        "connected": cache_service.is_connected(),
        "url": cache_service.redis_url
    }

    # Database
    components["database"] = {
        "connected": engine is not None,
        "url": str(engine.url).replace(engine.url.password or "", "***") if engine else None
    }

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "components": components
    }