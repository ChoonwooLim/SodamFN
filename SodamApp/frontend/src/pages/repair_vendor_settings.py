import re

file_path = r"c:\WORK\SodamFN\SodamApp\frontend\src\pages\VendorSettings.jsx"

def repair_file():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        # Fix 't ' -> 'const ' at start of line (ignoring indentation)
        # Regex: ^(\s*)t (\w+)
        
        # Check for specific broken patterns seen
        if re.match(r'^\s*t\s+\w+', line):
            print(f"Fixing line: {line.strip()}")
            line = re.sub(r'(^\s*)t\s+', r'\1const ', line)
        
        new_lines.append(line)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("Repaired file.")

if __name__ == "__main__":
    repair_file()
