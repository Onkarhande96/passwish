@echo off
title PassWish — Initial 1-Click System Setup
cd /d "%~dp0"

echo ==============================================================
echo             PassWish — Client CRM & Automated Wishes
echo                    Initial System Setup
echo ==============================================================
echo.

:: 1. Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to PATH!
    echo.
    echo Please download and install Python (Version 3.10, 3.11, or 3.12):
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANT: Make sure to check the box "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)

echo [+] Python detected:
python --version
echo.

:: 2. Install dependencies
echo [+] Installing required software packages...
echo     (This may take 1-2 minutes on first run, please wait...)
echo.
python -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] An error occurred during installation.
    echo Please check your internet connection and run this file again.
    pause
    exit /b 1
)

:: 3. Create required directories
if not exist "uploads" mkdir uploads
if not exist "backups" mkdir backups

:: 4. Initialize database tables
echo.
echo [+] Setting up database...
python -c "import database; database.init_db()"

:: 5. Create Desktop Shortcut with custom logo
echo.
echo [+] Creating PassWish Desktop Shortcut with custom logo...
python create_desktop_shortcut.py

echo.
echo ==============================================================
echo [SUCCESS] PassWish installation is complete!
echo.
echo A 'PassWish' shortcut with custom logo has been created on your Desktop.
echo You can now start the software anytime directly from your Desktop,
echo or by double-clicking: Start_PassWish.bat
echo ==============================================================
echo.
pause
