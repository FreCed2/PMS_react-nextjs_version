from app import create_app, socketio
from dotenv import load_dotenv
import logging
import os

# Load environment variables from .env
load_dotenv()

# Create Flask app using the environment-specific configuration
app = create_app()

if __name__ == "__main__":
    # Create a handler to log to the console
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)  # Set the log level
    formatter = logging.Formatter("%(levelname)s %(asctime)s %(message)s")
    console_handler.setFormatter(formatter)

    # Get the app's logger and attach the handler
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)
    logger.addHandler(console_handler)

    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)  # 🔥 WebSockets ar
