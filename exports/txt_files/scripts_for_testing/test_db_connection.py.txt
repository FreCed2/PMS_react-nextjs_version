from app import create_app
from app.extensions.db import db


app = create_app()

with app.app_context():
    print("Database tables:", db.metadata.tables.keys())