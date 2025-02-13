import json
import os

def prompt_for_file(prompt_message):
    """
    Prompt the user for a file name and return the full path.
    """
    file_name = input(prompt_message)
    return os.path.join("pythonprojects", "project_documentation", "project_structure", file_name + ".json")

def generate_dot_file(json_data, dot_file):
    """
    Convert JSON data to a DOT file for visualization.
    """
    with open(dot_file, "w") as f:
        # Add graph properties for left-to-right layout
        f.write("digraph ProjectStructure {\n")
        f.write("    rankdir=LR;\n")  # Left to right direction
        f.write("    node [shape=box];\n")
        
        # Recursive function to write nodes and edges
        def write_edges(parent, data):
            if isinstance(data, dict):
                for key, value in data.items():
                    child = f'"{key}"'
                    f.write(f'    "{parent}" -> {child};\n')
                    write_edges(key, value)
            elif data is None:
                child = parent + "_file"  # Ensures unique label for file nodes
                f.write(f'    "{parent}" -> "{child}" [label="{parent}"];\n')

        # Root node and children
        root = "Project Root"
        f.write(f'    "{root}" [label="{root}"];\n')
        for key, value in json_data.items():
            child = f'"{key}"'
            f.write(f'    "{root}" -> {child};\n')
            write_edges(key, value)
        
        f.write("}\n")
    
    print(f"DOT file created: {dot_file}")

if __name__ == "__main__":
    # Prompt the user for input file name
    input_file = prompt_for_file("What is the name of the JSON file to convert (without extension)? ")
    
    # Set output file name
    file_name = os.path.splitext(os.path.basename(input_file))[0]
    output_file = os.path.join("pythonprojects", "project_documentation", "project_structure", file_name + ".dot")
    
    # Check if the input file exists
    if not os.path.exists(input_file):
        print(f"[ERROR] The specified file '{input_file}' does not exist.")
    else:
        # Load JSON data
        with open(input_file, "r") as f:
            json_data = json.load(f)
        
        # Generate the DOT file
        generate_dot_file(json_data, output_file)