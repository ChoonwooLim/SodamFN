import re

def check_tags(filename, tag_name):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    opening = len(re.findall(f'<{tag_name}[\\s>]', content))
    closing = len(re.findall(f'</{tag_name}>', content))
    
    print(f"Tag: {tag_name}")
    print(f"Opening: {opening}")
    print(f"Closing: {closing}")
    if opening != closing:
        print("!!! MISMATCH !!!")
    else:
        print("Balanced.")

if __name__ == "__main__":
    file_path = r'c:\WORK\SodamFN\SodamApp\frontend\src\pages\StaffDetail.jsx'
    check_tags(file_path, 'button')
    check_tags(file_path, 'div')
    check_tags(file_path, 'th')
    check_tags(file_path, 'td')
    check_tags(file_path, 'tr')
    check_tags(file_path, 'table')
    check_tags(file_path, 'thead')
    check_tags(file_path, 'tbody')
