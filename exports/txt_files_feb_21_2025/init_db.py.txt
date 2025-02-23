# init_db.py
"""
This script initializes the database tables by creating them based on the models defined in the app.
"""

from app.extensions.db import db
from app import create_app

# Create the Flask application instance
app = create_app()

if __name__ == '__main__':
    with app.app_context():
        print("Using database URI:", app.config['SQLALCHEMY_DATABASE_URI'])
        print("Creating database tables...")
        try:
            db.create_all()  # Create all tables in the database based on the models defined
            print("Database tables created successfully.")
        except Exception as e:
            print(f"Error creating database tables: {e}")