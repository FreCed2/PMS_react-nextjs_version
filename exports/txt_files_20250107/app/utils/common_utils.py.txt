# Utility file handling business logic for shared functions
import logging
from sqlalchemy.sql import func, cast
from sqlalchemy import Integer
from app.extensions.db import db  # Centralized SQLAlchemy instance

# Initialize logger for the module
logger = logging.getLogger(__name__)


def log_interaction(caller, callee, action, data=None, result=None, error=None):
    """
    Logs interaction details for debugging and sequence generation.
            :param caller: The calling entity or module.
            :param callee: The receiving entity or module.
            :param action: The action being logged.
            :param data: Optional data payload.
            :param result: Optional result of the action.
            :param error: Optional error message.
    """
    message = f"Caller: {caller}, Callee: {callee}, Action: {action}"
    if data:
        message += f", Data: {data}"
    if result:
        message += f", Result: {result}"
    if error:
        message += f", Error: {error}"
    logger.info(message)


# ------------------------------
# Project-Related Counting Functions
# ------------------------------


def count_ongoing_projects():
    """
    Count ongoing projects based on their story points completion.
    """
    from app.models import Project
    from app.tasks.models import Task

    ongoing_projects = (
        db.session.query(Project)
        .join(Task, Project.id == Task.project_id)
        .group_by(Project.id)
        .having(
            func.sum(Task.story_points * cast(Task.completed, Integer)) 
            < func.sum(Task.story_points)
        )
        .all()
    )
    return len(ongoing_projects)


def count_completed_projects():
    """
    Count completed projects where all story points are finished.
    """
    from app.models import Project
    from app.tasks.models import Task

    completed_projects = (
        db.session.query(Project)
        .join(Task, Project.id == Task.project_id)
        .group_by(Project.id)
        .having(
            func.sum(Task.story_points * cast(Task.completed, Integer)) 
            >= func.sum(Task.story_points)
        )
        .all()
    )
    return len(completed_projects)


def count_unstarted_projects():
    """
    Count unstarted projects where no story points are completed.
    """
    from app.models import Project
    from app.tasks.models import Task

    unstarted_projects = (
        db.session.query(Project)
        .outerjoin(Task, Project.id == Task.project_id)
        .group_by(Project.id)
        .having(
            func.sum(Task.story_points * cast(Task.completed, Integer))
            == None)
        .all()
    )
    return len(unstarted_projects)


def count_all_projects():
    """
    Count all projects in the database.
    """
    from app.models import Project

    all_projects = db.session.query(Project).all()
    return len(all_projects)


# ------------------------------
# Contributor-Related Counting Functions
# ------------------------------


def count_all_contributors():
    """
    Count all contributors in the database.
    """
    from app.models import Contributor

    return db.session.query(Contributor).count()


def count_assigned_contributors():
    """
    Count contributors assigned to at least one project.
    """
    from app.models import Contributor, project_contributor

    return db.session.query(Contributor).join(project_contributor).distinct().count()


def count_unassigned_contributors():
    """
    Count contributors not assigned to any project.
    """
    from app.models import Contributor, project_contributor

    return (
        db.session.query(Contributor)
        .outerjoin(project_contributor)
        .filter(project_contributor.c.project_id == None)
        .count()
    )

