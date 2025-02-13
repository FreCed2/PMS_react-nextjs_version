from flask_wtf import FlaskForm
from wtforms import (
    StringField,
    DateField,
    IntegerField,
    SubmitField,
    TextAreaField,
    SelectField,
    HiddenField,
)
from wtforms.validators import DataRequired, NumberRange, ValidationError
from flask_wtf import CSRFProtect
import logging

csrf = CSRFProtect()

# Logging setup
logger = logging.getLogger(__name__)
logger.debug("This is a debug message from the forms module")


# Lazy import of Task model
def get_task_model():
    from app.tasks.models import Task

    return Task


# Forms
class ProjectForm(FlaskForm):
    project_name = StringField("Project Name", validators=[DataRequired()])
    start_date = DateField("Start Date", format="%Y-%m-%d", validators=[DataRequired()])
    end_date = DateField("End Date", format="%Y-%m-%d", validators=[DataRequired()])
    submit = SubmitField("Submit")


class AddContributorForm(FlaskForm):
    contributor_name = StringField("Contributor Name", validators=[DataRequired()])
    submit = SubmitField("Add Contributor")

    def validate(self, extra_validators=None):
        """
        Override the default validate method to include logging.
        """
        if super().validate(extra_validators):
            logger.info(
                f"Validation successful for contributor: {self.contributor_name.data}"
            )
            return True
        else:
            logger.error(f"Validation failed: {self.errors}")
            return False


class ProgressEditForm(FlaskForm):
    contributor_points = IntegerField("Story Points", validators=[DataRequired()])
    submit = SubmitField("Save Changes")


class AddProgressForm(FlaskForm):
    date = DateField("Completion Date", format="%Y-%m-%d", validators=[DataRequired()])
    points = IntegerField("Story Points", validators=[DataRequired()])
    submit = SubmitField("Add Progress")


class DeleteProjectForm(FlaskForm):
    submit = SubmitField("Delete Project")


# New forms for task management
class TaskForm(FlaskForm):
    name = StringField("Task Name", validators=[DataRequired()])
    description = TextAreaField("Description")
    status = StringField("Status", validators=[DataRequired()])
    story_points = IntegerField("Story Points", validators=[NumberRange(min=0)])
    parent_id = IntegerField(
        "Parent Task ID", validators=[NumberRange(min=0)], default=None
    )
    submit = SubmitField("Save Task")

    def validate_parent_id(self, field):
        Task = get_task_model()  # Lazy import
        if field.data is not None:
            parent_task = Task.query.get(field.data)
            if not parent_task:
                raise ValidationError("Parent task does not exist.")


class ArchiveTaskForm(FlaskForm):
    submit = SubmitField("Archive Task")


class FilterTasksForm(FlaskForm):
    show_archived = IntegerField("Show Archived (1 = Yes, 0 = No)", default=0)
    submit = SubmitField("Filter Tasks")


class ReassignSubtaskForm(FlaskForm):
    new_parent_id = IntegerField(
        "New Parent Task ID", validators=[DataRequired(), NumberRange(min=1)]
    )

    def validate_new_parent_id(self, field):
        Task = get_task_model()  # Lazy import
        new_parent_task = Task.query.get(field.data)
        if not new_parent_task:
            raise ValidationError("New parent task does not exist.")


# Form for assigning subtasks to parent tasks
class AssignSubtaskForm(FlaskForm):
    task_id = HiddenField("Task ID", validators=[DataRequired()])
    parent_id = SelectField("Parent Task", coerce=int, validators=[DataRequired()])
    submit = SubmitField("Assign as Subtask")

    def validate_parent_id(self, field):
        Task = get_task_model()  # Lazy import
        parent_task = Task.query.get(field.data)
        if not parent_task:
            raise ValidationError("Selected parent task does not exist.")
