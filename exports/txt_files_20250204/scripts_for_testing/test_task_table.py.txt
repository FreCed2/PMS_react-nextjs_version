from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Enum, ForeignKey, Boolean, Text

# Connect to the SQLite database
engine = create_engine('sqlite:///instance/projects.db')
metadata = MetaData()  # Create a MetaData instance

# Reflect existing tables in the database
metadata.reflect(bind=engine)

# Define the 'task' table
task = Table(
    'task', metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(100), nullable=False),
    Column('description', Text),
    Column(
        'task_type',
        Enum('Epic', 'User Story', 'Subtask', name='task_type_enum'),
        nullable=False
    ),
    Column('parent_id', Integer, ForeignKey('task.id', ondelete='CASCADE')),
    Column('project_id', Integer, ForeignKey('project.id', ondelete='CASCADE')),
    Column('contributor_id', Integer, ForeignKey('contributor.id', ondelete='SET NULL')),
    Column('story_points', Integer),
    Column('completed', Boolean, default=False)
)

# Create all tables in the database
metadata.create_all(engine)

print("Task table created successfully!")