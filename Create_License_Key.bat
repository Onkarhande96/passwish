@echo off
title PassWish — Commercial License Generator
cd /d "%~dp0"

python license_generator_gui.py

if %errorlevel% neq 0 (
    echo.
    echo ==============================================================
    echo [ERROR] Could not start the License Generator.
    echo Please make sure Python is installed and available in PATH.
    echo ==============================================================
    pause
)
