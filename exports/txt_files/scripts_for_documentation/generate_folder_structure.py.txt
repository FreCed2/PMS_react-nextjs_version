import os

def generate_project_structure(output_file="project_structure_tree.txt"):
    """
    Generate a textual representation of the project's folder structure as a tree, excluding files.
    """
    project_root = os.getcwd()  # Get the current working directory
    excluded_dirs = {"venv",".venv", ".vscode", ".idea", "instance", ".git", "out", ".pytest_cache", "__pycache__"}  # Add any directories to exclude

    with open(output_file, "w") as f:
        for root, dirs, _ in os.walk(project_root):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in excluded_dirs]

            # Calculate the depth of the current directory
            level = root.replace(project_root, "").count(os.sep)
            
            # Build the tree line prefixes
            indent = "    " * (level - 1) + "|-- " if level > 0 else ""
            folder_name = os.path.basename(root)
            
            # Write the formatted folder to the file
            f.write(f"{indent}{folder_name}/\n")
    
    print(f"Folder tree structure saved to {output_file}")

# Run the script
if __name__ == "__main__":
    generate_project_structure()
    