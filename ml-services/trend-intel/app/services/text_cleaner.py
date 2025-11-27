"""Text cleaning service to preprocess social media content."""
import re
import html
import logging
from typing import List, Dict, Tuple, Optional
from bs4 import BeautifulSoup
import emoji
from unidecode import unidecode

logger = logging.getLogger(__name__)


class TextCleaner:
    """Text cleaning service for social media content."""

    def __init__(self):
        """Initialize the text cleaner with compiled regex patterns."""
        # Compile regex patterns for better performance
        self.url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        self.mention_pattern = re.compile(r'@\w+')
        self.hashtag_pattern = re.compile(r'#\w+')
        self.whitespace_pattern = re.compile(r'\s+')
        self.special_chars_pattern = re.compile(r'[^a-zA-Z0-9\s.,!?;:]')
        self.repeated_chars_pattern = re.compile(r'(.)\1{2,}')
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

    def clean(
        self,
        text: str,
        preserve_hashtags: bool = True,
        preserve_mentions: bool = False
    ) -> str:
        """
        Main cleaning method that applies all cleaning steps.

        Args:
            text: Input text to clean
            preserve_hashtags: Whether to preserve hashtags
            preserve_mentions: Whether to preserve mentions

        Returns:
            Cleaned text
        """
        if not text:
            return ""

        cleaned = text.strip()

        # Remove HTML tags
        cleaned = self.remove_html_tags(cleaned)

        # Remove URLs
        cleaned = self.remove_urls(cleaned)

        # Remove email addresses
        cleaned = self.remove_emails(cleaned)

        # Handle hashtags and mentions
        if not preserve_hashtags:
            cleaned = self.remove_hashtags(cleaned)

        if not preserve_mentions:
            cleaned = self.remove_mentions(cleaned)

        # Remove emojis if needed for certain processing
        # For classification, we'll keep emojis but convert them to text
        cleaned = self.replace_emojis_with_text(cleaned)

        # Remove special characters
        cleaned = self.remove_special_characters(cleaned, keep_punctuation=True)

        # Normalize unicode
        cleaned = self.normalize_unicode(cleaned)

        # Reduce repeated characters
        cleaned = self.remove_repeated_characters(cleaned, max_repeats=2)

        # Normalize whitespace
        cleaned = self.normalize_whitespace(cleaned)

        return cleaned.strip()

    def remove_urls(self, text: str) -> str:
        """
        Remove all URLs from text.

        Args:
            text: Input text

        Returns:
            Text with URLs removed
        """
        return self.url_pattern.sub('', text)

    def remove_emails(self, text: str) -> str:
        """
        Remove email addresses from text.

        Args:
            text: Input text

        Returns:
            Text with emails removed
        """
        return self.email_pattern.sub('', text)

    def remove_html_tags(self, text: str) -> str:
        """
        Remove HTML tags using BeautifulSoup.

        Args:
            text: Input text

        Returns:
            Text with HTML tags removed
        """
        try:
            soup = BeautifulSoup(text, 'html.parser')
            return soup.get_text()
        except Exception as e:
            logger.warning(f"Failed to parse HTML: {e}")
            # Fallback to simple regex removal
            html_pattern = re.compile(r'<[^>]+>')
            return html_pattern.sub('', text)

    def remove_mentions(self, text: str) -> str:
        """
        Remove @mentions from text.

        Args:
            text: Input text

        Returns:
            Text with mentions removed
        """
        return self.mention_pattern.sub('', text)

    def extract_hashtags(self, text: str) -> List[str]:
        """
        Extract all hashtags from text.

        Args:
            text: Input text

        Returns:
            List of hashtags without # symbol
        """
        hashtags = self.hashtag_pattern.findall(text)
        # Remove # symbol and convert to lowercase
        return [hashtag[1:].lower() for hashtag in hashtags]

    def remove_hashtags(self, text: str) -> str:
        """
        Remove #hashtags from text.

        Args:
            text: Input text

        Returns:
            Text with hashtags removed
        """
        return self.hashtag_pattern.sub('', text)

    def remove_emojis(self, text: str) -> str:
        """
        Remove all emojis from text.

        Args:
            text: Input text

        Returns:
            Text with emojis removed
        """
        return emoji.replace_emoji(text, replace='')

    def replace_emojis_with_text(self, text: str) -> str:
        """
        Replace emojis with text descriptions.

        Args:
            text: Input text

        Returns:
            Text with emojis replaced by descriptions
        """
        return emoji.demojize(text)

    def normalize_whitespace(self, text: str) -> str:
        """
        Replace multiple spaces with single space and trim.

        Args:
            text: Input text

        Returns:
            Normalized text
        """
        # Replace multiple whitespace with single space
        text = self.whitespace_pattern.sub(' ', text)
        return text.strip()

    def remove_special_characters(self, text: str, keep_punctuation: bool = True) -> str:
        """
        Remove special characters from text.

        Args:
            text: Input text
            keep_punctuation: Whether to keep basic punctuation

        Returns:
            Text with special characters removed
        """
        if keep_punctuation:
            pattern = r'[^a-zA-Z0-9\s.,!?;:]'  # Keep letters, numbers, and basic punctuation
        else:
            pattern = r'[^a-zA-Z0-9\s]'  # Keep only letters, numbers, and spaces

        return re.sub(pattern, '', text)

    def normalize_unicode(self, text: str) -> str:
        """
        Normalize unicode characters using unidecode.

        Args:
            text: Input text

        Returns:
            Normalized text
        """
        return unidecode(text)

    def remove_repeated_characters(self, text: str, max_repeats: int = 2) -> str:
        """
        Reduce repeated characters to specified maximum.

        Args:
            text: Input text
            max_repeats: Maximum allowed consecutive repeats

        Returns:
            Text with reduced repeated characters
        """
        # Create pattern for excessive repeats
        pattern = re.compile(r'(.)\1{' + str(max_repeats) + ',}')
        return pattern.sub(r'\1' * max_repeats, text)

    def clean_for_classification(self, text: str) -> str:
        """
        Specialized cleaning for ML classification.

        Args:
            text: Input text

        Returns:
            Text cleaned for classification
        """
        if not text:
            return ""

        # For classification, we want to preserve meaning but reduce noise
        cleaned = text.strip()

        # Remove HTML and URLs
        cleaned = self.remove_html_tags(cleaned)
        cleaned = self.remove_urls(cleaned)

        # Convert emojis to text (they carry sentiment)
        cleaned = self.replace_emojis_with_text(cleaned)

        # Normalize unicode
        cleaned = self.normalize_unicode(cleaned)

        # Reduce excessive repetition
        cleaned = self.remove_repeated_characters(cleaned, max_repeats=2)

        # Remove special characters but keep punctuation
        cleaned = self.remove_special_characters(cleaned, keep_punctuation=True)

        # Normalize whitespace
        cleaned = self.normalize_whitespace(cleaned)

        return cleaned

    def clean_for_display(self, text: str) -> str:
        """
        Cleaning for user-facing display.

        Args:
            text: Input text

        Returns:
            Text suitable for UI display
        """
        if not text:
            return ""

        # For display, we keep most elements but clean harmful content
        cleaned = text.strip()

        # Remove only harmful HTML
        cleaned = self.remove_html_tags(cleaned)

        # Normalize unicode for consistency
        cleaned = self.normalize_unicode(cleaned)

        # Remove excessive whitespace
        cleaned = self.normalize_whitespace(cleaned)

        return cleaned

    def get_text_stats(self, text: str) -> Dict[str, int]:
        """
        Get statistics about the text.

        Args:
            text: Input text

        Returns:
            Dictionary with text statistics
        """
        return {
            "character_count": len(text),
            "word_count": len(text.split()),
            "sentence_count": len(re.split(r'[.!?]+', text)),
            "hashtag_count": len(self.extract_hashtags(text)),
            "mention_count": len(self.mention_pattern.findall(text)),
            "emoji_count": len(emoji.emoji_list(text)),
            "url_count": len(self.url_pattern.findall(text)),
        }

    def is_spam(self, text: str) -> bool:
        """
        Simple spam detection heuristics.

        Args:
            text: Input text

        Returns:
            True if text appears to be spam
        """
        stats = self.get_text_stats(text)

        # Check for excessive hashtags (>30% of words)
        word_count = max(stats["word_count"], 1)
        hashtag_ratio = stats["hashtag_count"] / word_count
        if hashtag_ratio > 0.3:
            return True

        # Check for excessive mentions (>20% of words)
        mention_ratio = stats["mention_count"] / word_count
        if mention_ratio > 0.2:
            return True

        # Check for excessive URLs (>2)
        if stats["url_count"] > 2:
            return True

        # Check for excessive capitalization (>70% uppercase letters)
        if len(text) > 10:
            uppercase_count = sum(1 for c in text if c.isupper())
            uppercase_ratio = uppercase_count / len(text)
            if uppercase_ratio > 0.7:
                return True

        # Check for repeated characters in many places
        repeated_sections = len(self.repeated_chars_pattern.findall(text))
        if repeated_sections > 3:
            return True

        return False

    def extract_keywords(self, text: str, min_length: int = 3) -> List[str]:
        """
        Extract simple keywords from text.

        Args:
            text: Input text
            min_length: Minimum keyword length

        Returns:
            List of keywords
        """
        # Clean text for keyword extraction
        cleaned = self.clean_for_classification(text)

        # Tokenize and filter
        words = re.findall(r'\b[a-zA-Z]+\b', cleaned.lower())

        # Filter by length and common stop words
        stop_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
                     'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may',
                     'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'her', 'let',
                     'put', 'say', 'she', 'too', 'use'}

        keywords = [word for word in words if len(word) >= min_length and word not in stop_words]

        # Return unique keywords preserving order
        seen = set()
        return [word for word in keywords if not (word in seen or seen.add(word))]

    def sanitize_text(self, text: str) -> str:
        """
        Sanitize text for safe processing.

        Args:
            text: Input text

        Returns:
            Sanitized text
        """
        if not text:
            return ""

        # Remove potentially dangerous content
        cleaned = text.strip()

        # Remove HTML tags and entities
        cleaned = self.remove_html_tags(cleaned)
        cleaned = html.unescape(cleaned)

        # Remove control characters
        cleaned = ''.join(char for char in cleaned if ord(char) >= 32 or char in '\n\r\t')

        # Limit maximum length
        cleaned = cleaned[:10000]  # Limit to 10k characters

        return cleaned