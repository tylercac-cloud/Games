@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Node.js is required. Install it from https://nodejs.org ^(LTS, defaults are fine^), then run this file again.
    pause
    exit /b 1
  )
  echo First run: downloading Electron ^(about 100 MB^). This takes a minute...
  call npm install --no-audit --no-fund
  if not exist "node_modules\electron\dist\electron.exe" (
    echo Something went wrong with the download. Check your internet connection and run this again.
    pause
    exit /b 1
  )
  rem first run only: add a desktop shortcut with her icon (delete it any time)
  call "Create Desktop Shortcut.bat" >nul 2>nul
)
start "" "node_modules\electron\dist\electron.exe" .
