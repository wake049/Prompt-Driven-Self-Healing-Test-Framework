@echo off
cd /d "%~dp0"
echo Starting MCP Server on ws://localhost:8765
call .venv\Scripts\activate.bat
set MCP_AUTH_TOKEN=devtoken
python main.py --ws --token devtoken
pause