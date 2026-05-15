# Phase 5 – Dokumentation & Release

**Ziel:** Vollständige README, Setup-Guides für alle unterstützten Clients,
GitHub Release-Workflow.

**Voraussetzung:** Phase 1–3 abgeschlossen (Phase 4 optional).

---

## Dateien die erstellt werden

```
obsidian_mcp/
├── README.md
├── docs/
│   ├── setup-claude-desktop.md
│   ├── setup-vscode.md
│   ├── setup-openwebui.md
│   └── setup-plugin.md
└── .github/
    └── workflows/
        └── release.yml        ← optional: GitHub Actions Build
```

---

## Schritt 5.1 — `README.md`

### Struktur:
```markdown
# Obsidian MCP

> KI-Assistenten Zugriff auf deine Obsidian Vaults über das
> Model Context Protocol (MCP).

## Features
- 21 MCP-Tools: Notizen, Ordner, Suche, Tags, Backlinks, Attachments
- Multi-Vault Support
- Unterstützt Claude Desktop, Claude Code, VS Code, OpenWebUI, Ollama
- Obsidian Plugin (automatischer Server-Start + optionale Chat-Sidebar)

## Schnellstart

### Option A: Mit Obsidian Plugin
1. Plugin installieren
2. Vault hinzufügen
3. Externen Client verbinden

### Option B: Nur Server (ohne Plugin)
pip install -r requirements.txt
python main.py --transport stdio   # für Claude Desktop
python main.py --transport sse     # für VS Code / OpenWebUI

## Client-Setup
→ [Claude Desktop](docs/setup-claude-desktop.md)
→ [VS Code](docs/setup-vscode.md)
→ [OpenWebUI / Ollama](docs/setup-openwebui.md)
→ [Obsidian Plugin](docs/setup-plugin.md)

## MCP-Tools Referenz
[Tabelle aller 21 Tools]

## Entwicklung
[Lokaler Build, Tests, Contribution Guide]
```

---

## Schritt 5.2 — `docs/setup-claude-desktop.md`

```markdown
# Setup: Claude Desktop

## Voraussetzungen
- Claude Desktop installiert
- obsidian-mcp-server.exe heruntergeladen

## Konfiguration

Öffne: %APPDATA%\Claude\claude_desktop_config.json

{
  "mcpServers": {
    "obsidian": {
      "command": "C:/pfad/zu/obsidian-mcp-server.exe",
      "args": ["--transport", "stdio"]
    }
  }
}

## Vaults konfigurieren

Erster Start: Claude kann direkt Vaults hinzufügen:
"Füge meinen Vault unter C:/Users/.../Obsidian/Privat hinzu"

Oder manuell in ~/.obsidian-mcp/config.json.

## Testen
In Claude Desktop: "Liste alle konfigurierten Vaults"
```

---

## Schritt 5.3 — `docs/setup-vscode.md`

```markdown
# Setup: VS Code

Funktioniert mit: Continue, Cline, GitHub Copilot (Agent Mode),
Cursor (identische Konfiguration).

## Voraussetzungen
- Obsidian Plugin installiert (startet Server automatisch)
  ODER manuell: obsidian-mcp-server.exe --transport sse --port 3333

## Continue Extension

~/.continue/config.json:
{
  "mcpServers": [
    {
      "name": "obsidian",
      "transport": {
        "type": "sse",
        "url": "http://127.0.0.1:3333/sse"
      }
    }
  ]
}

## Cline Extension

Settings → MCP Servers → Add:
  URL: http://127.0.0.1:3333/sse

## GitHub Copilot (Agent Mode)
.vscode/mcp.json:
{
  "servers": {
    "obsidian": {
      "url": "http://127.0.0.1:3333/sse"
    }
  }
}
```

---

## Schritt 5.4 — `docs/setup-openwebui.md`

```markdown
# Setup: OpenWebUI / AnythingLLM / LibreChat

Für lokale LLMs mit Ollama oder andere OpenAI-kompatible Backends.

## OpenWebUI

Workspace → Tools → MCP Servers → Add:
  Name: Obsidian
  URL:  http://127.0.0.1:3333/sse

## AnythingLLM

Settings → Agent Skills → Custom MCP:
  Endpoint: http://127.0.0.1:3333/sse

## LibreChat
librechat.yaml:
  mcp:
    servers:
      obsidian:
        url: http://127.0.0.1:3333/sse

## Empfohlene Modelle für Tool-Use
- llama3.2 (Ollama)
- qwen2.5-coder (Ollama)
- mistral-nemo (Ollama)
- claude-3-5-haiku (API)
```

---

## Schritt 5.5 — GitHub Actions Release (optional)

`.github/workflows/release.yml`:

```yaml
name: Build & Release

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r server/requirements.txt pyinstaller
      - run: cd server && pyinstaller obsidian-mcp.spec --clean
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: |
          cp server/dist/obsidian-mcp-server.exe plugin/bin/
          cd plugin && npm install && npm run build
      - name: Zip plugin
        run: Compress-Archive -Path plugin/* -DestinationPath obsidian-mcp-windows.zip
      - uses: actions/upload-artifact@v4
        with:
          name: obsidian-mcp-windows
          path: obsidian-mcp-windows.zip

  release:
    needs: [build-windows]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - uses: softprops/action-gh-release@v2
        with:
          files: "**/*.zip"
```

---

## Checkliste vor Release

- [ ] Alle 21 MCP-Tools manuell getestet
- [ ] Claude Desktop Verbindung getestet
- [ ] VS Code (Continue oder Cline) Verbindung getestet
- [ ] Ollama + OpenWebUI Verbindung getestet
- [ ] Plugin startet Server automatisch
- [ ] Plugin stoppt Server beim Schließen
- [ ] Vault-Sync funktioniert nach Settings-Änderung
- [ ] Path-Traversal Sicherheitstest bestanden
- [ ] `.exe` startet ohne Python auf frischem System
- [ ] README ist vollständig und korrekt
