import os

class Config:
    """Base configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "your_default_secret_key")
    SQLALCHEMY_DATABASE_URI = "postgresql://pythonproject_user:securepassword@localhost:5432/pythonproject"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = False

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    ENV = "development"

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "postgresql://pythonproject_user:securepassword@localhost:5432/pythonproject_test"
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