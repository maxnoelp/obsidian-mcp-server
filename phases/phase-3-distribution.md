# Phase 3 – Distribution (PyInstaller + Plugin-Bundle)

**Ziel:** Nutzer können das Plugin installieren ohne Python zu installieren.
Der Server wird als `.exe` (Windows) / Binary (Mac/Linux) mit dem Plugin ausgeliefert.

**Voraussetzung:** Phase 1 + 2 abgeschlossen und getestet.

---

## Übersicht

```
Endprodukt (Plugin-Ordner):
.obsidian/plugins/obsidian-mcp/
├── main.js               ← gebundeltes TypeScript Plugin
├── manifest.json
├── styles.css
└── bin/
    ├── obsidian-mcp-server.exe    ← Windows (PyInstaller)
    ├── obsidian-mcp-server-mac    ← macOS   (PyInstaller, optional)
    └── obsidian-mcp-server-linux  ← Linux   (PyInstaller, optional)
```

---

## Schritt 3.1 — PyInstaller Spec (`server/obsidian-mcp.spec`)

```python
# obsidian-mcp.spec
a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'frontmatter',
        'yaml',
        'fastmcp',
        'anyio',
        'starlette',
        'uvicorn',
    ],
    hookspath=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='obsidian-mcp-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # console=True damit Logs sichtbar sind
    disable_windowed_traceback=False,
    icon=None,
)
```

**Build-Befehl:**
```bash
cd server
pip install pyinstaller
pyinstaller obsidian-mcp.spec --clean

# Output: server/dist/obsidian-mcp-server.exe (~30-50 MB)
```

---

## Schritt 3.2 — Build-Skript (`build.ps1` / `build.sh`)

### Windows (`build.ps1`):
```powershell
# 1. Python Server bauen
Set-Location server
pip install -r requirements.txt
pip install pyinstaller
pyinstaller obsidian-mcp.spec --clean

# 2. Executable ins Plugin kopieren
$exePath = "dist\obsidian-mcp-server.exe"
$targetDir = "..\plugin\bin"
New-Item -ItemType Directory -Force -Path $targetDir
Copy-Item $exePath $targetDir

# 3. TypeScript Plugin bauen
Set-Location ..\plugin
npm install
npm run build

Write-Host "Build fertig! Plugin bereit in: plugin/"
```

### Linux/Mac (`build.sh`):
```bash
#!/bin/bash
set -e

cd server
pip install -r requirements.txt pyinstaller
pyinstaller obsidian-mcp.spec --clean

mkdir -p ../plugin/bin
cp dist/obsidian-mcp-server ../plugin/bin/obsidian-mcp-server-$(uname -s | tr '[:upper:]' '[:lower:]')

cd ../plugin
npm install && npm run build

echo "Build fertig!"
```

---

## Schritt 3.3 — Größenoptimierung

PyInstaller-Executables sind standardmäßig 30-60 MB. Reduktionsmöglichkeiten:

| Maßnahme | Ersparnis |
|----------|-----------|
| `--exclude-module tkinter` | ~5 MB |
| `--exclude-module unittest` | ~2 MB |
| UPX-Kompression (bereits in Spec) | ~30% |
| Nur benötigte hiddenimports | ~5 MB |

**Zielgröße:** < 35 MB (unkomprimiert), < 20 MB (zip)

---

## Schritt 3.4 — Plugin Release-Struktur

```
obsidian-mcp-v1.0.0.zip
└── obsidian-mcp/
    ├── main.js
    ├── manifest.json
    ├── styles.css
    └── bin/
        └── obsidian-mcp-server.exe
```

**GitHub Release** (optional):
- `obsidian-mcp-v1.0.0-windows.zip`
- `obsidian-mcp-v1.0.0-macos.zip`
- `obsidian-mcp-v1.0.0-linux.zip`

---

## Schritt 3.5 — `server-manager.ts` Anpassungen

Plattform-spezifischer Executable-Name:

```typescript
private getExecutablePath(): string {
  const platform = process.platform;
  const suffix = {
    win32:  "obsidian-mcp-server.exe",
    darwin: "obsidian-mcp-server-macos",
    linux:  "obsidian-mcp-server-linux",
  }[platform] ?? "obsidian-mcp-server";

  return path.join(this.pluginDir, "bin", suffix);
}
```

---

## Testen nach Phase 3

1. `build.ps1` ausführen
2. `plugin/bin/obsidian-mcp-server.exe` direkt starten → prüfen ob Server läuft
3. Obsidian neu laden → Plugin startet Executable automatisch
4. Kein Python auf dem System → Server soll trotzdem starten

**Erwartetes Ergebnis:** Komplettes Plugin ohne Python-Abhängigkeit einsatzbereit.

---

## Abhängigkeit zu anderen Phasen

- Braucht Phase 1 + 2
- Phase 4 (Chat) kann danach unabhängig gebaut werden
