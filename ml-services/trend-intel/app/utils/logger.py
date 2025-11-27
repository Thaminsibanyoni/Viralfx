"""Structured logging utilities for the Trend Intelligence service."""
import logging
import sys
from typing import Any, Dict, Optional
import structlog
from structlog.processors import JSONRenderer, TimeStamper, add_log_level, add_logger_name
from structlog.dev import ConsoleRenderer


def setup_logging(
    log_level: str = "INFO",
    enable_json: bool = False,
    service_name: str = "trend-intel"
) -> structlog.stdlib.BoundLogger:
    """
    Configure structlog with processors for structured logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_json: Whether to use JSON formatting (for production)
        service_name: Name of the service for log context

    Returns:
        Configured structlog logger
    """
    # Convert log level string to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=numeric_level,
    )

    # List of processors for log entries
    processors = [
        # Add contextual information
        add_log_level,
        add_logger_name,
        structlog.stdlib.add_log_level_number,
        structlog.stdlib.PositionalArgumentsFormatter(),
        TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),

        # Handle exceptions
        structlog.processors.format_exc_info,

        # Handle Unicode
        structlog.processors.UnicodeDecoder(),

        # Conditional rendering based on environment
        ConsoleRenderer(colors=True) if not enable_json else JSONRenderer(),
    ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Get and return a bound logger with service context
    logger = structlog.get_logger(service=service_name)

    # Log initialization
    logger.info(
        "Logging initialized",
        log_level=log_level,
        json_format=enable_json,
        service=service_name
    )

    return logger


def get_logger(name: Optional[str] = None) -> structlog.stdlib.BoundLogger:
    """
    Get a logger instance.

    Args:
        name: Optional logger name (uses service name if not provided)

    Returns:
        Logger instance
    """
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()


def log_performance(
    logger: structlog.stdlib.BoundLogger,
    operation: str,
    duration_ms: float,
    **kwargs: Any
) -> None:
    """
    Log performance metrics.

    Args:
        logger: Logger instance
        operation: Name of the operation
        duration_ms: Duration in milliseconds
        **kwargs: Additional context to log
    """
    logger.info(
        "Performance metric",
        operation=operation,
        duration_ms=duration_ms,
        **kwargs
    )


def log_error(
    logger: structlog.stdlib.BoundLogger,
    error: Exception,
    operation: str,
    **kwargs: Any
) -> None:
    """
    Log error with context.

    Args:
        logger: Logger instance
        error: Exception that occurred
        operation: Operation that failed
        **kwargs: Additional context
    """
    logger.error(
        "Operation failed",
        operation=operation,
        error_type=type(error).__name__,
        error_message=str(error),
        exc_info=True,
        **kwargs
    )


def log_request(
    logger: structlog.stdlib.BoundLogger,
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    **kwargs: Any
) -> None:
    """
    Log HTTP request.

    Args:
        logger: Logger instance
        method: HTTP method
        path: Request path
        status_code: Response status code
        duration_ms: Request duration
        **kwargs: Additional context
    """
    logger.info(
        "HTTP request",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=duration_ms,
        **kwargs
    )


def log_model_loading(
    logger: structlog.stdlib.BoundLogger,
    model_name: str,
    model_path: str,
    load_time_ms: float,
    success: bool = True,
    error: Optional[Exception] = None
) -> None:
    """
    Log model loading events.

    Args:
        logger: Logger instance
        model_name: Name of the model
        model_path: Path to model file
        load_time_ms: Loading time in milliseconds
        success: Whether loading succeeded
        error: Error if loading failed
    """
    if success:
        logger.info(
            "Model loaded successfully",
            model_name=model_name,
            model_path=model_path,
            load_time_ms=load_time_ms
        )
    else:
        logger.error(
            "Model loading failed",
            model_name=model_name,
            model_path=model_path,
            error_message=str(error) if error else "Unknown error",
            exc_info=True
        )


def log_batch_processing(
    logger: structlog.stdlib.BoundLogger,
    batch_size: int,
    processed_count: int,
    failed_count: int,
    duration_ms: float,
    operation: str,
    **kwargs: Any
) -> None:
    """
    Log batch processing results.

    Args:
        logger: Logger instance
        batch_size: Total items in batch
        processed_count: Successfully processed items
        failed_count: Failed items
        duration_ms: Processing duration
        operation: Type of operation
        **kwargs: Additional context
    """
    logger.info(
        "Batch processing completed",
        operation=operation,
        batch_size=batch_size,
        processed_count=processed_count,
        failed_count=failed_count,
        success_rate=processed_count / batch_size if batch_size > 0 else 0,
        duration_ms=duration_ms,
        items_per_second=(batch_size * 1000) / duration_ms if duration_ms > 0 else 0,
        **kwargs
    )


def log_cache_operation(
    logger: structlog.stdlib.BoundLogger,
    operation: str,
    key: str,
    hit: Optional[bool] = None,
    duration_ms: Optional[float] = None,
    **kwargs: Any
) -> None:
    """
    Log cache operations.

    Args:
        logger: Logger instance
        operation: Cache operation (get, set, delete, etc.)
        key: Cache key
        hit: Whether cache hit (for get operations)
        duration_ms: Operation duration
        **kwargs: Additional context
    """
    log_data = {
        "cache_operation": operation,
        "cache_key": key,
        **kwargs
    }

    if hit is not None:
        log_data["cache_hit"] = hit

    if duration_ms is not None:
        log_data["duration_ms"] = duration_ms

    logger.debug("Cache operation", **log_data)


def log_database_operation(
    logger: structlog.stdlib.BoundLogger,
    operation: str,
    table: str,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error: Optional[Exception] = None,
    **kwargs: Any
) -> None:
    """
    Log database operations.

    Args:
        logger: Logger instance
        operation: Database operation (select, insert, update, delete)
        table: Table name
        duration_ms: Operation duration
        success: Whether operation succeeded
        error: Error if operation failed
        **kwargs: Additional context
    """
    log_data = {
        "db_operation": operation,
        "db_table": table,
        **kwargs
    }

    if duration_ms is not None:
        log_data["duration_ms"] = duration_ms

    if success:
        logger.debug("Database operation completed", **log_data)
    else:
        logger.error(
            "Database operation failed",
            error_message=str(error) if error else "Unknown error",
            exc_info=True,
            **log_data
        )