import sys
import os

# Ensure the script runs from the correct project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

from app import create_app  # Import the function to create the Flask app
from app.extensions.db import db
from app.tasks.models import Task

# Create the app instance
app = create_app()

# Push an application context so Flask knows what app is running
with app.app_context():
    task = db.session.get(Task, 161)  # Correct for SQLAlchemy 2.0
    if task:
        print(vars(task))  # ✅ This will show all attributes of the Task instance
        task_dict = task.to_dict()
        print(task_dict)
    else:
        print("Task not found")