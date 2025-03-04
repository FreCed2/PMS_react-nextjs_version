"""Initialize the Flask application.
This module creates the Flask application and initializes the necessary
extensions and configurations. It also registers the blueprints for the
application's routes."""

import os
import logging
from flask import Flask
from flask_migrate import Migrate
from flask_debugtoolbar import DebugToolbarExtension
from flask_cors import CORS  # ✅ Import CORS
from flask_socketio import SocketIO  # ✅ Import WebSockets
from flask import make_response, request, jsonify
from flask_wtf.csrf import generate_csrf
from app.extensions.db import db
from app.forms.forms import csrf
from app.utils.logging_config import setup_logging
from app.config import get_config
from dotenv import load_dotenv

# ✅ Ensure `async_mode` is set to "threading" for better compatibility
socketio = SocketIO(cors_allowed_origins=["http://localhost:3000"], async_mode="threading")  # ✅ WebSocket Initialization


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
                "DEBUG_TB_INTERCEPT_REDIRECTS": False,
                "DEBUG_TB_PROFILER_ENABLED": False,
                "DEBUG_TB_TEMPLATE_EDITOR_ENABLED": True,
                "SQLALCHEMY_RECORD_QUERIES": True,
                "SQLALCHEMY_ECHO": False,
                "SECRET_KEY": "dev",
            })
            
        # Enable SQLAlchemy engine logging
        logging.basicConfig()
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
            
        # Debug output for confirmation
        print(f"DEBUG mode: {app.debug}")
        print(f"Environment: {app.config.get('ENV')}")
        print(f"SQLALCHEMY_RECORD_QUERIES: {app.config.get('SQLALCHEMY_RECORD_QUERIES')}")

        # Initialize Flask extensions
        db.init_app(app)
        csrf.init_app(app)
        socketio.init_app(app)  # ✅ Initialize WebSockets
        
        
        # ✅ Register Flask-Migrate
        Migrate(app, db)

        #toolbar.init_app(app)

        # ✅ Correctly allow credentials and set specific frontend origin
        CORS(app, supports_credentials=True, resources={
            r"/api/*": {
                "origins": ["http://localhost:3000"],  # Explicit origin instead of "*"
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "X-CSRFToken"],
            },
            r"/tasks/*": {  # ✅ Extend CORS to task-related routes
                "origins": ["http://localhost:3000"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "X-CSRFToken"],
            }
        })
        
        
        # CORS(app, supports_credentials=True, resources={r"/api/*": {
        #     "origins": "http://localhost:3000",
        #     "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        # }})

        # Import models AFTER db is initialized
        with app.app_context():
            from app.models.models import Project, Contributor
            from app.tasks.models import Task
            _ = Project, Contributor, Task  # ✅ Dummy usage to prevent IDE warnings

        # Set up logging
        logger = setup_logging()
        logger.info("Application started in %s mode", env)

        # Register blueprints
        from app.routes.api_routes import api
        from app.routes.page_routes import page
        from app.tasks.routes import bp as tasks_bp

        app.register_blueprint(api, url_prefix="/api")  # ✅ Ensure this matches the fetch call
        app.register_blueprint(page)
        app.register_blueprint(tasks_bp, url_prefix="/tasks")

        logger.info("Blueprints registered successfully")
        
        # # ✅ Set CSRF token in response cookie after every request
        # @app.after_request
        # def add_cors_headers(response):
        #     response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        #     response.headers["Access-Control-Allow-Credentials"] = "true"
        #     response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        #     response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        #     print("CORS headers applied with PATCH")
        #     return response

        def set_csrf_cookie(response):
            csrf_token = generate_csrf()
            response.set_cookie(
                "csrftoken", csrf_token, 
                httponly=True, secure=False, samesite="Lax"
            )

            # ✅ If JSON response, attach CSRF token explicitly
            if response.is_json:
                data = response.get_json()
                if isinstance(data, dict):  # Ensure it's a JSON response
                    data["csrf_token"] = csrf_token
                    response.set_data(jsonify(data).data)
            
            print(f"✅ CSRF Token Set: {csrf_token}")  # Debugging output
            return response


    except Exception as e:
        logging.error(f"Error during application initialization: {e}")
        raise e

    return app