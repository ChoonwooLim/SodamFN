import re

file_path = r"c:\WORK\SodamFN\SodamApp\frontend\src\pages\VendorSettings.jsx"

def fix_syntax():
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        original = line
        
        # Repair useEffect
        if re.search(r'^\s*ffect\(\(\) => {', line):
            print(f"Fixing useEffect: {line.strip()}")
            line = re.sub(r'^\s*ffect\(\(\) => {', '    useEffect(() => {', line)
            
        # Repair mismatched closing deps
        if re.search(r'^\s*selectedDate\]\);', line):
             print(f"Fixing deps: {line.strip()}")
             line = '    }, [selectedDate]);\n'
             
        if re.search(r'^\s*activeTab\]\);', line):
             print(f"Fixing deps: {line.strip()}")
             line = '    }, [activeTab]);\n'
             
        # Repair comments
        if re.search(r'^\s*eset category', line):
             print(f"Fixing comment: {line.strip()}")
             line = '    // Reset category when tab changes\n'
             
        if re.search(r'^\s*erge handlers', line):
             print(f"Fixing comment: {line.strip()}")
             line = '    // Merge handlers\n'
             
        if re.search(r'^\s*onthly Stats State', line):
             print(f"Fixing comment: {line.strip()}")
             line = '    // Monthly Stats State\n'
             
        if re.search(r'^\s*orting State', line):
             print(f"Fixing comment: {line.strip()}")
             line = '    // Sorting State\n'
             
        new_lines.append(line)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("Fixed syntax errors.")

if __name__ == "__main__":
    fix_syntax()
