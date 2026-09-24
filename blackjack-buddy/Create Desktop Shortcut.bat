@echo off
rem Puts a "Blackjack Buddy" shortcut (with her icon) on your desktop. Safe to run again.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$dir = (Get-Location).Path; $desk = [Environment]::GetFolderPath('Desktop'); if (-not $desk) { $desk = Join-Path $HOME 'Desktop' }; $lnk = Join-Path $desk 'Blackjack Buddy.lnk'; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk); $s.TargetPath = Join-Path $dir 'Run Blackjack Buddy.bat'; $s.WorkingDirectory = $dir; $s.IconLocation = (Join-Path $dir 'icon.ico') + ',0'; $s.WindowStyle = 7; $s.Description = 'Blackjack Buddy'; $s.Save(); Write-Host ('Shortcut created: ' + $lnk)"
