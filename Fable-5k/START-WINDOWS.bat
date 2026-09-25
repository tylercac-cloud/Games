@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "%~dp0market-scan\server.py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is required for the local launcher. Install it from python.org, then run this file again.
    pause
    exit /b 1
  )
  python "%~dp0market-scan\server.py"
)
pause
