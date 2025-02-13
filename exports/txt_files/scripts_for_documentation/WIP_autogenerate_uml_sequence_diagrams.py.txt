import os
import re
from datetime import datetime

# ---------------------------
# Configuration
# ---------------------------
LOG_FILE_PATH = "app.log"  # Path to your application log file
SOURCE_CODE_PATH = "./app"  # Path to your Flask app's source code
OUTPUT_FOLDER = "exports"
PLANTUML_JAR_PATH = "./exports/plantuml.jar"  # Update with your PlantUML jar location

# ---------------------------
# Helper Functions
# ---------------------------

def ensure_folder(folder_name):
    """Ensure the output folder exists."""
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)
    return folder_name


def get_timestamp():
    """Generate a timestamp for filenames."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def log_file_action(action, file_path):
    """Log actions performed on files."""
    print(f"[{action.upper()}] {file_path}")


def render_plantuml(puml_file, output_format="svg"):
    """Render the PlantUML diagram."""
    output_file = puml_file.replace(".puml", f".{output_format}")
    try:
        os.system(f"java -jar {PLANTUML_JAR_PATH} -t{output_format} {puml_file}")
        log_file_action("rendered", output_file)
    except Exception as e:
        print(f"[ERROR] Failed to render {puml_file}: {e}")


# ---------------------------
# Parsing Functions
# ---------------------------

def parse_logs(log_file):
    """
    Parse structured logs to extract interactions.
    Expected log format:
    [TIMESTAMP] Caller=Frontend, Callee=Backend, Action=POST /tasks/archive/<task_id>, File=routes.py
    """
    interactions = []
    try:
        with open(log_file, "r") as f:
            for line in f:
                match = re.search(
                    r"Caller=(?P<from>\w+), Callee=(?P<to>\w+), Action=(?P<action>.+), File=(?P<file>\S+)",
                    line,
                )
                if match:
                    interactions.append(match.groupdict())
    except FileNotFoundError:
        print(f"[ERROR] Log file not found: {log_file}")
    return interactions


def parse_routes(source_code_path):
    """
    Parse Flask route definitions to infer interactions.
    Example route:
    @bp.route("/tasks/archive/<int:task_id>", methods=["POST"])
    def archive_task():
    """
    interactions = []
    route_pattern = re.compile(
        r"@bp\.route\(\"(?P<route>[^\"]+)\", methods=\[(?P<methods>[^\]]+)\]\)\s+def\s+(?P<function>\w+)"
    )

    for root, _, files in os.walk(source_code_path):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r") as f:
                    content = f.read()
                    matches = route_pattern.finditer(content)
                    for match in matches:
                        interactions.append(
                            {
                                "route": match.group("route"),
                                "methods": match.group("methods"),
                                "function": match.group("function"),
                                "file": file,
                            }
                        )
    return interactions


# ---------------------------
# Sequence Diagram Generation
# ---------------------------

def generate_puml(title, interaction_steps, output_folder):
    """
    Generate a .puml file for the given interaction steps.
    """
    ensure_folder(output_folder)
    timestamp = get_timestamp()
    file_name = f"{title.replace(' ', '_')}_{timestamp}.puml"
    file_path = os.path.join(output_folder, file_name)

    with open(file_path, "w") as f:
        f.write(f"@startuml\n")
        f.write(f"title {title}\n\n")

        # Add participants
        participants = set()
        for step in interaction_steps:
            participants.add(step["from"])
            participants.add(step["to"])

        for participant in participants:
            f.write(f'participant "{participant}"\n')

        f.write("\n")

        # Add interactions
        for step in interaction_steps:
            label = step["action"]
            if "file" in step:
                label += f" ({step['file']})"
            f.write(f'{step["from"]} -> {step["to"]} : {label}\n')

        f.write("\n@enduml\n")

    log_file_action("generated", file_path)
    return file_path


# ---------------------------
# Main Functionality
# ---------------------------

def generate_sequence_diagrams():
    """
    Generate sequence diagrams by analyzing logs and routes.
    """
    output_folder = ensure_folder(OUTPUT_FOLDER)

    # Analyze logs for interactions
    log_interactions = parse_logs(LOG_FILE_PATH)

    # Analyze source code for routes
    route_interactions = parse_routes(SOURCE_CODE_PATH)

    # Combine all interactions
    all_interactions = log_interactions + [
        {
            "from": "Frontend",
            "to": "Backend",
            "action": f"{route['methods']} {route['route']}",
            "file": route["file"],
        }
        for route in route_interactions
    ]

    # Generate sequence diagrams for all interactions
    puml_file = generate_puml("Application Interaction Flow", all_interactions, output_folder)
    render_plantuml(puml_file, output_format="svg")

    print("\n[INFO] Sequence diagrams generated in:", output_folder)


# ---------------------------
# Entry Point
# ---------------------------

if __name__ == "__main__":
    generate_sequence_diagrams()