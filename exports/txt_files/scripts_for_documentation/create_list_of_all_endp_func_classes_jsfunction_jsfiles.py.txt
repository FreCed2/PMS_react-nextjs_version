import os
import ast
import re

# Define excluded folders and files
EXCLUDED_FOLDERS = ["migrations", "tests", "venv", "__pycache__", "node_modules",
                    ".venv", "scripts for documentation", "exports", "out",
                    "logs", ".vscode", "project_documentation", "scripts_for_testing",
                    ".env", "exports", "out", "logs", ".vscode", "project_documentation",
                    "scripts_for_testing","db_backups","migrations","tests","instance", ]
EXCLUDED_FILES = ["config.py", "secrets.py", ".env", "config.py", "config.py.example", "app.log", "error.log", "kill_process_on_port_5000.py",
                  "list_all_routes.py", "list_routes.py", "logfile",]

def parse_python_file(file_path):
    """
    Parse a Python file and extract endpoints, functions, classes, and their docstrings.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=file_path)
    
    functions = []
    classes = {}
    endpoints = []

    for node in ast.walk(tree):
        # Extract Functions
        if isinstance(node, ast.FunctionDef):
            docstring = ast.get_docstring(node)
            functions.append({
                "name": node.name,
                "docstring": docstring,
            })

        # Extract Classes
        elif isinstance(node, ast.ClassDef):
            class_docstring = ast.get_docstring(node)
            methods = []
            for class_node in node.body:
                if isinstance(class_node, ast.FunctionDef):
                    method_docstring = ast.get_docstring(class_node)
                    methods.append({
                        "name": class_node.name,
                        "docstring": method_docstring,
                    })
            classes[node.name] = {
                "docstring": class_docstring,
                "methods": methods,
            }

        # Identify Flask Endpoints
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in ["route", "get", "post", "put", "delete"]:
                # Safely check for arguments and ensure it's an endpoint
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    endpoints.append({
                        "name": node.args[0].value,
                        "methods": [node.func.attr],
                    })

    return functions, classes, endpoints

def parse_javascript_file(file_path):
    """
    Parse a JavaScript file and extract functions and comments.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Match function declarations (both named and arrow functions)
    function_pattern = re.compile(r'function\s+(\w+)|(\w+)\s*=\s*\(.*?\)\s*=>')
    functions = function_pattern.findall(content)
    functions = [func[0] if func[0] else func[1] for func in functions]

    # Match comments
    comment_pattern = re.compile(r'(\/\/.*?$|\/\*[\s\S]*?\*\/)', re.MULTILINE)
    comments = comment_pattern.findall(content)

    return {
        "functions": functions,
        "comments": comments
    }

def scan_project():
    """
    Scan the project directory for Python and JavaScript files, extract their structure and docstrings, skipping excluded folders and files.
    """
    results = {}
    for root, dirs, files in os.walk("."):
        
        # Exclude folders
        dirs[:] = [d for d in dirs if d not in EXCLUDED_FOLDERS]
        
        for file in files:
            if file.endswith(".py") and file not in EXCLUDED_FILES:
                file_path = os.path.join(root, file)
                functions, classes, endpoints = parse_python_file(file_path)
                results[file_path] = {
                    "type": "python",
                    "functions": functions,
                    "classes": classes,
                    "endpoints": endpoints,
                }
            elif file.endswith(".js"):
                file_path = os.path.join(root, file)
                js_data = parse_javascript_file(file_path)
                results[file_path] = {
                    "type": "javascript",
                    "functions": js_data["functions"],
                    "comments": js_data["comments"]
                }
    return results

def save_results_to_file(results, output_path):
    """
    Save the parsed results to a file.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        for file_path, details in results.items():
            f.write(f"File: {file_path}\n")

            if details["type"] == "python":
                # Endpoints
                if details["endpoints"]:
                    f.write("  Endpoints:\n")
                    for endpoint in details["endpoints"]:
                        methods = ", ".join(endpoint["methods"])
                        f.write(f"    - {endpoint['name']} (Methods: {methods})\n")

                # Functions
                if details["functions"]:
                    f.write("  Functions:\n")
                    for func in details["functions"]:
                        f.write(f"    - {func['name']}\n")
                        if func["docstring"]:
                            f.write(f"      Docstring: {func['docstring']}\n")

                # Classes
                if details["classes"]:
                    f.write("  Classes:\n")
                    for cls_name, cls_details in details["classes"].items():
                        f.write(f"    - {cls_name}\n")
                        if cls_details["docstring"]:
                            f.write(f"      Docstring: {cls_details['docstring']}\n")
                        for method in cls_details["methods"]:
                            f.write(f"      - {method['name']}\n")
                            if method["docstring"]:
                                f.write(f"        Docstring: {method['docstring']}\n")
            elif details["type"] == "javascript":
                # JavaScript Functions
                if details["functions"]:
                    f.write("  JavaScript Functions:\n")
                    for func in details["functions"]:
                        f.write(f"    - {func}\n")

                # JavaScript Comments
                if details["comments"]:
                    f.write("  Comments:\n")
                    for comment in details["comments"]:
                        f.write(f"    {comment}\n")

            f.write("\n")
    print(f"Overview saved to {output_path}")

if __name__ == "__main__":
    # Define the output path explicitly
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_file = os.path.join(project_root, "exports", "endpoints_functions_methods_classes.txt")

    # Run the script
    results = scan_project()
    save_results_to_file(results, output_file)