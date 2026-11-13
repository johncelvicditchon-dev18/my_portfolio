@echo off
cd /d "%~dp0"
echo Starting local preview at http://localhost:4173 ...
start "Portfolio preview" cmd /c "node server.mjs"
timeout /t 2 >nul
start "" "http://localhost:4173"
