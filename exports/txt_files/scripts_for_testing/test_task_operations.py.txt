from sqlalchemy import create_engine, MetaData, Table, insert, select, delete

# Connect to the SQLite database
engine = create_engine("sqlite:///instance/projects.db", echo=True)
metadata = MetaData()

# Reflect the task table
task_table = Table("task", metadata, autoload_with=engine)

def test_insert_task():
    # Insert a new task
    insert_stmt = insert(task_table).values(
        name="Test Task",
        description="This is a test task",
        task_type="User Story",
        project_id=41,  # Update with an actual project_id
        contributor_id=1,  # Update with an actual contributor_id
        story_points=5,
        completed=False
    )
    with engine.connect() as conn:
        conn.execute(insert_stmt)
        conn.commit()  # Commit the transaction
        print("Inserted a task successfully.")

def test_query_tasks():
    # Query tasks
    select_stmt = select(task_table)
    with engine.connect() as conn:
        results = conn.execute(select_stmt).fetchall()
        for row in results:
            print(row)

def test_delete_task():
    # Delete a task by ID
    delete_stmt = delete(task_table).where(task_table.c.id == 1)  # Update with an actual task ID
    with engine.connect() as conn:
        conn.execute(delete_stmt)
        conn.commit()
        print("Deleted the task successfully.")

if __name__ == "__main__":
    print("Testing Task Table Operations")
    test_insert_task()
    test_query_tasks()
    test_delete_task()