import logging
import os
from logging.handlers import RotatingFileHandler


def setup_logging():
    """
    Configure logging for the application, including rotating file logs and
    development/production environment adjustments.
    """
    # Get the root logger
    logger = logging.getLogger()

    # Remove existing handlers to prevent duplication
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    # Set up a rotating file handler for general logs
    log_handler = RotatingFileHandler("app.log", maxBytes=1_000_000, backupCount=5)
    log_format = "%(asctime)s %(levelname)s: %(message)s"
    log_handler.setFormatter(logging.Formatter(log_format))

    # Set the logging levels based on the environment
    if os.getenv("FLASK_ENV") == "production":
        # Production environment: Focus on warnings and errors
        logger.setLevel(logging.WARNING)
        log_handler.setLevel(logging.ERROR)
    else:
        # Development environment: Enable detailed debugging
        logger.setLevel(logging.DEBUG)
        log_handler.setLevel(logging.DEBUG)

    # Add the log handler to the root logger
    logger.addHandler(log_handler)

    # Optional: Add a separate error log file for critical errors
    error_handler = RotatingFileHandler("error.log", maxBytes=1_000_000, backupCount=5)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(log_format))
    logger.addHandler(error_handler)

    # Suppress overly verbose library logs
    logging.getLogger("matplotlib").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    # Optional: Enable detailed SQLAlchemy query logging in development
    if os.getenv("FLASK_ENV") == "development":
        logging.getLogger("sqlalchemy.engine").setLevel(logging.DEBUG)

    return logger
