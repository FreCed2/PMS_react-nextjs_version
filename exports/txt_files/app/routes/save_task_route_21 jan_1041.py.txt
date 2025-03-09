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

        # Map 'title' to 'name' for compatibility
        data['name'] = data.get('name') or data.get('title')
        if not data['name']:
            logger.error("Task name is missing in payload")
            return jsonify({"error": "Missing required field: 'name'"}), 400
        
        # Validate the payload
        valid, error_message = validate_task_payload(data)
        if not valid:
            logger.error(f"Validation failed: {error_message}")
            return jsonify({"error": error_message}), 400
        
        # Normalize name for consistent duplicate checks
        data['name'] = data['name'].strip().lower()

        # Check for duplicates
        existing_task = Task.query.filter_by(
            name=data['name'],
            project_id=data['project_id'],
            task_type=data['task_type']
        ).first()

        if existing_task:
            logger.warning(f"Duplicate task creation attempted: {data}")
            return jsonify({
                "error": "A task with the same name, project, and type already exists.",
                "task_id": existing_task.id,
            }), 409

        # Check if updating an existing task
        task_id = data.get('id') or data.get('task_id')  # Support both 'id' and 'task_id'
        if task_id:
            logger.debug(f"Updating task with ID {task_id}")
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task with ID {task_id} not found")
                return jsonify({"error": f"Task with ID {task_id} not found."}), 404

            # Update task fields
            task.name = data['name']
            task.description = data.get('description')
            task.project_id = data['project_id']
            task.story_points = data['story_points']
            task.parent_id = data['parent_id']
            task.task_type = data['task_type']
            task.contributor_id = data.get('contributor_id')
            task.completed = data.get('completed', False)
            task.updated_at = datetime.utcnow()

            if 'sort_order' in data:
                task.sort_order = data['sort_order']

            # Commit changes
            try:
                db.session.commit()
                logger.info(f"Task ID {task_id} updated successfully")
                return jsonify({"message": f"Task ID {task_id} updated successfully"}), 200
            except IntegrityError as e:
                logger.error(f"Integrity error during update: {e}")
                db.session.rollback()
                return jsonify({"error": "Database constraint error"}), 400
            except Exception as e:
                logger.error(f"Unexpected error during update: {e}", exc_info=True)
                db.session.rollback()
                return jsonify({"error": "Unexpected error occurred"}), 500

        # Creating a new task
        logger.info("Creating a new task")
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

        try:
            db.session.add(new_task)
            db.session.commit()
            logger.info(f"New task created successfully: {new_task.id}")
            return jsonify({
                "message": "Task created successfully",
                "task": {
                    "id": new_task.id,
                    "name": new_task.name,
                    "project_id": new_task.project_id,
                    "story_points": new_task.story_points,
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

    except Exception as e:
        logger.error(f"Error in save_task: {e}", exc_info=True)
        return jsonify({"error": "Unexpected error occurred"}), 500