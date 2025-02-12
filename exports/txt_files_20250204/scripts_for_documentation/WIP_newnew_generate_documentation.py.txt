import os
import sys
import subprocess
import shutil
import glob
from datetime import datetime

# Ensure the project root is in sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from app.utils.common_utils import log_interaction


def validate_dependencies():
    required_tools = ["pyreverse", "dot", "plantuml"]
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"[ERROR] {tool} is not installed or not in PATH.")
            return False
    return True


def ensure_output_folder(folder_name):
    folder_path = os.path.abspath(folder_name)
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        log_interaction("helper.ensure_output_folder", None, "Created output folder", {"folder_name": folder_name})
    return folder_path


def get_timestamp():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def log_file_action(action, file_path):
    print(f"[{action.upper()}] {file_path}")


def summarize_outputs(output_folder):
    ignored_files = {".DS_Store"}
    print("\n[SUMMARY] Generated Files:")
    for root, _, files in os.walk(output_folder):
        for file in files:
            if file not in ignored_files:
                print(os.path.join(root, file))


def generate_module_interaction(output_folder="project_documentation/diagrams/class_diagrams"):
    timestamp = get_timestamp()
    output_folder = ensure_output_folder(output_folder)
    modules = [(".", "root_models"), ("app.tasks", "tasks_models")]

    for module_path, prefix in modules:
        try:
            print(f"[INFO] Running Pyreverse for: {module_path} with prefix: {prefix}")
            subprocess.run(["pyreverse", module_path, "-o", "dot", "-p", prefix], check=True)
            dot_files = [f"classes_{prefix}.dot", f"packages_{prefix}.dot"]
            for dot_file in dot_files:
                source_path = glob.glob(f"**/{dot_file}", recursive=True)
                if source_path:
                    source_path = os.path.abspath(source_path[0])
                    destination_file = os.path.join(output_folder, f"{dot_file.replace('.dot', '')}_{timestamp}.dot")
                    os.rename(source_path, destination_file)
                    log_file_action("moved", destination_file)
                    svg_file = destination_file.replace(".dot", ".svg")
                    subprocess.run(["dot", "-Tsvg", destination_file, "-o", svg_file], check=True)
                    log_file_action("generated", svg_file)
                else:
                    print(f"[WARNING] {dot_file} not found.")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Pyreverse failed for {module_path}: {e}")


def generate_sequence_diagrams(output_folder="project_documentation/diagrams/sequence_diagrams"):
    timestamp = get_timestamp()
    output_folder = ensure_output_folder(output_folder)

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
        puml_path = os.path.join(output_folder, puml_file)
        svg_file = os.path.join(output_folder, f"{sequence}_{timestamp}.svg")

        if not os.path.exists(puml_path):
            print(f"[CREATED PLACEHOLDER] {puml_file}")
            with open(puml_path, "w") as f:
                f.write(f"@startuml\nactor User\nUser -> System : Placeholder for {sequence}\n@enduml")

        try:
            subprocess.run(["plantuml", "-tsvg", puml_path], check=True)
            log_file_action("generated UML diagram", svg_file)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to generate UML diagram for {sequence}: {e}")


def generate_database_schema(output_folder="project_documentation/database"):
    timestamp = get_timestamp()
    output_folder = ensure_output_folder(output_folder)
    schema_output_path = os.path.join(output_folder, f"schema_output_{timestamp}.txt")

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
    generate_module_interaction()
    generate_database_schema()
    generate_sequence_diagrams()
    summarize_outputs("project_documentation")


if __name__ == "__main__":
    if validate_dependencies():
        generate_all_documentation()
    else:
        print("[ERROR] Please install all required dependencies and re-run the script.")