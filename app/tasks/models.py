import logging
from datetime import datetime, timezone
from sqlalchemy import func, cast, CheckConstraint
from sqlalchemy.orm import validates
from sqlalchemy.types import Enum
from sqlalchemy.dialects.postgresql import ENUM
from app.extensions.db import db
from app.models import Project, Contributor
from app.utils.common_utils import log_interaction

logger = logging.getLogger(__name__)  # Logger for this module

ALLOWED_TASK_TYPES = ["Epic", "User Story", "Subtask"]

# Define allowed priority levels
TASK_PRIORITY_ENUM = ENUM("Unset", "Low", "Medium", "High", "Critical", name="task_priority", create_type=False)
EPIC_PRIORITY_ENUM = ENUM("Unset", "P0", "P1", "P2", "P3", "P4", name="epic_priority", create_type=False)


class Task(db.Model):
    __tablename__ = "task"
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    description = db.Column(db.Text)
    task_type = db.Column(db.String(10), nullable=False, server_default='Subtask')
    
    priority = db.Column(TASK_PRIORITY_ENUM, nullable=True)  # ✅ Allow NULL 
    epic_priority = db.Column(EPIC_PRIORITY_ENUM, nullable=True)  # ✅ Allow Null
    
    # ✅ Ensure task_type determines allowed priority
    @validates("priority", "epic_priority")
    def validate_priority(self, key, value):
        logger.debug(f"🔍 Validating priority: key={key}, value={value}, task_type={self.task_type}")
        
        if self.task_type == "Epic" and key == "priority":
            raise ValueError("Epics cannot have priority.")
        if self.task_type != "Epic" and key == "epic_priority":
            logger.warning(f"🚨 Unexpected epic_priority for non-Epic task: {self.to_dict()}")
            return None  # ✅ Instead of raising an error, just ignore it for now
    
    
    is_archived = db.Column(db.Boolean, default=False, index=True)
    completed = db.Column(db.Boolean, default=False, index=True)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="Not Started",
        server_default="Not Started"
    )  # New status column
    parent_id = db.Column(
        db.Integer, db.ForeignKey("task.id"), index=True, nullable=True
    )
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id"), nullable=False, index=True
    )
    contributor_id = db.Column(
        db.Integer, db.ForeignKey("contributor.id"), index=True, nullable=True
    )
    story_points = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    completed_date = db.Column(db.DateTime, nullable=True)
    
    ALLOWED_STATUSES = ["Not Started", "In Progress", "Completed", "Archived"]  # Allowed statuses
    
    @validates("status")
    def validate_status(self, key, value):
        """
        Validates that the status is one of the allowed values.
        Automatically updates 'completed' and 'completed_date'.
        """
        if value not in self.ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{value}'. Allowed statuses are: {self.ALLOWED_STATUSES}")

        # ✅ Update 'completed' and 'completed_date' automatically
        if value == "Completed":
            self.completed = True
            self.completed_date = datetime.utcnow()
        else:
            self.completed = False
            self.completed_date = None

        return value
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.debug(f"Task initialized: name={self.name}, task_type={self.task_type}, parent_id={self.parent_id}")

    # Relationships
    parent = db.relationship(
        "Task", remote_side=[id], back_populates="children", lazy="select"
    )
    children = db.relationship(
        "Task", back_populates="parent", lazy="select"
    )
    project = db.relationship("Project", back_populates="tasks")
    contributor = db.relationship("Contributor", back_populates="tasks")

    
    __table_args__ = (
    # ✅ Ensure proper task hierarchy
        CheckConstraint(
            "(task_type = 'Epic' AND parent_id IS NULL) OR "
            "(task_type = 'User Story' AND parent_id IN (SELECT id FROM task WHERE task_type = 'Epic')) OR "
            "(task_type = 'Subtask' AND parent_id IN (SELECT id FROM task WHERE task_type = 'User Story'))",
            name="task_hierarchy_constraint"
        ),
        
        # ✅ Ensure Epics cannot have priority
        CheckConstraint(
            "(task_type != 'Epic' OR priority IS NULL)",
            name="check_epic_priority_null"
        ),
    )

    @validates('parent_id', 'task_type')
    def validate_task_changes(self, key, value):
        """
        Validates changes to 'parent_id' and 'task_type'.
        Ensures hierarchy validity and checks for circular references.
        """
        logger.debug(f"Validating {key} change for Task {self.id}: {value}")

        if key == 'parent_id':
            # Log changes to parent_id
            if self.id and value != self.parent_id:
                logger.info(f"Task {self.id}: Updating 'parent_id' from {self.parent_id} to {value}")

            # Prevent a task from being its own parent
            if value and value == self.id:
                logger.error("A task cannot be its own parent.")
                raise ValueError("A task cannot be its own parent.")

            # Check for circular references
            if value:
                Task.check_circular_reference(self.id, value)

        elif key == 'task_type':
            # Log changes to task_type
            if self.id and value != self.task_type:
                logger.info(f"Task {self.id}: Updating 'task_type' from {self.task_type} to {value}")

        # Check hierarchy rules without triggering further validation
        if key in ['parent_id', 'task_type']:
            self._validate_hierarchy_change(key, value)

        logger.info(f"Validation passed for {key}: {value}")
        return value

    def _validate_hierarchy_change(self, key, value):
        """
        Validates hierarchy changes based on task_type and parent_id.
        This method avoids setting attributes and focuses only on validation.
        """
        if key == 'parent_id' and value:
            parent_task = Task.query.with_entities(Task.task_type).filter_by(id=value).first()
            if not parent_task:
                raise ValueError("Parent task does not exist.")

            logger.debug(f"Validating hierarchy: Task {self.id}, Parent Type: {parent_task.task_type}")
            # Hierarchy rules
            if self.task_type == "User Story" and parent_task.task_type != "Epic":
                raise ValueError("A User Story can only have an Epic as a parent.")
            if self.task_type == "Subtask" and parent_task.task_type != "User Story":
                raise ValueError("A Subtask can only have a User Story as a parent.")
        elif key == 'task_type' and self.parent_id:
            parent_task = Task.query.with_entities(Task.task_type).filter_by(id=self.parent_id).first()
            if parent_task:
                logger.debug(f"Validating hierarchy: Task Type: {value}, Parent Type: {parent_task.task_type}")
                if value == "User Story" and parent_task.task_type != "Epic":
                    raise ValueError("A User Story can only have an Epic as a parent.")
                if value == "Subtask" and parent_task.task_type != "User Story":
                    raise ValueError("A Subtask can only have a User Story as a parent.")
                
        logger.info(f"Hierarchy validation passed for Task {self.id if self.id else 'New Task'}.")


    @staticmethod
    def check_circular_reference(task_id, parent_id):
        """
        Iteratively checks for circular references in the task hierarchy.
        Prevents stack overflow on deep hierarchies.
        """
        visited = set()
        current_parent_id = parent_id
        
        logger.info(f"Checking circular reference for Task {task_id} with Parent ID: {parent_id}")

        while current_parent_id:
            if current_parent_id in visited:
                logger.error("Circular reference detected!")
                raise ValueError("Circular reference detected in task hierarchy.")
            visited.add(current_parent_id)

            if current_parent_id == task_id:
                logger.error("A task cannot be its own ancestor.")
                raise ValueError("A task cannot be its own ancestor.")

            # Fetch the next parent_id in the hierarchy
            task = Task.query.with_entities(Task.parent_id).filter_by(id=current_parent_id).first()
            if not task:
                # Exit when the task does not exist
                break
            current_parent_id = task.parent_id
            
        logger.info("Circular reference check passed.")
            
    @staticmethod
    def _validate_no_circular_references(new_parent_id):
        """
        Validates that there are no circular references in the task hierarchy.

        Args:
            new_parent_id (int): The new parent ID to validate.

        Raises:
            ValueError: If a circular reference is detected.
        """
        visited = set()
        current_parent_id = new_parent_id

        logger.info(f"Validating circular references for parent ID: {new_parent_id}")

        while current_parent_id:
            if current_parent_id in visited:
                logger.error(
                    f"Circular reference detected: Parent ID {current_parent_id} already visited."
                )
                raise ValueError("Circular reference detected in task hierarchy.")
            visited.add(current_parent_id)

            # Fetch the next parent_id in the hierarchy
            parent = Task.query.with_entities(Task.parent_id).filter_by(id=current_parent_id).first()
            if not parent:
                break  # Exit if no parent is found
            current_parent_id = parent.parent_id

        logger.info("No circular reference detected.")
            
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "task_type": self.task_type,
            "priority": self.priority,  # ✅ Include priority in API response
            "epic_priority": self.epic_priority if self.task_type == "Epic" else None,  # ✅ Include only for epics
            "is_archived": self.is_archived,
            "completed": self.completed,
            "parent_id": self.parent_id,
            "project_id": self.project_id,
            "project": self.project.name if self.project else "No Project Assigned",
            "contributor_id": self.contributor_id,
            "assigned_to": self.contributor.name if self.contributor else "Unassigned",
            "story_points": self.story_points if self.story_points is not None else 0,
            "status": self.status,  # ✅ Make sure this is included!
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def validate_hierarchy(self):
        from app.tasks.utils import TaskService
        """
        Ensures valid parent-task relationships using TaskService.

        Raises:
            ValueError: If the hierarchy rules are violated.
        """
        logger.info(f"Delegating hierarchy validation to TaskService for Task {self.id}")
        TaskService.validate_hierarchy(self)

    
    def save(self):
        """
        Saves the task to the database after validation.

        Raises:
            ValueError: If validation fails.
        """
        try:
            logger.info(f"Saving task: {self}")
            self.validate_hierarchy()
            db.session.add(self)
            db.session.commit()
            logger.info(f"Task saved successfully: {self}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error saving task: {str(e)}")
            raise e
    
    # Recursive Deletion Helper
    def delete_with_children(self, confirm=False):
        """
        Deletes the task and optionally its children if 'confirm' is True.
        """
        if confirm:
            for child in self.children:
                db.session.delete(child)
                logger.info(f"Deleted child task: {child.id}")
        db.session.delete(self)
        try:
            db.session.commit()
            logger.info(f"Deleted task: {self.id}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting task {self.id}: {str(e)}")
            raise e
    
    def archive(self):
        """Archives the task and its subtasks."""
        self.is_archived = True
        try:
            for subtask in self.children:
                subtask.archive()
            log_interaction(
                caller="Task Model",
                callee="Database",
                action="Archive Task",
                data={
                    "task_id": self.id,
                    "subtasks_archived": [subtask.id for subtask in self.children],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log_interaction(
                caller="Task Model",
                callee="Database",
                action="Rollback on archive",
                error=str(e),
                data={
                    "task_id": self.id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            raise e

    def unarchive(self):
        """Unarchives the task and its subtasks."""
        self.is_archived = False
        for subtask in self.children:
            subtask.unarchive()
        db.session.commit()

    def mark_completed(self):
        """Marks the task as completed."""
        self.completed = True
        self.completed_date = datetime.utcnow()
        try:
            if self.project:
                self.project.update_story_points()
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise e
        
    def to_dict_with_children(self):
        """
        Converts the Task instance into a dictionary, including its children.
        Ensures that the hierarchy is serialized properly.
        """
        task_dict = self.to_dict()  # Serialize the current task
        # Include serialized children if they exist
        task_dict["children"] = [child.to_dict_with_children() for child in self.children]
        return task_dict

    def __repr__(self):
        return f"<Task {self.name} (ID: {self.id}, Type: {self.task_type})>"