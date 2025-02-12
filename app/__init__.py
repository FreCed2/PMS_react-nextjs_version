"""Initialize the Flask application.
This module creates the Flask application and initializes the necessary
extensions and configurations. It also registers the blueprints for the
application's routes."""

import os
import logging
from flask import Flask
from flask_migrate import Migrate
from flask_debugtoolbar import DebugToolbarExtension
from app.extensions.db import db
from app.forms.forms import csrf
from app.utils.logging_config import setup_logging
from app.config import get_config
from dotenv import load_dotenv



# Load environment variables from .env
load_dotenv()

# Initialize the Debug Toolbar extension
toolbar = DebugToolbarExtension()

def create_app():
    """Application factory function to initialize the Flask app."""
    app = Flask(__name__)

    # Load environment-specific configuration
    env = os.getenv("FLASK_ENV", "development")
    app.config.from_object(get_config(env))


    try:
        # Ensure instance folder exists
        os.makedirs(app.instance_path, exist_ok=True)

        # Debug mode settings (specific to development)
        if app.config.get("ENV") == "development":
            app.config.update({
                "DEBUG": True,
                "DEBUG_TB_INTERCEPT_REDIRECTS": False,  # Avoid interfering with redirects
                "DEBUG_TB_PROFILER_ENABLED": False,     # Enable the profiler for SQL queries
                "DEBUG_TB_TEMPLATE_EDITOR_ENABLED": True,
                "SQLALCHEMY_RECORD_QUERIES": True,      # Record SQLAlchemy queries for debugging
                "SQLALCHEMY_ECHO": False,               # Log all SQL statements
                "SECRET_KEY": "dev",                    # Set a basic key for development
            })
            
        # Enable SQLAlchemy engine logging
        import logging
        logging.basicConfig()
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
            
        # Debug output for confirmation
        print(f"DEBUG mode: {app.debug}")
        print(f"Environment: {app.config.get('ENV')}")
        print(f"SQLALCHEMY_RECORD_QUERIES: {app.config.get('SQLALCHEMY_RECORD_QUERIES')}")

        # Initialize Flask extensions
        db.init_app(app)
        csrf.init_app(app)
        Migrate(app, db)
        #toolbar.init_app(app)  # Enable Flask Debug Toolbar

        # Import models AFTER db is initialized
        with app.app_context():
            from app.models import Project, Contributor

        # Set up logging
        logger = setup_logging()
        logger.info("Application started in %s mode", env)

        # Register blueprints
        from app.routes.api_routes import api
        from app.routes.page_routes import page
        from app.tasks.routes import bp as tasks_bp

        app.register_blueprint(api, url_prefix="/api")
        app.register_blueprint(page)
        app.register_blueprint(tasks_bp, url_prefix="/tasks")

        logger.info("Blueprints registered successfully")

    except Exception as e:
        logging.error(f"Error during application initialization: {e}")
        raise e

    return app