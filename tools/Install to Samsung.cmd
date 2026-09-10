@echo off
rem MSIGN - double-click to build, sign and install the Tizen app on a Samsung TV over Wi-Fi.
rem Pass IPs on the command line to skip the prompt:  "Install to Samsung.cmd" 192.168.1.60
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-to-samsung.ps1" %*
echo.
pause
