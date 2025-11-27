# 🧠 **Trend Intelligence Service Blueprint**

*(AI + data ingestion backbone for ViralFX)*

### 🎯 Goal

Detect, classify, and track *non-harmful, high-velocity South-African viral stories* in near-real time from TikTok, X (Twitter), Instagram, YouTube, and Facebook.

---

## 1. **Architecture Overview**

```
ml-services/
 ├── trend-intel/
 │   ├── app/
 │   │   ├── main.py
 │   │   ├── routers/
 │   │   │   ├── ingest_router.py
 │   │   │   ├── classify_router.py
 │   │   │   ├── trends_router.py
 │   │   │   └── health_router.py
 │   │   ├── services/
 │   │   │   ├── collectors/
 │   │   │   │   ├── twitter_collector.py
 │   │   │   │   ├── tiktok_collector.py
 │   │   │   │   ├── instagram_collector.py
 │   │   │   │   ├── youtube_collector.py
 │   │   │   │   └── facebook_collector.py
 │   │   │   ├── text_cleaner.py
 │   │   │   ├── language_detector.py
 │   │   │   ├── sentiment_analyzer.py
 │   │   │   ├── toxicity_filter.py
 │   │   │   ├── virality_score.py
 │   │   │   ├── topic_cluster.py
 │   │   │   └── geo_classifier.py
 │   │   ├── models/
 │   │   │   ├── sentiment_model.pt
 │   │   │   ├── toxicity_model.pt
 │   │   │   └── trend_vectorizer.pkl
 │   │   ├── utils/
 │   │   │   ├── cache.py
 │   │   │   ├── logger.py
 │   │   │   └── db.py
 │   │   └── config.py
 │   ├── requirements.txt
 │   └── Dockerfile
```

---

## 2. **Data Flow**

1. **Collectors** hit each platform's API or scraping gateway for new public posts with SA-relevant tags/locations.
2. **Cleaner** removes links, emojis, duplicates, etc.
3. **LanguageDetector** → only keep English, isiZulu, isiXhosa, Afrikaans.
4. **SentimentAnalyzer** → returns polarity score.
5. **ToxicityFilter** → deep-learning classifier filters out harmful topics.
6. **GeoClassifier** → checks if post or author originates from South Africa.
7. **TopicCluster** groups related posts into a "topic bubble".
8. **ViralityScore** combines engagement rate, velocity, and cross-platform momentum.
9. Store final topics in **Postgres + Redis cache**, push to backend via API event or Kafka queue.

---

## 3. **Key Endpoints**

| Method                 | Endpoint                       | Description |
| ---------------------- | ------------------------------ | ----------- |
| `GET /health`          | Health check                   |             |
| `POST /ingest`         | Manually trigger collection    |             |
| `GET /trends/current`  | Top trending topics now        |             |
| `GET /trends/{region}` | Filtered by SA provinces       |             |
| `POST /classify`       | Test classifier on sample text |             |
| `GET /topics/{id}`     | Full topic details & metrics   |             |

---

## 4. **Virality Scoring Formula (simplified)**

```
ViralityScore = (E + V + S) * Q * R
```

* **E:** Engagement rate (likes + comments + shares / impressions)
* **V:** Velocity (Δengagement / Δtime)
* **S:** Sentiment strength (|positive|)
* **Q:** Quality multiplier (low toxicity, relevant language = +1.2)
* **R:** Regional weight (SA content = +1.3)

Stored in Postgres daily as time-series data for charts.

---

## 5. **Filtering Logic**

| Filter                         | Description                                 | Method                          |
| ------------------------------ | ------------------------------------------- | ------------------------------- |
| **Toxic content**              | Detects violence, abuse, death, pornography | BERT-based toxicity model       |
| **Spam detection**             | Excludes spammy hashtags, bots              | User engagement entropy         |
| **Ethical compliance**         | Discard harmful categories                  | Curated keyword blacklists      |
| **Language filtering**         | SA languages only                           | fastText / langdetect           |
| **Cross-platform unification** | Merge duplicates                            | Cosine similarity on embeddings |

---

## 6. **Example Output Object**

```json
{
  "id": "trend_20251112_213",
  "title": "DJ Zinhle new dance challenge explodes on TikTok",
  "summary": "Users across SA are joining DJ Zinhle's #GlowDance trend...",
  "platforms": ["tiktok", "instagram", "twitter"],
  "sentiment": 0.82,
  "toxicity": 0.05,
  "viralityScore": 88.5,
  "velocity": 12.3,
  "engagement": 240000,
  "region": "Gauteng",
  "categories": ["entertainment", "music", "dance"],
  "createdAt": "2025-11-12T10:15:23Z"
}
```

---

## 7. **Tech Stack**

| Layer      | Tech                                         |
| ---------- | -------------------------------------------- |
| Framework  | FastAPI                                      |
| Lang       | Python 3.11                                  |
| NLP libs   | Transformers, spaCy, fastText, scikit-learn  |
| Models     | fine-tuned DistilBERT (sentiment/toxicity)   |
| Cache      | Redis                                        |
| Storage    | Postgres (topics, trends), S3 (raw datasets) |
| Queue      | Bull or Kafka (to backend)                   |
| Monitoring | Prometheus client + Grafana dashboards       |

---

## 8. **AI Safety & Retraining**

* Weekly retraining on approved dataset of SA social posts.
* Human-in-the-loop moderation feedback loop.
* Toxicity threshold adjustable from admin UI.

---

## 9. **Integration Points**

### Backend Integration
```typescript
// backend/src/modules/trend-intel/trend-intel.service.ts
@Injectable()
export class TrendIntelService {
  async getTrendingTopics(region?: string): Promise<Topic[]> {
    return this.http.get(`${TREND_INTEL_URL}/trends/${region || 'current'}`);
  }

  async classifyContent(text: string): Promise<ClassificationResult> {
    return this.http.post(`${TREND_INTEL_URL}/classify`, { text });
  }

  async triggerIngestion(): Promise<void> {
    return this.http.post(`${TREND_INTEL_URL}/ingest`);
  }
}
```

### WebSocket Events
```typescript
// Real-time trend updates
socket.emit('trend:update', {
  type: 'NEW_TREND',
  data: topicObject
});

socket.emit('trend:score_update', {
  topicId: 'trend_20251112_213',
  newScore: 92.1
});
```

---

## 10. **Performance Requirements**

### Throughput Targets
- **Ingestion Rate**: 10,000 posts/minute across all platforms
- **Classification Latency**: < 500ms per post
- **Topic Clustering**: < 2 seconds for batch of 1000 posts
- **API Response Time**: < 100ms for cached trends

### Caching Strategy
```python
# Redis cache keys
"trend:current"           # 5 minutes TTL
"trend:region:{region}"   # 5 minutes TTL
"classify:hash:{hash}"    # 1 hour TTL
"topic:{id}"             # 15 minutes TTL
```

---

## 11. **Monitoring & Alerting**

### Key Metrics
```python
# Prometheus metrics
trending_topics_total = Counter('trending_topics_total')
ingestion_errors_total = Counter('ingestion_errors_total')
classification_latency = Histogram('classification_latency_seconds')
virality_score_distribution = Histogram('virality_score_distribution')
```

### Alert Conditions
- Classification latency > 1s for 5 minutes
- Ingestion failure rate > 10%
- No new trends detected for 30 minutes
- Toxicity filter accuracy drops below 95%

---

## 12. **Data Model**

```sql
-- Trend Topics Table
CREATE TABLE trend_topics (
    id VARCHAR(50) PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    platforms JSONB,
    sentiment FLOAT,
    toxicity FLOAT,
    virality_score FLOAT,
    velocity FLOAT,
    engagement BIGINT,
    region VARCHAR(50),
    categories JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trend History (for time-series)
CREATE TABLE trend_history (
    id BIGSERIAL PRIMARY KEY,
    topic_id VARCHAR(50) REFERENCES trend_topics(id),
    virality_score FLOAT,
    engagement BIGINT,
    velocity FLOAT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trend_topics_created_at ON trend_topics(created_at DESC);
CREATE INDEX idx_trend_topics_region ON trend_topics(region);
CREATE INDEX idx_trend_topics_score ON trend_topics(virality_score DESC);
CREATE INDEX idx_trend_history_topic_timestamp ON trend_history(topic_id, timestamp);
```

---

## 13. **Development Commands**

```bash
# Setup environment
cd ml-services/trend-intel
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003

# Run tests
pytest tests/ -v

# Train models
python scripts/train_sentiment.py
python scripts/train_toxicity.py

# Manual ingestion
curl -X POST http://localhost:8003/ingest

# Classify sample text
curl -X POST http://localhost:8003/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "This amazing new trend is taking over South Africa!"}'
```

---

## 14. **Configuration**

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:pass@localhost/trend_intel"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # API Keys
    TWITTER_BEARER_TOKEN: str
    TIKTOK_API_KEY: str
    INSTAGRAM_ACCESS_TOKEN: str
    YOUTUBE_API_KEY: str
    FACEBOOK_ACCESS_TOKEN: str

    # Model Settings
    SENTIMENT_MODEL_PATH: str = "./models/sentiment_model.pt"
    TOXICITY_MODEL_PATH: str = "./models/toxicity_model.pt"

    # Filtering
    TOXICITY_THRESHOLD: float = 0.3
    MIN_VIRALITY_SCORE: float = 50.0

    # Regional
    DEFAULT_REGION: str = "ZA"
    SUPPORTED_REGIONS: list = ["GP", "WC", "KZN", "EC", "FS", "MP", "NW", "NC"]

    # Cache TTL (seconds)
    CACHE_TTL_TRENDS: int = 300
    CACHE_TTL_CLASSIFICATION: int = 3600

    class Config:
        env_file = ".env"
```

---

## 15. **Security Considerations**

- API rate limiting for platform endpoints
- Input sanitization and validation
- Encrypted storage of API keys
- Request signing for backend communication
- Content filtering before database storage
- GDPR/POPIA compliance for user data
- Regular security audits of ML models

---

## ✅ **Next Steps for Implementation**

1. **Create the FastAPI service structure** with all routers and services
2. **Implement platform collectors** for Twitter, TikTok, Instagram, YouTube, Facebook
3. **Train and integrate ML models** for sentiment and toxicity detection
4. **Set up Redis caching** and PostgreSQL database
5. **Create Docker configuration** for deployment
6. **Integrate with backend** via API calls and WebSocket events
7. **Set up monitoring** with Prometheus and Grafana
8. **Test with sample SA viral data** and fine-tune filtering

This blueprint provides a comprehensive foundation for building the Trend Intelligence Service that will power ViralFX's real-time social momentum detection capabilities.