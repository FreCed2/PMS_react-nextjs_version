import os
import sys
import subprocess
import shutil
import glob
from datetime import datetime

# Ensure the project root is in sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from app.utils.common_utils import log_interaction  # Importing log_interaction for standardized logging


def validate_dependencies():
    required_tools = ["pyreverse", "dot", "plantuml"]
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"[ERROR] {tool} is not installed or not in PATH.")
            return False
    return True


def ensure_output_folder(folder_name):
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)
        log_interaction("helper.ensure_output_folder", None, "Created output folder", {"folder_name": folder_name})
    return folder_name


def get_timestamp():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def log_file_action(action, file_path):
    print(f"[{action.upper()}] {file_path}")


def summarize_outputs(output_folder):
    print("\n[SUMMARY] Generated Files:")
    for root, _, files in os.walk(output_folder):
        for file in files:
            print(os.path.join(root, file))


def generate_module_interaction(output_folder="project_documentation"):
    log_interaction("generate_module_interaction", None, "Started module interaction generation")
    timestamp = get_timestamp()
    class_diagrams_folder = ensure_output_folder(os.path.join(output_folder, "class_diagrams"))

    modules = [(".", "root_models"), ("app.tasks", "tasks_models")]

    for module_path, prefix in modules:
        print(f"[INFO] Running Pyreverse for: {module_path} with prefix: {prefix}")
        subprocess.run(["pyreverse", module_path, "-o", "dot", "-p", prefix])
        dot_files = [f"classes_{prefix}.dot", f"packages_{prefix}.dot"]

        for dot_file in dot_files:
            source_path = glob.glob(f"**/{dot_file}", recursive=True)
            if source_path:
                source_path = os.path.abspath(source_path[0])
                destination_file = os.path.join(class_diagrams_folder, f"{dot_file.replace('.dot', '')}_{timestamp}.dot")
                os.rename(source_path, destination_file)
                log_file_action("moved", destination_file)

                svg_file = destination_file.replace(".dot", ".svg")
                subprocess.run(["dot", "-Tsvg", destination_file, "-o", svg_file])
                log_file_action("generated", svg_file)
            else:
                print(f"[ERROR] {dot_file} not found.")


def generate_sequence_diagrams(output_folder="project_documentation"):
    log_interaction("generate_sequence_diagrams", None, "Started sequence diagram generation")
    timestamp = get_timestamp()
    sequence_diagrams_folder = ensure_output_folder(os.path.join(output_folder, "sequence_diagrams"))

    sequences = [
        "add_contributor_sequence",
        "remove_contributor_sequence",
        "view_dashboard_sequence",
        "view_task_details_sequence",
        "update_task_sequence",
        "delete_task_sequence",
    ]

    for sequence in sequences:
        puml_file = f"{sequence}_{timestamp}.puml"
        puml_path = os.path.join(sequence_diagrams_folder, puml_file)
        svg_file = os.path.join(sequence_diagrams_folder, f"{sequence}_{timestamp}.svg")

        if not os.path.exists(puml_path):
            print(f"[CREATED PLACEHOLDER] {puml_file}")
            with open(puml_path, "w") as f:
                f.write(f"@startuml\nactor User\nUser -> System : Placeholder for {sequence}\n@enduml")

        try:
            subprocess.run(["plantuml", "-tsvg", puml_path], check=True)
            log_file_action("generated UML diagram", svg_file)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to generate UML diagram for {sequence}: {e}")


def generate_database_schema(output_folder="project_documentation"):
    log_interaction("generate_database_schema", None, "Started database schema generation")
    timestamp = get_timestamp()
    db_schemas_folder = ensure_output_folder(os.path.join(output_folder, "database_schemas"))
    schema_output_path = os.path.join(db_schemas_folder, f"schema_output_{timestamp}.txt")

    try:
        db_name = "pythonproject"
        user = "postgres"
        host = "localhost"

        with open(schema_output_path, "w") as schema_file:
            subprocess.run(
                ["pg_dump", "-s", "-U", user, "-h", host, db_name],
                stdout=schema_file,
                check=True
            )
        log_file_action("generated", schema_output_path)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to generate schema: {e}")


def generate_all_documentation():
    output_folder = "project_documentation"
    generate_module_interaction(output_folder=output_folder)
    generate_database_schema(output_folder=output_folder)
    generate_sequence_diagrams(output_folder=output_folder)
    summarize_outputs(output_folder)


if __name__ == "__main__":
    if validate_dependencies():
        generate_all_documentation()
    else:
        print("[ERROR] Please install all required dependencies and re-run the script.")
        