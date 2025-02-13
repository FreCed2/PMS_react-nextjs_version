import argparse
import os
import sys

# Add the project root directory to the sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
if project_root not in sys.path:
    sys.path.append(project_root)

from scripts_for_documentation.create_database_schema.export_schema import export_database_schema
from app import create_app

"""
To run the script from within the project root (pythonproject):
cd /path/to/pythonproject
python scripts_for_documentation/create_database_schema/run_export_schema.py

To run from a different directory:
cd /some/other/location
python /path/to/pythonproject/scripts_for_documentation/create_database_schema/run_export_schema.py
"""

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export database schema")
    default_output = os.path.join(os.path.dirname(__file__), "../../project_documentation/database_schemas/schema_output.txt")
    parser.add_argument("--output", type=str, default=default_output, help="Output file path")
    parser.add_argument("--format", type=str, choices=["txt", "json", "markdown"], default="txt", help="Output format")
    args = parser.parse_args()

    app = create_app()  # Create the Flask app instance

    try:
        export_database_schema(app, output_file=args.output, format=args.format)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")