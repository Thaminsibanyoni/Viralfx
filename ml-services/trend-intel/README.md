# ViralFX Trend Intelligence Service

AI-powered social momentum detection and analysis service that processes social media content to identify viral trends, analyze sentiment, detect toxicity, and calculate virality scores.

## Overview

The Trend Intelligence Service is a core component of the ViralFX platform that uses advanced NLP and machine learning to:

- **Analyze Content**: Sentiment analysis, toxicity detection, and language identification
- **Cluster Topics**: Group related posts into trending topics using semantic similarity
- **Calculate Virality**: Apply the (E + V + S) × Q × R formula to score viral potential
- **Geographic Classification**: Identify South African content and regions
- **Real-time Processing**: Handle 10,000+ posts per minute with <500ms classification latency

## Architecture

### Core Components

- **FastAPI Application**: RESTful API with async support
- **NLP Pipeline**: Text cleaning → Language detection → Sentiment analysis → Toxicity filtering → Geo-classification
- **Topic Clustering**: Sentence transformers + DBSCAN/HDBSCAN for semantic grouping
- **Virality Scoring**: Engagement, velocity, sentiment, quality, and regional weighting
- **Caching Layer**: Redis for trends, classifications, and topics
- **Database**: PostgreSQL for persistent storage with async SQLAlchemy

### Virality Formula

```
ViralityScore = (E + V + S) × Q × R

Where:
E = Engagement rate (0-100)
V = Velocity (0-100)
S = Sentiment strength (0-100)
Q = Quality multiplier (0.1-1.5)
R = Regional weight (1.0-1.5)
```

## Features

### NLP Services
- **Text Cleaning**: Removes URLs, mentions, HTML, normalizes text
- **Language Detection**: Supports 10 South African languages (English, Afrikaans, isiZulu, isiXhosa, etc.)
- **Sentiment Analysis**: Transformer-based with emotion detection
- **Toxicity Filtering**: Multi-label classification with keyword fallback
- **Geo-classification**: South African location detection and province identification

### Topic Analysis
- **Semantic Clustering**: Groups related posts using sentence embeddings
- **Cross-platform Unification**: Detects duplicate content across platforms
- **Trend Detection**: Identifies emerging and viral topics
- **Topic Metadata**: Auto-generates titles, summaries, and keywords

### Performance
- **High Throughput**: 10,000 posts/minute processing capability
- **Low Latency**: <500ms classification, <100ms cached API responses
- **Scalable**: Async processing with connection pooling
- **Caching**: Multi-tier caching with Redis

## API Endpoints

### Health Checks
- `GET /health` - Comprehensive health check with component status
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /metrics` - Prometheus metrics

### Classification
- `POST /classify` - Complete text analysis (sentiment, toxicity, geo)
- `POST /classify/batch` - Batch text classification
- `POST /classify/sentiment` - Sentiment analysis only
- `POST /classify/toxicity` - Toxicity detection only
- `POST /classify/language` - Language detection only
- `POST /classify/geo` - Geographic classification only

### Trends
- `GET /trends/current` - Current trending topics
- `GET /trends/{region}` - Regional trends (GP, WC, KZN, etc.)
- `GET /trends/topic/{id}` - Topic details with history
- `GET /trends/search` - Search topics by keyword
- `GET /trends/categories` - Available categories
- `GET /trends/platforms` - Platform-specific trends

### Ingestion
- `POST /ingest` - Trigger manual ingestion
- `POST /ingest/process` - Process unprocessed posts
- `POST /ingest/cluster` - Cluster recent posts into topics
- `GET /ingest/status` - Ingestion statistics
- `GET /ingest/stats` - Detailed processing metrics

## Installation

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download required models
python -m spacy download en_core_web_sm
python -m nltk.downloader punkt stopwords

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations (if needed)
# alembic upgrade head

# Start the service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

### Docker Deployment

```bash
# Build image
docker build -t viralfx-trend-intel .

# Run container
docker run -p 8003:8003 \
  --env-file .env \
  viralfx-trend-intel
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trend-intel
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trend-intel
  template:
    metadata:
      labels:
        app: trend-intel
    spec:
      containers:
      - name: trend-intel
        image: viralfx-trend-intel:latest
        ports:
        - containerPort: 8003
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8003
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Configuration

### Environment Variables

#### Database
- `DATABASE_URL` - PostgreSQL connection string (required)
- `DATABASE_POOL_SIZE` - Connection pool size (default: 10)
- `DATABASE_MAX_OVERFLOW` - Max overflow connections (default: 20)

#### Redis Cache
- `REDIS_URL` - Redis connection string (default: redis://localhost:6379)
- `REDIS_DB` - Redis database number (default: 0)
- `CACHE_TTL_TRENDS` - Trends cache TTL in seconds (default: 300)

#### Models
- `EMBEDDING_MODEL` - Sentence transformer model (default: all-MiniLM-L6-v2)
- `SENTIMENT_MODEL_PATH` - Custom sentiment model path
- `TOXICITY_THRESHOLD` - Toxicity threshold (default: 0.3)

#### Regional
- `SUPPORTED_LANGUAGES` - SA languages (default: en,af,zu,xh,st,tn,ts,ss,nr,ve)
- `DEFAULT_REGION` - Default region code (default: ZA)

#### Performance
- `MAX_BATCH_SIZE` - Maximum batch size (default: 100)
- `DEVICE` - Model device (cpu/cuda/mps) (default: cpu)

## Usage Examples

### Classify Text

```bash
curl -X POST "http://localhost:8003/classify" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This amazing trend is taking over South Africa!",
    "language": "auto",
    "include_sentiment": true,
    "include_toxicity": true,
    "include_geo": true
  }'
```

### Get Current Trends

```bash
curl "http://localhost:8003/trends/current?limit=10&min_virality_score=70"
```

### Process Ingested Posts

```bash
curl -X POST "http://localhost:8003/ingest/process" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "platform": "twitter"}'
```

### Regional Trends

```bash
curl "http://localhost:8003/trends/GP?limit=20&categories=politics,entertainment"
```

## Monitoring

### Prometheus Metrics

Key metrics to monitor:

- `http_requests_total` - HTTP request count by endpoint
- `classification_duration_seconds` - Classification processing time
- `virality_score_distribution` - Virality score histogram
- `cache_hits_total` - Cache hit rates
- `service_health_status` - Component health status
- `posts_processed_total` - Ingestion throughput

### Health Checks

```bash
# Basic health
curl http://localhost:8003/health

# Detailed component status
curl http://localhost:8003/health/components

# Readiness check
curl http://localhost:8003/health/ready
```

### Logging

Structured logging with JSON output in production:

```json
{
  "timestamp": "2024-01-15T12:00:00Z",
  "level": "info",
  "event": "classification_completed",
  "text_length": 156,
  "language": "en",
  "processing_time_ms": 125.5,
  "virality_score": 78.2
}
```

## Development

### Project Structure

```
app/
├── main.py                 # FastAPI application
├── config.py               # Configuration settings
├── models/
│   ├── database.py         # SQLAlchemy ORM models
│   └── schemas.py          # Pydantic request/response models
├── services/
│   ├── text_cleaner.py     # Text preprocessing
│   ├── language_detector.py # Language identification
│   ├── sentiment_analyzer.py # Sentiment analysis
│   ├── toxicity_filter.py  # Toxicity detection
│   ├── geo_classifier.py   # Geographic classification
│   ├── topic_cluster.py    # Topic clustering
│   └── virality_score.py   # Virality scoring
├── routers/
│   ├── health_router.py    # Health check endpoints
│   ├── classify_router.py  # Classification endpoints
│   ├── trends_router.py    # Trends endpoints
│   └── ingest_router.py    # Ingestion endpoints
└── utils/
    ├── logger.py           # Structured logging
    ├── cache.py            # Redis cache service
    ├── db.py               # Database utilities
    └── metrics.py          # Prometheus metrics
```

### Adding New Services

1. Create service in `services/` directory
2. Implement async `load_models()` method
3. Add service to `main.py` lifespan
4. Update health checks and metrics
5. Add router if needed

### Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_classification.py
```

### Code Quality

```bash
# Format code
black app/
isort app/

# Lint code
flake8 app/

# Type checking
mypy app/
```

## Performance

### Benchmarks

- **Text Classification**: 50-200ms depending on model complexity
- **Batch Processing**: 100 texts in 1-3 seconds
- **Trend Query**: <100ms for cached results
- **Database Queries**: <50ms with proper indexing
- **Cache Operations**: <5ms for Redis

### Optimization Tips

1. **Batch Processing**: Use `/classify/batch` for multiple texts
2. **Caching**: Enable Redis caching for frequent queries
3. **GPU Acceleration**: Set `DEVICE=cuda` for faster model inference
4. **Connection Pooling**: Tune database pool settings for load
5. **Model Selection**: Use lighter models for higher throughput

### Scaling

- **Horizontal**: Deploy multiple instances behind load balancer
- **Vertical**: Increase memory and CPU for larger batches
- **Database**: Read replicas for query-heavy workloads
- **Cache**: Redis Cluster for high-throughput caching

## Troubleshooting

### Common Issues

**Model Loading Errors**
```bash
# Clear model cache and restart
rm -rf ~/.cache/torch/
docker-compose restart trend-intel
```

**Database Connection Issues**
```bash
# Check connection string format
# Should be: postgresql+asyncpg://user:pass@host:port/db
```

**High Memory Usage**
- Reduce `MAX_BATCH_SIZE`
- Use lighter embedding models
- Enable model quantization

**Slow Performance**
- Enable Redis caching
- Use GPU acceleration
- Optimize database queries with indexes

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=DEBUG
export DEBUG=true
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style

- Use Black for formatting
- Follow PEP 8 guidelines
- Add type hints for new functions
- Include docstrings for public methods
- Write tests for new features

## License

This project is part of ViralFX and follows the project's licensing terms.

## Support

- Documentation: [ViralFX Docs](https://docs.viralfx.com)
- Issues: [GitHub Issues](https://github.com/viralfx/trend-intel/issues)
- Discussions: [GitHub Discussions](https://github.com/viralfx/trend-intel/discussions)