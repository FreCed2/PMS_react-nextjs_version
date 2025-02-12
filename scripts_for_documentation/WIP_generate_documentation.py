import os
import sys
import subprocess
import shutil
import glob
from datetime import datetime

# Providing a main function to execute all documentation generation tasks.
# The script below provides a comprehensive way to generate documentation for a Python project. It includes the following features: 
# - Generating module interaction diagrams using pyreverse and Graphviz.
# - Extracting the database schema from a SQLite database file.
# - Converting the database schema to an Entity-Relationship Diagram (ERD) using Graphviz (optional).
# - Generating UML diagrams from PlantUML files.
# - Organizing the generated documentation in a timestamped folder for easy access.

# Possible improvements and extensions to the script include:
# - The script can be run as a standalone Python script to generate the documentation.
# - The script can be extended to include additional documentation generation tasks.
# - The script uses subprocess to run external commands for generating diagrams and extracting database schema.
# - The script provides helper functions to create output folders and generate timestamps for filenames.
# - The script can be customized to include additional documentation generation tasks based on the project requirements.
# - The script can be integrated into a CI/CD pipeline to automatically generate documentation for a project.
# - The script can be extended to include more detailed documentation generation tasks such as API documentation, code metrics, etc.
# - The script can be enhanced to generate documentation in multiple formats (e.g., HTML, PDF, Markdown) based on project needs.
# - The script can be further optimized for performance and error handling based on the complexity of the project.
# - The script can be integrated with version control systems to automatically update documentation on code changes.
# - The script can be extended to include automated testing of the generated documentation to ensure its accuracy and completeness.
# - The script can be used as a template for generating documentation for different types of projects (web applications, APIs, libraries, etc.).

# The script can be further enhanced by adding support for generating API documentation, code metrics, test coverage reports, 
# and other types of documentation commonly required for software projects. 
# It can also be integrated with continuous integration (CI) tools to automatically generate and publish documentation 
# as part of the build process. 
# By customizing the script to suit the specific requirements of a project, developers can ensure that the documentation 
# remains up-to-date and comprehensive, facilitating better understanding and maintenance of the codebase.

# The script can be extended to include additional documentation generation tasks such as API documentation, code metrics, test coverage reports, 
# and other types of documentation commonly required for software projects. 
# By integrating these tasks into the documentation generation process, developers can ensure that the documentation 
# remains up-to-date and comprehensive, facilitating better understanding and maintenance of the codebase. 
# The script can also be customized to generate documentation in different formats (e.g., HTML, PDF, Markdown) 
# based on the project requirements.

# RUN THE SCRIPT:
# python generate_documentation.py

# Add the project root directory to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from app.utils.common_utils import log_interaction  # Importing log_interaction for standardized logging

# ---------------------------
# Helper Functions
# ---------------------------

def validate_dependencies():
    """
    Ensure required tools (pyreverse, dot, plantuml) are installed and accessible in the PATH.
    """
    required_tools = ["pyreverse", "dot", "plantuml"]
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"[ERROR] {tool} is not installed or not in PATH.")
            return False
    return True

def ensure_output_folder(folder_name):
    """
    Ensure the output folder exists; create it if it does not.
    """
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)
        log_interaction("helper.ensure_output_folder", None, "Created output folder", {"folder_name": folder_name})
    return folder_name

def get_timestamp():
    """
    Generate a timestamp for filenames.
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def log_file_action(action, file_path):
    """
    Log actions performed on files (move, rename, generate, etc.).
    """
    print(f"[{action.upper()}] {file_path}")

def summarize_outputs(output_folder):
    """
    Print a summary of all generated files saved in the output folder.
    """
    print("\n[SUMMARY] Generated Files:")
    for root, _, files in os.walk(output_folder):
        for file in files:
            print(os.path.join(root, file))

# ---------------------------
# Pyreverse Module Interaction
# ---------------------------

def find_dot_files():
    """
    Recursively search for .dot files and log their locations.
    """
    log_interaction("helper.find_dot_files", None, "Searching for .dot files")
    for root, _, files in os.walk("."):
        for file in files:
            if file.endswith(".dot"):
                print(f"[FOUND] {os.path.join(root, file)}")

def generate_module_interaction(folder_name="class_diagrams"):
    """
    Generate module interaction diagrams using Pyreverse and save the output in the specified folder.
    """
    log_interaction("generate_module_interaction", None, "Started module interaction generation")
    timestamp = get_timestamp()
    output_folder = ensure_output_folder(os.path.join(folder_name, "class_diagrams"))

    modules = [(".", "root_models"), ("./tasks", "tasks_models")]

    for module_path, prefix in modules:
        print(f"[INFO] Running Pyreverse for: {module_path} with prefix: {prefix}")
        subprocess.run(["pyreverse", module_path, "-o", "dot", "-p", prefix])
        find_dot_files()

        dot_files = [f"classes_{prefix}.dot", f"packages_{prefix}.dot"]

        for dot_file in dot_files:
            source_path = glob.glob(f"**/{dot_file}", recursive=True)
            if source_path:
                source_path = os.path.abspath(source_path[0])
                destination_file = os.path.join(
                    output_folder,
                    f"{dot_file.replace('.dot', '')}_{timestamp}.dot"
                )
                os.rename(source_path, destination_file)
                log_file_action("moved", destination_file)

                svg_file = destination_file.replace(".dot", ".svg")
                subprocess.run(["dot", "-Tsvg", destination_file, "-o", svg_file])
                log_file_action("generated", svg_file)
            else:
                print(f"[ERROR] {dot_file} not found.")

# ---------------------------
# Database Schema Generation
# ---------------------------

def generate_database_schema(input_db=None, folder_name="project_documentation"):
    """
    Extract and save the database schema from the PostgreSQL database.
    """
    log_interaction("generate_database_schema", None, "Started database schema generation", {"input_db": input_db})
    timestamp = get_timestamp()
    output_folder = ensure_output_folder(os.path.join(folder_name, "database_schemas"))

    schema_output_path = os.path.join(output_folder, f"schema_output_{timestamp}.txt")
    try:
        # Update with the actual PostgreSQL connection details
        db_name = "pythonproject"
        user = "postgres"
        host = "localhost"
        output_file = os.path.abspath(schema_output_path)

        with open(schema_output_path, "w") as schema_file:
            subprocess.run(
                ["pg_dump", "-s", "-U", user, "-h", host, db_name],
                stdout=schema_file,
                check=True
            )
        log_file_action("generated", schema_output_path)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to generate schema: {e}")

# ---------------------------
# Sequence Diagram Generation
# ---------------------------

def generate_sequence_diagrams(output_folder, timestamp):
    """
    Generate UML sequence diagrams for specified interactions.
    """
    log_interaction("generate_sequence_diagrams", None, "Started sequence diagram generation")
    sequences = [
        "add_contributor_sequence",
        "remove_contributor_sequence",
        "view_dashboard_sequence",
        "view_task_details_sequence",
        "update_task_sequence",
        "delete_task_sequence",
    ]

    for sequence in sequences:
        puml_file = f"{sequence}.puml"
        puml_path = os.path.join(output_folder, puml_file)
        svg_file = os.path.join(output_folder, f"{sequence}_{timestamp}.svg")

        if not os.path.exists(puml_path):
            print(f"[CREATED PLACEHOLDER] {puml_file}")
            with open(puml_path, "w") as f:
                f.write(f"@startuml\nactor User\nUser -> System : Placeholder for {sequence}\n@enduml")

        try:
            subprocess.run(["plantuml", "-tsvg", puml_path, "-o", output_folder], check=True)
            log_file_action("generated UML diagram", svg_path)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to generate UML diagram for {sequence}: {e}")

# ---------------------------
# Log Parsing for Sequence Diagrams
# ---------------------------

def parse_logs_for_sequence(log_file, output_file):
    """
    Parse logs and generate a sequence diagram from file interactions.
    """
    sequence_lines = ["@startuml", "title Interaction Sequence"]

    try:
        with open(log_file, 'r') as logs:
            for line in logs:
                if "Caller" in line and "Callee" in line:
                    # Extract relevant parts of the log
                    parts = line.split(", ")
                    caller = parts[1].split(": ")[1]
                    callee = parts[2].split(": ")[1]
                    action = parts[3].split(": ")[1]
                    sequence_lines.append(f"{caller} -> {callee} : {action}")

        sequence_lines.append("@enduml")

        with open(output_file, 'w') as out_file:
            out_file.write("\n".join(sequence_lines))

        print(f"[GENERATED] Sequence diagram saved to {output_file}")
    except Exception as e:
        print(f"[ERROR] Failed to parse logs for sequence diagram: {e}")

# ---------------------------
# Main Driver Function
# ---------------------------

def generate_all_documentation():
    """
    Main function to generate all documentation artifacts for the project.
    """
    log_interaction("generate_all_documentation", None, "Started generating all documentation")
    output_folder = "project_documentation"
    timestamp = get_timestamp()

    generate_module_interaction(folder_name=output_folder)
    generate_database_schema(folder_name=output_folder)
    generate_sequence_diagrams(output_folder=output_folder, timestamp=timestamp)

    # Generate sequence diagrams from logs
    log_file = "app.log"  # Path to the log file
    sequence_output_file = os.path.join(output_folder, f"sequence_diagram_{timestamp}.puml")
    parse_logs_for_sequence(log_file, sequence_output_file)

    summarize_outputs(output_folder)
    print(f"[INFO] All documentation files saved in: {output_folder}")

# ---------------------------
# Entry Point
# ---------------------------

if __name__ == "__main__":
    if validate_dependencies():
        generate_all_documentation()
    else:
        print("[ERROR] Please install all required dependencies and re-run the script.")