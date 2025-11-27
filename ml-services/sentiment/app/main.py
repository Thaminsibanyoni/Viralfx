from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import asyncio
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.metrics import metrics_middleware
from app.models.sentiment import SentimentRequest, SentimentResponse
from app.services.sentiment_service import SentimentService
from app.services.model_service import ModelService
from app.services.cache_service import CacheService

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Global services
sentiment_service: SentimentService = None
model_service: ModelService = None
cache_service: CacheService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global sentiment_service, model_service, cache_service

    logger.info("Starting Sentiment Analysis Service...")

    # Initialize services
    try:
        cache_service = CacheService(redis_url=settings.REDIS_URL)
        await cache_service.connect()
        logger.info("Connected to Redis cache")

        model_service = ModelService(
            model_path=settings.MODEL_PATH,
            device=settings.DEVICE,
        )
        await model_service.load_model()
        logger.info("Models loaded successfully")

        sentiment_service = SentimentService(
            model_service=model_service,
            cache_service=cache_service,
        )
        logger.info("Sentiment service initialized")

        # Warm up models
        await sentiment_service.warm_up()
        logger.info("Models warmed up")

        logger.info("Sentiment Analysis Service ready!")

        yield

    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise

    finally:
        logger.info("Shutting down Sentiment Analysis Service...")
        if cache_service:
            await cache_service.disconnect()


# Create FastAPI app
app = FastAPI(
    title="ViralX Sentiment Analysis API",
    description="Advanced sentiment analysis service for social momentum trading",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add metrics collection
app.middleware("http")(metrics_middleware)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None,
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
        "service": "ViralX Sentiment Analysis",
        "status": "healthy",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "checks": {},
    }

    # Check model service
    if model_service and model_service.is_loaded():
        health_status["checks"]["model"] = "healthy"
    else:
        health_status["checks"]["model"] = "unhealthy"
        health_status["status"] = "unhealthy"

    # Check cache service
    if cache_service and cache_service.is_connected():
        health_status["checks"]["cache"] = "healthy"
    else:
        health_status["checks"]["cache"] = "unhealthy"
        health_status["status"] = "unhealthy"

    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi.responses import Response

    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.post("/analyze/sentiment", response_model=SentimentResponse, tags=["Sentiment Analysis"])
async def analyze_sentiment(
    request: SentimentRequest,
    background_tasks: BackgroundTasks,
):
    """
    Analyze sentiment for given text

    This endpoint provides comprehensive sentiment analysis including:
    - Overall sentiment score (-1 to 1)
    - Confidence score
    - Emotion classification
    - Aspect-based sentiment (optional)
    - Text preprocessing and cleaning
    """
    try:
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            raise ValueError("Text cannot be empty")

        if len(request.text) > settings.MAX_TEXT_LENGTH:
            raise ValueError(f"Text too long. Maximum length: {settings.MAX_TEXT_LENGTH}")

        logger.info(f"Analyzing sentiment for text length: {len(request.text)}")

        # Perform sentiment analysis
        result = await sentiment_service.analyze(
            text=request.text,
            language=request.language,
            include_emotions=request.include_emotions,
            include_aspects=request.include_aspects,
        )

        # Log analysis in background
        background_tasks.add_task(
            log_sentiment_analysis,
            text_hash=hash(request.text),
            result=result,
        )

        logger.info(f"Sentiment analysis completed. Score: {result.score_float}")

        return result

    except ValueError as e:
        logger.warning(f"Validation error in sentiment analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error in sentiment analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/analyze/batch", tags=["Sentiment Analysis"])
async def analyze_batch(
    texts: list[str],
    background_tasks: BackgroundTasks,
    language: str = "en",
    include_emotions: bool = False,
):
    """
    Analyze sentiment for multiple texts

    Optimized for batch processing with async operations
    """
    try:
        if len(texts) > settings.MAX_BATCH_SIZE:
            raise ValueError(f"Batch too large. Maximum size: {settings.MAX_BATCH_SIZE}")

        logger.info(f"Analyzing sentiment for batch of {len(texts)} texts")

        # Process batch concurrently
        tasks = [
            sentiment_service.analyze(
                text=text,
                language=language,
                include_emotions=include_emotions,
                include_aspects=False,  # Disable aspects for batch to improve performance
            )
            for text in texts
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions in batch
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error analyzing text {i}: {result}")
                processed_results.append({
                    "error": str(result),
                    "text_index": i,
                })
            else:
                processed_results.append(result)

        logger.info(f"Batch analysis completed. Processed: {len(processed_results)} texts")

        return {
            "results": processed_results,
            "batch_size": len(texts),
            "processed": len(processed_results),
            "errors": sum(1 for r in processed_results if "error" in r),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error in batch sentiment analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/train", tags=["Training"])
async def train_model(
    data_path: str,
    model_name: str = None,
    epochs: int = 3,
    background_tasks: BackgroundTasks = None,
):
    """
    Train or fine-tune the sentiment model

    This endpoint is for training new models or fine-tuning existing ones
    """
    try:
        logger.info(f"Starting model training with data: {data_path}")

        # Queue training task
        if background_tasks:
            background_tasks.add_task(
                model_service.train_model,
                data_path=data_path,
                model_name=model_name,
                epochs=epochs,
            )

        return {
            "status": "training_started",
            "data_path": data_path,
            "model_name": model_name or "default",
            "epochs": epochs,
        }

    except Exception as e:
        logger.error(f"Error starting model training: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start training")


@app.get("/models", tags=["Model Management"])
async def list_models():
    """List available sentiment models"""
    try:
        models = await model_service.list_models()
        return {"models": models}

    except Exception as e:
        logger.error(f"Error listing models: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list models")


@app.post("/models/{model_name}/load", tags=["Model Management"])
async def load_model(model_name: str):
    """Load a specific model"""
    try:
        await model_service.load_model(model_name)
        return {"status": "model_loaded", "model_name": model_name}

    except Exception as e:
        logger.error(f"Error loading model {model_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load model")


async def log_sentiment_analysis(text_hash: str, result: SentimentResponse):
    """Log sentiment analysis for analytics"""
    try:
        # This could send to analytics service or database
        logger.debug(f"Logged analysis for text hash: {text_hash}")
    except Exception as e:
        logger.error(f"Failed to log sentiment analysis: {e}")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True,
    )