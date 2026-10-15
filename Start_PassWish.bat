@echo off
title PassWish — Customer CRM & Automated Wishes
cd /d "%~dp0"

echo ==============================================================
echo             PassWish — Client CRM & Automated Wishes
echo ==============================================================
echo Starting PassWish...
echo Default Login: admin / admin123 (Changeable in Profile tab)
echo.

:: Check if desktop window mode is available
if exist "desktop_app.py" (
    echo [+] Launching PassWish Desktop App window...
    python desktop_app.py
    if %ERRORLEVEL% EQU 0 exit /b 0
    echo [!] Notice: Switching to browser mode...
)

:: Fallback browser launch
timeout /t 1 >nul
start "" "http://127.0.0.1:5000"
python app.py

pause
