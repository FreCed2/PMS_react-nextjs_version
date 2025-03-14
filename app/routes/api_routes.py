import logging
import traceback
from sqlalchemy.exc import IntegrityError
from flask import Blueprint, request, jsonify, make_response
from flask_cors import CORS
from flask_wtf.csrf import generate_csrf
from markupsafe import Markup  # ✅ Import from markupsafe
from datetime import datetime
from app.forms.forms import csrf
from app.tasks.utils import TaskService
from app.models import Project, Contributor
from app.tasks.models import Task
from app.extensions.db import db
from app import socketio  # ✅ Ensure this is imported where needed
from flask_socketio import SocketIO, emit

logger = logging.getLogger(__name__)  # Creates a logger for the current module
logger.debug("This is a debug message from the api_routes module")

# ✅ Corrected Order: Define the Blueprint first
api = Blueprint('api', __name__)  # Create a Blueprint for API routes

# ✅ Then apply CORS to the `api` blueprint
CORS(api)

# ✅ Emit an event when a contributor is added
@socketio.on("new_contributor")
def handle_new_contributor(data):
    """ Broadcasts a WebSocket event when a new contributor is added. """
    logger.info(f"📡 WebSocket Event: New Contributor Added - {data}")
    emit("update_contributors", data, broadcast=True)

# ✅ Emit an event when a task is updated
@socketio.on("task_updated")
def handle_task_update(data):
    """ Broadcasts a WebSocket event when a task is updated. """
    logger.info(f"📡 WebSocket Event: Task Updated - {data}")
    emit("update_task", data, broadcast=True)

# ✅ Emit an event when a contributor is removed
@socketio.on("remove_contributor")
def handle_remove_contributor(data):
    """ Broadcasts a WebSocket event when a contributor is removed. """
    logger.info(f"📡 WebSocket Event: Contributor Removed - {data}")
    emit("update_contributors", {"removed": True, **data}, broadcast=True)
    
@api.route("/csrf", methods=["GET"])
def get_csrf_token():
    """Returns a new CSRF token for the frontend."""
    csrf_token = generate_csrf()
    return jsonify({"csrf_token": csrf_token})

# @api.after_request
# def add_cors_headers(response):
#     response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
#     response.headers["Access-Control-Allow-Credentials"] = "true"
#     response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
#     response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
#     return response

@csrf.exempt
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
    per_page = request.args.get("per_page", 700, type=int)

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
            if hierarchical:
                # 🔥 Optimized Recursive SQL Query for Hierarchical Data
                sql = """
                WITH RECURSIVE task_hierarchy AS (
                    SELECT 
                        id, name, description, task_type, is_archived, completed, 
                        parent_id, project_id, contributor_id, story_points, status, sort_order
                    FROM task
                    WHERE project_id = %s AND parent_id IS NULL
                    UNION ALL
                    SELECT 
                        t.id, t.name, t.description, t.task_type, t.is_archived, t.completed, 
                        t.parent_id, t.project_id, t.contributor_id, t.story_points, t.status, t.sort_order
                    FROM task t
                    INNER JOIN task_hierarchy th ON t.parent_id = th.id
                )
                SELECT * FROM task_hierarchy ORDER BY sort_order;
                """
                result = db.session.execute(sql, (project_id,))
                all_tasks = [dict(row) for row in result]

                # Convert flat result into a nested structure
                task_map = {task["id"]: task for task in all_tasks}
                for task in all_tasks:
                    task.setdefault("children", [])
                    if task["parent_id"]:
                        task_map[task["parent_id"]]["children"].append(task)

                tasks = [task for task in all_tasks if task["parent_id"] is None]

            else:
                # 🔥 Optimized Flat Query with Pagination
                sql = """
                SELECT id, name, description, task_type, is_archived, completed, 
                       parent_id, project_id, contributor_id, story_points, status, sort_order
                FROM task
                WHERE project_id = %s
                ORDER BY sort_order
                LIMIT %s OFFSET %s;
                """
                result = db.session.execute(sql, (project_id, per_page, (page - 1) * per_page))
                tasks = [dict(row) for row in result]

            # Pagination metadata
            pagination = {
                "page": page,
                "per_page": per_page,
                "total": len(tasks),
                "pages": (len(tasks) + per_page - 1) // per_page,
                "page_numbers": TaskService.generate_page_numbers(
                    current_page=page,
                    total_pages=(len(tasks) + per_page - 1) // per_page
                ),
            }

        else:
            # 🔥 Use TaskService to Filter & Paginate Tasks Without Project Filtering
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
    


    
def ensure_miscellaneous_project():
    misc_project = Project.query.filter_by(name="Miscellaneous").first()
    if not misc_project:
        misc_project = Project(name="Miscellaneous", description="Default project for uncategorized tasks")
        db.session.add(misc_project)
        db.session.commit()
        logger.info("✅ Created default 'Miscellaneous' project.")
    return misc_project.id  # Return its ID

@api.route("/projects/miscellaneous", methods=["GET"])
def get_miscellaneous_project():
    """Fetches the 'Miscellaneous' project or creates it if missing."""
    project_id = ensure_miscellaneous_project()
    return jsonify({"id": project_id, "name": "Miscellaneous"})
    
@api.route('/projects', methods=['GET'])
def get_projects():
    """
    API endpoint to fetch all projects.
    """
    try:
        ensure_miscellaneous_project()  # Ensure project exists
        projects = Project.query.all()
        return jsonify([{"id": p.id, "name": p.name} for p in projects]), 200
    except Exception as e:
        logger.error(f"Error fetching projects: {str(e)}")
        return jsonify({"error": "An error occurred while fetching projects."}), 500
    
@csrf.exempt  # ✅ Disable CSRF protection for this route
@api.route('/projects/<int:project_id>/contributors/manage', methods=['GET', 'POST', 'DELETE'])
def manage_project_contributors(project_id):
    """
    GET: Fetch all contributors globally, marking whether they are part of the project.
    POST: Add a new contributor to the project if not already assigned.
    DELETE: Remove a contributor from a project.
    """
    project = Project.query.get_or_404(project_id)  # ✅ Ensure project exists

    if request.method == "GET":
        try:
            # ✅ Fetch all contributors globally
            all_contributors = Contributor.query.all()

            # ✅ Get contributors assigned to this project
            project_contributor_ids = {c.id for c in project.contributors}

            # ✅ Prepare response with `is_in_project` flag and `projects` array
            contributors = [
                {
                    "id": c.id,
                    "name": c.name,
                    "is_in_project": c.id in project_contributor_ids,
                    "projects": [p.id for p in c.projects]  # ✅ List all project IDs
                }
                for c in all_contributors
            ]

            return jsonify(contributors), 200

        except Exception as e:
            return jsonify({"error": f"Failed to fetch contributors: {str(e)}"}), 500

    elif request.method == "POST":
        try:
            data = request.get_json()
            contributor_id = data.get("contributor_id")

            if not contributor_id:
                return jsonify({"error": "Contributor ID is required"}), 400

            contributor = Contributor.query.get_or_404(contributor_id)

            # ✅ Check if already assigned
            if contributor in project.contributors:
                return jsonify({"message": "Contributor already assigned"}), 200

            # ✅ Assign contributor to project
            project.contributors.append(contributor)
            db.session.commit()

            # ✅ Emit WebSocket event for real-time updates
            if socketio is not None:
                try:
                    logger.info("📡 WebSocket: Emitting `update_contributors` event...")
                    socketio.emit("update_contributors", {
                        "id": contributor.id,
                        "name": contributor.name,
                        "project_id": project.id
                    }, namespace="/", to=None)
                    logger.info("✅ WebSocket Event Sent Successfully!")
                except Exception as e:
                    logger.error(f"🚨 Failed to send WebSocket event: {e}")
            else:
                logger.error("🚨 WebSocket (socketio) is still None! Check initialization.")

            return jsonify({
                "message": "Contributor added successfully",
                "contributor": {"id": contributor.id, "name": contributor.name},
                "project": {"id": project.id, "name": project.name}
            }), 201

        except Exception as e:
            return jsonify({"error": f"Failed to assign contributor: {str(e)}"}), 500

    elif request.method == "DELETE":
        try:
            data = request.get_json()
            contributor_id = data.get("contributor_id")

            if not contributor_id:
                return jsonify({"error": "Contributor ID is required"}), 400

            contributor = Contributor.query.get_or_404(contributor_id)

            # ✅ Ensure contributor is in project before removing
            if contributor not in project.contributors:
                return jsonify({"error": "Contributor is not assigned to this project"}), 400

            # ✅ Remove contributor from project
            project.contributors.remove(contributor)
            db.session.commit()

            # ✅ Emit WebSocket event for removal
            try:
                socketio.start_background_task(
                    lambda: socketio.emit("update_contributors", {
                        "id": contributor.id,
                        "name": contributor.name,
                        "project_id": project.id,
                        "removed": True
                    }, namespace="/", to=None)
                )
                logger.info("✅ WebSocket Event Sent Successfully!")
            except Exception as e:
                logger.error(f"🚨 WebSocket Event Failed: {e}")

            return jsonify({
                "message": "Contributor removed successfully",
                "contributor": {"id": contributor.id, "name": contributor.name},
                "project": {"id": project.id, "name": project.name}
            }), 200

        except Exception as e:
            return jsonify({"error": f"Failed to remove contributor: {str(e)}"}), 500
    

@api.route('/contributors', methods=['GET'])
def get_all_contributors():
    """
    API endpoint to fetch all contributors globally.
    """
    try:
        all_contributors = Contributor.query.all()

        contributors = [
            {
                "id": c.id,
                "name": c.name,
                "projects": [p.id for p in c.projects]  # ✅ Get all project IDs the contributor is assigned to
            }
            for c in all_contributors
        ]

        return jsonify(contributors), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to fetch contributors: {str(e)}"}), 500

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
    
    # ✅ Ensure project_id is not empty or None
    if "project_id" not in data or not str(data["project_id"]).strip():
        return False, "Project ID cannot be empty. Assign the task to a project."
    
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    # ✅ Convert project_id safely
    try:
        data['project_id'] = int(data['project_id'])
    except ValueError:
        return False, "Invalid Project ID. It must be an integer."

    try:
        # ✅ Convert optional fields safely
        data['story_points'] = int(data['story_points']) if str(data.get('story_points', '')).isdigit() else 0
        data['parent_id'] = int(data['parent_id']) if str(data.get('parent_id', '')).isdigit() else None

        # ✅ Validate contributor ID exists
        if data.get('contributor_id'):
            contributor = Contributor.query.get(data['contributor_id'])
            if not contributor:
                logger.error(f"Contributor ID {data['contributor_id']} does not exist.")
                return False, "Invalid contributor ID."

        # ✅ Enforce hierarchy validation only if parent_id exists
        if data['parent_id']:
            parent_task = Task.query.get(data['parent_id'])
            if not parent_task:
                return False, f"Parent task with ID {data['parent_id']} does not exist."

            # Validate hierarchy rules
            if data['task_type'] == "Epic":
                return False, "Epics cannot have a parent task."
            if data['task_type'] == "User Story" and parent_task.task_type != "Epic":
                return False, "User Stories must have an Epic as a parent."
            if data['task_type'] == "Subtask" and parent_task.task_type != "User Story":
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
        
        logger.info(f"🔥 Incoming Payload: {data}")

        # Validate the payload
        valid, error_message = validate_task_payload(data)
        if not valid:
            logger.error(f"Validation failed: {error_message}")
            return jsonify({"error": error_message}), 400

        ## Check for duplicates - NOW RETURNING A WARNING INSTEAD OF ERROR
        #existing_task = Task.query.filter(
        #    Task.name.ilike(data['name']),
        #    Task.project_id == data['project_id'],
        #    Task.task_type == data['task_type'],
        #    Task.is_archived == False
        #).first()

        #if existing_task:
        #    logger.warning(f"Duplicate task detected: {data}")

        #    # ✅ If the existing task has different properties, proceed with update
        #    if (
        #        existing_task.status != data.get("status") or
        #        existing_task.priority != data.get("priority") or
        #        existing_task.contributor_id != data.get("contributor_id") or
        #        existing_task.story_points != data.get("story_points")
        #    ):
        #        logger.info(f"Updating existing task {existing_task.id} due to changed fields.")
        #        return update_task(data, existing_task.id)

        #    # ✅ Return existing task if no updates are required
        #    return jsonify({
        #        "message": "Duplicate task found. Returning existing task data.",
        #        "task": existing_task.to_dict(),
        #        "warning": "A task with the same name already exists, but duplicates are allowed."
        #    }), 200
        
        ## **Proceed with task creation**
        return create_task(data)

    except Exception as e:
        logger.error(f"Error in save_task: {e}", exc_info=True)
        return jsonify({"error": "Unexpected error occurred"}), 500

    
# @csrf.exempt
# @api.route('/tasks/<int:task_id>', methods=['PATCH'])
# def update_task_route(task_id):
#     """
#     API endpoint to update a task.
#     This function wraps the existing `update_task(data, task_id)`.
#     """
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"error": "Invalid request. No JSON payload provided."}), 400
        
#         return update_task(data, task_id)

#     except Exception as e:
#         logger.error(f"Error in update_task_route: {e}", exc_info=True)
#         return jsonify({"error": "Unexpected error occurred"}), 500

# def update_task(data, task_id):
#     """
#     Updates an existing task with the provided data.
#     Only updating fields that have changed to optimize database transactions.
#     Ensures that the assigned contributor is also part of the task´s project.
#     """
#     task = Task.query.get(task_id)
#     if not task:
#         logger.error(f"Task with ID {task_id} not found")
#         return jsonify({"error": f"Task with ID {task_id} not found."}), 404

#     try:
#         logger.debug(f"Received update payload for Task ID {task_id}: {data}")

#         # Convert empty strings to None for nullable integer fields
#         data['parent_id'] = int(data['parent_id']) if data.get('parent_id') and str(data['parent_id']).isdigit() else None
#         data['project_id'] = int(data['project_id']) if data.get('project_id') and str(data['project_id']).isdigit() else task.project_id
#         data['story_points'] = int(data['story_points']) if data.get('story_points') and str(data['story_points']).isdigit() else task.story_points
#         data['sort_order'] = int(data['sort_order']) if data.get('sort_order') and str(data['sort_order']).isdigit() else task.sort_order
#         data['contributor_id'] = int(data['contributor_id']) if 'contributor_id' in data and data['contributor_id'] else task.contributor_id

#         # Define allowed statuses and priorities
#         ALLOWED_STATUSES = ["Not Started", "In Progress", "Completed", "Archived"]
#         ALLOWED_PRIORITIES = ["Unset", "Low", "Medium", "High", "Critical"]
#         ALLOWED_EPIC_PRIORITIES = ["Unset", "P0", "P1", "P2", "P3", "P4"]

#         updated_fields = []  # Track which fields are updated

#         # ✅ Handle `task_type` changes before priority updates
#         if "task_type" in data and data["task_type"] != task.task_type:
#             logger.info(f"Task ID {task_id}: Changing task_type from {task.task_type} to {data['task_type']}")

#             # ✅ Remove epic_priority if changing to non-Epic
#             if task.task_type == "Epic" and data["task_type"] != "Epic":
#                 logger.info(f"Task ID {task_id}: Removing epic_priority (was: {task.epic_priority})")
#                 task.epic_priority = None
#                 updated_fields.append("epic_priority")

#             # ✅ Remove priority if changing to Epic
#             if data["task_type"] == "Epic":
#                 logger.info(f"Task ID {task_id}: Removing priority (was: {task.priority})")
#                 task.priority = None
#                 updated_fields.append("priority")

#             task.task_type = data["task_type"]
#             updated_fields.append("task_type")

#         # ✅ Handle status updates
#         if "status" in data and data["status"] in ALLOWED_STATUSES:
#             if task.status != data["status"]:  # ✅ Prevent redundant updates
#                 task.status = data["status"]
#                 updated_fields.append("status")
#                 logger.debug(f"Updated status for Task ID {task_id} to: {task.status}")

#                 # ✅ Handle "completed" and "completed_date" updates
#                 if task.status == "Completed":
#                     if not task.completed:
#                         task.completed = True
#                         task.completed_date = datetime.utcnow()
#                         updated_fields.append("completed")
#                         updated_fields.append("completed_date")
#                         logger.debug(f"Task {task_id} marked as completed at {task.completed_date}.")
#                 else:
#                     if task.completed:
#                         task.completed = False
#                         task.completed_date = None  # Reset completed_date
#                         updated_fields.append("completed")
#                         updated_fields.append("completed_date")
#                         logger.debug(f"Task {task_id} unmarked as completed.")

#         # ✅ Handle priority updates after `task_type` check
#         if "priority" in data or "epic_priority" in data:
#             if task.task_type == "Epic":
#                 if "priority" in data:
#                     return jsonify({"error": "Epics cannot have task priority."}), 400
#                 if "epic_priority" in data and data["epic_priority"] in ALLOWED_EPIC_PRIORITIES:
#                     if task.epic_priority != data["epic_priority"]:  # ✅ Prevent redundant updates
#                         task.epic_priority = data["epic_priority"]
#                         updated_fields.append("epic_priority")
#                         logger.debug(f"Updated epic priority for Task ID {task_id} to: {task.epic_priority}")
#             else:
#                 if "epic_priority" in data:
#                     # ✅ Remove epic_priority if task is not an Epic
#                     logger.info(f"Task ID {task_id}: Removing epic_priority (was: {task.epic_priority})")
#                     task.epic_priority = None
#                     updated_fields.append("epic_priority")

#                 if "priority" in data and data["priority"] in ALLOWED_PRIORITIES:
#                     if task.priority != data["priority"]:  # ✅ Prevent redundant updates
#                         task.priority = data["priority"]
#                         updated_fields.append("priority")
#                         logger.debug(f"Updated priority for Task ID {task_id}")

#         # ✅ Handle general task field updates
#         if "name" in data and data["name"].strip() and data["name"].strip() != task.name:
#             task.name = data["name"].strip()
#             updated_fields.append("name")

#         if "description" in data and data["description"] != task.description:
#             task.description = data["description"]
#             updated_fields.append("description")

#         if "parent_id" in data and data["parent_id"] != task.parent_id:
#             task.parent_id = data["parent_id"]
#             updated_fields.append("parent_id")

#         if "project_id" in data and data["project_id"] != task.project_id:
#             task.project_id = data["project_id"]
#             updated_fields.append("project_id")

#         if "story_points" in data and data["story_points"] != task.story_points:
#             task.story_points = data["story_points"]
#             updated_fields.append("story_points")

#         # ✅ Assign Contributor and Ensure Project Membership
#         if "contributor_id" in data and data["contributor_id"] != task.contributor_id:
#             contributor = Contributor.query.get(data["contributor_id"])
#             if contributor:
#                 task.contributor_id = data["contributor_id"]
#                 updated_fields.append("contributor_id")

#                 # ✅ Ensure the contributor is part of the task's project
#                 if contributor not in task.project.contributors:
#                     task.project.contributors.append(contributor)
#                     db.session.commit()
#                     logger.info(f"✅ Contributor {contributor.id} added to Project {task.project.id}")

#                     # ✅ WebSocket event for project update
#                     socketio.emit("update_contributors", {
#                         "id": contributor.id,
#                         "name": contributor.name,
#                         "project_id": task.project.id
#                     }, namespace="/", to=None)

#             else:
#                 return jsonify({"error": "Invalid Contributor ID"}), 400

#         # ✅ Commit task update if any changes were made
#         if updated_fields:
#             task.updated_at = datetime.utcnow()
#             db.session.commit()
#             logger.info(f"Task ID {task_id} updated successfully. Updated fields: {updated_fields}")

#             # ✅ WebSocket event for task update
#             socketio.emit("update_task", {
#                 "taskId": task.id,
#                 "contributor_id": task.contributor_id,
#                 "contributor_name": task.contributor.name if task.contributor else "Unassigned"
#             }, namespace="/", to=None)

#         else:
#             logger.info(f"Task ID {task_id} - No changes detected, skipping database commit.")

#         # Include contributor name in the response
#         contributor_name = task.contributor.name if task.contributor else None

#         return jsonify({
#             "message": "Task updated successfully",
#             "task": {
#                 "id": task.id,
#                 "name": task.name,
#                 "project_id": task.project_id,
#                 "story_points": task.story_points,
#                 "parent_id": task.parent_id,
#                 "task_type": task.task_type,
#                 "priority": task.priority,  # ✅ Include priority in response
#                 "epic_priority": task.epic_priority,  # ✅ Include epic_priority in response
#                 "contributor_id": task.contributor_id,
#                 "contributor_name": contributor_name,
#                 "completed": task.completed,
#                 "completed_date": task.completed_date.isoformat() if task.completed_date else None,  # ✅ Include completion timestamp
#                 "sort_order": task.sort_order,
#                 "status": task.status,
#                 "updated_at": task.updated_at.isoformat() if task.updated_at else None,
#             }
#         }), 200

#     except IntegrityError as e:
#         logger.error(f"Integrity error during update: {e}")
#         db.session.rollback()
#         return jsonify({"error": "Database constraint error"}), 400
#     except Exception as e:
#         logger.error(f"Unexpected error during update: {e}", exc_info=True)
#         db.session.rollback()
#         return jsonify({"error": "Unexpected error occurred"}), 500
    
    
    
    
    
#--------------New Update task route and helper functions for each separate field-----------------
    
@csrf.exempt
@api.route('/tasks/<int:task_id>', methods=['PATCH'])
def update_task_route(task_id):
    """
    API endpoint to update a task.
    Delegates updates to specialized helper functions for maintainability.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request. No JSON payload provided."}), 400
        
        return update_task(data, task_id)

    except Exception as e:
        logger.error(f"Error in update_task_route: {e}", exc_info=True)
        return jsonify({"error": "Unexpected error occurred"}), 500


def update_task(data, task_id):
    """
    Updates an existing task by delegating specific updates to helper functions.
    Ensures only fields that actually changed are updated.
    """
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": f"Task with ID {task_id} not found."}), 404

    updated_fields = []

    # ✅ Delegate updates to helper functions (excluding parent updates)

    if "project_id" in data:
        response = update_task_project(task, data["project_id"])
        if response:
            updated_fields.append("project_id")
        
    # ✅ Handle status updates
    if "status" in data:
        response = update_task_status(task, data["status"])
        if response:
            updated_fields.append("status")

    if "contributor_id" in data:
        response = update_task_contributor(task, data["contributor_id"])
        if response:
            updated_fields.append("contributor_id")

    if "priority" in data:
       if task.task_type == "Epic":
           # ✅ Remove priority if task is an Epic (since Epics shouldn't have priority)
           if task.priority is not None:
               task.priority = None
               updated_fields.append("priority")
               logger.info(f"Task ID {task.id}: Removed priority as it's now an Epic.")
       else:
           response = update_task_priority(task, data["priority"])
           if response:
               updated_fields.append("priority")

    if "epic_priority" in data:
        if task.task_type == "Epic":  # ✅ Ensure it's only applied to Epics
            response = update_task_priority(task, data["epic_priority"], is_epic=True)
            if response:
                updated_fields.append("epic_priority")
        else:
            # ✅ Remove epic_priority if task is no longer an Epic
            if task.epic_priority is not None:
                task.epic_priority = None
                updated_fields.append("epic_priority")
                logger.info(f"Task ID {task.id}: Removed epic_priority as it's no longer an Epic.")
    
    if "task_type" in data:
        response = update_task_type(task, data["task_type"])
        if response:
            updated_fields.append("task_type")

    if "estimate" in data:
        response = update_task_estimate(task, data["estimate"], data.get("estimate_type", "story_points"))
        if response:
            updated_fields.append("estimate")


    # ✅ Delegate general field updates
    for field in ["name", "description"]:
        if field in data:
            response = update_task_field(task, field, data[field])
            if response:
                updated_fields.append(field)

    # ✅ Commit changes only if something was actually updated
    if updated_fields:
        task.updated_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"Task ID {task_id} updated successfully. Updated fields: {updated_fields}")

        return jsonify({
            "message": f"Task {task_id} updated.",
            "updated_fields": updated_fields,
            "task": {
                "id": task.id,
                "name": task.name,
                "project_id": task.project_id,
                "story_points": task.story_points,
                "time_estimate": task.time_estimate,
                "task_type": task.task_type,
                "priority": task.priority,
                "epic_priority": task.epic_priority,
                "contributor_id": task.contributor_id,
                "completed": task.completed,
                "status": task.status,
                "sort_order": task.sort_order,  # ✅ Now included
                "updated_at": task.updated_at.isoformat() if task.updated_at else None  # ✅ Now included
            }
        }), 200

    return jsonify({"message": "No changes detected."}), 200


### 🔹 **Helper Functions for Specific Updates**


def update_task_project(task, new_project_id):
    """
    Updates the project_id of a task, ensuring the project exists.
    Also ensures the contributor is part of the new project.
    """
    if new_project_id == task.project_id:
        return False  # No change

    # Validate project existence
    project = Project.query.get(new_project_id)
    if not project:
        return jsonify({"error": f"Project with ID {new_project_id} not found."}), 400

    task.project_id = new_project_id
    logger.info(f"Task ID {task.id}: Moved to Project ID {new_project_id}")

    # ✅ Ensure the contributor remains part of the new project
    if task.contributor_id:
        contributor = Contributor.query.get(task.contributor_id)
        if contributor and contributor not in project.contributors:
            project.contributors.append(contributor)
            db.session.commit()  # ✅ Commit contributor update separately
            logger.info(f"Contributor {contributor.id} added to Project {project.id}")

            # ✅ Emit WebSocket event for contributor update
            socketio.emit("update_contributors", {
                "id": contributor.id,
                "name": contributor.name,
                "project_id": project.id
            }, namespace="/", to=None)

    # ✅ Commit immediately for autosave behavior
    task.updated_at = datetime.utcnow()
    db.session.commit()

    # ✅ Emit WebSocket event for project update
    socketio.emit("update_task", {
        "taskId": task.id,
        "project_id": task.project_id
    }, namespace="/")

    return True

# DONE ✅
def update_task_status(task, new_status):
    """ Updates the status of a task and handles completion logic. """
    ALLOWED_STATUSES = ["Not Started", "In Progress", "Completed", "Archived"]

    if new_status not in ALLOWED_STATUSES or task.status == new_status:
        return False  # No change or invalid status

    task.status = new_status
    logger.debug(f"Updated status for Task ID {task.id} to: {task.status}")

    # Handle completion updates
    if new_status == "Completed":
        task.completed = True
        task.completed_date = datetime.utcnow()
    else:
        task.completed = False
        task.completed_date = None

    # ✅ Emit WebSocket event for real-time frontend updates
    socketio.emit("update_task", {
        "taskId": task.id,
        "status": task.status,
        
        "completed": task.completed,
        "completed_date": task.completed_date.isoformat() if task.completed_date else None
    }, namespace="/")

    return True

# DONE ✅
def update_task_priority(task, new_priority, is_epic=False):
    """ Updates the priority of a task, ensuring validity. """
    ALLOWED_PRIORITIES = ["Unset", "Low", "Medium", "High", "Critical"]
    ALLOWED_EPIC_PRIORITIES = ["Unset", "P0", "P1", "P2", "P3", "P4"]

    # ✅ Ensure Epics cannot have task priority
    if is_epic:
        if new_priority not in ALLOWED_EPIC_PRIORITIES or task.epic_priority == new_priority:
            return False  # No change or invalid epic priority
        task.epic_priority = new_priority
        logger.debug(f"Updated epic priority for Task ID {task.id} to: {task.epic_priority}")

        # ✅ Emit WebSocket event for epic priority update
        socketio.emit("update_task", {
            "taskId": task.id,
            "epic_priority": task.epic_priority
        }, namespace="/")

        return True

    else:
        if new_priority not in ALLOWED_PRIORITIES or task.priority == new_priority:
            return False  # No change or invalid priority

        # ✅ If changing from an Epic, remove epic_priority
        if task.task_type != "Epic" and task.epic_priority is not None:
            logger.info(f"Removing epic_priority from Task ID {task.id} (no longer an Epic).")
            task.epic_priority = None

        task.priority = new_priority
        logger.debug(f"Updated priority for Task ID {task.id} to: {task.priority}")

        # ✅ Emit WebSocket event for priority update
        socketio.emit("update_task", {
            "taskId": task.id,
            "priority": task.priority
        }, namespace="/")

        return True

# DONE ✅
def update_task_type(task, new_task_type):
    """ Updates the task type and enforces hierarchy constraints. """
    ALLOWED_TASK_TYPES = ["Epic", "User Story", "Subtask"]
    
    if new_task_type not in ALLOWED_TASK_TYPES or task.task_type == new_task_type:
        return False  # No change or invalid task type
    
    logger.info(f"Updating task type for Task ID {task.id} to {new_task_type}")

    # ✅ Handle Epic-Specific Constraints
    if task.task_type == "Epic" and new_task_type != "Epic":
        logger.info(f"Removing epic_priority from Task ID {task.id} as it's no longer an Epic.")
        task.epic_priority = None

    # ✅ Prevent setting priority for Epics
    if new_task_type == "Epic":
        task.priority = None
    else:
        # ✅ Remove epic_priority if task is not an Epic anymore
        if task.epic_priority is not None:
            logger.info(f"Removing epic_priority from Task ID {task.id} (no longer an Epic).")
            task.epic_priority = None

    # ✅ Ensure User Stories are only assigned to Epics
    if new_task_type == "User Story" and task.parent_id:
        parent_task = Task.query.get(task.parent_id)
        if parent_task and parent_task.task_type != "Epic":
            return jsonify({"error": "User Stories must have an Epic as a parent."}), 400

    # ✅ Ensure Subtasks are only assigned to User Stories
    if new_task_type == "Subtask" and task.parent_id:
        parent_task = Task.query.get(task.parent_id)
        if parent_task and parent_task.task_type != "User Story":
            return jsonify({"error": "Subtasks must have a User Story as a parent."}), 400

    task.task_type = new_task_type

    # ✅ Emit WebSocket event
    socketio.emit("update_task", {
        "taskId": task.id,
        "task_type": task.task_type
    }, namespace="/")

    return True

def update_task_estimate(task, estimate_value, estimate_type="story_points"):
    """ 
    Updates the task estimate, supporting both story points and time estimates.
    """

    # ✅ Ensure valid estimate type
    if estimate_type not in ["story_points", "time"]:
        return False  # Invalid estimate type

    updated = False

    if estimate_type == "story_points":
        if task.story_points != estimate_value:
            task.story_points = estimate_value
            task.time_estimate = None  # ✅ Reset time estimate if switching to story points
            updated = True

    else:  # estimate_type == "time"
        if task.time_estimate != estimate_value:
            task.time_estimate = estimate_value
            task.story_points = None  # ✅ Reset story points if switching to time estimates
            updated = True

    # ✅ Update estimate_type if it changed
    if task.estimate_type != estimate_type:
        task.estimate_type = estimate_type
        updated = True

    if updated:
        logger.debug(f"Updated {estimate_type} for Task ID {task.id} to: {estimate_value}")

        # ✅ Emit WebSocket event
        socketio.emit("update_task", {
            "taskId": task.id,
            "estimate_type": task.estimate_type,
            "estimate_value": estimate_value
        }, namespace="/")

        return True

    return False

#DONE ✅
def update_task_contributor(task, new_contributor_id):
    """ 
    Updates the assigned contributor and ensures they belong to the project.
    Returns True if the contributor was updated, otherwise False.
    """

    if new_contributor_id is None or new_contributor_id == task.contributor_id:
        return False  # No change

    contributor = Contributor.query.get(new_contributor_id)
    if not contributor:
        return False  # Invalid contributor ID

    project = task.project  # Get the task's project reference

    # ✅ Ensure contributor is part of the task's project
    if contributor not in project.contributors:
        project.contributors.append(contributor)
        db.session.commit()  # Commit once to improve performance
        logger.info(f"✅ Contributor {contributor.id} added to Project {project.id}")

        # ✅ WebSocket event for project contributor update
        socketio.emit("update_contributors", {
            "id": contributor.id,
            "name": contributor.name,
            "project_id": project.id
        }, namespace="/", to=None)

    # ✅ Assign contributor to task
    task.contributor_id = new_contributor_id

    # ✅ WebSocket event for task update
    socketio.emit("update_task", {
        "taskId": task.id,
        "contributor_id": task.contributor_id,
        "contributor_name": contributor.name
    }, namespace="/", to=None)

    return True  # Contributor successfully updated

#DONE ✅
def update_task_field(task, field, value):
    """ Generic function to update a field if it has changed. """
    if getattr(task, field) == value:
        return False  # No change

    setattr(task, field, value)

    # ✅ Emit WebSocket event for real-time frontend updates
    socketio.emit("update_task", {
        "taskId": task.id,
        field: value
    }, namespace="/")

    return True


    

def create_task(data):
    """
    Creates a new task with status and priority support.
    """
    try:
        # Define allowed values
        ALLOWED_STATUSES = ["Not Started", "In Progress", "Completed", "Archived"]
        ALLOWED_PRIORITIES = ["Unset", "Low", "Medium", "High", "Critical"]
        ALLOWED_EPIC_PRIORITIES = ["Unset", "P0", "P1", "P2", "P3", "P4"]
        
        logger.info(f"🔍 create_task() received data: {data}")
        
        # ✅ Validate and set estimation type
        estimate_type = data.get("estimate_type", "story_points")  # Default to story points
        if estimate_type not in ["story_points", "time"]:
            logger.error(f"Invalid estimate type: {estimate_type}")
            return jsonify({"error": "Invalid estimate type. Must be 'story_points' or 'time'."}), 400

        # ✅ Set estimate_type explicitly before creating the Task object
        story_points = None
        time_estimate = None

        if estimate_type == "story_points":
            story_points = data.get("story_points", 0)
        elif estimate_type == "time":
            time_estimate = data.get("time_estimate", 0)
        
        # ✅ Explicitly Remove epic_priority if the task is NOT an Epic
        if data.get("task_type") != "Epic":
            if "epic_priority" in data:
                logger.warning(f"🚨 Removing epic_priority from non-Epic task: {data}")
                del data["epic_priority"]  # ✅ Extra safeguard

        # Validate and set status
        status = data.get("status", "Not Started")  # Default to "Not Started"
        if status not in ALLOWED_STATUSES:
            logger.error(f"Invalid status value: {status}")
            return jsonify({"error": f"Invalid status value. Allowed values: {ALLOWED_STATUSES}"}), 400
        
        # ✅ If the task has a parent, inherit its project_id
        if data.get("parent_id"):
            parent_task = Task.query.get(data["parent_id"])
            if parent_task:
                data["project_id"] = parent_task.project_id  # ✅ Inherit project from parent

        # ✅ Ensure `project_id` exists (for tasks created outside a parent)
        if "project_id" not in data or not data["project_id"]:
            data["project_id"] = ensure_miscellaneous_project()  # ✅ Assign default project
            
        # ✅ Explicitly Remove epic_priority if the task is NOT an Epic
        if data["task_type"] != "Epic":
            data.pop("epic_priority", None)  # ✅ Completely remove it

        # ✅ Ensure `epic_priority` is only set for Epics
        if data["task_type"] == "Epic":
            if "priority" in data:
                logger.error("Epics cannot have task priority.")
                return jsonify({"error": "Epics cannot have task priority."}), 400
            
            epic_priority = data.get("epic_priority", "Unset")  # ✅ Default to "Unset" if missing
            if epic_priority not in ALLOWED_EPIC_PRIORITIES:
                logger.error(f"Invalid epic priority value: {epic_priority}")
                return jsonify({"error": f"Invalid epic priority. Allowed values: {ALLOWED_EPIC_PRIORITIES}"}), 400
        else:
            priority = data.get("priority", "Unset")  # Default to "Unset"
            if priority not in ALLOWED_PRIORITIES:
                logger.error(f"Invalid priority value: {priority}")
                return jsonify({"error": f"Invalid priority value. Allowed values: {ALLOWED_PRIORITIES}"}), 400
            
        # ✅ Determine `sort_order` for the new task
        if data.get("parent_id"):
            last_sort_order = db.session.query(db.func.max(Task.sort_order)).filter_by(parent_id=data["parent_id"]).scalar()
        else:
            last_sort_order = db.session.query(db.func.max(Task.sort_order)).filter_by(project_id=data["project_id"]).scalar()

        # If there are no existing tasks, default to 0
        new_sort_order = (last_sort_order or 0) + 1
        data["sort_order"] = new_sort_order
            

        new_task = Task(
            name=data['name'],
            description=data.get('description'),
            project_id=data['project_id'],
            estimate_type=estimate_type,  # ✅ Explicitly setting estimate_type first
            story_points=data.get('story_points', 0),
            time_estimate=time_estimate,
            parent_id=data.get('parent_id'),
            task_type=data['task_type'],
            contributor_id=data.get('contributor_id'),
            completed=data.get('completed', False),
            created_at=datetime.utcnow(),
            sort_order=data["sort_order"],  # ✅ Now correctly assigned
            status=status,  # ✅ Include status
            priority=priority,  # ✅ Include priority
            epic_priority=data.get('epic_priority') if data.get("task_type") == "Epic" else None
        )

        try:
            db.session.add(new_task)
            db.session.commit()

            task_data = new_task.to_dict()

            print(f"✅ WebSocket Emitting task_created: {task_data}")  # LOGGING
            socketio.emit("task_created", {"task": task_data}, namespace="/")  # EMITTING

            logger.info(f"New task created successfully: {new_task.id} (Priority: {new_task.priority}, Status: {new_task.status})")

        except Exception as e:
            logger.error(f"❌ Error emitting WebSocket event: {e}", exc_info=True)
            print(f"❌ Error emitting WebSocket event: {e}")  # LOGGING

        # Include contributor_name in the response
        contributor_name = new_task.contributor.name if new_task.contributor else None

        # Return the successfully fetched task details
        return jsonify({
            "message": "Task created successfully",
            "task": {
                "id": new_task.id,
                "name": new_task.name,
                "project_id": new_task.project_id,
                "estimate_type": new_task.estimate_type,  # ✅ Include estimate type
                "estimate": story_points if estimate_type == "story_points" else time_estimate,
                "task_type": new_task.task_type,
                "priority": new_task.priority,  # ✅ Return priority
                "epic_priority": new_task.epic_priority,  # ✅ Return epic_priority
                "status": new_task.status,  # ✅ Return status
                "parent_id": new_task.parent_id,
                "contributor_id": new_task.contributor_id,
                "contributor_name": contributor_name,
                "completed": new_task.completed,
                "sort_order": new_task.sort_order,
                "created_at": new_task.created_at.isoformat(),
            }
        }), 201

    except IntegrityError as e:
        logger.error(f"Integrity error during creation: {e}")
        db.session.rollback()
        return jsonify({"error": "Database constraint error"}), 400
    except Exception as e:
        logger.error(f"Unexpected error in create_task: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Unexpected error occurred", "details": str(e)}), 500

@csrf.exempt 
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
    
    
# Backend cleanup script (Runs periodically or on session close)
@api.route('/api/cleanup_empty_tasks', methods=['DELETE'])
def cleanup_empty_tasks():
    deleted_count = Task.query.filter(
        Task.name == "", Task.description == ""
    ).delete()
    db.session.commit()
    return jsonify({"deleted_tasks": deleted_count})

# Version 1
# 📌 1️⃣ Update task sort order (PUT /tasks/{task_id}/sort)
# @csrf.exempt
# @api.route('/tasks/<int:task_id>/sort', methods=['PUT', 'OPTIONS'])
# def update_task_sort(task_id):
#     """ Updates the sorting order of a task within a project. """
    
#     if request.method == "OPTIONS":
#         # ✅ Properly handle the preflight request
#         response = make_response(jsonify({"message": "CORS preflight successful"}), 200)
#         response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
#         response.headers["Access-Control-Allow-Credentials"] = "true"
#         response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
#         response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
#         return response
    
#     data = request.json
#     new_order_index = data.get("new_order_index")

#     if new_order_index is None:
#         return jsonify({"error": "new_order_index is required"}), 400

#     task = Task.query.get(task_id)
#     if not task:
#         return jsonify({"error": "Task not found"}), 404

#     project_id = task.project_id

#     # Fetch all tasks sorted by `sort_order`
#     tasks = Task.query.filter_by(project_id=project_id).order_by(Task.sort_order).all()
    
#     if not tasks:
#         return jsonify({"error": "No tasks found for project"}), 400
    
    
#     # Find the task that was moved
#     moved_task = None
#     for t in tasks:
#         if t.id == task_id:
#             moved_task = t
#             tasks.remove(t)
#             break

#     if not moved_task:
#         return jsonify({"error": "Task not found in sorting list"}), 400

#     # Insert the moved task at the new index
#     tasks.insert(new_order_index, moved_task)

#     # Reassign `sort_order` values
#     for index, t in enumerate(tasks):
#         t.sort_order = index
    
#     db.session.commit()

#     # Emit WebSocket event
#     socketio.emit("task_sorted", {"task_id": task.id, "new_order": new_order_index}, to='/')

#     # ✅ FIX: Ensure CORS Headers are Returned
#     response = jsonify({"message": "Task order updated"})
#     response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
#     response.headers["Access-Control-Allow-Credentials"] = "true"
#     return response, 200


# Version 2
# # 📌 1️⃣ Update task sort order (PUT /tasks/{task_id}/sort)
@csrf.exempt
@api.route('/tasks/<int:task_id>/sort', methods=['PUT', 'OPTIONS'])
def update_task_sort(task_id):
    """ Updates the sorting order of a task within its hierarchy level. """
    
    if request.method == "OPTIONS":
        # ✅ Properly handle the preflight request
        response = make_response(jsonify({"message": "CORS preflight successful"}), 200)
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        return response

    data = request.json
    new_order_index = data.get("new_order_index")

    if new_order_index is None:
        return jsonify({"error": "new_order_index is required"}), 400

    # Fetch the task
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    # parent_id = task.parent_id  # ✅ Ensure sorting happens within the same parent

    # Fetch all sibling tasks (same parent)
    # sibling_tasks = Task.query.filter_by(parent_id=parent_id).order_by(Task.sort_order).all()
    
    logger.info(f"Sorting Task {task.id} - {task.name} (Type: {task.task_type}) to index {new_order_index}")
    
    # ✅ Determine Sorting Scope (Stay Within Parent)
    parent_id = task.parent_id
    
    if task.task_type == "User Story" and parent_id is None:
        logger.info(f"⚠️ User Story {task.id} has no parent! Sorting within 'No Epic'.")
        
        # ✅ Ensure sorting happens within User Stories without a parent
        sibling_tasks = Task.query.filter(
            Task.task_type == "User Story",
            Task.parent_id.is_(None),
            Task.project_id == task.project_id
        ).order_by(Task.sort_order).all()
        
    else:
        sibling_tasks = Task.query.filter_by(parent_id=parent_id).order_by(Task.sort_order).all()

    if not sibling_tasks:
        return jsonify({"error": "No tasks found in this hierarchy level"}), 400
    
    if task not in sibling_tasks:
        return jsonify({"error": "Task not found in sorting list"}), 400

    # ✅ Remove task from its current position
    sibling_tasks.remove(task)

    # ✅ Insert at new position
    sibling_tasks.insert(new_order_index, task)

    # ✅ Update `sort_order` for all tasks in this level
    for index, t in enumerate(sibling_tasks):
        t.sort_order = index

    db.session.commit()

    # ✅ Emit WebSocket event for real-time updates
    socketio.emit("task_sorted", {
        "task_id": task.id,
        "new_order": new_order_index,
        "new_parent_id": parent_id  # Ensure frontend updates hierarchy
    }, to='/')

    logger.info(f"✅ Task {task.id} sorted to index {new_order_index} successfully.")

    response = jsonify({"message": "Task order updated"})
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response, 200


@csrf.exempt
@api.route('/tasks/<int:task_id>/parent', methods=['PUT', 'PATCH', 'OPTIONS'])
def update_task_parent(task_id):
    """ Moves a task to a new parent while enforcing hierarchy rules,
    including handling the 'No Epic' category. """
    
    if request.method == "OPTIONS":
        response = make_response(jsonify({"message": "CORS preflight successful"}), 200)
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        return response
    
    data = request.json
    new_parent_id = data.get("new_parent_id")

    if new_parent_id is None:
        return jsonify({"error": "new_parent_id is required"}), 400

    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    # ✅ Handle "No Epic" Epic Creation
    if task.task_type == "User Story" and new_parent_id == "no_epic":
        logger.info(f"🔍 Moving User Story {task.id} to 'No Epic'.")

        # Check if "No Epic" exists
        no_epic = Task.query.filter_by(
            name="No Epic", task_type="Epic", project_id=task.project_id
        ).first()

        if not no_epic:
            no_epic = Task(
                name="No Epic",
                task_type="Epic",
                project_id=task.project_id,
                sort_order=0
            )
            db.session.add(no_epic)
            db.session.commit()
            logger.info(f"✅ Created 'No Epic' in Project {task.project_id}")

        new_parent_id = no_epic.id  # Assign to "No Epic"

    else:
        new_parent = Task.query.get(new_parent_id)
        if not new_parent:
            return jsonify({"error": "New parent task not found"}), 404

        # ✅ Prevent invalid hierarchy placements
        if task.task_type == "User Story" and new_parent.task_type != "Epic":
            return jsonify({"error": "A User Story can only have an Epic as a parent."}), 400
        if task.task_type == "Subtask" and new_parent.task_type != "User Story":
            return jsonify({"error": "A Subtask can only have a User Story as a parent."}), 400
        if task.task_type == "Epic":
            return jsonify({"error": "Epics cannot have a parent task."}), 400

    # ✅ Update parent relationship
    task.parent_id = new_parent_id
    db.session.commit()

    # ✅ Emit WebSocket event for real-time frontend updates
    socketio.emit("task_parent_updated", {"task_id": task.id, "new_parent_id": new_parent_id}, namespace="/")

    response = jsonify({"message": "Task parent updated successfully"})
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
    return response, 200
    