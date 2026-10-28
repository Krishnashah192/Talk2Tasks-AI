# Talk2Tasks AI - Windows Environment Setup Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      Talk2Tasks AI - Local Meeting Intelligence Setup     " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# 1. Check Python
Write-Host "[1/5] Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py -3.10"
    $pyVer = py --version 2>&1
    Write-Host "  [OK] Found Python Launcher: $pyVer" -ForegroundColor Green
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
    $pyVer = python --version 2>&1
    Write-Host "  [OK] Found Python: $pyVer" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Python not found! Please install Python 3.10+ from python.org." -ForegroundColor Red
    exit 1
}

# 2. Check Node & npm
Write-Host "`n[2/5] Checking Node.js and npm..." -ForegroundColor Yellow
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    $nodeVer = node -v
    $npmVer = npm -v
    Write-Host "  [OK] Found Node.js: $nodeVer" -ForegroundColor Green
    Write-Host "  [OK] Found npm: $npmVer" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Node.js or npm not found! Please install Node.js (v18+) from nodejs.org." -ForegroundColor Red
    exit 1
}

# 3. Check FFmpeg (Optional for Whisper audio preprocessing)
Write-Host "`n[3/5] Checking FFmpeg audio decoder..." -ForegroundColor Yellow
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Found FFmpeg in PATH" -ForegroundColor Green
} else {
    Write-Host "  [INFO] FFmpeg not found in PATH. Audio upload decoding will use python-av fallback." -ForegroundColor Cyan
    Write-Host "         (To install on Windows: choco install ffmpeg or winget install Gyan.FFmpeg)" -ForegroundColor DarkGray
}

# 4. Check Ollama (Optional for live local LLM)
Write-Host "`n[4/5] Checking Local LLM (Ollama)..." -ForegroundColor Yellow
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Found Ollama executable" -ForegroundColor Green
    try {
        $ollamaRes = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
        $modelCount = $ollamaRes.models.Count
        Write-Host "  [OK] Ollama service is RUNNING ($modelCount models installed)" -ForegroundColor Green
    } catch {
        Write-Host "  [INFO] Ollama service is not currently running. Start it with 'ollama serve'." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [INFO] Ollama not detected. The application will use its built-in" -ForegroundColor Cyan
    Write-Host '         deterministic AI extraction engine (offline guaranteed demo).' -ForegroundColor Cyan
}

# 5. Setup Backend Virtual Environment & Dependencies
Write-Host "`n[5/5] Setting up Backend and Frontend Dependencies..." -ForegroundColor Yellow
$backendVenv = Join-Path $projectRoot "backend\venv"
$backendPython = Join-Path $backendVenv "Scripts\python.exe"

if (-not (Test-Path $backendPython)) {
    Write-Host "  Creating Python virtual environment in backend\venv..." -ForegroundColor Gray
    if ($pythonCmd -eq "py -3.10") {
        py -3.10 -m venv "$backendVenv"
    } else {
        python -m venv "$backendVenv"
    }
}

Write-Host "  Installing backend packages from requirements.txt..." -ForegroundColor Gray
& "$backendPython" -m pip install -q -r "$projectRoot\backend\requirements.txt"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Backend packages installed successfully." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Issue installing some backend packages. Check pip logs." -ForegroundColor Yellow
}

# Setup Frontend
Write-Host "  Installing frontend packages..." -ForegroundColor Gray
Set-Location "$projectRoot\frontend"
npm install --silent
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Frontend packages installed successfully." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Failed installing frontend packages." -ForegroundColor Red
}

Set-Location $projectRoot

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "                 SETUP COMPLETE!                          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start.ps1" -ForegroundColor Cyan
Write-Host ""
