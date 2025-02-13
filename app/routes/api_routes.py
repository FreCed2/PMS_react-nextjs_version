import logging
import traceback
from sqlalchemy.exc import IntegrityError
from flask import Blueprint, request, jsonify
from flask_cors import CORS
from datetime import datetime
from app.forms.forms import csrf
from app.tasks.utils import TaskService
from app.models import Project, Contributor
from app.tasks.models import Task
from app.extensions.db import db


logger = logging.getLogger(__name__)  # Creates a logger for the current module
logger.debug("This is a debug message from the api_routes module")

# ✅ Corrected Order: Define the Blueprint first
api = Blueprint('api', __name__)  # Create a Blueprint for API routes

# ✅ Then apply CORS to the `api` blueprint
CORS(api)

# Json API endpoint to fetch all tasks. Used by the Next.js frontend.
@api.route("/tasks", methods=["GET"])
def list_tasks_json():
    """API endpoint to fetch tasks in JSON format for the Next.js frontend."""
    logger.info("Entering list_tasks_json route...")

    # Extract query parameters
    project_id = request.args.get("project_id", type=int)
    contributor_id = request.args.get("contributor_id", type=int)
    show_archived = request.args.get("show_archived", "false").lower() == "true"
    task_type = request.args.get("task_type", "all")
    completion_status = request.args.get("completion_status")
    hierarchical = request.args.get("hierarchical", "false").lower() == "true"
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 110, type=int)

    filters = {
        "is_archived": show_archived,
        "contributor_id": contributor_id,
        "task_type": task_type if task_type != "all" else None,
        "completion_status": completion_status,
        "project_id": project_id,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    logger.debug(f"Filters used in API: {filters}")

    try:
        if project_id:
            # Fetch tasks for the given project
            all_tasks = TaskService.fetch_all_tasks_as_dicts(filters)
            logger.debug(f"API Tasks fetched: {len(all_tasks)} tasks found")

            if hierarchical:
                # Build a hierarchy
                task_map = {task["id"]: task for task in all_tasks}
                top_level_tasks = [task for task in all_tasks if task["parent_id"] is None]

                for task in all_tasks:
                    if task["parent_id"]:
                        parent = task_map.get(task["parent_id"])
                        if parent:
                            parent.setdefault("children", []).append(task)

                tasks = top_level_tasks
            else:
                # Paginate tasks normally
                tasks_flat = [task for task in all_tasks]
                start = (page - 1) * per_page
                end = start + per_page
                tasks = tasks_flat[start:end]

            pagination = {
                "page": page,
                "per_page": per_page,
                "total": len(tasks_flat),
                "pages": (len(tasks_flat) + per_page - 1) // per_page,
                "page_numbers": TaskService.generate_page_numbers(
                    current_page=page,
                    total_pages=(len(tasks_flat) + per_page - 1) // per_page
                ),
            }
        else:
            # Default case: Get all tasks
            tasks_query = TaskService.filter_tasks(filters=filters)
            pagination_obj = tasks_query.paginate(page=page, per_page=per_page, error_out=False)
            tasks = [task.to_dict() for task in pagination_obj.items]

            pagination = {
                "page": pagination_obj.page,
                "per_page": pagination_obj.per_page,
                "total": pagination_obj.total,
                "pages": pagination_obj.pages,
                "page_numbers": TaskService.generate_page_numbers(
                    current_page=pagination_obj.page,
                    total_pages=pagination_obj.pages
                ),
            }

        # Fetch additional metadata
        task_types = ["all"] + [t[0] for t in db.session.query(Task.task_type).distinct()]
        projects = Project.query.options(db.lazyload(Project.contributors)).all()

        return jsonify({
            "tasks": tasks,
            "pagination": pagination,
            "filters": filters,
            "task_types": task_types,
            "projects": [{"id": p.id, "name": p.name} for p in projects],
        })

    except ValueError as ve:
        logger.error(f"ValueError in list_tasks_json: {str(ve)}")
        return jsonify({"error": "A value error occurred while fetching tasks."}), 400

    except db.exc.SQLAlchemyError as se:
        logger.error(f"SQLAlchemyError in list_tasks_json: {str(se)}")
        return jsonify({"error": "A database error occurred while fetching tasks."}), 500

    except Exception as e:
        logger.error(f"Unexpected error in list_tasks_json: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while fetching tasks."}), 500
    

@csrf.exempt
@api.route('/calculate_completion_percentage/<int:project_id>', methods=['GET'])
def calculate_completion_percentage_api(project_id):
    """
    API endpoint to calculate the completion percentage of a project.
    """
    # Retrieve the project
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": f"Project with ID {project_id} not found."}), 404

    # Use TaskService to calculate completion percentage
    completion_percentage = TaskService.calculate_completion_percentage(project)

    # Return the result as JSON
    return jsonify({"completion_percentage": completion_percentage})

@api.route('/delete_project/<int:project_id>', methods=['DELETE'])
def api_delete_project(project_id):
    """
    API endpoint to delete a project and its related tasks.
    """
    # Use TaskService to delete the project
    success, message = TaskService.delete_project_and_tasks(project_id)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'message': message}), 500

@api.route('/tasks/<int:task_id>', methods=['GET'])
def get_task_details(task_id):
    """
    Fetch task details by ID and return as JSON using the TaskService utility method.
    """
    logger.info(f"Fetching task details for Task ID {task_id}.")

    try:
        # Fetch the task as a dictionary using TaskService
        task_data = TaskService.fetch_task_as_dict(task_id)
        logger.debug(f"Fetched Task Data: {task_data}")  # Log the fetched data
        logger.info(f"Task details fetched successfully for Task ID {task_id}.")
        return jsonify(task_data), 200
    except ValueError as e:
        logger.error(f"Task not found: {e}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error fetching task details for Task ID {task_id}: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while fetching task details.",
            "details": str(e)
        }), 500


def validate_task_payload(data):
    """Validates task payload for required fields and hierarchy rules."""
    required_fields = ['title', 'project_id', 'task_type']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"

    try:
        # Safely convert story_points and parent_id to integers or None
        data['story_points'] = int(data['story_points']) if data.get('story_points') and str(data['story_points']).isdigit() else 0
        
        # Validate contributor_id exists in the database
        if 'contributor_id' in data and data['contributor_id']:
            contributor = Contributor.query.get(data['contributor_id'])
            if not contributor:
                # Log and return an error response if contributor is invalid
                logger.error(f"Contributor ID {data['contributor_id']} does not exist.")
                return jsonify({"error": "Invalid contributor ID"}), 400
            
        data['parent_id'] = int(data['parent_id']) if data.get('parent_id') and str(data['parent_id']).isdigit() else None

        # Enforce hierarchy validation
        if data['task_type'] == "Epic" and data['parent_id']:
            return False, "Epics cannot have a parent task."

        if data['task_type'] == "User Story" and data['parent_id']:
            parent_task = Task.query.get(data['parent_id'])
            if not parent_task or parent_task.task_type != "Epic":
                return False, "User Stories must have an Epic as a parent."

        if data['task_type'] == "Subtask" and data['parent_id']:
            parent_task = Task.query.get(data['parent_id'])
            if not parent_task or parent_task.task_type != "User Story":
                logger.error(f"Invalid parent for Subtask: parent_id={data['parent_id']}, parent_type={parent_task.task_type if parent_task else 'None'}")
                return False, "Subtasks must have a User Story as a parent."
    except ValueError as e:
        logger.error(f"Error validating payload: {e}")
        return False, "Fields 'story_points' and 'parent_id' must be integers."

    return True, None


@csrf.exempt
@api.route('/tasks', methods=['POST'])
def save_task():
    """
    API route to create a new task or update an existing one.
    Handles validation, parent-child hierarchy rules, and database interactions.
    """
    logger.info("save_task triggered")

    try:
        # Ensure the request contains JSON
        data = request.get_json()
        logger.info(f"Payload received: {data}")

        if not data:
            logger.error("No JSON payload received")
            return jsonify({"error": "Invalid input. Expected JSON payload."}), 400
        
        # If updating an existing task (id is present), delegate to update_task
        task_id = data.get('id') or data.get('task_id')
        if task_id:
            logger.info(f"Update request for Task ID: {task_id}")
            return update_task(data, task_id)

        # If creating a new task, validate and handle creation
        data['name'] = (data.get('name') or data.get('title', '')).strip().lower()
        if not data['name']:
            logger.error("Task name is missing in payload")
            return jsonify({"error": "Missing required field: 'name'"}), 400

        # Validate the payload
        valid, error_message = validate_task_payload(data)
        if not valid:
            logger.error(f"Validation failed: {error_message}")
            return jsonify({"error": error_message}), 400

        # Check for duplicates
        existing_task = Task.query.filter(
            Task.name.ilike(data['name']),
            Task.project_id == data['project_id'],
            Task.task_type == data['task_type']
        ).first()

        if existing_task:
            logger.warning(f"Duplicate task creation attempted: {data}")
            return jsonify({
                "error": "A task with the same name, project, and type already exists.",
                "task_id": existing_task.id,
            }), 409
            
        # Delegate to create_task for new task creation
        return create_task(data)

    except Exception as e:
        logger.error(f"Error in save_task: {e}", exc_info=True)
        return jsonify({"error": "Unexpected error occurred"}), 500

@csrf.exempt
@api.route('/tasks/<int:task_id>/status', methods=['PATCH'])
def update_task_status_route(task_id):
    """
    API route to update the status of a task.
    Handles status updates independently of other fields.
    """
    logger.info(f"update_task_status_route triggered for Task ID {task_id}")

    try:
        # Ensure the request contains JSON
        data = request.get_json()
        if not data or "status" not in data:
            logger.error("Invalid payload for status update")
            return jsonify({"error": "Invalid input. Expected 'status' in JSON payload."}), 400

        # Delegate to the `update_task` function with status-only payload
        return update_task({"id": task_id, "status": data["status"]}, task_id)

    except Exception as e:
        logger.error(f"Error in update_task_status_route: {e}", exc_info=True)
        return jsonify({"error": "Unexpected error occurred"}), 500

def update_task(data, task_id):
    """
    Updates an existing task, including status updates.
    """
    task = Task.query.get(task_id)
    if not task:
        logger.error(f"Task with ID {task_id} not found")
        return jsonify({"error": f"Task with ID {task_id} not found."}), 404

    try:
        logger.debug(f"Received update payload for Task ID {task_id}: {data}")

        # Convert empty strings to None for nullable integer fields
        data['parent_id'] = int(data['parent_id']) if data.get('parent_id') and str(data['parent_id']).isdigit() else None
        data['project_id'] = int(data['project_id']) if data.get('project_id') and str(data['project_id']).isdigit() else task.project_id
        data['story_points'] = int(data['story_points']) if data.get('story_points') and str(data['story_points']).isdigit() else task.story_points
        data['sort_order'] = int(data['sort_order']) if data.get('sort_order') and str(data['sort_order']).isdigit() else task.sort_order
        data['contributor_id'] = int(data['contributor_id']) if 'contributor_id' in data and data['contributor_id'] else task.contributor_id

        # Define allowed statuses
        ALLOWED_STATUSES = ["Not Started", "In Progress", "Completed", "Archived"]

        # Handle status-only updates separately
        if "status" in data:
            if data["status"] not in ALLOWED_STATUSES:
                logger.error(f"Invalid status value: {data['status']}")
                return jsonify({"error": f"Invalid status value. Allowed statuses: {ALLOWED_STATUSES}"}), 400

            # Update the status field
            task.status = data["status"]
            logger.debug(f"Updated status for Task ID {task_id} to: {task.status}")


        # Update all fields
        task.name = data.get('name', task.name).strip() if data.get('name') else task.name
        task.description = data.get('description', task.description)
        task.parent_id = data.get('parent_id', task.parent_id)
        task.project_id = data.get('project_id', task.project_id)
        task.story_points = data.get('story_points', task.story_points)
        task.task_type = data.get('task_type', task.task_type)
        task.contributor_id = data.get('contributor_id', task.contributor_id)
        task.completed = data.get('completed', task.completed)
        task.sort_order = data.get('sort_order', task.sort_order)
        task.updated_at = datetime.utcnow()

        # Commit the update
        db.session.commit()
        logger.info(f"Task ID {task_id} updated successfully.")

        # Include contributor name in the response
        contributor_name = task.contributor.name if task.contributor else None

        return jsonify({
            "message": "Task updated successfully",
            "task": {
                "id": task.id,
                "name": task.name,
                "project_id": task.project_id,
                "story_points": task.story_points,
                "parent_id": task.parent_id,
                "task_type": task.task_type,
                "contributor_id": task.contributor_id,
                "contributor_name": contributor_name,
                "completed": task.completed,
                "sort_order": task.sort_order,
                "status": task.status,
                "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            }
        }), 200

    except IntegrityError as e:
        logger.error(f"Integrity error during update: {e}")
        db.session.rollback()
        return jsonify({"error": "Database constraint error"}), 400
    except Exception as e:
        logger.error(f"Unexpected error during update: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Unexpected error occurred"}), 500
    

def create_task(data):
    """
    Creates a new task.
    """
    try:
        new_task = Task(
            name=data['name'],
            description=data.get('description'),
            project_id=data['project_id'],
            story_points=data['story_points'],
            parent_id=data['parent_id'],
            task_type=data['task_type'],
            contributor_id=data.get('contributor_id'),
            completed=data.get('completed', False),
            created_at=datetime.utcnow(),
            sort_order=data.get('sort_order', 0)
        )
        db.session.add(new_task)
        db.session.commit()
        logger.info(f"New task created successfully: {new_task.id}")
        
        # Include contributor_name in the response
        contributor_name = new_task.contributor.name if new_task.contributor else None
        
        # Fetch the task after committing to ensure it's saved and retrievable
        try:
            logger.debug("Attempting to fetch task after save...")
            task = Task.query.get(new_task.id)
            if not task:
                raise ValueError(f"Task with ID {new_task.id} not found after creation.")
            logger.debug(f"Fetched task: {task}")
        except Exception as e:
            logger.error(f"Error fetching task after save: {e}")
            db.session.rollback()
            return jsonify({"error": "Failed to retrieve saved task"}), 500

        # Return the successfully fetched task details
        return jsonify({
            "message": "Task created successfully",
            "task": {
                "id": new_task.id,
                "name": new_task.name,
                "project_id": new_task.project_id,
                "story_points": new_task.story_points,
                "task_type": new_task.task_type,  # Add this line
                "contributor_id": new_task.contributor_id,
                "contributor_name": contributor_name,
                "completed": new_task.completed,
                "sort_order": new_task.sort_order,
                "created_at": new_task.created_at,
            }
        }), 201
        
        
    except IntegrityError as e:
        logger.error(f"Integrity error during creation: {e}")
        db.session.rollback()
        return jsonify({"error": "Database constraint error"}), 400
    except Exception as e:
        logger.error(f"Unexpected error during creation: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Unexpected error occurred"}), 500


        
@api.route('/tasks/delete/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """
    API endpoint to delete a task. Optionally, delete its child tasks as well.
    :param task_id: ID of the task to be deleted.
    :return: JSON response with success or error message.
    """
    try:
        # Fetch the task
        task = Task.query.get(task_id)
        if not task:
            logger.error(f"Task with ID {task_id} not found.")
            return jsonify({"error": f"Task with ID {task_id} not found."}), 404
        
        # Check for child tasks without deleting
        if request.args.get('check_children_only', 'false').lower() == 'true':
            has_children = Task.query.filter_by(parent_id=task_id).count() > 0
            return jsonify({"has_children": has_children}), 200

        # Confirm deletion of children via query param
        confirm_children = request.args.get('confirm_children', 'false').lower() == 'true'

        # Use helper method to delete task
        task.delete_with_children(confirm=confirm_children)
        return jsonify({"message": f"Task {task_id} and its children have been deleted."}), 200

    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {str(e)}")
        return jsonify({"error": "An error occurred while deleting the task."}), 500
    