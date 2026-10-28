@echo off
title Talk2Tasks AI - Desktop Companion Launcher
cd /d "%~dp0"
echo ==========================================================
echo  Talk2Tasks AI - Floating Desktop Meeting Companion
echo ==========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start_desktop.ps1"
pause
