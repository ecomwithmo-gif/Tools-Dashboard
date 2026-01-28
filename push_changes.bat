@echo off
echo Starting automated push...

:: Check if the portable git exists
if not exist ".\.dev_tools\mingit\cmd\git.exe" (
    echo Portable Git not found. Please ask the AI to set it up again.
    pause
    exit /b
)

:: Set Git path variable
set GIT=".\.dev_tools\mingit\cmd\git.exe"

:: Add all changes
echo Adding changes...
%GIT% add .

:: Commit with a generic message (or prompt user)
echo Committing changes...
set /p buildmsg="Enter commit message (default: Update features): " || set buildmsg=Update features
%GIT% commit -m "%buildmsg%"

:: Push to main
echo Pushing to remote...
%GIT% push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo Push successful!
) else (
    echo Push failed. You might need to pull changes first or check your internet connection.
)
pause
