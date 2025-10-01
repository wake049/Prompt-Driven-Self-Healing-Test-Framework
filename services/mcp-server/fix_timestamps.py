#!/usr/bin/env python3
"""
Fix UTC timestamps in server.py
"""

import re

def fix_timestamps():
    """Fix all datetime.now() calls to use UTC timezone"""
    file_path = "c:\\Users\\Wakeb\\capstone-self-healing\\services\\mcp-server\\server.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace datetime.now().isoformat() with datetime.now(timezone.utc).isoformat()
    content = re.sub(
        r'datetime\.now\(\)\.isoformat\(\)',
        'datetime.now(timezone.utc).isoformat()',
        content
    )
    
    # Replace datetime.now() with datetime.now(timezone.utc) for other cases
    content = re.sub(
        r'datetime\.now\(\)(?!\.)',
        'datetime.now(timezone.utc)',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed all datetime references to use UTC timezone")

if __name__ == "__main__":
    fix_timestamps()