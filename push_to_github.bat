@echo off
setlocal
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo ===================================================
echo     PassWish -- GitHub Push Helper
echo ===================================================
echo.

git status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not initialized.
    pause
    exit /b 1
)

set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/passwish.git): "
if "%REPO_URL%"=="" (
    echo [ERROR] No URL entered.
    pause
    exit /b 1
)

echo.
echo [1/3] Setting remote origin...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [2/3] Adding changes and committing...
git add .
git commit -m "update: PassWish production sync" >nul 2>&1

echo [3/3] Pushing to GitHub (main branch)...
git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Code pushed to GitHub successfully!
    echo Now open Render.com to deploy your Web Service.
) else (
    echo [NOTE] Push failed. If this is a private repo, ensure you are logged into GitHub.
)
echo.
pause
