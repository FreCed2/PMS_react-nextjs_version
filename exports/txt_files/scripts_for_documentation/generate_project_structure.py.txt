import os

def generate_project_structure(output_file="project_structure_30dec_2024.txt"):
    project_root = os.getcwd()  # Get the current working directory
    with open(output_file, "w") as f:
        for root, dirs, files in os.walk(project_root):
            # Calculate the indentation level based on directory depth
            level = root.replace(project_root, "").count(os.sep)
            indent = " " * 4 * level
            f.write(f"{indent}{os.path.basename(root)}/\n")
            sub_indent = " " * 4 * (level + 1)
            for file in files:
                f.write(f"{sub_indent}{file}\n")
    print(f"Project structure saved to {output_file}")

# Run the script
if __name__ == "__main__":
    generate_project_structure()