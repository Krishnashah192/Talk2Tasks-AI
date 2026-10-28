@echo off
title Talk2Tasks AI - Setup
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
echo.
pause
