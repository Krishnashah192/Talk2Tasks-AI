@echo off
title Talk2Tasks AI - Verification Diagnostic
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\verify_setup.ps1"
echo.
pause
