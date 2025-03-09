import os
from dotenv import load_dotenv

# Explicitly load .env from the root directory
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)


class Config:
    """Base configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key")  # Uses the .env value or a fallback
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "postgresql://localhost:5432/defaultdb")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = False

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    ENV = "development"

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "postgresql://localhost:5432/testdb")
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    ENV = "production"

# Factory function for configuration
def get_config(env):
    if env == "development":
        return DevelopmentConfig
    elif env == "testing":
        return TestingConfig
    elif env == "production":
        return ProductionConfig
    return Config