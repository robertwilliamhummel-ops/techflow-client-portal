@echo off
REM =============================================
REM  InvoicePro Portal Clone Script
REM  Based on FULL_CLONE_SETUP_GUIDE_2.md
REM =============================================

echo.
echo =============================================
echo   INVOICEPRO PORTAL CLONE SCRIPT
echo =============================================
echo.

REM Get source folder name
set /p SOURCE_FOLDER="Enter SOURCE folder name (e.g., techflow-client-portal): "

REM Get new folder name
set /p NEW_FOLDER="Enter NEW folder name (e.g., client-name-portal): "

REM Get GitHub username
set /p GITHUB_USER="Enter your GitHub username (e.g., robertwilliamhummel-ops): "

echo.
echo =============================================
echo   STEP 1: Create GitHub Repo FIRST
echo =============================================
echo.
echo Go to: https://github.com/new
echo.
echo   Repository name: %NEW_FOLDER%
echo   Make it PRIVATE or PUBLIC (your choice)
echo   DO NOT initialize with README
echo   DO NOT add .gitignore
echo   DO NOT choose a license
echo.
pause
echo.

echo =============================================
echo   STEP 2: Copying Files
echo =============================================
echo.

REM Go to parent directory
cd ..

REM Copy folder (excluding junk)
echo Copying %SOURCE_FOLDER% to %NEW_FOLDER%...
xcopy %SOURCE_FOLDER% %NEW_FOLDER% /E /I /Q /EXCLUDE:%SOURCE_FOLDER%\clone-exclude.txt

REM Enter new folder
cd %NEW_FOLDER%

echo.
echo =============================================
echo   STEP 3: Cleaning Up
echo =============================================
echo.

REM Remove node_modules (root)
if exist node_modules (
    echo Removing root node_modules...
    rmdir /s /q node_modules
)

REM Remove functions/node_modules
if exist functions\node_modules (
    echo Removing functions/node_modules...
    rmdir /s /q functions\node_modules
)

REM Remove .git (old repo history)
if exist .git (
    echo Removing old .git history...
    rmdir /s /q .git
)

REM Remove .firebaserc (hardcoded to old project ID)
if exist .firebaserc (
    echo Removing old .firebaserc...
    del /q .firebaserc
)

REM Remove Docs folder (not needed for client portals)
if exist Docs (
    echo Removing Docs folder...
    rmdir /s /q Docs
)

REM Remove this script from the clone
if exist clone-repo-script.bat (
    echo Removing clone script...
    del /q clone-repo-script.bat
)

REM Remove clone-exclude.txt if it got copied
if exist clone-exclude.txt (
    del /q clone-exclude.txt
)

echo.
echo   Cleaned: node_modules, .git, .firebaserc, Docs
echo.

echo =============================================
echo   STEP 4: Git Setup
echo =============================================
echo.

git init
git add .
git commit -m "Initial commit - cloned from %SOURCE_FOLDER%"
git branch -M main
git remote add origin https://github.com/%GITHUB_USER%/%NEW_FOLDER%

echo.
echo =============================================
echo   STEP 5: Pushing to GitHub
echo =============================================
echo.

git push -u origin main

echo.
echo =============================================
echo   SUCCESS! Git setup complete.
echo =============================================
echo.
echo Repo: https://github.com/%GITHUB_USER%/%NEW_FOLDER%
echo Local: %CD%
echo.
echo =============================================
echo   NEXT STEPS (follow FULL_CLONE_SETUP_GUIDE_2.md)
echo =============================================
echo.
echo   1. Create Firebase project at console.firebase.google.com
echo   2. Enable Firestore + Authentication (Email/Password)
echo   3. Register web app and copy firebaseConfig
echo   4. Update src/config/firebase.js with new credentials
echo   5. Create .firebaserc: {"projects":{"default":"NEW-PROJECT-ID"}}
echo   6. Update public/CNAME with new domain
echo   7. Update src/config/client.js with client branding
echo   8. Run: npm install
echo   9. Run: cd functions ^&^& npm install ^&^& cd ..
echo  10. Run: firebase use NEW-PROJECT-ID
echo  11. Set secrets: firebase functions:secrets:set STRIPE_SECRET_KEY
echo  12. Set secrets: firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
echo  13. Set secrets: firebase functions:secrets:set ZOHO_EMAIL_PASSWORD
echo  14. Run: firebase deploy
echo  15. Copy Firestore rules from source project
echo  16. Create test auth user in Firebase Console
echo  17. Update admins collection with new UID
echo  18. Configure GitHub Pages source to "GitHub Actions"
echo  19. Set custom domain in GitHub Pages settings
echo  20. Test full flow (admin + client)
echo.
echo For details on each step, see Docs/FULL_CLONE_SETUP_GUIDE_2.md
echo in the SOURCE repo (not this clone).
echo.
pause
