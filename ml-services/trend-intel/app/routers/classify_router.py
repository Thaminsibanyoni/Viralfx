"""Classification router for text analysis endpoints."""
import logging
import time
import hashlib
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import (
    ClassifyRequest, ClassificationResult, SentimentScore,
    ToxicityScore, GeoClassification, LanguageDetection,
    ErrorResponse, SentimentRequest, ToxicityRequest,
    LanguageRequest, GeoRequest
)
from ..services.text_cleaner import TextCleaner
from ..services.language_detector import LanguageDetector
from ..services.sentiment_analyzer import SentimentAnalyzer
from ..services.toxicity_filter import ToxicityFilter
from ..services.geo_classifier import GeoClassifier
from ..utils.cache import cache_service
from ..utils.db import get_db_session
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Classification"])


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


@router.post("/", response_model=ClassificationResult, status_code=status.HTTP_200_OK)
async def classify_text(
    request: ClassifyRequest,
    text_cleaner: TextCleaner = Depends(get_text_cleaner),
    language_detector: LanguageDetector = Depends(get_language_detector),
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    geo_classifier: GeoClassifier = Depends(get_geo_classifier)
) -> ClassificationResult:
    """
    Classify text with sentiment, toxicity, and geographic analysis.

    Args:
        request: Classification request with text and options

    Returns:
        ClassificationResult with all requested analyses

    Raises:
        HTTPException: If text is invalid or analysis fails
    """
    start_time = time.time()

    try:
        # Validate input
        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )

        if len(request.text) > settings.max_text_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Text exceeds maximum length of {settings.max_text_length}"
            )

        # Create cache key that includes request options
        options_data = {
            "include_sentiment": request.include_sentiment,
            "include_toxicity": request.include_toxicity,
            "include_geo": request.include_geo,
            "language": request.language
        }
        options_hash = hashlib.md5(str(options_data).encode()).hexdigest()[:8]
        text_hash = hashlib.md5(request.text.encode()).hexdigest()
        cache_key = f"classify:{text_hash}:opts:{options_hash}"

        cached_result = await cache_service.get_json(cache_key)
        if cached_result:
            logger.info(f"Returning cached classification result for text: {request.text[:50]}...")
            return ClassificationResult(**cached_result)

        # Clean text
        cleaned_text = text_cleaner.clean_for_classification(request.text)

        # Check for spam
        is_spam = text_cleaner.is_spam(cleaned_text)

        # Language detection
        language_code = "unknown"
        language_confidence = 0.0
        if request.language != "auto":
            language_code = request.language
            language_confidence = 1.0
        else:
            try:
                language_code, language_confidence = language_detector.detect(
                    cleaned_text, min_confidence=0.5
                )
            except Exception as e:
                logger.warning(f"Language detection failed: {e}")
                language_code = "unknown"
                language_confidence = 0.0

        # Check if supported language
        supported_language = language_detector.is_supported_language(cleaned_text, min_confidence=0.7)

        # Initialize result variables
        sentiment_result = None
        toxicity_result = None
        geo_result = None

        # Only proceed with analysis if supported language
        if supported_language and not is_spam:
            # Sentiment analysis
            if request.include_sentiment:
                try:
                    sentiment_result = await sentiment_analyzer.analyze(cleaned_text)
                except Exception as e:
                    logger.error(f"Sentiment analysis failed: {e}")

            # Toxicity analysis
            if request.include_toxicity:
                try:
                    toxicity_result = await toxicity_filter.analyze(cleaned_text)
                except Exception as e:
                    logger.error(f"Toxicity analysis failed: {e}")

            # Geo classification
            if request.include_geo:
                try:
                    geo_result = await geo_classifier.classify(cleaned_text)
                except Exception as e:
                    logger.error(f"Geo classification failed: {e}")

        # Calculate processing time
        processing_time_ms = (time.time() - start_time) * 1000

        # Create result
        result = ClassificationResult(
            text=request.text,
            language=language_code,
            language_confidence=language_confidence,
            sentiment=sentiment_result,
            toxicity=toxicity_result,
            geo_classification=geo_result,
            processing_time_ms=processing_time_ms,
            text_length=len(request.text),
            is_spam=is_spam
        )

        # Cache result
        await cache_service.set_json(
            cache_key,
            result.model_dump(mode="json"),
            ttl=settings.cache_ttl_classification
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text classification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}"
        )


@router.post("/batch", response_model=List[ClassificationResult], status_code=status.HTTP_200_OK)
async def classify_batch(
    requests: List[ClassifyRequest],
    background_tasks: BackgroundTasks,
    text_cleaner: TextCleaner = Depends(get_text_cleaner),
    language_detector: LanguageDetector = Depends(get_language_detector),
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    geo_classifier: GeoClassifier = Depends(get_geo_classifier)
) -> List[ClassificationResult]:
    """
    Classify multiple texts in batch.

    Args:
        requests: List of classification requests
        background_tasks: FastAPI background tasks

    Returns:
        List of classification results

    Raises:
        HTTPException: If batch is too large or analysis fails
    """
    start_time = time.time()

    try:
        # Validate batch size
        if len(requests) > settings.max_batch_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Batch size exceeds maximum of {settings.max_batch_size}"
            )

        # Process texts in parallel
        results = []
        for request in requests:
            try:
                result = await classify_text(
                    request=request,
                    text_cleaner=text_cleaner,
                    language_detector=language_detector,
                    sentiment_analyzer=sentiment_analyzer,
                    toxicity_filter=toxicity_filter,
                    geo_classifier=geo_classifier
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to classify text in batch: {e}")
                # Add error result for failed text
                results.append(ClassificationResult(
                    text=request.text,
                    language="unknown",
                    language_confidence=0.0,
                    sentiment=None,
                    toxicity=None,
                    geo_classification=None,
                    processing_time_ms=0.0,
                    text_length=len(request.text),
                    is_spam=False
                ))

        # Log batch processing
        processing_time_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Batch classification completed",
            batch_size=len(requests),
            processing_time_ms=processing_time_ms,
            avg_time_ms=processing_time_ms / len(requests)
        )

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch classification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch classification failed: {str(e)}"
        )


@router.post("/sentiment", response_model=SentimentScore, status_code=status.HTTP_200_OK)
async def analyze_sentiment(
    request: SentimentRequest,
    sentiment_analyzer: SentimentAnalyzer = Depends(get_sentiment_analyzer),
    text_cleaner: TextCleaner = Depends(get_text_cleaner)
) -> SentimentScore:
    """
    Analyze sentiment of text only.

    Args:
        request: SentimentRequest with text and optional language

    Returns:
        SentimentScore with sentiment analysis

    Raises:
        HTTPException: If analysis fails
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )

        # Clean text
        cleaned_text = text_cleaner.clean_for_classification(request.text)

        # Analyze sentiment
        result = await sentiment_analyzer.analyze(cleaned_text, include_emotions=True)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sentiment analysis failed: {str(e)}"
        )


@router.post("/toxicity", response_model=ToxicityScore, status_code=status.HTTP_200_OK)
async def analyze_toxicity(
    request: ToxicityRequest,
    toxicity_filter: ToxicityFilter = Depends(get_toxicity_filter),
    text_cleaner: TextCleaner = Depends(get_text_cleaner)
) -> ToxicityScore:
    """
    Check toxicity of text only.

    Args:
        request: ToxicityRequest with text to analyze

    Returns:
        ToxicityScore with toxicity analysis

    Raises:
        HTTPException: If analysis fails
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )

        # Clean text
        cleaned_text = text_cleaner.clean_for_classification(request.text)

        # Analyze toxicity
        result = await toxicity_filter.analyze(cleaned_text)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toxicity analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Toxicity analysis failed: {str(e)}"
        )


@router.post("/language", response_model=LanguageDetection, status_code=status.HTTP_200_OK)
async def detect_language(
    request: LanguageRequest,
    language_detector: LanguageDetector = Depends(get_language_detector)
) -> LanguageDetection:
    """
    Detect language of text.

    Args:
        request: LanguageRequest with text to analyze

    Returns:
        LanguageDetection with language and confidence

    Raises:
        HTTPException: If detection fails
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )

        # Clean text for detection
        cleaned_text = language_detector._preprocess_for_detection(request.text)

        # Detect language
        language_code, confidence = language_detector.detect(cleaned_text)
        language_name = language_detector.get_language_name(language_code)
        is_supported = language_detector.is_supported_language(cleaned_text, min_confidence=0.7)

        return LanguageDetection(
            language=language_code,
            language_name=language_name,
            confidence=confidence,
            is_supported=is_supported
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Language detection failed: {str(e)}"
        )


@router.post("/geo", response_model=GeoClassification, status_code=status.HTTP_200_OK)
async def classify_geography(
    request: GeoRequest,
    geo_classifier: GeoClassifier = Depends(get_geo_classifier),
    text_cleaner: TextCleaner = Depends(get_text_cleaner)
) -> GeoClassification:
    """
    Classify geographic origin of text.

    Args:
        request: GeoRequest with text and optional author location

    Returns:
        GeoClassification with geographic analysis

    Raises:
        HTTPException: If classification fails
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )

        # Clean text
        cleaned_text = text_cleaner.clean_for_classification(request.text)

        # Classify geography
        result = await geo_classifier.classify(cleaned_text, request.author_location)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Geo classification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Geo classification failed: {str(e)}"
        )