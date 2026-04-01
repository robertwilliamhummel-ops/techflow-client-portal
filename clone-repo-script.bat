@echo off
REM ====================================
REM Quick Repo Clone & Setup Script
REM ====================================

echo.
echo ============================================
echo   QUICK REPO CLONE SCRIPT
echo ============================================
echo.

REM Get source folder name
set /p SOURCE_FOLDER="Enter SOURCE folder name (e.g., techflow-client-portal): "

REM Get new folder name
set /p NEW_FOLDER="Enter NEW folder name (e.g., demo-contractor-portal): "

REM Get GitHub username
set /p GITHUB_USER="Enter your GitHub username (e.g., robertwilliamhummel-ops): "

echo.
echo ============================================
echo   STEP 1: Creating GitHub Repo
echo ============================================
echo.
echo IMPORTANT: Go to GitHub and create the repo NOW:
echo https://github.com/new
echo.
echo Repository name: %NEW_FOLDER%
echo Make it PRIVATE or PUBLIC (your choice)
echo DO NOT initialize with README
echo.
pause
echo.

echo ============================================
echo   STEP 2: Copying Files
echo ============================================
echo.

REM Go to parent directory
cd ..

REM Copy folder
echo Copying %SOURCE_FOLDER% to %NEW_FOLDER%...
xcopy %SOURCE_FOLDER% %NEW_FOLDER% /E /I /Q

REM Enter new folder
cd %NEW_FOLDER%

echo.
echo ============================================
echo   STEP 3: Cleaning Up
echo ============================================
echo.

REM Remove node_modules if it exists
if exist node_modules (
    echo Removing old node_modules...
    rmdir /s /q node_modules
)

REM Remove .git if it exists
if exist .git (
    echo Removing old .git...
    rmdir /s /q .git
)

echo.
echo ============================================
echo   STEP 4: Git Setup
echo ============================================
echo.

REM Initialize git
echo Initializing git...
git init

REM Add all files
echo Adding files...
git add .

REM Commit
echo Committing...
git commit -m "Initial commit - cloned from %SOURCE_FOLDER%"

REM Rename branch to main
echo Renaming branch to main...
git branch -M main

REM Add remote
echo Adding remote...
git remote add origin https://github.com/%GITHUB_USER%/%NEW_FOLDER%

echo.
echo ============================================
echo   STEP 5: Pushing to GitHub
echo ============================================
echo.

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin main

echo.
echo ============================================
echo   SUCCESS!
echo ============================================
echo.
echo Your new repo is ready at:
echo https://github.com/%GITHUB_USER%/%NEW_FOLDER%
echo.
echo Local folder: %CD%
echo.
pause