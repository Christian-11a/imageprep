@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 24 LTS, then try again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing ImagePrep dependencies...
  call npm.cmd ci
  if errorlevel 1 (
    echo Dependencies could not be installed. Check your internet connection.
    pause
    exit /b 1
  )
)
echo Starting ImagePrep. Keep this window open while using the app.
call npm.cmd run dev -- --open
pause
