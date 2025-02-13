import logging

from flask import Blueprint, render_template, request, redirect, url_for, flash, get_flashed_messages, jsonify
from sqlalchemy.orm import joinedload
from datetime import datetime

from app.charts.burnup_chart import generate_burnup_chart
from app.forms.forms import ProjectForm, AddContributorForm, DeleteProjectForm, TaskForm
from app.models import Project, Contributor
from app.extensions.db import db
from app.tasks.models import Task
from app.utils.common_utils import (
    count_ongoing_projects,
    count_completed_projects,
    count_unstarted_projects,
    count_all_projects,
    count_all_contributors,
    count_assigned_contributors,
    count_unassigned_contributors,
    log_interaction
)
from app.tasks.utils import TaskService

logger = logging.getLogger(__name__)  # Creates a logger for the current module
logger.debug("This is a debug message from the page_routes module")

page = Blueprint('page', __name__)

# Route for the homepage
@page.route('/', methods=['GET', 'POST'])
def index():
    """
    Renders the homepage with project details and a form to add new projects.
    """
    form = ProjectForm()

    if form.validate_on_submit():
        project_name = form.project_name.data
        start_date = form.start_date.data
        end_date = form.end_date.data
        scope = form.scope.data

        existing_project = Project.query.filter_by(name=project_name).first()
        if existing_project:
            logging.error(f"Project with name '{project_name}' already exists.")
            return f"Error: Project with name '{project_name}' already exists.", 400

        new_project = Project(name=project_name, start_date=start_date, end_date=end_date, total_scope=scope)

        try:
            db.session.add(new_project)
            db.session.commit()
            logging.info(f"Project '{project_name}' added successfully.")
            return redirect(url_for('page.project', project_name=project_name))
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error adding project '{project_name}': {e}")
            return f"Error: {str(e)}", 400

    projects = Project.query.options(joinedload(Project.tasks)).all()
    return render_template('index.html', form=form, projects=projects)

# Route for the base page
@page.route('/base', methods=['GET', 'POST'])
def base():
    """
    Renders the base.html template.
    """
    return render_template('base.html')

# Route for testing flash messages
@page.route('/test-flash')
def test_flash():
    """
    Adds a test flash message and redirects to the base page.
    """
    flash('This is a test message')  # Add a flash message
    return redirect(url_for('page.base'))  # Redirect to the base page

# Route for the dashboard
@page.route('/dashboard')
def dashboard():
    """
    Renders the dashboard page with project and contributor stats and charts.
    """
    messages = get_flashed_messages(with_categories=True)
    logging.info(f"Flash messages: {messages}")

    form = ProjectForm()  # Create an instance of the form

    projects = Project.query.options(joinedload(Project.tasks)).all()
    project_data = []

    for project in projects:
        total_scope = TaskService.calculate_total_story_points(project.id)
        completed_points = TaskService.calculate_completed_story_points(project.id)

        completion_percentage = TaskService.calculate_completion_percentage(project.id)
        formatted_start_date = project.start_date.strftime('%b-%d-%Y')
        formatted_end_date = project.end_date.strftime('%b-%d-%Y')

        project_data.append({
            'project': project,
            'completion_percentage': completion_percentage,
            'formatted_start_date': formatted_start_date,
            'formatted_end_date': formatted_end_date
        })

    contributors_count = Contributor.query.count()
    ongoing_count = count_ongoing_projects()
    completed_count = count_completed_projects()
    unstarted_count = count_unstarted_projects()
    all_count = count_all_projects()
    all_contributors_count = count_all_contributors()
    assigned_contributors_count = count_assigned_contributors()
    unassigned_contributors_count = count_unassigned_contributors()

    # Generate charts
    from app.charts.project_breakdown_chart import generate_project_breakdown_chart
    project_breakdown_chart_url = generate_project_breakdown_chart(ongoing_count, completed_count, unstarted_count)
    from app.charts.contributor_breakdown_chart import generate_contributor_breakdown_chart
    contributor_breakdown_chart_url = generate_contributor_breakdown_chart(assigned_contributors_count, unassigned_contributors_count)

    return render_template(
        'dashboard.html',
        form=form,
        project_data=project_data,
        total_contributors=contributors_count,
        ongoing_count=ongoing_count,
        completed_count=completed_count,
        unstarted_count=unstarted_count,
        all_count=all_count,
        all_contributors_count=all_contributors_count,
        assigned_contributors_count=assigned_contributors_count,
        unassigned_contributors_count=unassigned_contributors_count,
        has_flash_messages=len(messages) > 0,
        messages=messages,
        project_breakdown_chart_url=project_breakdown_chart_url,
        contributor_breakdown_chart_url=contributor_breakdown_chart_url
    )

# Route to display project details and add progress
@page.route('/project/<project_name>', methods=['GET', 'POST'])
def project(project_name):
    """
    Displays project details and allows interaction such as adding contributors or viewing charts.
    """
    project = Project.query.filter_by(name=project_name).first()
    all_contributors = Contributor.query.all()

    if not project:
        return "Error: Project not found.", 404

    add_contributor_form = AddContributorForm()
    delete_project_form = DeleteProjectForm()
    chart_url = generate_burnup_chart(project_name)

    return render_template(
        'project.html',
        project=project,
        all_contributors=all_contributors,
        add_contributor_form=add_contributor_form,
        chart_url=chart_url,
        delete_project_form=delete_project_form,
    )
    
from flask import Blueprint, render_template, request
from app.models.models import Project, Contributor
from sqlalchemy import asc, desc

bp = Blueprint("tasks", __name__)


@page.route('/create_project', methods=['POST'])
def create_project():
    """
    Handles the creation of a new project.
    """
    form = ProjectForm()

    # Validate form input
    if not form.validate_on_submit():
        return jsonify({"success": False, "message": "Invalid form submission."}), 400

    # Sanitize and trim project name
    project_name = form.project_name.data.strip()
    start_date = form.start_date.data
    end_date = form.end_date.data

    try:
        # Check for existing project with the same name
        existing_project = Project.query.filter_by(name=project_name).first()
        if existing_project:
            logging.warning(f"Attempt to create duplicate project: '{project_name}'")
            return jsonify({"success": False, "message": f"Project '{project_name}' already exists."}), 400

        # Create a new project
        new_project = Project(name=project_name, start_date=start_date, end_date=end_date)
        db.session.add(new_project)
        db.session.commit()

        # Log success and respond
        logging.info(f"Project '{project_name}' created successfully.")
        return jsonify({"success": True, "message": f"Project '{project_name}' created successfully."}), 201

    except Exception as e:
        # Rollback and handle errors
        db.session.rollback()
        logging.error(f"Error creating project '{project_name}': {e}")
        return jsonify({"success": False, "message": f"Error creating project: {str(e)}"}), 500

# AJAX route to add a contributor
@page.route('/add_contributor/<project_name>', methods=['POST'])
def add_contributor(project_name):
    """
    Adds a contributor to a specified project. Logs all interactions for tracing and debugging.
    """
    try:
        # Fetch the project by name
        log_interaction('page_routes.add_contributor', 'models.Project.query', 'Fetching project by name', {'project_name': project_name})
        current_project = Project.query.filter_by(name=project_name.strip()).first()

        if not current_project:
            log_interaction('models.Project.query', None, 'Project not found', {'project_name': project_name})
            return jsonify(success=False, error="Project not found"), 404

        # Fetch contributor name from the request
        contributor_name = request.form.get('contributor_name', '').strip()
        log_interaction('page_routes.add_contributor', 'request.form', 'Received contributor name', {'contributor_name': contributor_name})

        if not contributor_name:
            log_interaction('page_routes.add_contributor', None, 'Invalid contributor name', {'contributor_name': contributor_name})
            return jsonify(success=False, error="Invalid contributor name"), 400

        # Check if the contributor exists, else create a new one
        existing_contributor = Contributor.query.filter_by(name=contributor_name).first()
        if not existing_contributor:
            log_interaction('models.Contributor.query', 'models.Contributor', 'Creating new contributor', {'contributor_name': contributor_name})
            existing_contributor = Contributor(name=contributor_name)
            db.session.add(existing_contributor)

        # Check if the contributor already has tasks in the project
        if TaskService.contributor_has_assigned_tasks(current_project.id, existing_contributor.id):
            log_interaction('page_routes.add_contributor', None, 'Contributor has tasks in the project', {'project_id': current_project.id, 'contributor_id': existing_contributor.id})
            return jsonify(success=False, error="Contributor already has tasks in this project"), 400

        # Add the contributor to the project
        log_interaction('page_routes.add_contributor', 'models.Project.add_contributor', 'Adding contributor to project', {'project_id': current_project.id, 'contributor_id': existing_contributor.id})
        current_project.add_contributor(existing_contributor)
        db.session.commit()

        # Prepare the response data
        contributors_data = [
            {'name': c.name, 'has_tasks': TaskService.contributor_has_assigned_tasks(current_project.id, c.id)}
            for c in current_project.contributors
        ]

        return jsonify(success=True, contributors=contributors_data)

    except Exception as e:
        # Handle errors and rollback the transaction
        db.session.rollback()
        log_interaction('page_routes.add_contributor', None, 'Error adding contributor', {'error': str(e)})
        return jsonify(success=False, error="An error occurred while adding the contributor."), 500

# AJAX route to remove a contributor
@page.route('/remove_contributor/<project_name>', methods=['POST'])
def remove_contributor(project_name):
    """
    Removes a contributor from a specified project. Prevents removal if the contributor has assigned tasks.
    Logs all interactions for tracing and debugging.
    
    :param project_name: The name of the project from which the contributor will be removed.
    """
    # Log the beginning of the operation
    log_interaction('page_routes.remove_contributor', 'models.Project.query', 'Fetching project by name', {'project_name': project_name})
    current_project = Project.query.filter_by(name=project_name).first()

    if not current_project:
        # Handle case when the project is not found        
        log_interaction('models.Project.query', None, 'Project not found', {'project_name': project_name})
        return jsonify(success=False, error="Project not found"), 404
    
    # Parse the JSON request for the contributor name
    data = request.get_json()
    contributor_name = data.get('contributor_name')
    log_interaction('page_routes.remove_contributor', 'request.get_json', 'Received contributor name', {'contributor_name': contributor_name})

    if not contributor_name:
        # Handle missing contributor name
        log_interaction('page_routes.remove_contributor', None, 'Invalid contributor name', {'contributor_name': contributor_name})
        return jsonify(success=False, error="Invalid contributor name"), 400

    try:
        # Check if the contributor exists
        log_interaction('page_routes.remove_contributor', 'models.Contributor.query', 'Checking if contributor exists', {'contributor_name': contributor_name})
        existing_contributor = Contributor.query.filter_by(name=contributor_name).first()

        if not existing_contributor:
            # Handle case when the contributor is not found
            log_interaction('models.Contributor.query', None, 'Contributor not found', {'contributor_name': contributor_name})
            return jsonify(success=False, error="Contributor not found"), 404

        # Check if the contributor has assigned tasks
        if TaskService.contributor_has_assigned_tasks(current_project, existing_contributor):
            log_interaction('page_routes.remove_contributor', None, 'Contributor has assigned tasks', {'contributor_name': contributor_name})
            return jsonify(success=False, error="Cannot remove contributor with assigned tasks."), 400

        # Remove the contributor from the project
        log_interaction('page_routes.remove_contributor', 'models.Project.remove_contributor', 'Removing contributor from project', {'project_id': current_project.id, 'contributor_id': existing_contributor.id})
        current_project.remove_contributor(existing_contributor)
        db.session.commit()
        log_interaction('models.Project.remove_contributor', 'db.session.commit', 'Contributor removed from project', {'project_id': current_project.id, 'contributor_id': existing_contributor.id})

        # Return updated contributors list
        return jsonify(success=True, contributors=[c.name for c in current_project.contributors])

    except Exception as e:
        db.session.rollback()
        log_interaction('page_routes.remove_contributor', None, 'Error removing contributor', {'error': str(e)})
        return jsonify(success=False, error="An error occurred while removing the contributor."), 500

# Route to delete a project
@page.route('/delete_project/<int:project_id>', methods=['POST'])
def delete_project(project_id):
    """
    Deletes a project and all its tasks. Handles errors during deletion.
    """
    project_to_delete = Project.query.get_or_404(project_id)

    try:
        # Delete the project from the database
        success, message = TaskService.delete_project_and_tasks(project_id)
        if success:
            logging.info(f"Project with ID {project_id} deleted successfully.")
            flash('Project deleted successfully!', 'success')
        else:
            flash('An error occurred while deleting the project.', 'danger')  # Flash error message

        return redirect(url_for('page.dashboard'))
    except Exception as e:
        logging.error(f"Error deleting project: {e}")
        return redirect(url_for('page.dashboard'))
