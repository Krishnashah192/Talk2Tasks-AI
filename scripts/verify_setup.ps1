# Talk2Tasks AI - Environment Verification Diagnostic
# Run with: powershell -ExecutionPolicy Bypass -File scripts\verify_setup.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     Talk2Tasks AI - Environment Verification Diagnostic   " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backendPython = Join-Path $projectRoot "backend\venv\Scripts\python.exe"

if (-not (Test-Path $backendPython)) {
    Write-Host "[FAIL] Python environment not found at backend\venv\Scripts\python.exe" -ForegroundColor Red
    Write-Host "Please run scripts\setup.ps1 first." -ForegroundColor Yellow
    exit 1
}

# 1. Run Python Backend Diagnostics
Write-Host "[1/3] Running Python Backend Diagnostics..." -ForegroundColor Yellow
Set-Location "$projectRoot\backend"
& "$backendPython" "test_env.py"
$pyCode = $LASTEXITCODE
Set-Location $projectRoot

if ($pyCode -ne 0) {
    Write-Host "`n[FAIL] Backend checks failed with exit code $pyCode." -ForegroundColor Red
    exit 1
}

# 2. Check Ollama LLM endpoint
Write-Host "`n[2/3] Checking Ollama Local LLM..." -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
    $modelCount = $res.models.Count
    Write-Host "  [OK] Ollama is online with $modelCount models available." -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Ollama service not running at http://localhost:11434." -ForegroundColor Cyan
    Write-Host "         The application will automatically use its built-in" -ForegroundColor Cyan
    Write-Host '         deterministic AI fallback engine (offline guaranteed demo).' -ForegroundColor Cyan
}

# 3. Check Frontend node_modules & build
Write-Host "`n[3/3] Checking Frontend Environment..." -ForegroundColor Yellow
if (Test-Path "$projectRoot\frontend\node_modules") {
    Write-Host "  [OK] Frontend node_modules present." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Frontend node_modules missing. Run 'npm install' inside frontend." -ForegroundColor Yellow
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "         VERIFICATION COMPLETE - SYSTEM IS READY!          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To launch the complete application:" -ForegroundColor White
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start.ps1" -ForegroundColor Cyan
Write-Host ""
