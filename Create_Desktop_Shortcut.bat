@echo off
title PassWish — Create Desktop Shortcut
cd /d "%~dp0"

echo ==============================================================
echo       PassWish — Create Desktop Shortcut with Custom Logo
echo ==============================================================
echo.
python create_desktop_shortcut.py
echo.
pause
