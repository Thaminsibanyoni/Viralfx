from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import uvicorn
import asyncio
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.metrics import metrics_middleware
from app.models.deception import DeceptionRequest, DeceptionResponse
from app.services.deception_service import DeceptionService
from app.services.model_service import ModelService
from app.services.evidence_service import EvidenceService
from app.services.cache_service import CacheService

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Global services
deception_service: DeceptionService = None
model_service: ModelService = None
evidence_service: EvidenceService = None
cache_service: CacheService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global deception_service, model_service, evidence_service, cache_service

    logger.info("Starting Deception Detection Service...")

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
        logger.info("Deception models loaded successfully")

        evidence_service = EvidenceService(
            cache_service=cache_service,
        )
        logger.info("Evidence service initialized")

        deception_service = DeceptionService(
            model_service=model_service,
            evidence_service=evidence_service,
            cache_service=cache_service,
        )
        logger.info("Deception service initialized")

        # Warm up models
        await deception_service.warm_up()
        logger.info("Models warmed up")

        logger.info("Deception Detection Service ready!")

        yield

    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise

    finally:
        logger.info("Shutting down Deception Detection Service...")
        if cache_service:
            await cache_service.disconnect()


# Create FastAPI app
app = FastAPI(
    title="ViralX Deception Detection API",
    description="Advanced deception detection and truth verification service",
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
        "service": "ViralX Deception Detection",
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


@app.post("/analyze/deception", response_model=DeceptionResponse, tags=["Deception Detection"])
async def analyze_deception(
    request: DeceptionRequest,
    background_tasks: BackgroundTasks,
):
    """
    Analyze text for deception indicators

    This endpoint provides comprehensive deception analysis including:
    - Deception Risk Score (DRS) from 0 to 1
    - Component breakdown (linguistic, semantic, etc.)
    - Evidence items with confidence scores
    - Source verification when possible
    - Stance detection
    - Consistency analysis
    """
    try:
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            raise ValueError("Text cannot be empty")

        if len(request.text) > settings.MAX_TEXT_LENGTH:
            raise ValueError(f"Text too long. Maximum length: {settings.MAX_TEXT_LENGTH}")

        logger.info(f"Analyzing deception for text length: {len(request.text)}")

        # Perform deception analysis
        result = await deception_service.analyze(
            text=request.text,
            language=request.language,
            include_evidence=request.include_evidence,
            include_sources=request.include_sources,
            context=request.context,
            author_info=request.author_info,
        )

        # Log analysis in background
        background_tasks.add_task(
            log_deception_analysis,
            text_hash=hash(request.text),
            result=result,
        )

        logger.info(f"Deception analysis completed. DRS: {result.drs}")

        return result

    except ValueError as e:
        logger.warning(f"Validation error in deception analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error in deception analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/analyze/batch", tags=["Deception Detection"])
async def analyze_batch(
    texts: List[str],
    background_tasks: BackgroundTasks,
    language: str = "en",
    include_evidence: bool = True,
):
    """
    Analyze deception for multiple texts

    Optimized for batch processing with async operations
    """
    try:
        if len(texts) > settings.MAX_BATCH_SIZE:
            raise ValueError(f"Batch too large. Maximum size: {settings.MAX_BATCH_SIZE}")

        logger.info(f"Analyzing deception for batch of {len(texts)} texts")

        # Process batch concurrently with limited concurrency to avoid memory issues
        semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_ANALYSES)

        async def analyze_with_semaphore(text: str):
            async with semaphore:
                return await deception_service.analyze(
                    text=text,
                    language=language,
                    include_evidence=include_evidence,
                    include_sources=False,  # Disable sources for batch to improve performance
                )

        tasks = [analyze_with_semaphore(text) for text in texts]
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
        logger.error(f"Error in batch deception analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/verify/source", tags=["Source Verification"])
async def verify_source(
    url: str,
    claim: str,
    background_tasks: BackgroundTasks,
):
    """
    Verify a source against a claim

    This endpoint checks if a source supports or contradicts a given claim
    """
    try:
        logger.info(f"Verifying source: {url}")

        result = await evidence_service.verify_source(
            url=url,
            claim=claim,
        )

        # Log verification in background
        background_tasks.add_task(
            log_source_verification,
            url=url,
            claim_hash=hash(claim),
            result=result,
        )

        return result

    except Exception as e:
        logger.error(f"Error verifying source: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to verify source")


@app.post("/cross-check", tags=["Cross-Checking"])
async def cross_check_claims(
    claims: List[str],
    background_tasks: BackgroundTasks,
):
    """
    Cross-check multiple claims against each other

    Identifies contradictions and consistencies between claims
    """
    try:
        if len(claims) < 2:
            raise ValueError("At least 2 claims required for cross-checking")

        logger.info(f"Cross-checking {len(claims)} claims")

        result = await deception_service.cross_check_claims(claims)

        # Log cross-check in background
        background_tasks.add_task(
            log_cross_check,
            claims_hash=hash(tuple(claims)),
            result=result,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Error in cross-check: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cross-check claims")


@app.post("/train", tags=["Training"])
async def train_model(
    data_path: str,
    model_type: str = "deception",
    epochs: int = 3,
    background_tasks: BackgroundTasks = None,
):
    """
    Train or fine-tune the deception detection model

    This endpoint is for training new models or fine-tuning existing ones
    """
    try:
        logger.info(f"Starting model training with data: {data_path}")

        # Queue training task
        if background_tasks:
            background_tasks.add_task(
                model_service.train_model,
                data_path=data_path,
                model_type=model_type,
                epochs=epochs,
            )

        return {
            "status": "training_started",
            "data_path": data_path,
            "model_type": model_type,
            "epochs": epochs,
        }

    except Exception as e:
        logger.error(f"Error starting model training: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start training")


@app.get("/models", tags=["Model Management"])
async def list_models():
    """List available deception detection models"""
    try:
        models = await model_service.list_models()
        return {"models": models}

    except Exception as e:
        logger.error(f"Error listing models: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list models")


async def log_deception_analysis(text_hash: str, result: DeceptionResponse):
    """Log deception analysis for analytics"""
    try:
        logger.debug(f"Logged deception analysis for text hash: {text_hash}")
    except Exception as e:
        logger.error(f"Failed to log deception analysis: {e}")


async def log_source_verification(url: str, claim_hash: str, result: Dict[str, Any]):
    """Log source verification for analytics"""
    try:
        logger.debug(f"Logged source verification for URL: {url}")
    except Exception as e:
        logger.error(f"Failed to log source verification: {e}")


async def log_cross_check(claims_hash: str, result: Dict[str, Any]):
    """Log cross-check for analytics"""
    try:
        logger.debug(f"Logged cross-check for claims hash: {claims_hash}")
    except Exception as e:
        logger.error(f"Failed to log cross-check: {e}")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True,
    )