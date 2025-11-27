"""Sentiment analysis service using transformer models."""
import logging
import time
import hashlib
from typing import Dict, List, Optional, Tuple
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch.nn.functional as F

from ..config import settings
from ..models.schemas import SentimentScore

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """Sentiment analysis service using transformer models."""

    def __init__(self, model_path: Optional[str] = None, device: str = "cpu"):
        """
        Initialize sentiment analyzer.

        Args:
            model_path: Path to sentiment model
            device: Device to run inference on (cpu, cuda, mps)
        """
        self.model_path = model_path or settings.sentiment_model_path
        self.device = device or settings.device
        self.model = None
        self.tokenizer = None
        self._is_loaded = False

        # Default model if no local model specified
        self.model_name = "distilbert-base-uncased-finetuned-sst-2-english"

        # Cache for results
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour

        # Label mappings (may vary by model)
        self.label_mapping = {
            "LABEL_0": "negative",
            "LABEL_1": "positive",
            "NEGATIVE": "negative",
            "POSITIVE": "positive",
            "NEUTRAL": "neutral"
        }

    async def load_model(self) -> None:
        """Load sentiment analysis model."""
        try:
            logger.info(f"Loading sentiment model: {self.model_name}")

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
            logger.info(f"Sentiment model loaded successfully on {self.device}")

        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            raise

    async def analyze(self, text: str, include_emotions: bool = False) -> SentimentScore:
        """
        Analyze sentiment of text.

        Args:
            text: Input text to analyze
            include_emotions: Whether to include emotion analysis

        Returns:
            SentimentScore object with results
        """
        if not text:
            return SentimentScore(
                score=0.0,
                label="neutral",
                confidence=0.0,
                emotions=None
            )

        # Check cache first
        cache_key = self._get_cache_key(text)
        if cache_key in self.cache:
            cached_result, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                logger.debug(f"Using cached sentiment result for text: {text[:50]}...")
                return cached_result

        if not self._is_loaded:
            await self.load_model()

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

            # Get sentiment score (-1 to 1 scale)
            score = self.calculate_sentiment_score(logits)

            # Get label and confidence
            confidence, label = self.get_sentiment_label_and_confidence(probabilities)

            # Get emotions if requested
            emotions = None
            if include_emotions:
                emotions = await self.analyze_emotions(processed_text)

            # Create result
            result = SentimentScore(
                score=score,
                label=label,
                confidence=confidence,
                emotions=emotions
            )

            # Cache result
            self.cache[cache_key] = (result, time.time())

            return result

        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            # Return neutral on error
            return SentimentScore(
                score=0.0,
                label="neutral",
                confidence=0.0,
                emotions=None
            )

    async def analyze_batch(
        self,
        texts: List[str],
        include_emotions: bool = False
    ) -> List[SentimentScore]:
        """
        Batch sentiment analysis for efficiency.

        Args:
            texts: List of texts to analyze
            include_emotions: Whether to include emotion analysis

        Returns:
            List of SentimentScore objects
        """
        if not texts:
            return []

        if not self._is_loaded:
            await self.load_model()

        results = []
        batch_size = 16  # Process in batches to manage memory

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_results = await self._analyze_batch_internal(batch_texts, include_emotions)
            results.extend(batch_results)

        return results

    async def _analyze_batch_internal(
        self,
        texts: List[str],
        include_emotions: bool = False
    ) -> List[SentimentScore]:
        """
        Internal batch analysis method.

        Args:
            texts: Batch of texts to analyze
            include_emotions: Whether to include emotion analysis

        Returns:
            List of SentimentScore objects
        """
        try:
            # Preprocess texts
            processed_texts = [self.preprocess_text(text) for text in texts]

            # Tokenize batch
            inputs = self.tokenizer(
                processed_texts,
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

            # Process results
            results = []
            for i, (text, logit, prob) in enumerate(zip(texts, logits, probabilities)):
                # Get sentiment score
                score = self.calculate_sentiment_score(logit.unsqueeze(0))

                # Get label and confidence
                confidence, label = self.get_sentiment_label_and_confidence(prob.unsqueeze(0))

                # Get emotions if requested
                emotions = None
                if include_emotions:
                    emotions = await self.analyze_emotions(processed_texts[i])

                result = SentimentScore(
                    score=score,
                    label=label,
                    confidence=confidence,
                    emotions=emotions
                )

                results.append(result)

            return results

        except Exception as e:
            logger.error(f"Batch sentiment analysis failed: {e}")
            # Return neutral results for all texts
            return [
                SentimentScore(score=0.0, label="neutral", confidence=0.0, emotions=None)
                for _ in texts
            ]

    def calculate_sentiment_score(self, logits: torch.Tensor) -> float:
        """
        Convert model logits to -1 to 1 scale.

        Args:
            logits: Model output logits

        Returns:
            Sentiment score (-1 to 1)
        """
        # Apply softmax to get probabilities
        probs = F.softmax(logits, dim=-1)

        # For binary sentiment models
        if probs.shape[-1] == 2:
            # Assuming [negative, positive]
            pos_prob = probs[0][1].item()
            neg_prob = probs[0][0].item()
            # Convert to -1 to 1 scale
            score = pos_prob - neg_prob
        else:
            # For ternary models with neutral
            if probs.shape[-1] == 3:
                # Assuming [negative, neutral, positive]
                pos_prob = probs[0][2].item()
                neg_prob = probs[0][0].item()
                score = pos_prob - neg_prob
            else:
                # Default handling
                score = 0.0

        return float(score)

    def get_sentiment_label_and_confidence(
        self,
        probabilities: torch.Tensor
    ) -> Tuple[float, str]:
        """
        Get sentiment label and confidence from probabilities.

        Args:
            probabilities: Model output probabilities

        Returns:
            Tuple of (confidence, label)
        """
        # Get max probability and index
        max_prob, predicted_class = torch.max(probabilities, dim=-1)
        confidence = max_prob[0].item()

        # Map class index to label
        if probabilities.shape[-1] == 2:
            # Binary: [negative, positive]
            label = "positive" if predicted_class[0].item() == 1 else "negative"
        elif probabilities.shape[-1] == 3:
            # Ternary: [negative, neutral, positive]
            class_idx = predicted_class[0].item()
            labels = ["negative", "neutral", "positive"]
            label = labels[class_idx]
        else:
            label = "neutral"

        return float(confidence), label

    def get_sentiment_label(self, score: float) -> str:
        """
        Convert score to sentiment label.

        Args:
            score: Sentiment score (-1 to 1)

        Returns:
            Sentiment label string
        """
        if score > 0.3:
            return "positive"
        elif score < -0.3:
            return "negative"
        else:
            return "neutral"

    async def analyze_emotions(self, text: str) -> Optional[Dict[str, float]]:
        """
        Analyze emotional content (simplified implementation).

        Args:
            text: Input text

        Returns:
            Dictionary of emotion: score
        """
        try:
            # Simple emotion keyword-based approach
            # In production, you'd use a dedicated emotion model
            emotion_keywords = {
                "joy": ["happy", "joy", "excited", "wonderful", "amazing", "great", "love"],
                "anger": ["angry", "mad", "furious", "annoyed", "frustrated", "hate"],
                "sadness": ["sad", "unhappy", "depressed", "lonely", "cry", "miss"],
                "fear": ["scared", "afraid", "fear", "worry", "anxious", "nervous"],
                "surprise": ["surprised", "shocked", "amazed", "unexpected", "wow"]
            }

            emotions = {}
            text_lower = text.lower()

            for emotion, keywords in emotion_keywords.items():
                score = sum(1 for keyword in keywords if keyword in text_lower)
                # Normalize score (0 to 1)
                emotions[emotion] = min(score / 5.0, 1.0)

            # Normalize all emotions to sum to 1
            total = sum(emotions.values())
            if total > 0:
                emotions = {k: v/total for k, v in emotions.items()}

            return emotions

        except Exception as e:
            logger.error(f"Emotion analysis failed: {e}")
            return None

    def get_dominant_emotion(self, emotions: Dict[str, float]) -> str:
        """
        Get emotion with highest score.

        Args:
            emotions: Dictionary of emotion: score

        Returns:
            Dominant emotion or "neutral"
        """
        if not emotions:
            return "neutral"

        # Check if any emotion has significant score (>0.3)
        max_emotion = max(emotions.items(), key=lambda x: x[1])
        return max_emotion[0] if max_emotion[1] > 0.3 else "neutral"

    def preprocess_text(self, text: str) -> str:
        """
        Clean text for sentiment analysis.

        Args:
            text: Input text

        Returns:
            Preprocessed text
        """
        if not text:
            return ""

        # Basic preprocessing
        text = text.strip()

        # Keep emojis as they carry sentiment
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
        """Clear the sentiment analysis cache."""
        self.cache.clear()
        logger.info("Sentiment analysis cache cleared")

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
sentiment_analyzer = SentimentAnalyzer()