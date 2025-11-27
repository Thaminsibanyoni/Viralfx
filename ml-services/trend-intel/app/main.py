from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Optional
import uvicorn
import asyncio
import time

from app.config import settings
from app.routers import ingest_router, trends_router, classify_router, health_router
from app.services.text_cleaner import TextCleaner
from app.services.language_detector import LanguageDetector
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.services.toxicity_filter import ToxicityFilter
from app.services.virality_score import ViralityScorer
from app.services.topic_cluster import TopicCluster
from app.services.geo_classifier import GeoClassifier
from app.utils.logger import setup_logging
from app.utils.cache import cache_service
from app.utils.db import setup_database, teardown_database, engine, SessionLocal
from app.utils.metrics import (
    set_service_info, update_uptime, update_health_status,
    get_metrics as get_prometheus_metrics
)
from prometheus_client import CONTENT_TYPE_LATEST
from fastapi.responses import Response

# Setup logging
logger = setup_logging()

# Global services
text_cleaner: TextCleaner = None
language_detector: LanguageDetector = None
sentiment_analyzer: SentimentAnalyzer = None
toxicity_filter: ToxicityFilter = None
virality_scorer: ViralityScorer = None
topic_cluster: TopicCluster = None
geo_classifier: GeoClassifier = None

# Service start time for uptime tracking
_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global text_cleaner, language_detector, sentiment_analyzer
    global toxicity_filter, virality_scorer, topic_cluster, geo_classifier

    logger.info("Starting Trend Intelligence Service...")

    try:
        # Initialize database
        await setup_database()
        logger.info("Database initialized")

        # Initialize cache
        await cache_service.connect()
        logger.info("Connected to Redis cache")
        update_health_status("cache", True)

        # Initialize text cleaner
        text_cleaner = TextCleaner()
        logger.info("Text cleaner initialized")

        # Initialize language detector
        model_load_start = time.time()
        language_detector = LanguageDetector()
        await language_detector.load_models()
        model_load_time = time.time() - model_load_start
        logger.info("Language detector loaded")
        update_health_status("language_detector", True)

        # Initialize sentiment analyzer
        model_load_start = time.time()
        sentiment_analyzer = SentimentAnalyzer()
        await sentiment_analyzer.load_model()
        model_load_time = time.time() - model_load_start
        logger.info("Sentiment analyzer loaded")
        update_health_status("sentiment_analyzer", True)

        # Initialize toxicity filter
        model_load_start = time.time()
        toxicity_filter = ToxicityFilter()
        await toxicity_filter.load_model()
        model_load_time = time.time() - model_load_start
        logger.info("Toxicity filter loaded")
        update_health_status("toxicity_filter", True)

        # Initialize virality scorer
        virality_scorer = ViralityScorer(cache_service)
        logger.info("Virality scorer initialized")

        # Initialize topic cluster
        model_load_start = time.time()
        topic_cluster = TopicCluster()
        await topic_cluster.load_models()
        model_load_time = time.time() - model_load_start
        logger.info("Topic cluster loaded")
        update_health_status("topic_cluster", True)

        # Initialize geo classifier
        geo_classifier = GeoClassifier()
        await geo_classifier.load_models()
        logger.info("Geo classifier loaded")
        update_health_status("geo_classifier", True)

        # Set service info for metrics
        set_service_info(
            service_name=settings.service_name,
            version="1.0.0",
            environment=settings.debug and "development" or "production",
            device=settings.device
        )

        logger.info("Trend Intelligence Service ready!")

        yield

    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise

    finally:
        logger.info("Shutting down Trend Intelligence Service...")
        try:
            await cache_service.disconnect()
            await teardown_database()
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


# Create FastAPI app
app = FastAPI(
    title="ViralFX Trend Intelligence API",
    description="AI-powered social momentum detection and analysis service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add metrics middleware
from app.utils.metrics import create_metrics_middleware
app.middleware("http")(create_metrics_middleware())


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else None,
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request, exc: ValueError):
    """Handle validation errors"""
    logger.warning(f"Validation error: {exc}")
    return JSONResponse(
        status_code=400,
        content={"error": "Validation error", "detail": str(exc)},
    )


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint"""
    return {
        "service": "ViralFX Trend Intelligence",
        "status": "healthy",
        "version": "1.0.0",
        "uptime": time.time() - _start_time
    }




@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus metrics endpoint"""
    update_uptime()
    content_type, metrics_data = get_prometheus_metrics()
    return Response(content=metrics_data, media_type=content_type)


# Include routers
app.include_router(health_router.router, prefix="/health", tags=["Health"])
app.include_router(ingest_router.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(trends_router.router, prefix="/trends", tags=["Trends"])
app.include_router(classify_router.router, prefix="/classify", tags=["Classification"])


# Dependency injection
def get_cache_service():
    return cache_service

def get_text_cleaner():
    return text_cleaner

def get_language_detector():
    return language_detector

def get_sentiment_analyzer():
    return sentiment_analyzer

def get_toxicity_filter():
    return toxicity_filter

def get_virality_scorer():
    return virality_scorer

def get_topic_cluster():
    return topic_cluster

def get_geo_classifier():
    return geo_classifier

# Note: Service instances are managed in the global scope and accessed via the dependency providers above


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8003,
        reload=settings.debug,
        log_level="info",
        access_log=True,
    )