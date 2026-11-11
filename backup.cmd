@echo off
rem Double-click to back up the VEASNA database now. Drag a folder (e.g. on a USB stick) onto this
rem file to save the backup there instead. See apps/backend/README.md, "Backups".
cd /d "%~dp0"
call npm run backup -- %1
pause
