"""Pydantic models for API request/response validation and documentation."""
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic_core import ValidationError
import enum


# Enums for schema validation
class PlatformEnum(str, enum.Enum):
    """Social media platforms enum."""
    TWITTER = "twitter"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    REDDIT = "reddit"
    DISCORD = "discord"
    TELEGRAM = "telegram"


class ContentTypeEnum(str, enum.Enum):
    """Content type enum."""
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    MIXED = "MIXED"


class LanguageEnum(str, enum.Enum):
    """Supported languages enum."""
    EN = "en"
    AF = "af"
    ZU = "zu"
    XH = "xh"
    ST = "st"
    TN = "tn"
    TS = "ts"
    SS = "ss"
    NR = "nr"
    VE = "ve"
    AUTO = "auto"


class RegionEnum(str, enum.Enum):
    """South African regions enum."""
    ZA = "ZA"  # South Africa (general)
    GP = "GP"  # Gauteng
    WC = "WC"  # Western Cape
    KZN = "KZN"  # KwaZulu-Natal
    EC = "EC"  # Eastern Cape
    FS = "FS"  # Free State
    MP = "MP"  # Mpumalanga
    NW = "NW"  # North West
    NC = "NC"  # Northern Cape
    LP = "LP"  # Limpopo


# Request Models
class SentimentRequest(BaseModel):
    """Request model for sentiment analysis."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to analyze")
    language: Optional[Union[LanguageEnum, str]] = Field(
        default="auto",
        description="Language code or 'auto' for detection"
    )

    @field_validator('language', mode='before')
    @classmethod
    def normalize_language(cls, v):
        """Normalize language string to enum value."""
        if isinstance(v, str):
            v = v.lower()
            if v not in [e.value for e in LanguageEnum]:
                raise ValueError(f"Language '{v}' not supported")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "I love this new phone! It's amazing.",
                "language": "auto"
            }
        }
    )


class ToxicityRequest(BaseModel):
    """Request model for toxicity analysis."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to analyze")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "This is a test message"
            }
        }
    )


class LanguageRequest(BaseModel):
    """Request model for language detection."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to analyze")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "Hello world"
            }
        }
    )


class GeoRequest(BaseModel):
    """Request model for geographic classification."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to analyze")
    author_location: Optional[str] = Field(
        default=None,
        description="Known author location (optional)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "I'm visiting Cape Town next week",
                "author_location": None
            }
        }
    )


class ClassifyRequest(BaseModel):
    """Request model for text classification."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to classify")
    language: Optional[Union[LanguageEnum, str]] = Field(
        default="auto",
        description="Language code or 'auto' for detection"
    )
    include_toxicity: bool = Field(default=True, description="Include toxicity analysis")
    include_sentiment: bool = Field(default=True, description="Include sentiment analysis")
    include_geo: bool = Field(default=False, description="Include geographic classification")

    @field_validator('language', mode='before')
    @classmethod
    def normalize_language(cls, v):
        """Normalize language string to enum value."""
        if isinstance(v, str):
            v = v.lower()
            if v not in [e.value for e in LanguageEnum]:
                raise ValueError(f"Language '{v}' not supported")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "This amazing trend is taking over South Africa!",
                "language": "auto",
                "include_toxicity": True,
                "include_sentiment": True,
                "include_geo": False
            }
        }
    )


class IngestRequest(BaseModel):
    """Request model for manual ingestion trigger."""
    platform: PlatformEnum = Field(..., description="Platform to ingest from")
    limit: int = Field(default=100, ge=1, le=1000, description="Number of posts to process")
    keywords: Optional[List[str]] = Field(default=None, description="Keywords to filter by")
    hashtags: Optional[List[str]] = Field(default=None, description="Hashtags to filter by")
    region: Optional[str] = Field(default="ZA", description="Region code")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "platform": "twitter",
                "limit": 100,
                "keywords": ["trending", "viral"],
                "hashtags": ["#trending", "#viral"],
                "region": "ZA"
            }
        }
    )


class TrendQueryRequest(BaseModel):
    """Request model for trend queries."""
    region: Optional[Union[RegionEnum, str]] = Field(default=None, description="Region code")
    limit: int = Field(default=20, ge=1, le=100, description="Number of trends to return")
    min_virality_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Minimum virality score"
    )
    categories: Optional[List[str]] = Field(default=None, description="Filter by categories")
    timeframe: str = Field(
        default="24h",
        description="Timeframe (1h, 6h, 24h, 7d, 30d)"
    )

    @field_validator('timeframe')
    @classmethod
    def validate_timeframe(cls, v):
        """Validate timeframe format."""
        valid_timeframes = ["1h", "6h", "24h", "7d", "30d"]
        if v not in valid_timeframes:
            raise ValueError(f"Timeframe must be one of {valid_timeframes}")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "region": "GP",
                "limit": 10,
                "min_virality_score": 70.0,
                "categories": ["politics", "entertainment"],
                "timeframe": "24h"
            }
        }
    )


class ProcessIngestRequest(BaseModel):
    """Request model for processing ingested posts."""
    limit: int = Field(default=100, ge=1, le=1000, description="Number of posts to process")
    platform: Optional[PlatformEnum] = Field(default=None, description="Filter by platform")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "limit": 50,
                "platform": "twitter"
            }
        }
    )


class ClusterPostsRequest(BaseModel):
    """Request model for clustering posts into topics."""
    timeframe: str = Field(default="1h", description="Timeframe for posts")
    min_cluster_size: int = Field(
        default=5,
        ge=2,
        le=100,
        description="Minimum posts per cluster"
    )
    platform: Optional[PlatformEnum] = Field(default=None, description="Filter by platform")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "timeframe": "6h",
                "min_cluster_size": 10,
                "platform": "twitter"
            }
        }
    )


# Response Models
class SentimentScore(BaseModel):
    """Sentiment analysis result."""
    score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment score (-1 to 1)")
    label: str = Field(..., description="Sentiment label (positive, negative, neutral)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0 to 1)")
    emotions: Optional[Dict[str, float]] = Field(
        default=None,
        description="Emotion scores (joy, anger, sadness, fear, surprise)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "score": 0.75,
                "label": "positive",
                "confidence": 0.92,
                "emotions": {
                    "joy": 0.8,
                    "anger": 0.1,
                    "sadness": 0.05,
                    "fear": 0.02,
                    "surprise": 0.03
                }
            }
        }
    )


class ToxicityScore(BaseModel):
    """Toxicity analysis result."""
    score: float = Field(..., ge=0.0, le=1.0, description="Toxicity score (0 to 1)")
    is_toxic: bool = Field(..., description="Whether content is toxic")
    categories: Dict[str, float] = Field(
        default_factory=dict,
        description="Toxicity categories (violence, hate_speech, profanity, sexual_content)"
    )
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0 to 1)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "score": 0.15,
                "is_toxic": False,
                "categories": {
                    "violence": 0.02,
                    "hate_speech": 0.01,
                    "profanity": 0.05,
                    "sexual_content": 0.07
                },
                "confidence": 0.88
            }
        }
    )


class GeoClassification(BaseModel):
    """Geographic classification result."""
    region: Optional[str] = Field(default=None, description="Detected region code")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence")
    is_south_african: bool = Field(..., description="Whether content is South African")
    indicators: List[str] = Field(
        default_factory=list,
        description="Indicators used for classification"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "region": "GP",
                "confidence": 0.85,
                "is_south_african": True,
                "indicators": ["location_mentions", "language_patterns", "cultural_references"]
            }
        }
    )


class ClassificationResult(BaseModel):
    """Complete classification result for a text."""
    text: str = Field(..., description="Original text")
    language: str = Field(..., description="Detected language code")
    language_confidence: float = Field(..., ge=0.0, le=1.0, description="Language detection confidence")
    sentiment: Optional[SentimentScore] = Field(default=None, description="Sentiment analysis result")
    toxicity: Optional[ToxicityScore] = Field(default=None, description="Toxicity analysis result")
    geo_classification: Optional[GeoClassification] = Field(default=None, description="Geo classification result")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    text_length: int = Field(..., description="Length of original text")
    is_spam: Optional[bool] = Field(default=False, description="Whether text appears to be spam")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": "This amazing trend is taking over South Africa!",
                "language": "en",
                "language_confidence": 0.95,
                "sentiment": {
                    "score": 0.75,
                    "label": "positive",
                    "confidence": 0.92,
                    "emotions": {"joy": 0.8, "surprise": 0.2}
                },
                "toxicity": {
                    "score": 0.15,
                    "is_toxic": False,
                    "categories": {"profanity": 0.05},
                    "confidence": 0.88
                },
                "geo_classification": {
                    "region": "GP",
                    "confidence": 0.85,
                    "is_south_african": True,
                    "indicators": ["location_mentions"]
                },
                "processing_time_ms": 125.5,
                "text_length": 45,
                "is_spam": False
            }
        }
    )


class TrendTopic(BaseModel):
    """Trend topic model."""
    id: str = Field(..., description="Topic ID")
    title: str = Field(..., description="Topic title")
    summary: Optional[str] = Field(default=None, description="Topic summary")
    platforms: List[str] = Field(..., description="Platforms where trend is active")
    categories: List[str] = Field(..., description="Topic categories")
    sentiment: Optional[float] = Field(default=None, description="Average sentiment score")
    toxicity: Optional[float] = Field(default=None, description="Average toxicity score")
    virality_score: Optional[float] = Field(default=None, description="Virality score (0-100)")
    velocity: Optional[float] = Field(default=None, description="Velocity score")
    engagement: Optional[int] = Field(default=None, description="Total engagement")
    region: Optional[str] = Field(default=None, description="Primary region")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    post_count: Optional[int] = Field(default=None, description="Number of posts in topic")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Trending hashtag goes viral in South Africa",
                "summary": "A new hashtag is trending across multiple platforms",
                "platforms": ["twitter", "instagram"],
                "categories": ["entertainment", "viral"],
                "sentiment": 0.75,
                "toxicity": 0.15,
                "virality_score": 85.5,
                "velocity": 78.2,
                "engagement": 50000,
                "region": "GP",
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T11:45:00Z",
                "post_count": 150
            }
        }
    )


class TrendResponse(BaseModel):
    """Response model for trends query."""
    trends: List[TrendTopic] = Field(..., description="List of trends")
    total: int = Field(..., description="Total number of trends")
    region: Optional[str] = Field(default=None, description="Region filter applied")
    timeframe: str = Field(..., description="Timeframe for trends")
    generated_at: datetime = Field(..., description="Response generation timestamp")
    cache_hit: bool = Field(default=False, description="Whether response came from cache")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "trends": [],
                "total": 25,
                "region": "GP",
                "timeframe": "24h",
                "generated_at": "2024-01-15T12:00:00Z",
                "cache_hit": False
            }
        }
    )


class ViralityMetrics(BaseModel):
    """Virality scoring metrics breakdown."""
    engagement_rate: float = Field(..., description="Engagement rate (E component)")
    velocity: float = Field(..., description="Velocity score (V component)")
    sentiment_strength: float = Field(..., description="Sentiment strength (S component)")
    quality_multiplier: float = Field(..., description="Quality multiplier (Q component)")
    regional_weight: float = Field(..., description="Regional weight (R component)")
    virality_score: float = Field(..., description="Final virality score")
    formula: str = Field(default="(E + V + S) * Q * R", description="Virality formula")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "engagement_rate": 75.0,
                "velocity": 80.5,
                "sentiment_strength": 65.0,
                "quality_multiplier": 1.2,
                "regional_weight": 1.3,
                "virality_score": 85.5,
                "formula": "(E + V + S) * Q * R"
            }
        }
    )


class HealthStatus(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Overall status (healthy, unhealthy, degraded)")
    checks: Dict[str, str] = Field(..., description="Component status checks")
    services: Dict[str, bool] = Field(..., description="Service availability")
    timestamp: datetime = Field(..., description="Health check timestamp")
    uptime_seconds: Optional[float] = Field(default=None, description="Service uptime in seconds")
    version: Optional[str] = Field(default=None, description="Service version")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "checks": {
                    "database": "ok",
                    "redis": "ok",
                    "sentiment_model": "ok",
                    "toxicity_model": "ok"
                },
                "services": {
                    "cache": True,
                    "database": True,
                    "language_detector": True,
                    "sentiment_analyzer": True,
                    "toxicity_filter": True
                },
                "timestamp": "2024-01-15T12:00:00Z",
                "uptime_seconds": 3600.5,
                "version": "1.0.0"
            }
        }
    )


class IngestStatus(BaseModel):
    """Ingestion operation status."""
    platform: str = Field(..., description="Platform")
    collected: int = Field(..., description="Posts collected")
    processed: int = Field(..., description="Posts processed")
    failed: int = Field(..., description="Posts failed")
    duration_seconds: float = Field(..., description="Operation duration")
    timestamp: datetime = Field(..., description="Operation timestamp")
    errors: List[str] = Field(default_factory=list, description="Error messages")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "platform": "twitter",
                "collected": 100,
                "processed": 95,
                "failed": 5,
                "duration_seconds": 45.2,
                "timestamp": "2024-01-15T12:00:00Z",
                "errors": ["Failed to process 5 posts due to toxicity filter"]
            }
        }
    )


class ProcessingStats(BaseModel):
    """Batch processing statistics."""
    batch_size: int = Field(..., description="Batch size")
    processed_count: int = Field(..., description="Successfully processed")
    failed_count: int = Field(..., description="Failed to process")
    topics_created: int = Field(..., description="Topics created")
    duration_ms: float = Field(..., description="Processing duration")
    success_rate: float = Field(..., description="Success rate (0-1)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "batch_size": 100,
                "processed_count": 92,
                "failed_count": 8,
                "topics_created": 5,
                "duration_ms": 2500.5,
                "success_rate": 0.92
            }
        }
    )


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(default=None, description="Error code")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Error details")
    timestamp: datetime = Field(..., description="Error timestamp")
    path: Optional[str] = Field(default=None, description="Request path")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "Text validation failed",
                "error_code": "VALIDATION_ERROR",
                "details": {
                    "field": "text",
                    "reason": "Text cannot be empty"
                },
                "timestamp": "2024-01-15T12:00:00Z",
                "path": "/classify"
            }
        }
    )


class LanguageDetection(BaseModel):
    """Language detection result."""
    language: str = Field(..., description="Detected language code")
    language_name: str = Field(..., description="Language full name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    is_supported: bool = Field(..., description="Whether language is supported")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "language": "en",
                "language_name": "English",
                "confidence": 0.95,
                "is_supported": True
            }
        }
    )


class TopicHistory(BaseModel):
    """Historical data for a topic."""
    timestamp: datetime = Field(..., description="Timestamp")
    virality_score: Optional[float] = Field(default=None, description="Virality score at timestamp")
    engagement: Optional[int] = Field(default=None, description="Engagement at timestamp")
    velocity: Optional[float] = Field(default=None, description="Velocity at timestamp")
    sentiment: Optional[float] = Field(default=None, description="Sentiment at timestamp")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "timestamp": "2024-01-15T12:00:00Z",
                "virality_score": 85.5,
                "engagement": 50000,
                "velocity": 78.2,
                "sentiment": 0.75
            }
        }
    )