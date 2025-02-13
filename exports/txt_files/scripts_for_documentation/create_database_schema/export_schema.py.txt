# export_schema.py
import os
import logging
from sqlalchemy import inspect, exc
from app.extensions.db import db

logging.basicConfig(level=logging.INFO)

def export_database_schema(app, output_file=None, format="txt"):
    """Export database schema in the specified format."""
    try:
        with app.app_context():
            engine = db.get_engine(app)  # Correctly access the engine
            inspector = inspect(engine)

            schema = {}
            for table_name in inspector.get_table_names():
                table_details = {
                    "columns": [],
                    "primary_keys": [],
                    "foreign_keys": [],
                    "unique_constraints": [],
                    "indexes": [],
                }

                # Populate columns
                for column in inspector.get_columns(table_name):
                    table_details["columns"].append({
                        "name": column["name"],
                        "type": str(column["type"]),
                        "nullable": column.get("nullable", True),
                        "default": column.get("default"),
                    })

                # Populate primary keys
                table_details["primary_keys"] = inspector.get_pk_constraint(table_name).get("constrained_columns", [])

                # Populate foreign keys
                for fk in inspector.get_foreign_keys(table_name):
                    table_details["foreign_keys"].append({
                        "column": fk["constrained_columns"],
                        "references": f"{fk['referred_table']}({fk['referred_columns']})",
                    })

                # Populate unique constraints
                for uc in inspector.get_unique_constraints(table_name):
                    table_details["unique_constraints"].append({
                        "name": uc["name"],
                        "columns": uc["column_names"],
                    })

                # Populate indexes
                for index in inspector.get_indexes(table_name):
                    table_details["indexes"].append({
                        "name": index["name"],
                        "columns": index["column_names"],
                        "unique": index.get("unique", False),
                    })

                schema[table_name] = table_details

            # Handle output
            if output_file:
                output_dir = os.path.dirname(output_file)
                if output_dir and not os.path.exists(output_dir):
                    os.makedirs(output_dir)

                with open(output_file, "w") as f:
                    for table, details in schema.items():
                        f.write(f"Table: {table}\n")
                        f.write("  Columns:\n")
                        for column in details["columns"]:
                            f.write(f"    - {column['name']} ({column['type']})")
                            if column["nullable"]:
                                f.write(" [Nullable]")
                            if column["default"]:
                                f.write(f" [Default: {column['default']}]")
                            f.write("\n")

                        # Write other details...
                        f.write("\n")

                logging.info(f"Schema successfully exported to {output_file}")
            else:
                return schema

    except exc.SQLAlchemyError as e:
        logging.error(f"Database error: {e}")
    except OSError as e:
        logging.error(f"File writing error: {e}")