"""Topic clustering service to group related social media posts into trend topics."""
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import numpy as np
from sklearn.cluster import DBSCAN
# Try to import HDBSCAN
try:
    from hdbscan import HDBSCAN
    HDBSCAN_AVAILABLE = True
except ImportError:
    HDBSCAN_AVAILABLE = False
    HDBSCAN = None
    logging.warning("HDBSCAN not available, falling back to DBSCAN")
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import hashlib

# Try to import sentence transformers
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("sentence-transformers not available, using TF-IDF fallback")

from ..config import settings

logger = logging.getLogger(__name__)


class TopicCluster:
    """Topic clustering service for grouping related posts."""

    def __init__(
        self,
        embedding_model: str = None,
        similarity_threshold: float = 0.75,
        clustering_algorithm: str = "hdbscan"
    ):
        """
        Initialize topic clusterer.

        Args:
            embedding_model: Sentence transformer model name
            similarity_threshold: Similarity threshold for clustering
            clustering_algorithm: Clustering algorithm ('dbscan' or 'hdbscan')
        """
        self.embedding_model_name = embedding_model or settings.embedding_model
        self.similarity_threshold = similarity_threshold
        self.clustering_algorithm = clustering_algorithm
        self.model = None
        self._is_loaded = False

        # TF-IDF fallback
        self.tfidf_vectorizer = None

        # Clustering parameters
        self.min_cluster_size = 5
        self.eps = 0.3  # For DBSCAN

        # Cache for embeddings
        self.embedding_cache = {}
        self.cache_size_limit = 10000

    async def load_models(self) -> None:
        """Load sentence transformer model."""
        try:
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                logger.info(f"Loading sentence transformer model: {self.embedding_model_name}")
                self.model = SentenceTransformer(self.embedding_model_name)
                self._is_loaded = True
                logger.info("Sentence transformer model loaded successfully")
            else:
                logger.warning("Sentence transformers not available, using TF-IDF fallback")
                await self._setup_tfidf_fallback()

        except Exception as e:
            logger.error(f"Failed to load sentence transformer model: {e}")
            await self._setup_tfidf_fallback()

    async def _setup_tfidf_fallback(self) -> None:
        """Setup TF-IDF vectorizer as fallback."""
        try:
            self.tfidf_vectorizer = TfidfVectorizer(
                max_features=5000,
                stop_words='english',
                ngram_range=(1, 2),
                min_df=2,
                max_df=0.8
            )
            self._is_loaded = True
            logger.info("TF-IDF fallback setup completed")
        except Exception as e:
            logger.error(f"Failed to setup TF-IDF fallback: {e}")
            raise

    async def cluster_posts(self, posts: List[Dict], min_cluster_size: int = None) -> List[Dict]:
        """
        Cluster posts into topics.

        Args:
            posts: List of post dictionaries
            min_cluster_size: Minimum posts per cluster

        Returns:
            List of topic dictionaries with posts
        """
        if not posts:
            return []

        if not self._is_loaded:
            await self.load_models()

        min_cluster_size = min_cluster_size or self.min_cluster_size

        try:
            # Extract text content
            texts = self._extract_texts(posts)
            if not texts:
                return []

            # Generate embeddings
            embeddings = await self.generate_embeddings(texts)

            # Apply clustering
            cluster_labels = await self.apply_clustering(embeddings, min_cluster_size)

            # Group posts by cluster
            topics = await self._group_posts_by_cluster(posts, cluster_labels, embeddings, min_cluster_size)

            # Generate metadata for each topic
            for topic in topics:
                topic.update(await self.generate_topic_metadata(topic['posts'], topic['id']))

            return topics

        except Exception as e:
            logger.error(f"Post clustering failed: {e}")
            # Return single cluster with all posts
            return [{
                'id': 'fallback_cluster',
                'posts': posts,
                'size': len(posts),
                'virality_score': 0.0
            }]

    def _extract_texts(self, posts: List[Dict]) -> List[str]:
        """
        Extract text content from posts.

        Args:
            posts: List of post dictionaries

        Returns:
            List of text strings
        """
        texts = []
        for post in posts:
            text = post.get('textContent', '') or post.get('text', '')
            if text:
                texts.append(text)
        return texts

    async def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate sentence embeddings for texts.

        Args:
            texts: List of text strings

        Returns:
            Numpy array of embeddings
        """
        if not texts:
            return np.array([])

        try:
            if SENTENCE_TRANSFORMERS_AVAILABLE and self.model:
                return await self._generate_sentence_transformer_embeddings(texts)
            else:
                return await self._generate_tfidf_embeddings(texts)

        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            # Return zero embeddings as fallback
            return np.zeros((len(texts), 384))

    async def _generate_sentence_transformer_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings using sentence transformers.

        Args:
            texts: List of text strings

        Returns:
            Numpy array of embeddings
        """
        # Check cache first
        uncached_texts = []
        cached_embeddings = []

        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            if cache_key in self.embedding_cache:
                cached_embeddings.append((i, self.embedding_cache[cache_key]))
            else:
                uncached_texts.append((i, text))

        # Generate embeddings for uncached texts
        new_embeddings = None
        embedding_dim = None

        if uncached_texts:
            uncached_text_list = [text for _, text in uncached_texts]
            new_embeddings = self.model.encode(
                uncached_text_list,
                batch_size=32,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            embedding_dim = new_embeddings.shape[1]

            # Cache new embeddings
            for (i, text), embedding in zip(uncached_texts, new_embeddings):
                cache_key = self._get_cache_key(text)
                if len(self.embedding_cache) < self.cache_size_limit:
                    self.embedding_cache[cache_key] = embedding

        # Determine embedding dimension from cached embeddings or model
        if embedding_dim is None and cached_embeddings:
            embedding_dim = cached_embeddings[0][1].shape[0]
        elif embedding_dim is None:
            # Default embedding dimension for common models
            embedding_dim = 384  # Default for all-MiniLM-L6-v2

        # Combine cached and new embeddings
        all_embeddings = np.zeros((len(texts), embedding_dim))

        # Fill cached embeddings
        for i, embedding in cached_embeddings:
            all_embeddings[i] = embedding

        # Fill new embeddings
        if new_embeddings is not None:
            for (i, _), embedding in zip(uncached_texts, new_embeddings):
                all_embeddings[i] = embedding

        return all_embeddings

    async def _generate_tfidf_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings using TF-IDF.

        Args:
            texts: List of text strings

        Returns:
            Numpy array of TF-IDF embeddings
        """
        if not self.tfidf_vectorizer:
            await self._setup_tfidf_fallback()

        # Fit transform texts
        tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
        return tfidf_matrix.toarray()

    async def apply_clustering(self, embeddings: np.ndarray, min_cluster_size: int) -> np.ndarray:
        """
        Apply clustering algorithm to embeddings.

        Args:
            embeddings: Numpy array of embeddings
            min_cluster_size: Minimum cluster size

        Returns:
            Array of cluster labels
        """
        if embeddings.shape[0] < min_cluster_size:
            # Not enough posts for clustering
            return np.array([-1] * embeddings.shape[0])

        try:
            if self.clustering_algorithm == "hdbscan" and HDBSCAN_AVAILABLE:
                clusterer = HDBSCAN(
                    min_cluster_size=min_cluster_size,
                    metric='cosine',
                    cluster_selection_method='eom'
                )
            else:
                # DBSCAN (fallback if HDBSCAN not available)
                clusterer = DBSCAN(
                    eps=self.eps,
                    min_samples=min_cluster_size,
                    metric='cosine'
                )

            cluster_labels = clusterer.fit_predict(embeddings)
            return cluster_labels

        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            # Return all points as noise (-1)
            return np.array([-1] * embeddings.shape[0])

    async def _group_posts_by_cluster(
        self,
        posts: List[Dict],
        cluster_labels: np.ndarray,
        embeddings: np.ndarray,
        min_cluster_size: int = None
    ) -> List[Dict]:
        """
        Group posts by cluster labels.

        Args:
            posts: List of post dictionaries
            cluster_labels: Cluster label for each post
            embeddings: Embeddings for each post
            min_cluster_size: Minimum cluster size (uses instance default if None)

        Returns:
            List of topic dictionaries
        """
        # Use provided min_cluster_size or fall back to instance default
        effective_min_cluster_size = min_cluster_size or self.min_cluster_size

        topics = {}
        cluster_id_counter = 0

        for post_idx, (post, label) in enumerate(zip(posts, cluster_labels)):
            if label == -1:
                # Noise point - skip or create individual clusters
                continue

            if label not in topics:
                topics[label] = {
                    'id': f'topic_{cluster_id_counter}',
                    'posts': [],
                    'size': 0,
                    'virality_score': 0.0,
                    'embeddings': []
                }
                cluster_id_counter += 1

            topics[label]['posts'].append(post)
            topics[label]['size'] += 1
            if post_idx < len(embeddings):
                topics[label]['embeddings'].append(embeddings[post_idx])

        # Convert to list and filter by size
        topic_list = [
            topic for topic in topics.values()
            if topic['size'] >= effective_min_cluster_size
        ]

        return topic_list

    async def generate_topic_metadata(self, posts: List[Dict], cluster_id: str) -> Dict:
        """
        Generate metadata for a topic cluster.

        Args:
            posts: List of posts in the cluster
            cluster_id: Cluster ID

        Returns:
            Dictionary with topic metadata
        """
        try:
            texts = self._extract_texts(posts)

            # Extract keywords
            keywords = await self.extract_keywords(texts)

            # Generate topic title
            title = await self.generate_topic_title(posts, keywords)

            # Generate topic summary
            summary = await self.generate_topic_summary(posts)

            # Calculate aggregate metrics
            platforms = list(set(post.get('platform', '') for post in posts))
            total_engagement = sum(
                post.get('engagementCount', 0) or 0 for post in posts
            )

            # Determine region (most common)
            regions = [post.get('region', '') for post in posts if post.get('region')]
            region = max(set(regions), key=regions.count) if regions else None

            return {
                'title': title,
                'summary': summary,
                'keywords': keywords,
                'platforms': platforms,
                'total_engagement': total_engagement,
                'region': region,
                'post_count': len(posts),
                'created_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to generate topic metadata: {e}")
            return {
                'title': f'Topic {cluster_id}',
                'summary': '',
                'keywords': [],
                'platforms': [],
                'total_engagement': 0,
                'region': None,
                'post_count': len(posts),
                'created_at': datetime.utcnow().isoformat()
            }

    async def extract_keywords(self, texts: List[str], top_n: int = 10) -> List[str]:
        """
        Extract top keywords from cluster texts.

        Args:
            texts: List of text strings
            top_n: Number of keywords to extract

        Returns:
            List of top keywords
        """
        try:
            if not texts:
                return []

            if SENTENCE_TRANSFORMERS_AVAILABLE and self.tfidf_vectorizer is None:
                # Create TF-IDF for keyword extraction if using sentence transformers
                vectorizer = TfidfVectorizer(
                    max_features=1000,
                    stop_words='english',
                    ngram_range=(1, 2),
                    min_df=2
                )
                tfidf_matrix = vectorizer.fit_transform(texts)
                feature_names = vectorizer.get_feature_names_out()
                tfidf_scores = tfidf_matrix.sum(axis=0).A1
            else:
                # Use existing TF-IDF vectorizer
                if self.tfidf_vectorizer:
                    tfidf_matrix = self.tfidf_vectorizer.transform(texts)
                    feature_names = self.tfidf_vectorizer.get_feature_names_out()
                    tfidf_scores = tfidf_matrix.sum(axis=0).A1
                else:
                    return []

            # Get top keywords by TF-IDF score
            top_indices = np.argsort(tfidf_scores)[-top_n:][::-1]
            keywords = [feature_names[i] for i in top_indices]

            return keywords

        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []

    async def generate_topic_title(self, posts: List[Dict], keywords: List[str]) -> str:
        """
        Generate human-readable topic title.

        Args:
            posts: List of posts in cluster
            keywords: Extracted keywords

        Returns:
            Topic title string
        """
        try:
            # Find most representative post (shortest, most engaging)
            representative_post = None
            best_score = -1

            for post in posts:
                text = post.get('textContent', '') or post.get('text', '')
                engagement = post.get('engagementCount', 0) or 0
                length = len(text)

                if length > 0:
                    # Score: engagement / length (prefer short, engaging posts)
                    score = engagement / max(length, 1)
                    if score > best_score:
                        best_score = score
                        representative_post = text

            if representative_post and len(representative_post) <= 100:
                return representative_post

            # Fallback: combine top keywords
            if keywords:
                title = " ".join(keywords[:3]).title()
                return title[:100]

            return "Untitled Topic"

        except Exception as e:
            logger.error(f"Failed to generate topic title: {e}")
            return "Untitled Topic"

    async def generate_topic_summary(self, posts: List[Dict], max_length: int = 200) -> str:
        """
        Generate topic summary.

        Args:
            posts: List of posts in cluster
            max_length: Maximum summary length

        Returns:
            Summary string
        """
        try:
            # Simple extractive summarization
            texts = self._extract_texts(posts)
            if not texts:
                return ""

            # Sort by engagement and take top posts
            posts_with_engagement = [
                (post.get('engagementCount', 0) or 0, post.get('textContent', '') or post.get('text', ''))
                for post in posts
            ]
            posts_with_engagement.sort(reverse=True)

            # Combine top posts until max length
            summary_parts = []
            current_length = 0

            for engagement, text in posts_with_engagement[:5]:
                if current_length + len(text) <= max_length:
                    summary_parts.append(text)
                    current_length += len(text)
                else:
                    break

            summary = " ".join(summary_parts)
            return summary[:max_length]

        except Exception as e:
            logger.error(f"Failed to generate topic summary: {e}")
            return ""

    def calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate cosine similarity between two texts.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score (0 to 1)
        """
        try:
            if self.model and SENTENCE_TRANSFORMERS_AVAILABLE:
                # Use sentence transformers
                embeddings = self.model.encode([text1, text2])
                similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
            else:
                # Use TF-IDF
                if self.tfidf_vectorizer:
                    tfidf_matrix = self.tfidf_vectorizer.transform([text1, text2])
                    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
                else:
                    similarity = 0.0

            return float(similarity)

        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0

    async def find_similar_topics(
        self,
        new_post: Dict,
        existing_topics: List[Dict],
        threshold: float = None
    ) -> Optional[str]:
        """
        Find if new post belongs to existing topic.

        Args:
            new_post: New post dictionary
            existing_topics: List of existing topic dictionaries
            threshold: Similarity threshold

        Returns:
            Topic ID if similar, None otherwise
        """
        if not existing_topics:
            return None

        threshold = threshold or self.similarity_threshold
        new_text = new_post.get('textContent', '') or new_post.get('text', '')

        if not new_text:
            return None

        try:
            for topic in existing_topics:
                # Get representative text from topic
                if topic.get('posts'):
                    representative_post = topic['posts'][0]
                    topic_text = representative_post.get('textContent', '') or representative_post.get('text', '')

                    if topic_text:
                        similarity = self.calculate_similarity(new_text, topic_text)
                        if similarity >= threshold:
                            return topic.get('id')

            return None

        except Exception as e:
            logger.error(f"Similar topic search failed: {e}")
            return None

    async def merge_similar_topics(
        self,
        topics: List[Dict],
        threshold: float = 0.85
    ) -> List[Dict]:
        """
        Merge very similar topics.

        Args:
            topics: List of topic dictionaries
            threshold: Similarity threshold for merging

        Returns:
            Deduplicated topic list
        """
        if len(topics) <= 1:
            return topics

        try:
            merged_topics = []
            processed_indices = set()

            for i, topic1 in enumerate(topics):
                if i in processed_indices:
                    continue

                merged_topic = topic1.copy()
                processed_indices.add(i)

                for j, topic2 in enumerate(topics[i+1:], i+1):
                    if j in processed_indices:
                        continue

                    # Compare topic titles or first posts
                    title1 = topic1.get('title', '')
                    title2 = topic2.get('title', '')

                    if title1 and title2:
                        similarity = self.calculate_similarity(title1, title2)
                        if similarity >= threshold:
                            # Merge topics
                            merged_topic['posts'].extend(topic2.get('posts', []))
                            merged_topic['size'] += topic2.get('size', 0)
                            merged_topic['total_engagement'] += topic2.get('total_engagement', 0)
                            processed_indices.add(j)

                merged_topics.append(merged_topic)

            return merged_topics

        except Exception as e:
            logger.error(f"Topic merging failed: {e}")
            return topics

    def is_loaded(self) -> bool:
        """
        Check if models are loaded.

        Returns:
            True if models are loaded
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
        """Clear the embedding cache."""
        self.embedding_cache.clear()
        logger.info("Embedding cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        return {
            "cache_size": len(self.embedding_cache),
            "cache_limit": self.cache_size_limit
        }


# Global instance
topic_cluster = TopicCluster()