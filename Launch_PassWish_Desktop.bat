@echo off
title PassWish — Customer CRM & Automated Wishes Desk
cd /d "%~dp0"

echo ==============================================================
echo             PassWish — Native Desktop App
echo ==============================================================
echo Starting native desktop window...
echo.

python desktop_app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Notice: Desktop window encountered an error.
    echo Launching standard browser mode fallback at http://127.0.0.1:5000...
    timeout /t 1 >nul
    start "" "http://127.0.0.1:5000"
    python app.py
)
