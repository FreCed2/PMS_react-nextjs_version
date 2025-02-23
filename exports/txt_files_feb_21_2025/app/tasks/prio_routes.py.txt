from flask import Flask, request, jsonify
import numpy as np
from datetime import datetime
from models import Task, TaskPriority, db

app = Flask(__name__)

@app.route('/tasks/<int:task_id>/calculate_rice', methods=['POST'])
def calculate_rice(task_id):
    """AI-powered RICE calculation for a task."""
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    # Simulated AI-based parameter prediction
    reach = np.random.uniform(1, 10)  # Placeholder: Replace with real model
    impact = np.random.uniform(1, 10)
    confidence = np.random.uniform(0.5, 1.0)
    effort = np.random.uniform(1, 10)

    priority_score = (reach * impact * confidence) / effort

    priority = TaskPriority(task_id=task.id, reach=reach, impact=impact,
                            confidence=confidence, effort=effort,
                            calculated_priority=priority_score, ai_generated=True)
    db.session.add(priority)
    db.session.commit()

    return jsonify({"task_id": task.id, "priority_score": priority_score})
