@echo off
title Talk2Tasks AI
cd /d "%~dp0"
if exist "Talk2Tasks AI.exe" (
    start "" "Talk2Tasks AI.exe"
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start_desktop.ps1"
)
