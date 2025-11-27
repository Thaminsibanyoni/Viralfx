"""Geo-classification service to identify South African content and regions."""
import logging
from typing import List, Tuple, Dict, Optional
from datetime import datetime

from ..config import settings
from ..models.schemas import GeoClassification

logger = logging.getLogger(__name__)


class GeoClassifier:
    """Geo-classification service for South African content detection."""

    def __init__(self):
        """Initialize geo-classifier."""
        self._is_loaded = False

        # South African provinces and their codes
        self.sa_provinces = {
            "gauteng": "GP",
            "western cape": "WC",
            "kwazulu-natal": "KZN",
            "kzn": "KZN",
            "eastern cape": "EC",
            "free state": "FS",
            "mpumalanga": "MP",
            "north west": "NW",
            "northern cape": "NC",
            "limpopo": "LP"
        }

        # Major SA cities and their provinces
        self.sa_cities = {
            "johannesburg": "GP",
            "joburg": "GP",
            "cape town": "WC",
            "capetown": "WC",
            "durban": "KZN",
            "pretoria": "GP",
            "tshwane": "GP",
            "port elizabeth": "EC",
            "gqeberha": "EC",
            "bloemfontein": "FS",
            "polokwane": "LP",
            "nelspruit": "MP",
            "kimberley": "NC",
            "pietermaritzburg": "KZN",
            "east london": "EC",
            "stellenbosch": "WC",
            "paarl": "WC",
            "vanderbijlpark": "GP",
            "germiston": "GP",
            "boksburg": "GP",
            "benoni": "GP",
            "witbank": "MP",
            "emalahleni": "MP",
            "rustenburg": "NW",
            "klerksdorp": "NW",
            "welkom": "FS",
            "mthatha": "EC",
            "umtata": "EC"
        }

        # South African landmarks
        self.sa_landmarks = [
            "table mountain", "robben island", "kruger national park",
            "union buildings", "soweto", "v&a waterfront", "gold reef city",
            "uShaka marine world", "drakensberg", "garden route",
            "sun city", "cradle of humankind", "ape caves"
        ]

        # SA language patterns
        self.language_regions = {
            "en": None,  # English - nationwide
            "af": ["WC", "NC", "GP"],  # Afrikaans - Western Cape, Northern Cape, Gauteng
            "zu": ["KZN", "GP", "MP"],  # isiZulu - KZN, Gauteng, Mpumalanga
            "xh": ["EC", "WC"],  # isiXhosa - Eastern Cape, Western Cape
            "st": ["FS", "GP"],  # Sesotho - Free State, Gauteng
            "tn": ["NW", "NC"],  # Setswana - North West, Northern Cape
            "ts": ["MP", "LP"],  # Xitsonga - Mpumalanga, Limpopo
            "ss": ["MP", "LP"],  # siSwati - Mpumalanga, Limpopo
            "nr": ["KZN", "LP"],  # isiNdebele - KZN, Limpopo
            "ve": ["LP"]  # Tshivenda - Limpopo
        }

        # SA-specific slang and cultural references
        self.sa_references = [
            "mzansi", "lekker", "braai", "eish", "yebo", "howzit", "sharp", "robot",
            "bakkie", "boerewors", "biltong", "samoosa", "koeksister",
            "springboks", "bafana bafana", "proteas", "rugby", "cricket",
            "heritage day", "freedom day", "youth day", "reconciliation day",
            "load shedding", "eskom", "sars", "sans", "cape malay", "township"
        ]

        # International locations (for non-SA detection)
        self.international_locations = [
            "london", "new york", "paris", "tokyo", "sydney", "dubai",
            "berlin", "moscow", "beijing", "singapore", "mumbai", "delhi"
        ]

        # Weights for different indicators
        self.weights = {
            "location_mention": 0.4,
            "language_pattern": 0.3,
            "cultural_reference": 0.2,
            "author_location": 0.1
        }

    async def load_models(self) -> None:
        """Load geo-classification models and data."""
        try:
            # Load additional data if needed
            # For now, all data is hardcoded

            self._is_loaded = True
            logger.info("Geo-classifier loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load geo-classifier: {e}")
            raise

    async def classify(
        self,
        text: str,
        author_location: Optional[str] = None
    ) -> GeoClassification:
        """
        Classify content as South African and determine region.

        Args:
            text: Content text to classify
            author_location: Author's location if known

        Returns:
            GeoClassification object with results
        """
        if not text:
            return GeoClassification(
                region=None,
                confidence=0.0,
                is_south_african=False,
                indicators=[]
            )

        if not self._is_loaded:
            await self.load_models()

        try:
            # Extract location mentions
            location_mentions = self.extract_location_mentions(text)

            # Detect SA-specific indicators
            sa_indicators = self.detect_sa_indicators(text)

            # Determine if South African
            is_sa, sa_score = self.is_south_african(text, author_location, sa_indicators)

            # Classify specific region if SA
            region = None
            confidence = 0.0

            if is_sa:
                region, confidence = self.classify_province(location_mentions, text)
            else:
                # Check if definitely non-SA
                for location in self.international_locations:
                    if location in text.lower():
                        confidence = 0.9
                        break

            # Compile indicators
            indicators = []
            if location_mentions:
                indicators.append("location_mentions")
            if sa_indicators["cultural_references"]:
                indicators.append("cultural_references")
            if sa_indicators["language_patterns"]:
                indicators.append("language_patterns")
            if author_location and "south africa" in author_location.lower():
                indicators.append("author_location")

            return GeoClassification(
                region=region,
                confidence=confidence,
                is_south_african=is_sa,
                indicators=indicators
            )

        except Exception as e:
            logger.error(f"Geo-classification failed: {e}")
            return GeoClassification(
                region=None,
                confidence=0.0,
                is_south_african=False,
                indicators=[]
            )

    async def classify_batch(self, posts: List[Dict]) -> List[GeoClassification]:
        """
        Batch geo-classification.

        Args:
            posts: List of post dictionaries

        Returns:
            List of GeoClassification objects
        """
        if not posts:
            return []

        results = []
        for post in posts:
            text = post.get('textContent', '') or post.get('text', '')
            author_location = post.get('authorLocation', '') or post.get('location', '')
            result = await self.classify(text, author_location)
            results.append(result)

        return results

    def extract_location_mentions(self, text: str) -> List[Tuple[str, str]]:
        """
        Extract location mentions from text.

        Args:
            text: Input text

        Returns:
            List of (location_name, location_type) tuples
        """
        text_lower = text.lower()
        locations = []

        # Check cities
        for city, province in self.sa_cities.items():
            if city in text_lower:
                locations.append((city, "city"))

        # Check provinces
        for province, code in self.sa_provinces.items():
            if province in text_lower:
                locations.append((province, "province"))

        # Check landmarks
        for landmark in self.sa_landmarks:
            if landmark in text_lower:
                locations.append((landmark, "landmark"))

        return locations

    def match_gazetteer(self, text: str) -> List[str]:
        """
        Match text against SA location gazetteer.

        Args:
            text: Input text

        Returns:
            List of matched locations
        """
        text_lower = text.lower()
        matches = []

        all_locations = set(self.sa_cities.keys()) | set(self.sa_provinces.keys()) | set(self.sa_landmarks)

        for location in all_locations:
            if location in text_lower:
                matches.append(location)

        return matches

    def classify_province(self, location_mentions: List[Tuple[str, str]], language: str) -> Tuple[Optional[str], float]:
        """
        Determine specific SA province.

        Args:
            location_mentions: List of location mentions
            language: Text content for language analysis

        Returns:
            Tuple of (province_code, confidence)
        """
        province_scores = {}

        # Score based on location mentions
        for location, location_type in location_mentions:
            if location_type == "city" and location in self.sa_cities:
                province = self.sa_cities[location]
                province_scores[province] = province_scores.get(province, 0) + 2
            elif location_type == "province" and location in self.sa_provinces:
                province = self.sa_provinces[location]
                province_scores[province] = province_scores.get(province, 0) + 3
            elif location_type == "landmark":
                # Landmarks contribute to multiple provinces, use heuristic
                if "kruger" in location:
                    province_scores["MP"] = province_scores.get("MP", 0) + 1
                elif "table mountain" in location or "v&a" in location:
                    province_scores["WC"] = province_scores.get("WC", 0) + 1

        # Score based on language patterns
        if language:
            lang_region_scores = self.classify_by_language(language, "")
            if lang_region_scores[0]:
                region = lang_region_scores[0]
                if region in self.sa_provinces.values():
                    province_scores[region] = province_scores.get(region, 0) + 1

        if not province_scores:
            return None, 0.0

        # Return province with highest score
        best_province = max(province_scores.items(), key=lambda x: x[1])
        confidence = min(best_province[1] / 3.0, 1.0)  # Normalize to 0-1

        return best_province[0], confidence

    def get_province_from_city(self, city: str) -> Optional[str]:
        """
        Map city name to province code.

        Args:
            city: City name

        Returns:
            Province code or None
        """
        city_lower = city.lower()
        return self.sa_cities.get(city_lower)

    def classify_by_language(self, language: str, text: str) -> Tuple[Optional[str], float]:
        """
        Infer region from language patterns.

        Args:
            language: Language code
            text: Text for additional analysis

        Returns:
            Tuple of (region, confidence)
        """
        if language in self.language_regions:
            regions = self.language_regions[language]
            if not regions:
                # Nationwide language (English)
                return None, 0.0
            elif len(regions) == 1:
                # Single region association
                return regions[0], 0.6
            else:
                # Multiple possible regions
                # Could use text analysis to narrow down
                return None, 0.3

        return None, 0.0

    def detect_language_patterns(self, text: str) -> Dict[str, float]:
        """
        Detect SA-specific language patterns.

        Args:
            text: Input text

        Returns:
            Dictionary of pattern: confidence
        """
        text_lower = text.lower()
        patterns = {}

        # Check for SA slang
        slang_count = sum(1 for slang in self.sa_references if slang in text_lower)
        if slang_count > 0:
            patterns["slang"] = min(slang_count / 3.0, 1.0)

        # Check for cultural references
        cultural_count = sum(1 for ref in self.sa_references if ref in text_lower)
        if cultural_count > 0:
            patterns["cultural"] = min(cultural_count / 5.0, 1.0)

        # Check for context-specific terms
        if any(term in text_lower for term in ["load shedding", "eskom"]):
            patterns["context"] = 0.8

        return patterns

    def is_south_african(
        self,
        text: str,
        author_location: Optional[str] = None,
        sa_indicators: Optional[Dict] = None
    ) -> Tuple[bool, float]:
        """
        Determine if content is South African.

        Args:
            text: Input text
            author_location: Author's location
            sa_indicators: Pre-computed SA indicators

        Returns:
            Tuple of (is_sa, confidence)
        """
        if sa_indicators is None:
            sa_indicators = self.detect_sa_indicators(text)

        # Calculate SA score from indicators
        sa_score = self.calculate_sa_score({
            "location_mentions": len(self.extract_location_mentions(text)),
            "language_patterns": len(sa_indicators.get("language_patterns", [])),
            "cultural_references": len(sa_indicators.get("cultural_references", [])),
            "author_location": 1 if author_location and "south africa" in author_location.lower() else 0
        })

        # Check for non-SA indicators
        text_lower = text.lower()
        non_sa_score = sum(1 for loc in self.international_locations if loc in text_lower) * 0.3

        # Final decision
        final_score = max(0, sa_score - non_sa_score)
        is_sa = final_score >= 0.3  # Threshold for SA content

        return is_sa, min(final_score, 1.0)

    def calculate_sa_score(self, indicators: Dict[str, int]) -> float:
        """
        Calculate overall SA score from indicators.

        Args:
            indicators: Dictionary of indicator counts

        Returns:
            Weighted SA score (0 to 1)
        """
        total_score = 0.0

        for indicator, count in indicators.items():
            weight = self.weights.get(indicator, 0.1)
            contribution = min(count * weight, 1.0)  # Cap each indicator at 1.0
            total_score += contribution

        return min(total_score, 1.0)

    def detect_sa_indicators(self, text: str) -> Dict[str, List[str]]:
        """
        Detect SA-specific cultural references.

        Args:
            text: Input text

        Returns:
            Dictionary of indicator type: list of matches
        """
        text_lower = text.lower()
        indicators = {
            "language_patterns": [],
            "cultural_references": []
        }

        # Detect cultural references
        for ref in self.sa_references:
            if ref in text_lower:
                indicators["cultural_references"].append(ref)

        # Detect language patterns
        patterns = self.detect_language_patterns(text)
        indicators["language_patterns"] = list(patterns.keys())

        return indicators

    def detect_cultural_references(self, text: str) -> List[str]:
        """
        Detect SA-specific cultural references.

        Args:
            text: Input text

        Returns:
            List of detected references
        """
        text_lower = text.lower()
        references = []

        for ref in self.sa_references:
            if ref in text_lower:
                references.append(ref)

        return references

    def get_sa_cities(self) -> List[str]:
        """
        Return list of major SA cities.

        Returns:
            List of city names
        """
        return list(self.sa_cities.keys())

    def get_sa_provinces(self) -> Dict[str, str]:
        """
        Return dict mapping province names to codes.

        Returns:
            Dictionary of province name: code
        """
        return self.sa_provinces.copy()

    def normalize_location_name(self, location: str) -> str:
        """
        Normalize location name for matching.

        Args:
            location: Location name to normalize

        Returns:
            Normalized location name
        """
        # Convert to lowercase and remove common variations
        normalized = location.lower().strip()

        # Handle common abbreviations and variations
        abbreviations = {
            "jhb": "johannesburg",
            "jburg": "johannesburg",
            "ct": "cape town",
            "dbn": "durban",
            "pta": "pretoria",
            "el": "east london",
            "pe": "port elizabeth"
        }

        return abbreviations.get(normalized, normalized)

    def calculate_regional_weight(self, region: str, is_sa: bool) -> float:
        """
        Calculate regional weight for virality scoring (R component).

        Args:
            region: Region code
            is_sa: Whether content is South African

        Returns:
            Regional weight value
        """
        # Base weight
        weight = 1.0

        if is_sa:
            # SA content gets boost
            weight *= 1.3

            # High-engagement regions get additional boost
            high_engagement_regions = ["GP", "WC", "KZN"]
            if region in high_engagement_regions:
                weight *= 1.1

        return weight

    def get_region_name(self, region_code: str) -> str:
        """
        Convert region code to full name.

        Args:
            region_code: Region code (e.g., "GP")

        Returns:
            Full region name
        """
        code_to_name = {v: k for k, v in self.sa_provinces.items()}
        return code_to_name.get(region_code, region_code)

    def is_loaded(self) -> bool:
        """
        Check if models and data are loaded.

        Returns:
            True if loaded
        """
        return self._is_loaded


# Global instance
geo_classifier = GeoClassifier()