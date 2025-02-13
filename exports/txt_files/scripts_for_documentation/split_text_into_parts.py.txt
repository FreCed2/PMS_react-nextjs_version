def split_text_into_parts(file_path, num_parts=5):
    """
    Splits a text file into approximately equal parts and saves them as separate files.
    
    :param file_path: Path to the original text file
    :param num_parts: Number of parts to divide the text into
    """
    # Read the content of the file
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
    
    # Calculate section length
    section_length = len(content) // num_parts
    
    # Split content into parts
    split_sections = [content[i * section_length: (i + 1) * section_length] for i in range(num_parts)]
    
    # Append remainder to the last section
    split_sections[-1] += content[num_parts * section_length:]
    
    # Save each part as a separate file
    file_paths = []
    for i, section in enumerate(split_sections):
        part_file_path = f"{file_path}_Part_{i+1}.txt"
        with open(part_file_path, "w", encoding="utf-8") as file:
            file.write(section)
        file_paths.append(part_file_path)
    
    return file_paths

# Example usage:
file_path = "Coding_Session_3_feb_2025.txt"
num_parts = 5
split_files = split_text_into_parts(file_path, num_parts)
print("Files created:", split_files)