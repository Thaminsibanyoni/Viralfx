"""Language detection service supporting South African languages."""
import logging
from typing import List, Tuple, Dict, Optional
import hashlib
import time
from functools import lru_cache

# Try to import fasttext, fallback to langdetect if not available
try:
    import fasttext
    FASTTEXT_AVAILABLE = True
except ImportError:
    FASTTEXT_AVAILABLE = False
    logging.warning("fasttext not available, falling back to langdetect")

try:
    from langdetect import detect, DetectorFactory
    from langdetect.lang_detect_exception import LangDetectException
    LANGDETECT_AVAILABLE = True
    # Set seed for consistent results
    DetectorFactory.seed = 0
except ImportError:
    LANGDETECT_AVAILABLE = False
    logging.warning("langdetect not available")

from ..config import settings

logger = logging.getLogger(__name__)


class LanguageDetector:
    """Language detection service for South African languages."""

    def __init__(self, model_type: str = "fasttext"):
        """
        Initialize language detector.

        Args:
            model_type: Type of detection model ('fasttext' or 'langdetect')
        """
        self.model_type = model_type
        self.model = None
        self.is_model_loaded = False

        # South African language mappings
        self.sa_languages = {
            'en': 'English',
            'af': 'Afrikaans',
            'zu': 'isiZulu',
            'xh': 'isiXhosa',
            'st': 'Sesotho',
            'tn': 'Setswana',
            'ts': 'Xitsonga',
            'ss': 'siSwati',
            'nr': 'isiNdebele',
            've': 'Tshivenda'
        }

        # FastText language mappings
        self.fasttext_to_sa = {
            'en': 'en',
            'af': 'af',
            'zu': 'zu',  # May not be well supported by fasttext
            'xh': 'xh',  # May not be well supported by fasttext
            # Fallback mappings for unsupported SA languages
            'nr': 'zu',  # isiNdebele -> isiZulu
            'st': 'zu',  # Sesotho -> isiZulu
            'ts': 'zu',  # Xitsonga -> isiZulu
            'tn': 'af',  # Setswana -> Afrikaans
            'ss': 'zu',  # siSwati -> isiZulu
            've': 'en',  # Tshivenda -> English
        }

        # Language detection confidence thresholds
        self.confidence_thresholds = {
            'fasttext': 0.5,
            'langdetect': 0.7
        }

        # Cache for detection results
        self.detection_cache = {}
        self.cache_ttl = 3600  # 1 hour

    async def load_models(self) -> None:
        """Load language detection model."""
        if self.model_type == "fasttext" and FASTTEXT_AVAILABLE:
            await self._load_fasttext_model()
        elif LANGDETECT_AVAILABLE:
            self.is_model_loaded = True
            logger.info("Using langdetect for language detection")
        else:
            logger.error("No language detection libraries available")
            raise RuntimeError("Language detection libraries not available")

    async def _load_fasttext_model(self) -> None:
        """Load fastText language detection model."""
        try:
            # Download and load lid.176.bin (language identification model)
            model_path = "lid.176.bin"
            try:
                self.model = fasttext.load_model(model_path)
            except FileNotFoundError:
                logger.info("FastText model not found, attempting to download...")
                import urllib.request
                model_url = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin"
                urllib.request.urlretrieve(model_url, model_path)
                self.model = fasttext.load_model(model_path)

            self.is_model_loaded = True
            logger.info("FastText language model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load FastText model: {e}")
            # Fallback to langdetect
            if LANGDETECT_AVAILABLE:
                self.model_type = "langdetect"
                self.is_model_loaded = True
                logger.info("Falling back to langdetect")
            else:
                raise

    def detect(self, text: str, min_confidence: float = 0.5) -> Tuple[str, float]:
        """
        Detect language of text.

        Args:
            text: Input text
            min_confidence: Minimum confidence threshold

        Returns:
            Tuple of (language_code, confidence)
        """
        if not text or not self.is_model_loaded:
            return "unknown", 0.0

        # Check cache first
        cache_key = self._get_cache_key(text)
        if cache_key in self.detection_cache:
            cached_result, timestamp = self.detection_cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return cached_result

        try:
            if self.model_type == "fasttext" and self.model:
                language, confidence = self._detect_fasttext(text)
            elif LANGDETECT_AVAILABLE:
                language, confidence = self._detect_langdetect(text)
            else:
                return "unknown", 0.0

            # Map to SA language if possible
            mapped_language = self._map_to_sa_language(language)

            # Store in cache
            self.detection_cache[cache_key] = (mapped_language, confidence), time.time()

            return mapped_language, confidence

        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            return "unknown", 0.0

    def _detect_fasttext(self, text: str) -> Tuple[str, float]:
        """
        Detect language using FastText.

        Args:
            text: Input text

        Returns:
            Tuple of (language_code, confidence)
        """
        # FastText requires preprocessing
        processed_text = self._preprocess_for_detection(text)
        if not processed_text:
            return "unknown", 0.0

        # Predict language
        predictions = self.model.predict(processed_text, k=1)
        language = predictions[0][0].replace('__label__', '')
        confidence = float(predictions[1][0])

        return language.lower(), confidence

    def _detect_langdetect(self, text: str) -> Tuple[str, float]:
        """
        Detect language using langdetect.

        Args:
            text: Input text

        Returns:
            Tuple of (language_code, confidence)
        """
        # langdetect requires minimum text length
        if len(text) < 10:
            return "unknown", 0.0

        processed_text = self._preprocess_for_detection(text)
        if not processed_text:
            return "unknown", 0.0

        try:
            language = detect(processed_text)
            # langdetect doesn't provide confidence, use fixed high confidence
            confidence = 0.8
            return language.lower(), confidence

        except LangDetectException:
            return "unknown", 0.0

    def _preprocess_for_detection(self, text: str) -> str:
        """
        Preprocess text for better language detection.

        Args:
            text: Input text

        Returns:
            Preprocessed text
        """
        if not text:
            return ""

        # Remove URLs, mentions, hashtags for better detection
        import re
        text = re.sub(r'http[s]?://\S+', '', text)
        text = re.sub(r'@\w+', '', text)
        text = re.sub(r'#\w+', '', text)

        # Keep only letters and spaces
        text = re.sub(r'[^a-zA-Z\s]', '', text)

        # Normalize whitespace and limit length
        text = ' '.join(text.split())
        return text[:1000]  # Limit to first 1000 characters

    def _map_to_sa_language(self, language: str) -> str:
        """
        Map detected language to supported SA language.

        Args:
            language: Detected language code

        Returns:
            Mapped SA language code
        """
        # Direct mapping
        if language in self.sa_languages:
            return language

        # FastText mapping
        if self.model_type == "fasttext" and language in self.fasttext_to_sa:
            return self.fasttext_to_sa[language]

        # If not a supported language, return original
        return language

    def detect_batch(self, texts: List[str], min_confidence: float = 0.5) -> List[Tuple[str, float]]:
        """
        Detect language for multiple texts.

        Args:
            texts: List of input texts
            min_confidence: Minimum confidence threshold

        Returns:
            List of (language_code, confidence) tuples
        """
        results = []
        for text in texts:
            result = self.detect(text, min_confidence)
            results.append(result)
        return results

    def is_supported_language(self, text: str, min_confidence: float = 0.7) -> bool:
        """
        Check if text is in a supported SA language.

        Args:
            text: Input text
            min_confidence: Minimum confidence threshold

        Returns:
            True if language is supported and confidence >= threshold
        """
        language, confidence = self.detect(text, min_confidence)
        return language in self.sa_languages and confidence >= min_confidence

    def get_language_name(self, language_code: str) -> str:
        """
        Convert language code to full name.

        Args:
            language_code: Language code (e.g., 'en', 'af')

        Returns:
            Full language name
        """
        return self.sa_languages.get(language_code, language_code.upper())

    def detect_with_fallback(self, text: str) -> Tuple[str, float]:
        """
        Try fastText first, then langdetect.

        Args:
            text: Input text

        Returns:
            Tuple of (language_code, confidence)
        """
        if self.model_type == "fasttext" and self.model:
            try:
                return self.detect(text)
            except:
                pass

        if LANGDETECT_AVAILABLE:
            try:
                return self._detect_langdetect(text)
            except:
                pass

        return "unknown", 0.0

    def detect_mixed_language(self, text: str) -> Dict[str, float]:
        """
        Detect if text contains multiple languages.

        Args:
            text: Input text

        Returns:
            Dictionary of language_code: percentage
        """
        # Split text into sentences
        sentences = [s.strip() for s in text.split('.') if s.strip()]

        if not sentences:
            return {"unknown": 1.0}

        language_counts = {}
        total_sentences = len(sentences)

        for sentence in sentences:
            if len(sentence) < 10:  # Skip very short sentences
                continue

            language, confidence = self.detect(sentence)
            if confidence > 0.5:  # Only count confident detections
                language_counts[language] = language_counts.get(language, 0) + 1

        # Calculate percentages
        language_percentages = {}
        for lang, count in language_counts.items():
            percentage = count / total_sentences
            language_percentages[lang] = round(percentage, 2)

        return language_percentages if language_percentages else {"unknown": 1.0}

    def is_english(self, text: str, min_confidence: float = 0.7) -> bool:
        """
        Quick check if text is English.

        Args:
            text: Input text
            min_confidence: Minimum confidence

        Returns:
            True if detected as English with sufficient confidence
        """
        language, confidence = self.detect(text, min_confidence)
        return language == "en" and confidence >= min_confidence

    def is_afrikaans(self, text: str, min_confidence: float = 0.7) -> bool:
        """
        Quick check if text is Afrikaans.

        Args:
            text: Input text
            min_confidence: Minimum confidence

        Returns:
            True if detected as Afrikaans with sufficient confidence
        """
        language, confidence = self.detect(text, min_confidence)
        return language == "af" and confidence >= min_confidence

    def is_loaded(self) -> bool:
        """
        Check if models are loaded and ready.

        Returns:
            True if models are loaded
        """
        return self.is_model_loaded

    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.

        Returns:
            List of supported language codes
        """
        return list(self.sa_languages.keys())

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
        """Clear the detection cache."""
        self.detection_cache.clear()
        logger.info("Language detection cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        return {
            "cache_size": len(self.detection_cache),
            "ttl_seconds": self.cache_ttl
        }


# Global instance
language_detector = LanguageDetector()