"""SQLAlchemy ORM models for trend intelligence data."""
from datetime import datetime
from typing import List, Optional
from enum import Enum
from sqlalchemy import (
    String, Text, Integer, BigInteger, Float, DateTime, Boolean,
    JSON, Index, ForeignKey, func
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid


class Base(DeclarativeBase):
    """Base model for all ORM models."""
    pass


class PlatformEnum(str, Enum):
    """Social media platforms enum."""
    TWITTER = "TWITTER"
    INSTAGRAM = "INSTAGRAM"
    TIKTOK = "TIKTOK"
    YOUTUBE = "YOUTUBE"
    REDDIT = "REDDIT"
    DISCORD = "DISCORD"
    TELEGRAM = "TELEGRAM"
    FACEBOOK = "FACEBOOK"
    CUSTOM = "CUSTOM"


class ContentTypeEnum(str, Enum):
    """Content type enum."""
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    MIXED = "MIXED"


class TrendTopic(Base):
    """Trend topics table for storing viral content."""
    __tablename__ = "trend_topics"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Topic metadata
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    platforms: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    categories: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Metrics
    sentiment: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    toxicity: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    virality_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        index=True
    )
    velocity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Geographic
    region: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    history: Mapped[List["TrendHistory"]] = relationship(
        "TrendHistory",
        back_populates="topic",
        cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("idx_trend_topics_created_at", "created_at"),
        Index("idx_trend_topics_region", "region"),
        Index("idx_trend_topics_virality_score", "virality_score"),
        Index("idx_trend_topics_sentiment", "sentiment"),
        Index("idx_trend_topics_toxicity", "toxicity"),
    )

    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "title": self.title,
            "summary": self.summary,
            "platforms": self.platforms,
            "categories": self.categories,
            "sentiment": self.sentiment,
            "toxicity": self.toxicity,
            "virality_score": self.virality_score,
            "velocity": self.velocity,
            "engagement": self.engagement,
            "region": self.region,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TrendHistory(Base):
    """Historical snapshots of trend metrics."""
    __tablename__ = "trend_history"

    # Primary key
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Foreign key to TrendTopic
    topic_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trend_topics.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Metrics snapshot
    virality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    velocity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sentiment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    # Relationships
    topic: Mapped["TrendTopic"] = relationship("TrendTopic", back_populates="history")

    # Indexes
    __table_args__ = (
        Index("idx_trend_history_topic_timestamp", "topic_id", "timestamp"),
        Index("idx_trend_history_timestamp", "timestamp"),
    )

    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "topic_id": str(self.topic_id),
            "virality_score": self.virality_score,
            "engagement": self.engagement,
            "velocity": self.velocity,
            "sentiment": self.sentiment,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class IngestEvent(Base):
    """Read-only model for ingested posts from backend connectors."""
    __tablename__ = "IngestEvent"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True
    )

    # Optional foreign key to TrendTopic (set after processing)
    topicId: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trend_topics.id"),
        nullable=True,
        index=True
    )

    # Content metadata
    platform: Mapped[PlatformEnum] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    nativeId: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    authorId: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    authorHandle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contentType: Mapped[ContentTypeEnum] = mapped_column(
        String(20),
        nullable=False,
        default=ContentTypeEnum.TEXT
    )

    # Content
    textContent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mediaUrls: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # Engagement metrics
    engagementCount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    likesCount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sharesCount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    commentsCount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    viewsCount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Processing status
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Timestamps
    ingestedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    publishedAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True
    )

    # Indexes
    __table_args__ = (
        Index("idx_ingest_platform", "platform"),
        Index("idx_ingest_processed", "processed"),
        Index("idx_ingest_ingested_at", "ingestedAt"),
        Index("idx_ingest_published_at", "publishedAt"),
        Index("idx_ingest_engagement", "engagementCount"),
    )

    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "topicId": str(self.topicId) if self.topicId else None,
            "platform": self.platform.value,
            "nativeId": self.nativeId,
            "authorId": self.authorId,
            "authorHandle": self.authorHandle,
            "contentType": self.contentType.value,
            "textContent": self.textContent,
            "mediaUrls": self.mediaUrls,
            "engagementCount": self.engagementCount,
            "likesCount": self.likesCount,
            "sharesCount": self.sharesCount,
            "commentsCount": self.commentsCount,
            "viewsCount": self.viewsCount,
            "processed": self.processed,
            "ingestedAt": self.ingestedAt.isoformat() if self.ingestedAt else None,
            "publishedAt": self.publishedAt.isoformat() if self.publishedAt else None,
        }


# Helper functions
def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


def create_topic_from_data(data: dict) -> TrendTopic:
    """Create TrendTopic instance from dictionary."""
    return TrendTopic(
        id=uuid.UUID(data.get("id", generate_uuid())),
        title=data.get("title", ""),
        summary=data.get("summary"),
        platforms=data.get("platforms", []),
        categories=data.get("categories", []),
        sentiment=data.get("sentiment"),
        toxicity=data.get("toxicity"),
        virality_score=data.get("virality_score"),
        velocity=data.get("velocity"),
        engagement=data.get("engagement"),
        region=data.get("region"),
    )


def create_history_from_data(data: dict) -> TrendHistory:
    """Create TrendHistory instance from dictionary."""
    return TrendHistory(
        topic_id=uuid.UUID(data["topic_id"]) if isinstance(data["topic_id"], str) else data["topic_id"],
        virality_score=data.get("virality_score"),
        engagement=data.get("engagement"),
        velocity=data.get("velocity"),
        sentiment=data.get("sentiment"),
        timestamp=data.get("timestamp", datetime.utcnow()),
    )