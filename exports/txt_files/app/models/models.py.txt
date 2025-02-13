import logging
from datetime import datetime, timezone
from app.utils.common_utils import log_interaction  # Adjusted path for imports
from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Table, func, cast
from sqlalchemy.ext.declarative import declared_attr
from app.extensions.db import db  # Centralized SQLAlchemy instance

# Initialize logger for the module
logger = logging.getLogger(__name__)

project_contributor = db.Table(
    'project_contributor',
    db.metadata,
    db.Column('project_id', db.Integer, db.ForeignKey('project.id', ondelete="CASCADE"), primary_key=True),
    db.Column('contributor_id', db.Integer, db.ForeignKey('contributor.id', ondelete="CASCADE"), primary_key=True),
)

# ------------------------------
# Project Model
# ------------------------------
class Project(db.Model):
    """
    Represents a project entity.
    """
    __tablename__ = 'project'

    id = db.Column(Integer, primary_key=True)
    name = db.Column(String(100), unique=True, nullable=False)
    start_date = db.Column(Date, nullable=False)
    end_date = db.Column(Date, nullable=False)
    scope = db.Column(db.Integer, nullable=True)
    completed_story_points = db.Column(Integer, default=0)
    created_at = db.Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    #@staticmethod
    #def secondary_table():
    #   return get_project_contributor()
    
    # Relationships
    @declared_attr
    def contributors(cls):
        """Define the many-to-many relationship for contributors dynamically."""
        return db.relationship(
            'Contributor',
            secondary=project_contributor,
            back_populates='projects',
            primaryjoin="Project.id == project_contributor.c.project_id",
            secondaryjoin="Contributor.id == project_contributor.c.contributor_id",
        )
    
    # Relationship to Task
    tasks = db.relationship(
        'Task', 
        back_populates='project', 
        cascade='all, delete-orphan')
    
    
    # Methods

    def add_contributor(self, contributor: 'Contributor') -> None:
        """
        Add a contributor to the project.
        """
        if contributor not in self.contributors:
            self.contributors.append(contributor)
            try:
                log_interaction(
                    caller="Project Model",
                    callee="Database",
                    action="Add Contributor",
                    data={"contributor": contributor.name, "project": self.name}
                )
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                log_interaction(
                    caller="Project Model",
                    callee="Database",
                    action="Rollback on add_contributor",
                    error=str(e)
                )
                raise e

    def remove_contributor(self, contributor):
        """
        Remove a contributor from the project.
        """
        if contributor in self.contributors:
            self.contributors.remove(contributor)
            try:
                log_interaction(
                    caller="Project Model",
                    callee="Database",
                    action="Remove Contributor",
                    data={"contributor": contributor.name, "project": self.name}
                )
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                log_interaction(
                    caller="Project Model",
                    callee="Database",
                    action="Rollback on remove_contributor",
                    error=str(e)
                )
                raise e

    def update_story_points(self):
        """
        Recalculate the completed story points for the project.
        """
        from app.tasks.utils import TaskService

        try:
            self.completed_story_points = TaskService.calculate_completed_story_points(self.id)
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Update Story Points",
                data={"project_id": self.id, "completed_story_points": self.completed_story_points},
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Rollback on update_story_points",
                error=str(e),
            )
            raise e

    @property
    def total_story_points(self):
        """
        Fetch the total story points for all tasks associated with this project.
        """
        from app.tasks.utils import TaskService
        
        try:
            total_points = TaskService.calculate_total_story_points(self.id)
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Calculate Total Story Points",
                data={
                    "project_id": self.id,
                    "total_story_points": total_points,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return total_points
        except Exception as e:
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Error in Calculate Total Story Points",
                error=str(e),
                data={
                    "project_id": self.id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            raise e

    def completion_percentage(self):
        """
        Calculate the completion percentage of the project based on story points.
        """
        from app.tasks.utils import TaskService

        try:
            completion = TaskService.calculate_completion_percentage(self.id)
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Calculate Completion Percentage",
                data={"project_id": self.id, "completion_percentage": completion},
            )
            return completion
        except Exception as e:
            log_interaction(
                caller="Project Model",
                callee="TaskService",
                action="Error in Calculate Completion Percentage",
                error=str(e),
                data={"project_id": self.id},
            )
            raise e

    def __repr__(self):
        return f"<Project {self.name} (ID: {self.id})>"


# ------------------------------
# Contributor Model
# ------------------------------
class Contributor(db.Model):
    """
    Represents a contributor entity.
    """
    __tablename__ = 'contributor'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

    # Relationships
    projects = db.relationship(
        'Project',
        secondary=project_contributor,
        back_populates='contributors',
    )
    
    tasks = db.relationship(
        "Task",
        back_populates="contributor",
        cascade="all, delete-orphan",
    )
   

    def __repr__(self):
        return f"<Contributor {self.name}>"

