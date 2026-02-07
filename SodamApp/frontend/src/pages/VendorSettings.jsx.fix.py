import os

file_path = r"c:\WORK\SodamFN\SodamApp\frontend\src\pages\VendorSettings.jsx"

def fix_file():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Check if file is indeed corrupted as expected
    # Look for the line 'import {useNavigate}...' which should be proper start (after useEffect)
    
    start_index = -1
    for i, line in enumerate(lines):
        if "import { useNavigate }" in line or "import {useNavigate}" in line:
            # Found the anchor.
            # Check if it has indentation.
            if line.strip().startswith("import"):
                start_index = i
                break
    
    if start_index == -1:
        print("Could not find anchor 'import { useNavigate }'. Aborting.")
        return

    print(f"Found anchor at line {start_index + 1}: {lines[start_index]}")
    
    # We expect lines before this to be garbage (the pasted code).
    # We want to replace lines[:start_index] with the correct first line.
    
    # Also strip indentation if present in the rest of the file?
    # View file showed indentation on line 101.
    # If the rest of the file is indented by 8 spaces, we should dedent it.
    
    rest_of_file = lines[start_index:]
    
    # Check indentation of the anchor line
    anchor_line = lines[start_index]
    indentation = len(anchor_line) - len(anchor_line.lstrip())
    
    if indentation > 0:
        print(f"Detected indentation of {indentation} spaces. Dedenting file...")
        rest_of_file = [line[indentation:] if len(line) >= indentation else line.lstrip() for line in rest_of_file]
        
    new_content = ["import { useEffect, useState } from 'react';\n"] + rest_of_file
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_content)
        
    print("File fixed successfully.")

if __name__ == "__main__":
    fix_file()
