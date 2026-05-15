# Obsidian MCP – Projektplan

## Überblick

Ein MCP-Server (Python/FastMCP) + Obsidian Plugin (TypeScript).

**Primäres Ziel:** Der MCP-Server dient als Standard-MCP-Endpunkt, den externe
KI-Clients (Claude Desktop, Claude Code CLI, VS Code Extensions, OpenWebUI, etc.)
direkt nutzen. Das Obsidian Plugin startet/verwaltet den Server und konfiguriert
Vaults — optional mit eingebetteter Chat-Sidebar für Nutzer mit eigenem API-Key.

---

## Architektur

```
┌─── Externe MCP-Clients (primärer Anwendungsfall) ────────────┐
│                                                               │
│  Claude Desktop ──────────┐                                   │
│  Claude Code CLI ─────────┤  stdio  ┌──────────────────────┐ │
│  VS Code (Continue/Cline) ┤─────────►                      │ │
│  Cursor ──────────────────┘         │   Python FastMCP     │ │
│                                     │       Server         │ │
│  OpenWebUI ───────────────┐         │                      │ │
│  AnythingLLM ─────────────┤ HTTP/   │  - 21 MCP-Tools      │ │
│  LibreChat ───────────────┤ SSE     │  - Multi-Vault       │ │
│  n8n / Make ──────────────┘─────────►  - Config:           │ │
│                                     │    ~/.obsidian-mcp/  │ │
└─────────────────────────────────────┤    config.json       │ │
                                      └──────────┬───────────┘ │
                              spawn()            │ Dateisystem  │
                                 ▲               ▼              │
┌─── Obsidian Plugin ───────────┼──────────────────────────┐   │
│                               │                           │   │
│  ┌─────────────┐  ┌───────────┴──┐  ┌───────────────┐    │   │
│  │  Settings   │  │   Server-    │  │  Chat-Sidebar  │   │   │
│  │  - Vaults   │  │   Manager   │  │  (OPTIONAL)    │   │   │
│  │  - Port     │  │  start/stop  │  │  für Nutzer   │   │   │
│  │  - Chat-Key │  │  vault sync  │  │  mit API-Key  │   │   │
│  └─────────────┘  └─────────────┘  └───────────────┘    │   │
│                                                           │   │
└───────────────────────────────────────────────────────────┘   │
                                                                 │
                    ┌────────────────────────────────────────┐   │
                    │         Obsidian Vault(s)              │   │
                    │  vault1/   vault2/   vault3/           │   │
                    └────────────────────────────────────────┘   │
```

---

## Projektstruktur

```
obsidian_mcp/
│
├── PLAN.md                        ← Diese Datei
│
├── server/                        ← Python FastMCP Server (Kern des Projekts)
│   ├── main.py                    ← Einstiegspunkt, alle Tools registriert
│   ├── config.py                  ← ~/.obsidian-mcp/config.json lesen/schreiben
│   ├── vault_manager.py           ← Pfad-Auflösung, Sicherheit (Path-Traversal)
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── notes.py               ← create/read/update/delete/move_note
│   │   ├── folders.py             ← create/delete/move/list_folder, get_vault_tree
│   │   ├── search.py              ← search_notes, search_by_tag
│   │   ├── metadata.py            ← frontmatter, backlinks, outlinks
│   │   └── attachments.py         ← list/read/delete_attachment
│   ├── requirements.txt
│   └── obsidian-mcp.spec          ← PyInstaller (→ .exe ohne Python)
│
└── plugin/                        ← Obsidian Plugin (TypeScript)
    ├── src/
    │   ├── main.ts                ← Plugin Entry Point
    │   ├── types.ts               ← Shared Types
    │   ├── settings.ts            ← Settings Tab (Vaults, Port, opt. Chat-Key)
    │   ├── server-manager.ts      ← Spawn/Stop Python-Server, Vault-Sync
    │   └── views/
    │       └── chat-view.ts       ← Chat-Sidebar (OPTIONAL, aktivierbar)
    ├── styles.css
    ├── manifest.json
    ├── package.json
    ├── tsconfig.json
    └── esbuild.config.mjs
```

> **Hinweis:** Die Plugin-Architektur ist schlanker als ursprünglich geplant.
> `mcp-client.ts` und `ai-providers/` entfallen als eigenständige Module, da
> externe Clients (Claude Desktop, VS Code, etc.) direkt mit dem Server kommunizieren.
> Die optionale Chat-Sidebar nutzt falls aktiviert direkt die Anthropic/OpenAI/Ollama API.

---

## MCP-Tools (vollständige Liste)

| Tool | Parameter | Beschreibung |
|------|-----------|--------------|
| `list_vaults` | — | Alle konfigurierten Vaults anzeigen |
| `add_vault` | name, path | Vault hinzufügen |
| `remove_vault` | name | Vault entfernen |
| `create_note` | vault, path, content?, frontmatter? | Neue Notiz erstellen |
| `read_note` | vault, path | Notiz lesen (Inhalt + Frontmatter) |
| `update_note` | vault, path, content?, frontmatter? | Notiz aktualisieren |
| `delete_note` | vault, path | Notiz löschen |
| `move_note` | vault, from_path, to_path | Notiz verschieben/umbenennen |
| `create_folder` | vault, path | Ordner erstellen |
| `delete_folder` | vault, path, recursive? | Ordner löschen |
| `move_folder` | vault, from_path, to_path | Ordner verschieben |
| `list_folder` | vault, path? | Ordnerinhalt auflisten |
| `get_vault_tree` | vault | Komplette Vault-Struktur |
| `search_notes` | vault, query, folder?, case_sensitive? | Volltextsuche |
| `search_by_tag` | vault, tag | Nach Tag suchen |
| `read_frontmatter` | vault, path | YAML-Metadaten lesen |
| `write_frontmatter` | vault, path, frontmatter, merge? | Metadaten schreiben |
| `get_backlinks` | vault, path | Alle Notizen die auf diese verlinken |
| `get_outlinks` | vault, path | Alle Links aus dieser Notiz |
| `list_attachments` | vault, folder? | Attachments auflisten |
| `read_attachment` | vault, path | Attachment als Base64 lesen |
| `delete_attachment` | vault, path | Attachment löschen |

---

## Client-Anbindung (extern)

### Claude Desktop / Claude Code CLI
```json
// %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "obsidian": {
      "command": "C:/pfad/zu/obsidian-mcp-server.exe",
      "args": ["--transport", "stdio"]
    }
  }
}
```
Transport: **stdio** — Server wird von Claude Desktop gestartet und gesteuert.

### VS Code (Continue, Cline, Copilot Agent Mode)
```json
// .vscode/mcp.json  oder  continue config
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:3333/sse"
    }
  }
}
```
Transport: **SSE** — Server muss vorher laufen (Obsidian Plugin startet ihn).

### OpenWebUI / AnythingLLM / LibreChat (Ollama & andere lokale LLMs)
```
MCP Server URL: http://127.0.0.1:3333/sse
```
Transport: **SSE** — identisch zu VS Code. Funktioniert mit jedem MCP-kompatiblen Client.

### n8n / Make / Automatisierungen
```
HTTP Tool: POST http://127.0.0.1:3333/mcp
Body: {"jsonrpc":"2.0","method":"tools/call","params":{...}}
```

---

## Optionale Chat-Sidebar (im Obsidian Plugin)

Für Nutzer, die direkt aus Obsidian heraus mit KI chatten wollen, ohne einen
externen Client zu öffnen. **Aktivierbar in den Plugin-Settings.**

```
Settings → Chat aktivieren → API-Key eingeben
   │
   ▼
Obsidian Sidebar: Chat-Fenster
   │
   ├── Anthropic API  → claude-sonnet-4-6
   ├── OpenAI API     → gpt-4o
   └── Ollama lokal   → frei wählbares Modell
         │
         ▼ (Tool-Calls des Modells werden automatisch ausgeführt)
   MCP-Server (bereits laufend) → Vault-Operationen
```

> Die Chat-Sidebar ist bewusst optional, da Claude Desktop, VS Code etc.
> die komfortablere Erfahrung bieten. Die Sidebar ist für schnelle Zugriffe
> direkt aus Obsidian heraus gedacht.

---

## Server-Lifecycle

| Zustand | Verhalten |
|---------|-----------|
| Obsidian startet | Plugin spawnt `bin/obsidian-mcp-server.exe --transport sse --port 3333` |
| Dev (kein .exe) | Fallback auf `python server/main.py` (für Entwicklung) |
| Claude Desktop | Startet Server selbst mit `--transport stdio` |
| Settings → Vault hinzufügen | Plugin sync'lt via JSON-Config-Datei + Server-Restart |
| Obsidian schließt | Plugin sendet SIGTERM an Server-Prozess |

---

## Distribution

### Option A: Mit Obsidian Plugin (empfohlen)
1. Plugin-Ordner in `.obsidian/plugins/obsidian-mcp/` kopieren
2. In Obsidian: Settings → Community Plugins → Enable
3. MCP Settings: Vaults hinzufügen, Port konfigurieren
4. Externe Clients auf `http://127.0.0.1:3333/sse` zeigen lassen

### Option B: Nur Server (ohne Plugin, z.B. für Claude Desktop)
```bash
# Server direkt starten
obsidian-mcp-server.exe --transport stdio
# oder für HTTP-Clients:
obsidian-mcp-server.exe --transport sse --port 3333
```
Vaults werden in `~/.obsidian-mcp/config.json` konfiguriert.

### Server als Executable bauen:
```bash
cd server
pip install pyinstaller -r requirements.txt
pyinstaller obsidian-mcp.spec
# → dist/obsidian-mcp-server.exe  (Windows)
# → dist/obsidian-mcp-server      (Linux/Mac)
```

---

## Sicherheit

- **Path-Traversal-Schutz**: Alle Pfade werden gegen den Vault-Root geprüft
- **Vault-Whitelist**: Nur konfigurierte Vaults sind zugänglich
- **Lokaler Server**: Server lauscht nur auf `127.0.0.1` (kein Netzwerkzugriff)
- **API-Keys**: Nur im Obsidian Plugin-Data gespeichert, nie an den Server übertragen

---

## Umsetzungsreihenfolge

Jede Phase hat eine eigene Detaildatei im `phases/` Ordner.

| Phase | Datei | Inhalt | Priorität |
|-------|-------|--------|-----------|
| 1 | [phase-1-server-core.md](phases/phase-1-server-core.md) | Python FastMCP Server, alle 21 Tools | **Pflicht** |
| 2 | [phase-2-plugin-core.md](phases/phase-2-plugin-core.md) | Obsidian Plugin, Server-Manager, Settings | **Pflicht** |
| 3 | [phase-3-distribution.md](phases/phase-3-distribution.md) | PyInstaller .exe, Build-Skripte | Empfohlen |
| 4 | [phase-4-chat-sidebar.md](phases/phase-4-chat-sidebar.md) | Optionale Chat-Sidebar mit AI-Providern | Optional |
| 5 | [phase-5-docs-and-release.md](phases/phase-5-docs-and-release.md) | README, Client-Guides, GitHub Release | Empfohlen |
