"""Reinitialized migrations

Revision ID: dbffa7830b9c
Revises: b7f90a8fdc83
Create Date: 2025-02-15 16:29:19.149411

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "dbffa7830b9c"
down_revision = "b7f90a8fdc83"
branch_labels = None
depends_on = None

# Define the Enum type for PostgreSQL
priority_enum = ENUM(
    "Low", "Medium", "High", "Critical", name="task_priority", create_type=True
)


def upgrade():
    """Apply migration: Add priority field to task"""
    # ✅ Ensure the Enum type exists before adding the column
    op.execute(
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN "
        "CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Critical'); END IF; END $$;"
    )

    with op.batch_alter_table("task") as batch_op:
        batch_op.add_column(
            sa.Column(
                "priority", priority_enum, nullable=False, server_default="Medium"
            )
        )

        # ✅ Drop constraint if it exists
        conn = op.get_bind()
        result = conn.execute(text(
            "SELECT conname FROM pg_constraint WHERE conname = 'unique_task_name_per_parent'"
        ))

        if result.fetchone():
            batch_op.drop_constraint("unique_task_name_per_parent", type_="unique")


def downgrade():
    """Revert migration: Remove priority field from task"""
    with op.batch_alter_table("task") as batch_op:
        batch_op.drop_column("priority")

    # ✅ Remove Enum type if it exists (must be done after dropping the column)
    op.execute("DROP TYPE IF EXISTS task_priority")

    # ✅ Check if the constraint exists before creating it
    conn = op.get_bind()
    result = conn.execute(text(
        "SELECT conname FROM pg_constraint WHERE conname = 'unique_task_name_per_parent'"
    ))

    if result.fetchone() is None:
        with op.batch_alter_table("task") as batch_op:
            batch_op.create_unique_constraint(
                "unique_task_name_per_parent", ["name", "parent_id"]
            )
