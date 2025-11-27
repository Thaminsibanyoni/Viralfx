"""Toxicity detection service using transformer models."""
import logging
import time
import hashlib
from typing import Dict, List, Optional, Tuple
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch.nn.functional as F

from ..config import settings
from ..models.schemas import ToxicityScore

logger = logging.getLogger(__name__)


class ToxicityFilter:
    """Toxicity detection service for filtering harmful content."""

    def __init__(self, model_path: Optional[str] = None, device: str = "cpu", threshold: float = 0.3):
        """
        Initialize toxicity filter.

        Args:
            model_path: Path to toxicity model
            device: Device to run inference on (cpu, cuda, mps)
            threshold: Toxicity threshold (0.0 to 1.0)
        """
        self.model_path = model_path or settings.toxicity_model_path
        self.device = device or settings.device
        self.threshold = threshold or settings.toxicity_threshold
        self.model = None
        self.tokenizer = None
        self._is_loaded = False

        # Recommended toxicity models
        self.model_names = [
            "unitary/toxic-bert",
            "martin-ha/toxic-comment-model",
            "Hate-speech-CNERG/bert-base-uncased-hatexplain"
        ]
        self.model_name = self.model_names[0]  # Default model

        # Toxicity categories
        self.toxicity_categories = [
            "toxicity",
            "severe_toxicity",
            "obscene",
            "threat",
            "insult",
            "identity_hate"
        ]

        # Keyword blacklist for fallback
        self.blacklist = self._load_blacklist()

        # Cache for results
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour

    async def load_model(self) -> None:
        """Load toxicity detection model."""
        try:
            logger.info(f"Loading toxicity model: {self.model_name}")

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)

            # Load model
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                torch_dtype=torch.float32 if self.device == "cpu" else torch.float16
            )

            # Move to device
            self.model.to(self.device)
            self.model.eval()

            self._is_loaded = True
            logger.info(f"Toxicity model loaded successfully on {self.device}")

        except Exception as e:
            logger.error(f"Failed to load toxicity model: {e}")
            # Fallback to keyword-based filtering
            self._is_loaded = False
            logger.warning("Using keyword-based toxicity filtering as fallback")

    async def analyze(self, text: str) -> ToxicityScore:
        """
        Analyze text for toxicity.

        Args:
            text: Input text to analyze

        Returns:
            ToxicityScore object with results
        """
        if not text:
            return ToxicityScore(
                score=0.0,
                is_toxic=False,
                categories={},
                confidence=1.0
            )

        # Check cache first
        cache_key = self._get_cache_key(text)
        if cache_key in self.cache:
            cached_result, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                logger.debug(f"Using cached toxicity result for text: {text[:50]}...")
                return cached_result

        # Try model-based analysis first
        if self._is_loaded:
            result = await self._analyze_with_model(text)
        else:
            result = await self._analyze_with_keywords(text)

        # Cache result
        self.cache[cache_key] = (result, time.time())

        return result

    async def _analyze_with_model(self, text: str) -> ToxicityScore:
        """
        Analyze toxicity using ML model.

        Args:
            text: Input text

        Returns:
            ToxicityScore object
        """
        try:
            # Preprocess text
            processed_text = self.preprocess_text(text)

            # Tokenize
            inputs = self.tokenizer(
                processed_text,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=512
            )

            # Move to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            # Run inference
            with torch.no_grad():
                outputs = self.model(**inputs)

            # Get logits and apply softmax
            logits = outputs.logits
            probabilities = F.softmax(logits, dim=-1)

            # Calculate overall toxicity score
            toxicity_score = float(probabilities[0][1]) if probabilities.shape[1] == 2 else float(torch.max(probabilities[0]))

            # Detect categories (simplified - would need multi-label model for real categories)
            categories = self._detect_categories(processed_text, logits)

            # Determine if toxic
            is_toxic = toxicity_score >= self.threshold

            # Calculate confidence
            confidence = float(torch.max(probabilities[0]))

            return ToxicityScore(
                score=toxicity_score,
                is_toxic=is_toxic,
                categories=categories,
                confidence=confidence
            )

        except Exception as e:
            logger.error(f"Model-based toxicity analysis failed: {e}")
            # Fallback to keyword analysis
            return await self._analyze_with_keywords(text)

    async def _analyze_with_keywords(self, text: str) -> ToxicityScore:
        """
        Analyze toxicity using keyword-based approach (fallback).

        Args:
            text: Input text

        Returns:
            ToxicityScore object
        """
        try:
            # Check against blacklist
            is_toxic, matched_keywords = self.check_blacklist(text.lower())

            # Calculate score based on matched keywords
            toxicity_score = min(len(matched_keywords) * 0.2, 1.0) if matched_keywords else 0.0

            # Categorize matches
            categories = self._categorize_keywords(matched_keywords)

            # Calculate confidence (lower for keyword-based)
            confidence = 0.7 if toxicity_score > 0 else 1.0

            return ToxicityScore(
                score=toxicity_score,
                is_toxic=is_toxic,
                categories=categories,
                confidence=confidence
            )

        except Exception as e:
            logger.error(f"Keyword-based toxicity analysis failed: {e}")
            return ToxicityScore(
                score=0.0,
                is_toxic=False,
                categories={},
                confidence=0.0
            )

    async def analyze_batch(self, texts: List[str]) -> List[ToxicityScore]:
        """
        Batch toxicity analysis.

        Args:
            texts: List of texts to analyze

        Returns:
            List of ToxicityScore objects
        """
        if not texts:
            return []

        results = []
        for text in texts:
            result = await self.analyze(text)
            results.append(result)

        return results

    def is_toxic(self, text: str, threshold: Optional[float] = None) -> bool:
        """
        Quick toxicity check.

        Args:
            text: Input text
            threshold: Override default threshold

        Returns:
            True if text is toxic
        """
        check_threshold = threshold or self.threshold

        # Quick keyword check first
        is_toxic, _ = self.check_blacklist(text.lower())
        if is_toxic:
            return True

        # For more thorough check, would need async call
        # This is a simplified synchronous version
        return False

    def filter_batch(self, texts: List[str], threshold: Optional[float] = None) -> List[bool]:
        """
        Filter multiple texts efficiently.

        Args:
            texts: List of texts to filter
            threshold: Override default threshold

        Returns:
            List of booleans indicating which texts should be filtered
        """
        filter_threshold = threshold or self.threshold
        results = []

        for text in texts:
            is_toxic, _ = self.check_blacklist(text.lower())
            # Simple approximation - in production, would use async analyze
            toxicity_score = 1.0 if is_toxic else 0.0
            should_filter = toxicity_score >= filter_threshold
            results.append(should_filter)

        return results

    def _detect_categories(self, text: str, logits: torch.Tensor) -> Dict[str, float]:
        """
        Detect specific toxicity categories.

        Args:
            text: Input text
            logits: Model logits

        Returns:
            Dictionary of category: score
        """
        categories = {}

        # This is a simplified implementation
        # In production, you'd use a multi-label classification model
        text_lower = text.lower()

        # Define keyword patterns for each category
        category_keywords = {
            "violence": ["kill", "murder", "violence", "attack", "harm", "weapon"],
            "hate_speech": ["hate", "racist", "nazi", "kike", "nigger"],
            "profanity": ["fuck", "shit", "asshole", "bitch", "damn"],
            "sexual_content": ["sex", "porn", "nude", "explicit", "adult"],
            "threat": ["threaten", "kill you", "harm you", "find you"]
        }

        for category, keywords in category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            categories[category] = min(score / 3.0, 1.0)  # Normalize to 0-1

        return categories

    def get_primary_category(self, categories: Dict[str, float]) -> str:
        """
        Get category with highest score.

        Args:
            categories: Dictionary of category: score

        Returns:
            Primary category name
        """
        if not categories:
            return "general"

        max_category = max(categories.items(), key=lambda x: x[1])
        return max_category[0] if max_category[1] > 0.1 else "general"

    def check_blacklist(self, text: str) -> Tuple[bool, List[str]]:
        """
        Check text against curated keyword blacklist.

        Args:
            text: Lowercased text to check

        Returns:
            Tuple of (contains_blacklisted: bool, matched_keywords: List[str])
        """
        matched = []
        for keyword in self.blacklist:
            if keyword in text:
                matched.append(keyword)

        return len(matched) > 0, matched

    def _load_blacklist(self) -> List[str]:
        """
        Load keyword blacklist.

        Returns:
            List of blacklisted keywords
        """
        # This is a simplified blacklist
        # In production, you'd load from a curated list
        return [
            # Violence and harm
            "kill", "murder", "die", "death", "suicide", "harm", "violence",
            # Hate speech
            "hate", "racist", "nazi", "terrorist", "extremist",
            # Profanity
            "fuck", "shit", "cunt", "asshole", "bitch", "whore",
            # Adult content
            "porn", "sex", "nude", "explicit", "adult", "xxx",
            # Scams and illegal
            "scam", "fraud", "illegal", "drugs", "weapon",
        ]

    def _categorize_keywords(self, keywords: List[str]) -> Dict[str, float]:
        """
        Categorize matched keywords.

        Args:
            keywords: List of matched keywords

        Returns:
            Dictionary of category: score
        """
        categories = {
            "violence": 0.0,
            "hate_speech": 0.0,
            "profanity": 0.0,
            "sexual_content": 0.0,
            "threat": 0.0
        }

        violence_words = ["kill", "murder", "die", "death", "harm", "violence"]
        hate_words = ["hate", "racist", "nazi", "terrorist"]
        profanity_words = ["fuck", "shit", "cunt", "asshole", "bitch"]
        sexual_words = ["porn", "sex", "nude", "explicit", "adult"]
        threat_words = ["kill you", "harm you", "threaten"]

        text = " ".join(keywords).lower()

        for category, words in [
            ("violence", violence_words),
            ("hate_speech", hate_words),
            ("profanity", profanity_words),
            ("sexual_content", sexual_words),
            ("threat", threat_words)
        ]:
            count = sum(1 for word in words if word in text)
            categories[category] = min(count / 2.0, 1.0)  # Normalize

        return categories

    def preprocess_text(self, text: str) -> str:
        """
        Clean text for toxicity detection.

        Args:
            text: Input text

        Returns:
            Preprocessed text
        """
        if not text:
            return ""

        # Basic preprocessing
        text = text.strip()

        # Normalize unicode
        # Keep special characters as they may indicate toxicity
        # Remove excessive whitespace
        while "  " in text:
            text = text.replace("  ", " ")

        # Limit length
        return text[:512]

    def is_loaded(self) -> bool:
        """
        Check if model is loaded.

        Returns:
            True if model is loaded
        """
        return self._is_loaded

    def get_toxicity_level(self, score: float) -> str:
        """
        Categorize toxicity level.

        Args:
            score: Toxicity score (0 to 1)

        Returns:
            Toxicity level string
        """
        if score > 0.7:
            return "high"
        elif score > 0.4:
            return "moderate"
        elif score > 0.2:
            return "low"
        else:
            return "safe"

    def _get_cache_key(self, text: str) -> str:
        """
        Generate cache key from text hash.

        Args:
            text: Input text

        Returns:
            Cache key
        """
        return hashlib.md5(text.encode()).hexdigest()

    def clear_cache(self) -> None:
        """Clear the toxicity analysis cache."""
        self.cache.clear()
        logger.info("Toxicity analysis cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        return {
            "cache_size": len(self.cache),
            "ttl_seconds": self.cache_ttl
        }


# Global instance
toxicity_filter = ToxicityFilter()