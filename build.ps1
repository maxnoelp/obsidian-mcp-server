# Obsidian MCP - Windows Build Script
# Baut Python-Server als .exe und bundelt ihn mit dem Obsidian Plugin

param(
    [switch]$SkipServer,
    [switch]$SkipPlugin
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "=== Obsidian MCP Build ===" -ForegroundColor Cyan

# ── 1. Python Server bauen ────────────────────────────────────────────────────
if (-not $SkipServer) {
    Write-Host "`n[1/3] Python-Server bauen..." -ForegroundColor Yellow
    Set-Location "$Root\server"

    pip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) { throw "pip install fehlgeschlagen" }

    pip install pyinstaller -q
    if ($LASTEXITCODE -ne 0) { throw "pyinstaller install fehlgeschlagen" }

    pyinstaller obsidian-mcp.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller Build fehlgeschlagen" }

    $exe = "$Root\server\dist\obsidian-mcp-server.exe"
    if (-not (Test-Path $exe)) { throw "Executable nicht gefunden: $exe" }

    $sizeMB = [math]::Round((Get-Item $exe).Length / 1MB, 1)
    Write-Host "   Server gebaut: $exe ($sizeMB MB)" -ForegroundColor Green
} else {
    Write-Host "`n[1/3] Server-Build uebersprungen (-SkipServer)" -ForegroundColor Gray
}

# ── 2. Executable ins Plugin-bin/ kopieren ────────────────────────────────────
Write-Host "`n[2/3] Executable ins Plugin kopieren..." -ForegroundColor Yellow

$binDir = "$Root\plugin\bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$exe = "$Root\server\dist\obsidian-mcp-server.exe"
if (Test-Path $exe) {
    Copy-Item $exe $binDir -Force
    Write-Host "   Kopiert nach: $binDir\obsidian-mcp-server.exe" -ForegroundColor Green
} else {
    Write-Host "   WARNUNG: $exe nicht gefunden - Plugin wird ohne .exe gebaut" -ForegroundColor Yellow
}

# ── 3. TypeScript Plugin bauen ────────────────────────────────────────────────
if (-not $SkipPlugin) {
    Write-Host "`n[3/3] TypeScript Plugin bauen..." -ForegroundColor Yellow
    Set-Location "$Root\plugin"

    npm install --silent
    if ($LASTEXITCODE -ne 0) { throw "npm install fehlgeschlagen" }

    node esbuild.config.mjs production
    if ($LASTEXITCODE -ne 0) { throw "esbuild fehlgeschlagen" }

    $mainJs = "$Root\plugin\main.js"
    $sizeKB = [math]::Round((Get-Item $mainJs).Length / 1KB, 1)
    Write-Host "   Plugin gebaut: main.js ($sizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "`n[3/3] Plugin-Build uebersprungen (-SkipPlugin)" -ForegroundColor Gray
}

# ── Ergebnis zusammenfassen ───────────────────────────────────────────────────
Write-Host "`n=== Build abgeschlossen ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Plugin-Ordner zum Installieren:"
Write-Host "  $Root\plugin\" -ForegroundColor White
Write-Host ""
Write-Host "Kopiere diesen Ordner nach:"
Write-Host "  <Vault>\.obsidian\plugins\obsidian-mcp\" -ForegroundColor White
Write-Host ""
Write-Host "Oder fuer Claude Desktop - Server direkt starten:"
Write-Host "  $Root\plugin\bin\obsidian-mcp-server.exe --transport stdio" -ForegroundColor White

Set-Location $Root
