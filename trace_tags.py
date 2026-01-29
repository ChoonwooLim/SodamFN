import re

def find_unbalanced(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        # Very simple regex to find divs and buttons
        tags = re.findall(r'<(div|button|th|td|tr|table|thead|tbody)[^>]*>|</(div|button|th|td|tr|table|thead|tbody)>', line)
        for tag_pair in tags:
            opening, closing = tag_pair
            if opening:
                # Filter out self-closing tags like <div /> if any (rare in this file)
                if not opening.endswith('/'):
                    tag_name = opening.split()[0].replace('<', '')
                    stack.append((tag_name, i + 1))
            elif closing:
                tag_name = closing.replace('</', '').replace('>', '')
                if not stack:
                    print(f"Unexpected closing tag </{tag_name}> at line {i + 1}")
                else:
                    last_tag, start_line = stack.pop()
                    if last_tag != tag_name:
                        print(f"Mismatched tag: opened <{last_tag}> at line {start_line}, closed with </{tag_name}> at line {i + 1}")
    
    while stack:
        tag_name, line_no = stack.pop()
        print(f"Unclosed tag <{tag_name}> opened at line {line_no}")

if __name__ == "__main__":
    find_unbalanced(r'c:\WORK\SodamFN\SodamApp\frontend\src\pages\StaffDetail.jsx')
