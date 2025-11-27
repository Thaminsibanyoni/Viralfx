"""Prometheus metrics utilities for monitoring service performance."""
import logging
import time
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager
from functools import wraps
from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST

logger = logging.getLogger(__name__)

# Request Metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

# Processing Metrics
classification_requests_total = Counter(
    'classification_requests_total',
    'Total classification requests',
    ['type']  # sentiment, toxicity, language, geo, full
)

classification_duration_seconds = Histogram(
    'classification_duration_seconds',
    'Classification processing duration',
    ['type'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

classification_errors_total = Counter(
    'classification_errors_total',
    'Total classification errors',
    ['type', 'error_type']
)

# Ingestion Metrics
posts_processed_total = Counter(
    'posts_processed_total',
    'Total posts processed',
    ['platform', 'status']  # success, failed, filtered
)

posts_processing_duration_seconds = Histogram(
    'posts_processing_duration_seconds',
    'Post processing duration',
    ['platform'],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

topics_created_total = Counter(
    'topics_created_total',
    'Total topics created',
    ['region']
)

virality_score_distribution = Histogram(
    'virality_score_distribution',
    'Distribution of virality scores',
    buckets=[0, 20, 40, 60, 80, 100]
)

# Model Metrics
model_inference_duration_seconds = Histogram(
    'model_inference_duration_seconds',
    'Model inference duration',
    ['model_name'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0]
)

model_load_time_seconds = Gauge(
    'model_load_time_seconds',
    'Time taken to load model',
    ['model_name']
)

# Cache Metrics
cache_hits_total = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_type']  # trends, classification, topics
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_type']
)

cache_operations_duration_seconds = Histogram(
    'cache_operations_duration_seconds',
    'Cache operation duration',
    ['operation'],  # get, set, delete
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
)

# Database Metrics
db_queries_total = Counter(
    'db_queries_total',
    'Total database queries',
    ['operation', 'table']  # select, insert, update, delete
)

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['operation', 'table'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

db_connection_pool_size = Gauge(
    'db_connection_pool_size',
    'Current database connection pool size'
)

# Service Health Metrics
service_health_status = Gauge(
    'service_health_status',
    'Service component health (1=healthy, 0=unhealthy)',
    ['component']  # cache, database, sentiment_model, toxicity_model, language_model
)

service_uptime_seconds = Gauge(
    'service_uptime_seconds',
    'Service uptime in seconds'
)

# Service Info
service_info = Info(
    'service_info',
    'Service information'
)

# Start time for uptime calculation
_start_time = time.time()


def track_request_metrics(method: str, endpoint: str, status: int, duration: float) -> None:
    """
    Track HTTP request metrics.

    Args:
        method: HTTP method
        endpoint: Request endpoint
        status: Response status code
        duration: Request duration in seconds
    """
    try:
        http_requests_total.labels(method=method, endpoint=endpoint, status=str(status)).inc()
        http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)
    except Exception as e:
        logger.error(f"Failed to track request metrics: {e}")


def track_classification_metrics(
    classification_type: str,
    duration: float,
    success: bool,
    error_type: str = None
) -> None:
    """
    Track classification metrics.

    Args:
        classification_type: Type of classification
        duration: Processing duration in seconds
        success: Whether classification succeeded
        error_type: Type of error (if failed)
    """
    try:
        classification_requests_total.labels(type=classification_type).inc()
        classification_duration_seconds.labels(type=classification_type).observe(duration)

        if not success and error_type:
            classification_errors_total.labels(type=classification_type, error_type=error_type).inc()

    except Exception as e:
        logger.error(f"Failed to track classification metrics: {e}")


def track_ingestion_metrics(
    platform: str,
    status: str,
    duration: float,
    post_count: int = 1
) -> None:
    """
    Track ingestion metrics.

    Args:
        platform: Social media platform
        status: Processing status (success, failed, filtered)
        duration: Processing duration in seconds
        post_count: Number of posts processed
    """
    try:
        for _ in range(post_count):
            posts_processed_total.labels(platform=platform, status=status).inc()

        posts_processing_duration_seconds.labels(platform=platform).observe(duration)

    except Exception as e:
        logger.error(f"Failed to track ingestion metrics: {e}")


def track_model_inference(model_name: str, duration: float) -> None:
    """
    Track model inference metrics.

    Args:
        model_name: Name of the model
        duration: Inference duration in seconds
    """
    try:
        model_inference_duration_seconds.labels(model_name=model_name).observe(duration)
    except Exception as e:
        logger.error(f"Failed to track model inference metrics: {e}")


def track_cache_operation(cache_type: str, operation: str, hit: bool = None, duration: float = None) -> None:
    """
    Track cache operation metrics.

    Args:
        cache_type: Type of cache (trends, classification, topics)
        operation: Operation type (get, set, delete)
        hit: Whether cache hit (for get operations)
        duration: Operation duration in seconds
    """
    try:
        if hit is not None:
            if hit:
                cache_hits_total.labels(cache_type=cache_type).inc()
            else:
                cache_misses_total.labels(cache_type=cache_type).inc()

        if duration is not None:
            cache_operations_duration_seconds.labels(operation=operation).observe(duration)

    except Exception as e:
        logger.error(f"Failed to track cache operation metrics: {e}")


def track_database_operation(operation: str, table: str, duration: float, success: bool = True) -> None:
    """
    Track database operation metrics.

    Args:
        operation: Type of operation (select, insert, update, delete)
        table: Database table name
        duration: Operation duration in seconds
        success: Whether operation succeeded
    """
    try:
        db_queries_total.labels(operation=operation, table=table).inc()
        db_query_duration_seconds.labels(operation=operation, table=table).observe(duration)

    except Exception as e:
        logger.error(f"Failed to track database operation metrics: {e}")


def update_health_status(component: str, is_healthy: bool) -> None:
    """
    Update service component health status.

    Args:
        component: Component name
        is_healthy: Whether component is healthy
    """
    try:
        service_health_status.labels(component=component).set(1 if is_healthy else 0)
    except Exception as e:
        logger.error(f"Failed to update health status: {e}")


def update_uptime() -> None:
    """Update service uptime metric."""
    try:
        uptime = time.time() - _start_time
        service_uptime_seconds.set(uptime)
    except Exception as e:
        logger.error(f"Failed to update uptime: {e}")


def set_service_info(
    service_name: str,
    version: str,
    environment: str,
    **kwargs: Any
) -> None:
    """
    Set service information.

    Args:
        service_name: Name of the service
        version: Service version
        environment: Deployment environment
        **kwargs: Additional service info
    """
    try:
        info = {
            'name': service_name,
            'version': version,
            'environment': environment,
            **kwargs
        }
        service_info.info(info)
    except Exception as e:
        logger.error(f"Failed to set service info: {e}")


def track_virality_score(score: float) -> None:
    """
    Track virality score distribution.

    Args:
        score: Virality score (0-100)
    """
    try:
        virality_score_distribution.observe(score)
    except Exception as e:
        logger.error(f"Failed to track virality score: {e}")


def track_topic_creation(region: str, topic_count: int = 1) -> None:
    """
    Track topic creation metrics.

    Args:
        region: Region where topic was created
        topic_count: Number of topics created
    """
    try:
        for _ in range(topic_count):
            topics_created_total.labels(region=region).inc()
    except Exception as e:
        logger.error(f"Failed to track topic creation: {e}")


def set_model_load_time(model_name: str, load_time: float) -> None:
    """
    Set model load time metric.

    Args:
        model_name: Name of the model
        load_time: Load time in seconds
    """
    try:
        model_load_time_seconds.labels(model_name=model_name).set(load_time)
    except Exception as e:
        logger.error(f"Failed to set model load time: {e}")


def set_db_connection_pool_size(pool_size: int) -> None:
    """
    Set database connection pool size metric.

    Args:
        pool_size: Current pool size
    """
    try:
        db_connection_pool_size.set(pool_size)
    except Exception as e:
        logger.error(f"Failed to set DB pool size: {e}")


@asynccontextmanager
async def track_time(metric: Histogram, labels: Dict[str, str] = None):
    """
    Context manager for timing operations.

    Args:
        metric: Histogram metric to observe
        labels: Labels for the metric
    """
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        try:
            if labels:
                metric.labels(**labels).observe(duration)
            else:
                metric.observe(duration)
        except Exception as e:
            logger.error(f"Failed to track time: {e}")


def timing(metric: Histogram, labels: Dict[str, str] = None):
    """
    Decorator for timing function execution.

    Args:
        metric: Histogram metric to observe
        labels: Labels for the metric
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                try:
                    if labels:
                        metric.labels(**labels).observe(duration)
                    else:
                        metric.observe(duration)
                except Exception as e:
                    logger.error(f"Failed to track function time: {e}")

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                try:
                    if labels:
                        metric.labels(**labels).observe(duration)
                    else:
                        metric.observe(duration)
                except Exception as e:
                    logger.error(f"Failed to track function time: {e}")

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def get_metrics() -> tuple:
    """
    Get Prometheus metrics data.

    Returns:
        Tuple of (content_type, metrics_data)
    """
    try:
        metrics_data = generate_latest()
        return CONTENT_TYPE_LATEST, metrics_data
    except Exception as e:
        logger.error(f"Failed to generate metrics: {e}")
        return CONTENT_TYPE_LATEST, b"# Error generating metrics\n"


def get_all_metrics() -> Dict[str, Any]:
    """
    Get all metrics as a dictionary for debugging.

    Returns:
        Dictionary with all metric values
    """
    try:
        # This is a simplified version - in production you'd want to use
        # the prometheus_client registry to get actual values
        return {
            "uptime_seconds": time.time() - _start_time,
            "service_info": "trend-intelligence",
            "metrics_collected": [
                "http_requests_total",
                "http_request_duration_seconds",
                "classification_requests_total",
                "classification_duration_seconds",
                "cache_hits_total",
                "cache_misses_total",
                "service_health_status"
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get metrics summary: {e}")
        return {"error": str(e)}


def create_metrics_middleware():
    """
    Create a FastAPI middleware that tracks HTTP request metrics.

    Returns:
        Middleware function that tracks request duration and increments metrics
    """
    async def middleware(request, call_next):
        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Extract endpoint path (remove query parameters)
            endpoint = request.url.path

            # Track request metrics
            http_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status=str(response.status_code)
            ).inc()

            http_request_duration_seconds.labels(
                method=request.method,
                endpoint=endpoint
            ).observe(duration)

            return response

        except Exception as e:
            # Track failed requests
            duration = time.time() - start_time
            endpoint = request.url.path

            http_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status="500"
            ).inc()

            http_request_duration_seconds.labels(
                method=request.method,
                endpoint=endpoint
            ).observe(duration)

            raise

    return middleware