import os
import shutil
from pathlib import Path

# List of file extensions to include
extensions = ["py", "js", "html", "css", "json", "md", "yaml", "yml", "txt", "sh", "xml"]

# Root directory to search files
source_root = Path(".")

# Directory to export the txt-converted files
export_dir = Path("exports/txt_files")

# Patterns or specific files to exclude
exclude_patterns = [
    ".git",        # Git directories
    "exports",     # Export directory itself
    "__pycache__", # Python cache
    "venv",        # Virtual environments
    "README.md",   # Specific file
    "example.js"   # Another specific file to exclude
]

# Ensure the export directory exists
export_dir.mkdir(parents=True, exist_ok=True)

# Function to check if a file should be excluded
def should_exclude(file_path):
    return any(pattern in str(file_path) for pattern in exclude_patterns)

# Traverse and process files
for ext in extensions:
    for file_path in source_root.rglob(f"*.{ext}"):
        # Skip excluded files or directories
        if should_exclude(file_path):
            continue
        
        # Determine relative and target paths
        relative_path = file_path.relative_to(source_root)
        target_path = export_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Handle txt files differently
        if file_path.suffix == ".txt":
            shutil.copy(file_path, target_path)
        else:
            target_path = target_path.with_suffix(target_path.suffix + ".txt")
            shutil.copy(file_path, target_path)

print("Export complete!")