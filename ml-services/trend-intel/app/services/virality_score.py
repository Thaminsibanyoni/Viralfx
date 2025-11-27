"""Virality scoring service implementing the (E + V + S) * Q * R formula."""
import logging
import math
from typing import Dict, Optional, List
from datetime import datetime, timedelta

from ..models.schemas import ViralityMetrics
from ..utils.cache import cache_service
from ..config import settings

logger = logging.getLogger(__name__)


class ViralityScorer:
    """Virality scoring service using the (E + V + S) * Q * R formula."""

    def __init__(self, cache_service=None):
        """
        Initialize virality scorer.

        Args:
            cache_service: Cache service instance for historical data
        """
        self.cache_service = cache_service
        self.min_virality_score = settings.min_virality_score

    def calculate_virality_score(self, metrics: Dict) -> ViralityMetrics:
        """
        Calculate complete virality score using the formula.

        Formula: ViralityScore = (E + V + S) * Q * R
        where:
        E = Engagement rate (0-100)
        V = Velocity (0-100)
        S = Sentiment strength (0-100)
        Q = Quality multiplier (0.1-1.5)
        R = Regional weight (1.0-1.5)

        Args:
            metrics: Dictionary containing all necessary metrics

        Returns:
            ViralityMetrics object with all components and final score
        """
        try:
            # Extract components
            engagement = metrics.get('likes', 0) + metrics.get('comments', 0) + metrics.get('shares', 0)
            impressions = metrics.get('impressions', metrics.get('views', 1)) or 1
            historical_engagement = metrics.get('historical_engagement', 0)
            time_diff_minutes = metrics.get('time_diff_minutes', 60)
            sentiment_score = metrics.get('sentiment', 0.0)
            toxicity = metrics.get('toxicity', 0.0)
            language_confidence = metrics.get('language_confidence', 0.0)
            is_spam = metrics.get('is_spam', False)
            region = metrics.get('region', None)
            is_sa = metrics.get('is_sa', False)

            # Calculate individual components
            E = self.calculate_engagement_rate(engagement, impressions)
            V = self.calculate_velocity(engagement, historical_engagement, time_diff_minutes)
            S = self.calculate_sentiment_strength(sentiment_score)
            Q = self.calculate_quality_multiplier(toxicity, language_confidence, is_spam)
            R = self.calculate_regional_weight(region, is_sa)

            # Apply formula: (E + V + S) * Q * R
            virality_score = (E + V + S) * Q * R

            # Cap at 100
            virality_score = min(virality_score, 100.0)

            return ViralityMetrics(
                engagement_rate=E,
                velocity=V,
                sentiment_strength=S,
                quality_multiplier=Q,
                regional_weight=R,
                virality_score=virality_score,
                formula="(E + V + S) * Q * R"
            )

        except Exception as e:
            logger.error(f"Virality score calculation failed: {e}")
            # Return zero score on error
            return ViralityMetrics(
                engagement_rate=0.0,
                velocity=0.0,
                sentiment_strength=0.0,
                quality_multiplier=0.1,
                regional_weight=1.0,
                virality_score=0.0,
                formula="(E + V + S) * Q * R"
            )

    def calculate_engagement_rate(self, likes: int, shares: int, comments: int, views: int, impressions: int) -> float:
        """
        Calculate engagement rate (E component).

        Formula: E = (likes + comments + shares) / impressions * 100
        Normalized to 0-100 scale with logarithmic scaling.

        Args:
            likes: Number of likes
            shares: Number of shares
            comments: Number of comments
            views: Number of views
            impressions: Number of impressions

        Returns:
            Engagement rate (0 to 100)
        """
        try:
            total_engagement = likes + comments + shares
            effective_impressions = max(impressions or views or 1, 1)

            # Raw engagement rate
            raw_rate = (total_engagement / effective_impressions) * 100

            # Normalize with logarithmic scaling to prevent extremely high values
            normalized_rate = min(math.log10(raw_rate + 1) * 20, 100.0)

            return round(normalized_rate, 2)

        except Exception as e:
            logger.error(f"Engagement rate calculation failed: {e}")
            return 0.0

    def calculate_velocity(self, current_engagement: int, previous_engagement: int, time_minutes: int) -> float:
        """
        Calculate velocity (V component).

        Formula: V = Δengagement / Δtime
        Normalized to 0-100 scale with logarithmic scaling.

        Args:
            current_engagement: Current engagement count
            previous_engagement: Engagement count from previous time
            time_minutes: Time difference in minutes

        Returns:
            Velocity score (0 to 100)
        """
        try:
            if time_minutes <= 0:
                return 0.0

            engagement_change = current_engagement - previous_engagement
            if engagement_change <= 0:
                return 0.0

            # Raw velocity (engagement per minute)
            raw_velocity = engagement_change / time_minutes

            # Normalize with logarithmic scaling
            # High velocities get compressed
            normalized_velocity = min(math.log10(raw_velocity + 1) * 15, 100.0)

            return round(normalized_velocity, 2)

        except Exception as e:
            logger.error(f"Velocity calculation failed: {e}")
            return 0.0

    def calculate_sentiment_strength(self, sentiment_score: float) -> float:
        """
        Calculate sentiment strength (S component).

        Formula: S = |sentiment_score| * 100
        Both positive and negative sentiment contribute to virality.

        Args:
            sentiment_score: Sentiment score (-1 to 1)

        Returns:
            Sentiment strength (0 to 100)
        """
        try:
            # Use absolute value - both strong positive and negative contribute
            strength = abs(sentiment_score) * 100
            return round(min(strength, 100.0), 2)

        except Exception as e:
            logger.error(f"Sentiment strength calculation failed: {e}")
            return 0.0

    def calculate_quality_multiplier(self, toxicity: float, language_confidence: float, is_spam: bool) -> float:
        """
        Calculate quality multiplier (Q component).

        Base multiplier: 1.0
        Adjustments:
        - Low toxicity (< 0.3): +0.2
        - High toxicity (> 0.7): -0.5
        - Supported language with high confidence: +0.1
        - Spam detected: -0.8

        Args:
            toxicity: Toxicity score (0 to 1)
            language_confidence: Language detection confidence (0 to 1)
            is_spam: Whether content appears to be spam

        Returns:
            Quality multiplier (0.1 to 1.5)
        """
        try:
            multiplier = 1.0

            # Toxicity adjustments
            if toxicity < 0.3:
                multiplier += 0.2  # Low toxicity boost
            elif toxicity > 0.7:
                multiplier -= 0.5  # High toxicity penalty

            # Language quality
            if language_confidence > 0.8:
                multiplier += 0.1  # High confidence boost

            # Spam penalty
            if is_spam:
                multiplier -= 0.8

            # Ensure multiplier stays within reasonable bounds
            return round(max(0.1, min(multiplier, 1.5)), 2)

        except Exception as e:
            logger.error(f"Quality multiplier calculation failed: {e}")
            return 0.5

    def calculate_regional_weight(self, region: str, is_sa: bool) -> float:
        """
        Calculate regional weight (R component).

        Base weight: 1.0
        South African content: +0.3
        High-engagement regions: +0.1

        Args:
            region: Region code
            is_sa: Whether content is South African

        Returns:
            Regional weight (1.0 to 1.5)
        """
        try:
            weight = 1.0

            # South African boost
            if is_sa:
                weight += 0.3

            # High-engagement regions
            high_engagement_regions = ["GP", "WC", "KZN"]
            if region in high_engagement_regions:
                weight += 0.1

            return round(weight, 2)

        except Exception as e:
            logger.error(f"Regional weight calculation failed: {e}")
            return 1.0

    def calculate_topic_virality(self, posts: List[Dict]) -> float:
        """
        Calculate aggregate virality for a topic (multiple posts).

        Args:
            posts: List of post dictionaries

        Returns:
            Topic virality score (0 to 100)
        """
        try:
            if not posts:
                return 0.0

            total_score = 0.0
            total_weight = 0.0

            for post in posts:
                # Calculate virality for individual post
                metrics = {
                    'likes': post.get('likesCount', 0),
                    'comments': post.get('commentsCount', 0),
                    'shares': post.get('sharesCount', 0),
                    'views': post.get('viewsCount', 0),
                    'impressions': post.get('engagementCount', 0),
                    'sentiment': post.get('sentiment', 0.0),
                    'toxicity': post.get('toxicity', 0.0),
                    'is_spam': post.get('is_spam', False),
                    'region': post.get('region'),
                    'is_sa': post.get('is_sa', False)
                }

                virality_metrics = self.calculate_virality_score(metrics)
                score = virality_metrics.virality_score

                # Weight by recency (newer posts weighted higher)
                published_at = post.get('publishedAt')
                if published_at:
                    if isinstance(published_at, str):
                        published_at = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                    age_hours = (datetime.utcnow() - published_at.replace(tzinfo=None)).total_seconds() / 3600
                    recency_weight = math.exp(-age_hours / 24)  # Decay over 24 hours
                else:
                    recency_weight = 0.5

                total_score += score * recency_weight
                total_weight += recency_weight

            if total_weight == 0:
                return 0.0

            return round(total_score / total_weight, 2)

        except Exception as e:
            logger.error(f"Topic virality calculation failed: {e}")
            return 0.0

    def is_trending(self, virality_score: float, velocity: float, threshold: float = None) -> bool:
        """
        Determine if content is trending.

        Args:
            virality_score: Virality score
            velocity: Velocity score
            threshold: Custom threshold

        Returns:
            True if trending
        """
        try:
            threshold = threshold or self.min_virality_score
            return virality_score >= threshold and velocity > 10

        except Exception as e:
            logger.error(f"Trending detection failed: {e}")
            return False

    def detect_breakout(self, current_score: float, historical_scores: List[float]) -> bool:
        """
        Detect sudden breakout in virality.

        Args:
            current_score: Current virality score
            historical_scores: List of historical scores

        Returns:
            True if breakout detected
        """
        try:
            if not historical_scores:
                return False

            # Calculate historical average
            avg_historical = sum(historical_scores) / len(historical_scores)

            # Breakout if current is more than 2x historical average
            return current_score > (avg_historical * 2)

        except Exception as e:
            logger.error(f"Breakout detection failed: {e}")
            return False

    def get_score_category(self, score: float) -> str:
        """
        Categorize virality score.

        Args:
            score: Virality score (0 to 100)

        Returns:
            Category string
        """
        if score >= 80:
            return "viral"
        elif score >= 60:
            return "trending"
        elif score >= 40:
            return "growing"
        elif score >= 20:
            return "emerging"
        else:
            return "low"

    def explain_score(self, metrics: ViralityMetrics) -> str:
        """
        Generate human-readable explanation of score.

        Args:
            metrics: ViralityMetrics object

        Returns:
            Explanation string
        """
        try:
            parts = []

            # Base components
            base_sum = metrics.engagement_rate + metrics.velocity + metrics.sentiment_strength
            parts.append(f"Base score: {base_sum:.1f} (E={metrics.engagement_rate:.1f}, V={metrics.velocity:.1f}, S={metrics.sentiment_strength:.1f})")

            # Quality impact
            if metrics.quality_multiplier > 1.0:
                parts.append(f"High quality (+{(metrics.quality_multiplier - 1) * 100:.0f}%)")
            elif metrics.quality_multiplier < 1.0:
                parts.append(f"Low quality ({-(1 - metrics.quality_multiplier) * 100:.0f}%)")

            # Regional impact
            if metrics.regional_weight > 1.0:
                parts.append(f"Regional boost (+{(metrics.regional_weight - 1) * 100:.0f}%)")

            # Final score
            parts.append(f"Final score: {metrics.virality_score:.1f}")

            return " | ".join(parts)

        except Exception as e:
            logger.error(f"Score explanation failed: {e}")
            return "Explanation unavailable"

    def validate_metrics(self, metrics: Dict) -> bool:
        """
        Validate that all required metrics are present and reasonable.

        Args:
            metrics: Metrics dictionary

        Returns:
            True if valid
        """
        try:
            # Check for negative values where not expected
            if metrics.get('likes', 0) < 0 or metrics.get('shares', 0) < 0 or metrics.get('comments', 0) < 0:
                return False

            # Check for reasonable ranges
            sentiment = metrics.get('sentiment', 0)
            if sentiment < -1 or sentiment > 1:
                return False

            toxicity = metrics.get('toxicity', 0)
            if toxicity < 0 or toxicity > 1:
                return False

            return True

        except Exception as e:
            logger.error(f"Metrics validation failed: {e}")
            return False

    def apply_time_decay(self, score: float, age_hours: float, half_life_hours: float = 24) -> float:
        """
        Apply exponential decay based on content age.

        Args:
            score: Original score
            age_hours: Age in hours
            half_life_hours: Half-life for decay

        Returns:
            Decayed score
        """
        try:
            decay_factor = math.pow(0.5, age_hours / half_life_hours)
            return score * decay_factor

        except Exception as e:
            logger.error(f"Time decay calculation failed: {e}")
            return score

    def calculate_recency_weight(self, timestamp: datetime) -> float:
        """
        Calculate weight based on recency.

        Args:
            timestamp: Content timestamp

        Returns:
            Recency weight (0.2 to 1.0)
        """
        try:
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            age_hours = (datetime.utcnow() - timestamp.replace(tzinfo=None)).total_seconds() / 3600

            if age_hours < 1:
                return 1.0
            elif age_hours < 6:
                return 0.8
            elif age_hours < 24:
                return 0.5
            elif age_hours < 168:  # 1 week
                return 0.3
            else:
                return 0.2

        except Exception as e:
            logger.error(f"Recency weight calculation failed: {e}")
            return 0.5


# Global instance
virality_scorer = ViralityScorer(cache_service)