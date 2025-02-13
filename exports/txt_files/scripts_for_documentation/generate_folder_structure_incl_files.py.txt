import os
import json
from datetime import datetime

def generate_project_structure():
    """
    Generate a textual and JSON representation of the project's folder and file structure.
    """
    # Get the current working directory
    project_root = os.getcwd()

    # Excluded directories and files
    excluded_dirs = {"venv", ".venv", ".vscode", ".idea", "instance", ".git", "out", ".pytest_cache", "__pycache__", "project_documentation",
                     "exports", "scripts_for_creating_documentation", "generated_diagrams", "scripts_for_testing"}
    excluded_files = {"config.json", "README.md"}

    # Get today's date and time for the filenames
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    text_output_file = f"project_structure_tree_{timestamp}.txt"
    json_output_file = f"project_structure_{timestamp}.json"

    # Data to hold the structure
    project_structure = {}

    # Generate the folder structure
    def build_tree(root_dir, current_level=0):
        tree = {}
        for item in sorted(os.listdir(root_dir)):
            item_path = os.path.join(root_dir, item)
            if os.path.isdir(item_path) and item not in excluded_dirs:
                tree[item] = build_tree(item_path, current_level + 1)
            elif os.path.isfile(item_path) and item not in excluded_files:
                tree[item] = None
        return tree

    project_structure = build_tree(project_root)

    # Write the text tree structure with lines connecting folders
    def write_text_tree(tree, prefix="", is_last=True, level=0):
        text_tree = ""
        for idx, (name, content) in enumerate(tree.items()):
            is_folder = content is not None
            connector = "└── " if is_last else "├── "
            text_tree += f"{prefix}{connector}{name}/\n" if is_folder else f"{prefix}{connector}{name}\n"

            if is_folder and content:
                extension = "    " if is_last else "│   "
                text_tree += write_text_tree(content, prefix + extension, idx == len(tree) - 1, level + 1)
        return text_tree

    tree_text = write_text_tree(project_structure)

    # Save the text tree to a file
    with open(text_output_file, "w", encoding="utf-8") as text_file:
        text_file.write(tree_text)
        text_file.write("\nExcluded Folders:\n")
        text_file.write("\n".join(f"  - {d}" for d in excluded_dirs))
        text_file.write("\n\nExcluded Files:\n")
        text_file.write("\n".join(f"  - {f}" for f in excluded_files))

    # Save the JSON structure to a file
    with open(json_output_file, "w", encoding="utf-8") as json_file:
        json.dump(project_structure, json_file, indent=4)

    print(f"Tree structure saved to {text_output_file}")
    print(f"JSON structure saved to {json_output_file}")

# Run the script
if __name__ == "__main__":
    generate_project_structure()