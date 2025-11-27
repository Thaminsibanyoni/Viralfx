"""Configuration settings for the Trend Intelligence service."""
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database Settings
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/viralfx",
        description="PostgreSQL connection string"
    )
    database_pool_size: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Database connection pool size"
    )
    database_max_overflow: int = Field(
        default=20,
        ge=0,
        le=100,
        description="Database max overflow connections"
    )

    # Redis Settings
    redis_url: str = Field(
        default="redis://localhost:6379",
        description="Redis connection string"
    )
    redis_db: int = Field(
        default=0,
        ge=0,
        le=15,
        description="Redis database number"
    )
    redis_password: Optional[str] = Field(
        default=None,
        description="Redis password"
    )

    # Social Media API Keys (for future use)
    twitter_bearer_token: Optional[str] = Field(
        default=None,
        description="Twitter API bearer token"
    )
    tiktok_api_key: Optional[str] = Field(
        default=None,
        description="TikTok API key"
    )
    instagram_access_token: Optional[str] = Field(
        default=None,
        description="Instagram access token"
    )
    youtube_api_key: Optional[str] = Field(
        default=None,
        description="YouTube API key"
    )
    facebook_access_token: Optional[str] = Field(
        default=None,
        description="Facebook access token"
    )

    # Model Settings
    sentiment_model_path: str = Field(
        default="./models/sentiment_model.pt",
        description="Path to sentiment model"
    )
    toxicity_model_path: str = Field(
        default="./models/toxicity_model.pt",
        description="Path to toxicity model"
    )
    language_model: str = Field(
        default="fasttext",
        description="Language detection model"
    )
    embedding_model: str = Field(
        default="all-MiniLM-L6-v2",
        description="Sentence transformer model for embeddings"
    )

    # Filtering Thresholds
    toxicity_threshold: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Toxicity score threshold"
    )
    min_virality_score: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Minimum virality score to store"
    )
    min_text_length: int = Field(
        default=10,
        ge=1,
        description="Minimum text length"
    )
    max_text_length: int = Field(
        default=5000,
        ge=10,
        description="Maximum text length"
    )

    # Regional Settings
    default_region: str = Field(
        default="ZA",
        description="Default region code"
    )
    supported_regions: List[str] = Field(
        default=["GP", "WC", "KZN", "EC", "FS", "MP", "NW", "NC", "LP"],
        description="Supported SA provinces"
    )
    supported_languages: List[str] = Field(
        default=["en", "af", "zu", "xh", "st", "tn", "ts", "ss", "nr", "ve"],
        description="Supported languages"
    )

    # Cache TTL (seconds)
    cache_ttl_trends: int = Field(
        default=300,
        ge=0,
        description="Trends cache TTL in seconds"
    )
    cache_ttl_classification: int = Field(
        default=3600,
        ge=0,
        description="Classification cache TTL in seconds"
    )
    cache_ttl_topics: int = Field(
        default=900,
        ge=0,
        description="Topics cache TTL in seconds"
    )

    # Performance Settings
    max_batch_size: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Maximum batch size for processing"
    )
    worker_threads: int = Field(
        default=4,
        ge=1,
        le=20,
        description="Number of worker threads"
    )
    request_timeout: int = Field(
        default=30,
        ge=1,
        le=300,
        description="HTTP request timeout in seconds"
    )

    # Application Settings
    debug: bool = Field(
        default=False,
        description="Debug mode flag"
    )
    allowed_origins: List[str] = Field(
        default=["*"],
        description="CORS allowed origins"
    )
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )
    service_name: str = Field(
        default="trend-intel",
        description="Service name"
    )

    # Device configuration
    device: str = Field(
        default="cpu",
        description="Device to run models on (cpu, cuda, mps)"
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    @field_validator("supported_regions", mode="before")
    @classmethod
    def parse_regions(cls, v):
        """Parse supported regions from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    @field_validator("supported_languages", mode="before")
    @classmethod
    def parse_languages(cls, v):
        """Parse supported languages from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, v):
        """Normalize log level to uppercase."""
        return v.upper() if v else "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow"  # Allow extra fields for flexibility
    )


# Global settings instance
settings = Settings()