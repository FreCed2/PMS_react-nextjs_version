import logging
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.extensions.db import db
from app.models import Project
from app.tasks.models import Task

logger = logging.getLogger(__name__)  # Logger for this module


class TaskService:
    @staticmethod
    def filter_tasks(filters=None, include_subtasks=True, page=None, per_page=None):
        """
        Dynamically filters tasks based on criteria provided in a dictionary, 
        with optimized loading for related models.

        Args:
            filters (dict): A dictionary of filtering criteria.
            page (int, optional): The page number for pagination.
            per_page (int, optional): The number of items per page.

        Returns:
            Query or Pagination: A SQLAlchemy query object or paginated results.
        """
        query = Task.query.options(
            db.joinedload(Task.project).joinedload(Project.contributors),  # Load project and its contributors
            db.joinedload(Task.contributor),  # Load task's assigned contributor
            db.joinedload(Task.children),     # Load child tasks
        ).order_by(Task.sort_order)

        if filters:
            logger.debug(f"Applying filters: {filters}")

            # Apply standard filters
            if "is_archived" in filters:
                query = query.filter(Task.is_archived == filters["is_archived"])
            if "project_id" in filters:
                query = query.filter(Task.project_id == filters["project_id"])
            if "task_type" in filters and filters["task_type"]:
                if isinstance(filters["task_type"], list):
                    query = query.filter(Task.task_type.in_(filters["task_type"]))
                else:
                    query = query.filter(Task.task_type == filters["task_type"])
            if "completion_status" in filters:
                completion_map = {"completed": True, "in_progress": False}
                if filters["completion_status"] in completion_map:
                    query = query.filter(Task.completed == completion_map[filters["completion_status"]])

            # Optionally exclude subtasks
            if not include_subtasks:
                query = query.filter(Task.task_type != "Subtask")

        logger.debug(f"Generated query: {query}")

        # Pagination
        if page and per_page:
            return query.paginate(page=page, per_page=per_page, error_out=False)
        return query
    
    @staticmethod
    def debug_parent_child_relationships(project_id=None):
        """
        Generates a debug map of parent-child relationships for all tasks.

        Args:
            project_id (int, optional): Restrict to tasks from a specific project.

        Returns:
            dict: A dictionary mapping parent IDs to their child task IDs.
        """
        query = Task.query
        if project_id:
            query = query.filter(Task.project_id == project_id)

        tasks = query.options(
            db.load_only(Task.id, Task.parent_id)
        ).all()

        relationship_map = {}
        for task in tasks:
            if task.parent_id not in relationship_map:
                relationship_map[task.parent_id] = []
            relationship_map[task.parent_id].append(task.id)

        logger.debug(f"Parent-Child Relationship Map: {relationship_map}")
        return relationship_map


    @staticmethod
    def validate_parent_child_relationships():
        """
        Validates all parent-child relationships in the database to ensure they conform to hierarchy rules.

        Ensures:
        - User Stories must have an Epic as a parent.
        - Subtasks must have a User Story as a parent.
        - Orphaned User Stories are automatically assigned to 'No Epic'.
        
        Raises:
            ValueError: If invalid relationships are detected.
        """
        tasks = Task.query.options(db.joinedload(Task.parent)).all()

        # 🔹 Step 1: Find all projects to check for orphaned User Stories
        projects = db.session.query(Task.project_id).distinct()

        for project in projects:
            project_id = project[0]

            # ✅ Check if "No Epic" exists for this project
            no_epic = Task.query.filter_by(name="No Epic", project_id=project_id, task_type="Epic").first()
            
            if not no_epic:
                logger.info(f"Creating 'No Epic' for Project {project_id}")
                no_epic = Task(name="No Epic", project_id=project_id, task_type="Epic", sort_order=0)
                db.session.add(no_epic)
                db.session.commit()  # ✅ Save changes

            # ✅ Assign orphaned User Stories to "No Epic"
            orphaned_user_stories = Task.query.filter(
                Task.task_type == "User Story",
                Task.parent_id.is_(None),
                Task.project_id == project_id
            ).all()

            for story in orphaned_user_stories:
                logger.info(f"Assigning orphaned User Story '{story.name}' (ID: {story.id}) to 'No Epic'.")
                story.parent_id = no_epic.id
                db.session.add(story)

        db.session.commit()  # ✅ Save all changes

        # 🔹 Step 2: Validate Parent-Child Relationships
        for task in tasks:
            if task.parent_id:
                parent_task = task.parent
                if not parent_task:
                    raise ValueError(f"Task {task.id} has an invalid parent ID {task.parent_id}.")

                # ✅ Enforce hierarchy rules
                if task.task_type == "User Story" and parent_task.task_type != "Epic":
                    raise ValueError(f"User Story {task.id} must have an Epic as its parent.")
                if task.task_type == "Subtask" and parent_task.task_type != "User Story":
                    raise ValueError(f"Subtask {task.id} must have a User Story as its parent.")

        logger.info("✅ All parent-child relationships are valid.")
    
    
    @staticmethod
    def get_all_task_ids_with_parents():
        """
        Returns a flat list of tasks with their parent IDs for debugging.

        Returns:
            list: A list of tuples (task_id, parent_id).
        """
        tasks = Task.query.with_entities(Task.id, Task.parent_id).all()
        logger.debug(f"Task IDs with Parent IDs: {tasks}")
        return tasks

    @staticmethod
    def calculate_total_story_points(project_id):
        """Calculates the total story points for a project."""
        return (
            db.session.query(db.func.coalesce(db.func.sum(Task.story_points), 0))
            .filter(Task.project_id == project_id)
            .scalar()
        )

    @staticmethod
    def calculate_completed_story_points(project_id):
        """Calculates the total completed story points for a project."""
        return (
            db.session.query(db.func.coalesce(db.func.sum(Task.story_points), 0))
            .filter(Task.project_id == project_id, Task.completed == True)
            .scalar()
        )

    @staticmethod
    def calculate_completion_percentage(project_id):
        """Calculates the completion percentage of a project."""
        total_points = TaskService.calculate_total_story_points(project_id)
        completed_points = TaskService.calculate_completed_story_points(project_id)
        return round((completed_points / total_points) * 100, 2) if total_points > 0 else 0

    @staticmethod
    def delete_project_and_tasks(project_id):
        """Deletes a project and all its associated tasks."""
        logger.info(f"Deleting project and its tasks: Project ID {project_id}")
        project_to_delete = Project.query.get_or_404(project_id)
        try:
            Task.query.filter_by(project_id=project_id).delete()
            db.session.delete(project_to_delete)
            db.session.commit()
            return True, f"Project {project_id} deleted successfully."
        except Exception as e:
            logger.error(f"Error deleting project: Project ID {project_id} - {e}")
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def contributor_has_assigned_tasks(project_id, contributor_id, project_name, contributor_name):
        """Checks if a contributor has tasks assigned in a project."""
        task_count = Task.query.filter_by(
            project=project_id, contributor_id=contributor_id
        ).count()
        logger.info(
            f"Contributor {contributor_name} has {task_count} tasks in project {project_name}."
        )
        return task_count > 0
    
    @staticmethod
    def fetch_task_with_logging(task_id):
        """Fetch a task with detailed logging, including parent task information."""
        task = Task.query.options(joinedload(Task.parent)).get(task_id)
        if not task:
            raise ValueError(f"Task with ID {task_id} not found.")
        
        # Log task details
        logger.info(f"Fetched task: {task.to_dict()}")

        # Fetch parent task details
        parent_task = task.parent.to_dict() if task.parent else None
        task_data = task.to_dict()
        task_data['parent'] = parent_task  # Add parent task details
        
        logger.info(f"Task with parent details: {task_data}")
        return task_data
    
    
    @staticmethod
    def archive_task(task, visited=None):
        """
        Archive a task and all its subtasks, preventing infinite recursion.
        
        Args:
            task (Task): The task to be archived.
            visited (set): A set of task IDs already processed (for recursion guard).
        """
        if visited is None:
            visited = set()
        
        logger.info(f"Archiving task ID {task.id}")
        
        # Prevent infinite recursion
        if task.id in visited:
            logger.warning(f"Detected circular reference with task ID {task.id}. Skipping.")
            return

        visited.add(task.id)  # Mark task as visited
        task.is_archived = True

        # Archive subtasks
        for subtask in Task.query.filter_by(parent_id=task.id).all():
            logger.info(f"Archiving subtask ID {subtask.id} of task ID {task.id}")
            TaskService.archive_task(subtask, visited)

        # Add task to session for commit
        db.session.add(task)
        
    @staticmethod
    def validate_hierarchy(task=None, parent_id=None, task_type=None):
        """
        Validates the hierarchy of a task or returns valid parent types.

        Args:
            task (Task): The task instance to validate (optional).
            parent_id (int): The ID of the parent task to validate against (optional).
            task_type (str): The type of the task to determine valid parents (optional).

        Returns:
            list: If no task and parent_id are provided, returns valid parent types for the task's type.

        Raises:
            ValueError: If the hierarchy rules are violated during validation.
        """
        logger.info(f"Validating hierarchy for Task {task.id if task else 'N/A'}")

        # Determine valid parent types if task_type is provided
        if task_type:
            logger.info(f"Determining valid parent types for task_type: {task_type}")
            if task_type == "Epic":
                return []  # Epics cannot have parents
            elif task_type == "User Story":
                return ["Epic"]  # User Stories can only have Epics as parents
            elif task_type == "Subtask":
                return ["User Story"]  # Subtasks can only have User Stories as parents
            else:
                logger.warning(f"Unsupported task type: {task_type}")
                raise ValueError(f"Invalid task type: {task_type}")

        # Validation mode: Ensure hierarchy rules are followed
        if task and parent_id:
            logger.info(f"Validating hierarchy for Task {task.id} with parent_id {parent_id}")
            # Prevent a task from being its own parent
            if parent_id == task.id:
                logger.error(f"Task {task.id} cannot be its own parent.")
                raise ValueError("A task cannot be its own parent.")

            # Fetch the parent task type
            parent_task_type = db.session.query(Task.task_type).filter_by(id=parent_id).scalar()
            if not parent_task_type:
                logger.error(f"Parent task {parent_id} does not exist.")
                raise ValueError("Parent task does not exist.")

            # Apply hierarchy rules
            if task.task_type == "Epic" and parent_id:
                raise ValueError("Epics cannot have a parent task.")
            if task.task_type == "User Story" and parent_task_type != "Epic":
                raise ValueError("If a User Story has a parent, it must be an Epic.")
            if task.task_type == "Subtask" and parent_task_type != "User Story":
                raise ValueError("If a Subtask has a parent, it must be a User Story.")

        logger.info(f"Hierarchy validation passed for Task {task.id if task else 'N/A'}")
                
    @staticmethod
    def fetch_all_tasks(project_id):
        """
        Fetches all tasks for a specific project, including project, contributor, and child task relationships.

        Args:
            project_id (int): The ID of the project whose tasks need to be fetched.

        Returns:
            list: A list of Task objects with their relationships loaded.
        """
        try:
            logger.info(f"Fetching all tasks for project ID: {project_id}")
            tasks = (
                Task.query.options(
                    db.joinedload(Task.project),
                    db.joinedload(Task.contributor),
                    db.joinedload(Task.children)
                )
                .filter_by(project_id=project_id)
                .order_by(Task.sort_order)  # Ensure tasks are ordered by sort order
                .all()
            )
            logger.info(f"Fetched {len(tasks)} tasks for project ID: {project_id}")
            return tasks
        except Exception as e:
            logger.error(f"Error fetching tasks for project ID {project_id}: {e}")
            raise
    
    
    @staticmethod
    def fetch_all_tasks_as_dicts(filters=None):
        """
        Fetches a list of tasks based on optional filters and serializes them into dictionaries.

        Args:
            filters (dict, optional): A dictionary of filters to apply to the task query.

        Returns:
            list[dict]: A list of serialized task dictionaries.
        """
        logger.info("Fetching all tasks with optional filters.")
        
        # Build the query
        query = Task.query.options(db.load_only(
            Task.id, Task.name, Task.description, Task.task_type, 
            Task.is_archived, Task.completed, Task.parent_id, Task.project_id,
            Task.contributor_id, Task.story_points, Task.status,
            Task.sort_order  # ✅ Ensure sort_order is explicitly included ADDED 25 FEB 2025
        )).filter(Task.sort_order.isnot(None))  # ✅ Exclude tasks with NULL sort_order ADJUSTED 25 FEB 2025
        
        if filters:
            
            if "project_id" in filters and filters["project_id"] is not None:   
                query = query.filter(Task.project_id == filters["project_id"])  
            if "is_archived" in filters:
                query = query.filter(Task.is_archived == filters["is_archived"]) 
            else:
                query = query.filter(Task.is_archived == False)  # ✅ Exclude archived tasks by default

        # Execute the query and serialize the results
        tasks = query.all()
        
        logger.info(f"✅ Retrieved {len(tasks)} tasks from database.")
        
        # ✅ Step 1: Find or Create "No Epic"
        project_id = filters.get("project_id") if filters else None
        if project_id:
            no_epic = Task.query.filter_by(name="No Epic", project_id=project_id, task_type="Epic").first()
            if not no_epic:
                logger.info("Creating 'No Epic' default Epic for project...")
                no_epic = Task(name="No Epic", project_id=project_id, task_type="Epic", sort_order=0)
                db.session.add(no_epic)
                db.session.commit()

        # ✅ Step 2: Assign orphaned User Stories to "No Epic"
        orphaned_user_stories = Task.query.filter(
            Task.task_type == "User Story",
            Task.parent_id.is_(None),
            Task.project_id == project_id
        ).all()

        for story in orphaned_user_stories:
            logger.info(f"Assigning orphaned User Story '{story.name}' (ID: {story.id}) to 'No Epic'.")
            story.parent_id = no_epic.id
            db.session.add(story)

        db.session.commit()  # ✅ Save changes

        # ✅ Step 3: Convert tasks to dictionary format
        task_dicts = [task.to_dict() for task in tasks]
        return task_dicts
    
    
    
    @staticmethod
    def fetch_task_as_dict(task_id):
        """
        Fetches a task by ID and returns it as a dictionary.

        Args:
            task_id (int): The ID of the task to fetch.

        Returns:
            dict: A dictionary representation of the task.

        Raises:
            ValueError: If the task is not found.
        """
        logger.info(f"Fetching task with ID {task_id}.")
        
        # Fetch the task from the database
        task = Task.query.get(task_id)
        logger.debug(f"Raw task object: {vars(task) if task else None}")

        if not task:
            logger.error(f"Task with ID {task_id} not found.")
            raise ValueError(f"Task with ID {task_id} not found.")
    
        # Serialize the task using its to_dict method
        task_dict = task.to_dict()
        print(task_dict)
        task_dict["contributor_name"] = task.contributor.name if task.contributor else "Unassigned"

        # Explicitly log parent ID
        logger.info(f"Task ID {task_id} fetched with parent ID: {task_dict.get('parent_id')}")

        # Optionally include parent details
        task_dict["parent"] = task.parent.to_dict() if task.parent else None

        logger.info(f"Task with ID {task_id} fetched successfully.")
        return task_dict

        
    @staticmethod
    def generate_page_numbers(current_page, total_pages, left_edge=1, right_edge=1, left_current=2, right_current=2):
        """
        Generates a list of page numbers for pagination, including ellipses.
        
        Args:
            current_page (int): The current page number.
            total_pages (int): Total number of pages.
            left_edge (int): Number of pages to show at the left edge.
            right_edge (int): Number of pages to show at the right edge.
            left_current (int): Number of pages to show to the left of the current page.
            right_current (int): Number of pages to show to the right of the current page.

        Returns:
            list: A list of page numbers or None for ellipses.
        """
        result = []
        last_page = 0

        for page_num in range(1, total_pages + 1):
            if (
                page_num <= left_edge or
                (page_num >= current_page - left_current and page_num <= current_page + right_current) or
                page_num > total_pages - right_edge
            ):
                if last_page + 1 != page_num:
                    result.append(None)  # Ellipsis
                result.append(page_num)
                last_page = page_num

        return result