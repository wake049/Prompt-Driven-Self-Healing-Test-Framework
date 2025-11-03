#!/usr/bin/env python3
"""
Command-line entry point for MCP server
"""

import sys
import os
from pathlib import Path

# Add the project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

def main():
    """Main entry point"""
    # Import and run the main function from main.py
    import asyncio
    from .main import main as async_main
    asyncio.run(async_main())

if __name__ == "__main__":
    main()