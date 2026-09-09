@echo off
rem MSIGN - double-click to install the app on an Android TV over Wi-Fi (asks for the TV's IP).
rem Pass IPs on the command line to skip the prompt:  "Install to TV.cmd" 192.168.1.50 192.168.1.51
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-to-tv.ps1" %*
echo.
pause
