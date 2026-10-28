# Talk2Tasks AI - Windows Desktop Companion Launcher
# Launches Python Backend, Vite Server, and Electron Desktop Application
# Run with: powershell -ExecutionPolicy Bypass -File scripts\start_desktop.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Talk2Tasks AI - Floating Desktop Meeting Companion      " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backendPython = Join-Path $projectRoot "backend\venv\Scripts\python.exe"

# 1. Verify Backend
if (-not (Test-Path $backendPython)) {
    Write-Host "[ERROR] Backend virtualenv not found. Running setup..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File "$projectRoot\scripts\setup.ps1"
}

# 2. Check or Start Backend
$backendRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 2 -ErrorAction Stop
    if ($res.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "[OK] Backend is already running on http://127.0.0.1:8000" -ForegroundColor Green
    }
} catch {
    # Not running
}

$backendProc = $null
if (-not $backendRunning) {
    Write-Host "Starting FastAPI backend server..." -ForegroundColor Yellow
    $backendProc = Start-Process -FilePath $backendPython `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory "$projectRoot\backend" `
        -PassThru

    Start-Sleep -Seconds 2
}

# 3. Check or Start Vite Dev Server
$viteRunning = $false
try {
    $viteCheck = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -ErrorAction Stop
    $viteRunning = $true
    Write-Host "[OK] Vite dev server is already running on http://localhost:5173" -ForegroundColor Green
} catch {
    # Not running
}

$viteProc = $null
if (-not $viteRunning) {
    Write-Host "Starting Vite frontend server..." -ForegroundColor Yellow
    $viteProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev" `
        -WorkingDirectory "$projectRoot\frontend" `
        -PassThru

    Start-Sleep -Seconds 3
}

# 4. Launch Electron Desktop Shell
Write-Host "`nLaunching Electron Desktop Application..." -ForegroundColor Cyan
Write-Host "  * Main Dashboard Window (1280x850)" -ForegroundColor Gray
Write-Host "  * Floating Mascot Companion Window (340x460, Always-on-Top)" -ForegroundColor Gray
Write-Host "  * Windows System Tray Icon & Background Execution" -ForegroundColor Gray
Write-Host ""

Set-Location "$projectRoot\frontend"

try {
    & npx electron .
} finally {
    Write-Host "`nShutting down desktop processes..." -ForegroundColor Yellow
    if ($viteProc -and -not $viteProc.HasExited) {
        Stop-Process -Id $viteProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] All processes stopped." -ForegroundColor Green
}
