import sys
import os
from flask import url_for
from bs4 import BeautifulSoup
import pytest

# Adding the project root directory to the system path so pytest can find app.py
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from app import app  # Importing the Flask app

@pytest.fixture
def client():
    # Set up the Flask app in testing mode, and create a test client
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client  # Return the test client to use in the test cases
        
        
def test_fetch_task_as_dict(app, db_session, task_factory):
    # Create a sample task
    task = task_factory(name="Sample Task", task_type="Subtask")
    db_session.add(task)
    db_session.commit()

    # Fetch the task as a dictionary
    task_dict = TaskService.fetch_task_as_dict(task.id)

    # Assertions
    assert task_dict['id'] == task.id
    assert task_dict['name'] == "Sample Task"
    assert task_dict['task_type'] == "Subtask"
    assert "created_at" in task_dict
    assert "updated_at" in task_dict

def test_fetch_task_as_dict_not_found(app):
    # Test with an invalid task ID
    with pytest.raises(ValueError) as excinfo:
        TaskService.fetch_task_as_dict(99999)  # Non-existent task ID
    assert "Task with ID 99999 not found" in str(excinfo.value)

# Helper function to extract CSRF token from HTML responses
def get_csrf_token(response):
    # Parse the HTML response using BeautifulSoup to locate the CSRF token input field
    soup = BeautifulSoup(response.data, 'html.parser')
    csrf_token_input = soup.find('input', {'name': 'csrf_token'})
    if csrf_token_input:
        return csrf_token_input['value']  # Return the value of the CSRF token
    else:
        raise ValueError("CSRF token not found in the response")

# Test case for creating a project
def test_create_project(client):
    # Step 1: Send GET request to the home page to retrieve the form
    response = client.get('/')
    csrf_token = get_csrf_token(response)  # Extract CSRF token from the form

    # Step 2: Submit the form with project details using a POST request
    response = client.post('/', data={
        'csrf_token': csrf_token,  # Include the CSRF token in the POST request
        'project_name': 'Test Project',  # Name of the project
        'start_date': '2024-09-24',  # Project start date
        'end_date': '2024-12-31',  # Project end date
        'scope': 100  # Scope of the project (story points)
    }, follow_redirects=True)

    # Debugging output for inspecting response content
    print(response.data.decode())

    # Step 3: Check that the project was created successfully (status code 200)
    # and that the project name appears in the response
    assert response.status_code == 200
    assert b'Project: Test Project' in response.data

# -------------Below are test cases for validating the status field behavior----------------
    
    """ 1. Test Database Persistence"""
    
    def test_task_status_persistence(db_session):
    # Create a new task
    task = Task(
        name="Test Task",
        status="In Progress",
        project_id=1
    )
    db_session.add(task)
    db_session.commit()

    # Fetch the task from the database
    fetched_task = Task.query.get(task.id)

    # Assert that the status is persisted correctly
    assert fetched_task.status == "In Progress"
    
    
    """ 2. Test Serialization """
    
    def test_task_to_dict_serialization(db_session):
    # Create a new task
    task = Task(
        name="Test Task",
        status="Completed",
        project_id=1
    )
    db_session.add(task)
    db_session.commit()

    # Serialize the task
    task_dict = task.to_dict()

    # Assert that the status field is included
    assert "status" in task_dict
    assert task_dict["status"] == "Completed"
    
    
    """ 3. Test API Response """
    
    def test_api_get_task(client, db_session):
    # Create a new task
    task = Task(
        name="API Test Task",
        status="Not Started",
        project_id=1
    )
    db_session.add(task)
    db_session.commit()

    # Make a GET request to the task endpoint
    response = client.get(f'/api/tasks/{task.id}')

    # Assert the response contains the status field
    assert response.status_code == 200
    data = response.json
    assert data["status"] == "Not Started"
    
    
    #----------------Below are test cases suggested by co-pilot----------------
    
    
    """
    AI is creating summary for test_status_field_validates_on_submit
    def test_status_field_validates_on_submit(client):
        # Step 1: Send GET request to the home page to retrieve the form
        response = client.get('/')
        csrf_token = get_csrf_token(response)  # Extract CSRF token from the form
        # Step 2: Submit the form with project details using a POST request
        response = client.post('/', data={
            'csrf_token': csrf_token,  # Include the CSRF token in the POST request
            'project_name': 'Test Project',  # Name of the project
            'start_date': '2024-09-24',  # Project start date
            'end_date': '2024-12-31',  # Project end date
            'scope': 100,  # Scope of the project (story points)
            'status': 'Invalid'  # Invalid status value
        }, follow_redirects=True)
        # Step 3: Check that the form submission failed with a 400 error
        assert response.status_code == 400
        assert b'Invalid status value: Invalid' in response.data
        # Step 4: Check that the form is re-rendered with the invalid status value
        assert b'value="Invalid"' in response.data
        assert b'Selected' not in response.data
        # Step 5: Check that the form is re-rendered with the selected status value
        assert b'Selected' in response.data
        assert b'value="New"' in response.data
        # Step 6: Check that the form is re-rendered with the selected status value
        assert b'Selected' in response.data
        assert b'value="In Progress"' in response.data
        # Step 7: Check that the form is re-rendered with the selected status value
        assert b'Selected' in response.data
        assert b'value="Completed"' in response.data
        # Step 8: Check that the form is re-rendered with the selected status value
        assert b'Selected' in response.data
        assert b'value="Closed"' in response.data
        # Step 9: Check that the form is re-rendered with the selected status value
        assert b'Selected' in response.data
        assert b'value="Invalid"' in response.data

        
  
    def test_status_field_validates_on_submit(app):
        # Create a new task with an invalid status
        with pytest.raises(ValueError) as excinfo:
            task = Task(name="Invalid Task", task_type="Subtask", status="Invalid")
            db_session.add(task)
            db_session.commit()
        assert "Invalid status value: Invalid" in str(excinfo.value)
    
    def test_status_field_validates_on_update(app, task_factory):
        # Create a sample task
        task = task_factory(name="Sample Task", task_type="Subtask")
        db_session.add(task)
        db_session.commit()
        
        # Update the task with an invalid status
        with pytest.raises(ValueError) as excinfo:
            task.status = "Invalid"
            db_session.commit()
        assert "Invalid status value: Invalid" in str(excinfo.value)
        
    def test_status_field_validates_on_update_with_service(app, task_factory):
        # Create a sample task
        task = task_factory(name="Sample Task", task_type="Subtask")
        db_session.add(task)
        db_session.commit()
        
        # Update the task with an invalid status using the service method
        with pytest.raises(ValueError) as excinfo:
            TaskService.update_task(task.id, status="Invalid")
        assert "Invalid status value: Invalid" in str(excinfo.value)
        
    def test_status_field_validates_on_update_with_service_dict(app, task_factory):
        # Create a sample task
        task = task_factory(name="Sample Task", task_type="Subtask")
        db_session.add(task)
        db_session.commit()
        
        # Update the task with an invalid status using the service method
        with pytest.raises(ValueError) as excinfo:
            TaskService.update_task_as_dict(task.id, status="Invalid")
        assert "Invalid status value: Invalid" in str(excinfo.value)
          """
          

        
        
        
