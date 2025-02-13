import os
import ast

directory = '/Users/fredrik_cederborg/CodingProjects/pythonProject/app'
filepath = '/Users/fredrik_cederborg/CodingProjects/pythonProject/app/api_routes.py'

def extract_variables_from_file(filepath):
    """
    Extracts variable names from a Python file.
    
    Args:
        filepath (str): Path to the Python file.
    
    Returns:
        dict: Dictionary with variable names categorized by scope (global, class, function).
    """
    with open(filepath, "r", encoding="utf-8") as file:
        content = file.read()

    tree = ast.parse(content)
    variables = {
        "globals": set(),
        "class_variables": {},
        "function_variables": {}
    }

    class VariableVisitor(ast.NodeVisitor):
        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    variables["globals"].add(target.id)
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            function_name = node.name
            local_vars = set()
            for sub_node in ast.walk(node):
                if isinstance(sub_node, ast.Assign):
                    for target in sub_node.targets:
                        if isinstance(target, ast.Name):
                            local_vars.add(target.id)
                elif isinstance(sub_node, ast.arg):
                    local_vars.add(sub_node.arg)
            variables["function_variables"][function_name] = local_vars
            self.generic_visit(node)

        def visit_ClassDef(self, node):
            class_name = node.name
            class_vars = set()
            for sub_node in ast.walk(node):
                if isinstance(sub_node, ast.Assign):
                    for target in sub_node.targets:
                        if isinstance(target, ast.Name):
                            class_vars.add(target.id)
            variables["class_variables"][class_name] = class_vars
            self.generic_visit(node)

    visitor = VariableVisitor()
    visitor.visit(tree)
    return variables


def extract_variables_from_directory(directory):
    """
    Recursively extracts variables from all Python files in a directory.
    
    Args:
        directory (str): Path to the directory.
    
    Returns:
        dict: Aggregated variable names across all files.
    """
    all_variables = {
        "globals": set(),
        "class_variables": {},
        "function_variables": {}
    }

    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                print(f"Processing {filepath}...")
                file_variables = extract_variables_from_file(filepath)

                # Merge globals
                all_variables["globals"].update(file_variables["globals"])

                # Merge class variables
                for cls, vars in file_variables["class_variables"].items():
                    if cls not in all_variables["class_variables"]:
                        all_variables["class_variables"][cls] = set()
                    all_variables["class_variables"][cls].update(vars)

                # Merge function variables
                for func, vars in file_variables["function_variables"].items():
                    if func not in all_variables["function_variables"]:
                        all_variables["function_variables"][func] = set()
                    all_variables["function_variables"][func].update(vars)

    return all_variables


def save_variables_to_file(variables, output_file):
    """
    Saves extracted variables to a file in a readable format.
    
    Args:
        variables (dict): Dictionary of variables.
        output_file (str): Path to the output file.
    """
    with open(output_file, "w", encoding="utf-8") as file:
        file.write("Global Variables:\n")
        file.write("\n".join(sorted(variables["globals"])))
        file.write("\n\nClass Variables:\n")
        for cls, vars in variables["class_variables"].items():
            file.write(f"{cls}:\n")
            file.write("  " + "\n  ".join(sorted(vars)) + "\n")
        file.write("\nFunction Variables:\n")
        for func, vars in variables["function_variables"].items():
            file.write(f"{func}:\n")
            file.write("  " + "\n  ".join(sorted(vars)) + "\n")


if __name__ == "__main__":
    # Specify the directory containing your Python code
    directory_to_scan = "/Users/fredrik_cederborg/CodingProjects/pythonProject/app"  # Change to your code directory
    output_file = "extracted_variables.txt"

    variables = extract_variables_from_directory(directory_to_scan)
    save_variables_to_file(variables, output_file)
    print(f"Variable extraction complete. Results saved to {output_file}.")
    