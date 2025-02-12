import os
import json

def json_to_dot(input_file, output_file):
    """
    Convert a JSON representation of a directory structure into a DOT file.
    """
    def add_nodes_and_edges(data, parent=None):
        """
        Recursively add nodes and edges to the DOT graph.
        """
        for key, value in data.items():
            node_id = key.replace(".", "_").replace("-", "_")  # Sanitize node ID
            dot_lines.append(f'    "{node_id}" [label="{key}"];')
            
            if parent:
                parent_id = parent.replace(".", "_").replace("-", "_")
                dot_lines.append(f'    "{parent_id}" -> "{node_id}";')
            
            if isinstance(value, dict):  # Recursively process subdirectories
                add_nodes_and_edges(value, key)

    # Load the JSON data
    with open(input_file, "r") as f:
        data = json.load(f)

    # Initialize DOT file content
    dot_lines = ["digraph ProjectStructure {", "    node [shape=box];"]
    
    # Add nodes and edges
    add_nodes_and_edges(data)
    
    # Close the DOT graph
    dot_lines.append("}")
    
    # Write the DOT content to the output file
    with open(output_file, "w") as f:
        f.write("\n".join(dot_lines))
    
    print(f"DOT file created: {output_file}")

# Usage
if __name__ == "__main__":
    # Define the file to convert
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_folder = os.path.join(project_root, "project_documentation", "project_structure")

    # Replace "file_name" with the actual JSON file name (without extension)
    file_name = input("Enter the name of the JSON file you want to convert to DOT (without extension)?\n")
    input_json_path = os.path.join(json_folder, f"{file_name}.json")
    output_dot_path = os.path.join(json_folder, f"{file_name}.dot")

    # Call the conversion function
    json_to_dot(input_json_path, output_dot_path)