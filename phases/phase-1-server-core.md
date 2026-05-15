# Phase 1 – Python FastMCP Server (Kern)

**Ziel:** Vollständig funktionsfähiger MCP-Server, der alle Vault-Operationen
als MCP-Tools bereitstellt. Läuft standalone ohne Plugin.

**Abhängigkeiten:** Python 3.11+, keine Plugin-Phase nötig.

---

## Dateien die erstellt werden

```
server/
├── requirements.txt
├── config.py
├── vault_manager.py
├── tools/
│   ├── __init__.py
│   ├── notes.py
│   ├── folders.py
│   ├── search.py
│   ├── metadata.py
│   └── attachments.py
└── main.py
```

---

## Schritt 1.1 — `requirements.txt`

```
fastmcp>=2.0.0
python-frontmatter>=1.1.0
pyyaml>=6.0
```

---

## Schritt 1.2 — `config.py`

Liest und schreibt `~/.obsidian-mcp/config.json`.

```json
// Beispiel config.json
{
  "vaults": {
    "Privat":   "C:/Users/Name/Documents/Obsidian/Privat",
    "Arbeit":   "C:/Users/Name/Documents/Obsidian/Arbeit"
  }
}
```

Funktionen:
- `get_config() -> dict`
- `save_config(config)`
- `get_vault_path(name) -> str | None`
- `list_vaults() -> dict`
- `add_vault(name, path)`
- `remove_vault(name)`

---

## Schritt 1.3 — `vault_manager.py`

Sicherheits-Layer für alle Dateizugriffe.

Funktionen:
- `get_vault(name) -> Path` — prüft ob Vault konfiguriert + existiert
- `resolve_path(vault, relative_path) -> Path` — löst Pfad auf, verhindert Path-Traversal
- `ensure_parent(path)` — erstellt übergeordnete Ordner

Sicherheit: Jeder aufgelöste Pfad wird mit `Path.resolve()` normalisiert
und gegen den Vault-Root geprüft.

---

## Schritt 1.4 — `tools/notes.py`

| Funktion | Parameter | Rückgabe |
|----------|-----------|----------|
| `create_note` | vault, path, content="", frontmatter=None | str (Erfolg/Fehler) |
| `read_note` | vault, path | dict {path, content, frontmatter} |
| `update_note` | vault, path, content=None, frontmatter=None | str |
| `delete_note` | vault, path | str |
| `move_note` | vault, from_path, to_path | str |

Besonderheiten:
- `.md` wird automatisch ergänzt falls nicht vorhanden
- Frontmatter wird mit `python-frontmatter` geparst/geschrieben
- Fehlermeldungen sind KI-lesbar (erklären was zu tun ist)

---

## Schritt 1.5 — `tools/folders.py`

| Funktion | Parameter | Rückgabe |
|----------|-----------|----------|
| `create_folder` | vault, path | str |
| `delete_folder` | vault, path, recursive=False | str |
| `move_folder` | vault, from_path, to_path | str |
| `list_folder` | vault, path="" | dict {path, items[]} |
| `get_vault_tree` | vault | dict (rekursiver Baum) |

`list_folder` gibt zurück:
```json
{
  "path": "Projects/",
  "items": [
    {"name": "Alpha", "path": "Projects/Alpha", "type": "folder"},
    {"name": "Note.md", "path": "Projects/Note.md", "type": "file", "extension": ".md"}
  ]
}
```

---

## Schritt 1.6 — `tools/search.py`

| Funktion | Parameter | Rückgabe |
|----------|-----------|----------|
| `search_notes` | vault, query, folder="", case_sensitive=False | list |
| `search_by_tag` | vault, tag | list |

`search_notes` gibt zurück:
```json
[
  {
    "path": "Projects/Alpha.md",
    "matches": 3,
    "snippets": [
      {"line": 12, "text": "...matching line text..."}
    ]
  }
]
```

Sucht auch in Inline-Tags (`#tag`) bei `search_by_tag`.

---

## Schritt 1.7 — `tools/metadata.py`

| Funktion | Parameter | Rückgabe |
|----------|-----------|----------|
| `read_frontmatter` | vault, path | dict {path, frontmatter} |
| `write_frontmatter` | vault, path, frontmatter, merge=True | str |
| `get_backlinks` | vault, path | list [{path, link_text}] |
| `get_outlinks` | vault, path | list [{type, target, alias}] |

Backlinks: Scannt alle `.md` Dateien auf `[[Wikilinks]]` die auf die
gegebene Notiz zeigen.

Outlinks: Findet sowohl `[[Wikilinks]]` als auch `[Markdown](links)`.

---

## Schritt 1.8 — `tools/attachments.py`

Unterstützte Dateitypen: `.png .jpg .jpeg .gif .webp .pdf .mp3 .mp4 .wav .svg .excalidraw`

| Funktion | Parameter | Rückgabe |
|----------|-----------|----------|
| `list_attachments` | vault, folder="" | list [{path, name, extension, size_bytes}] |
| `read_attachment` | vault, path | dict {path, mime_type, data_base64, size_bytes} |
| `delete_attachment` | vault, path | str |

---

## Schritt 1.9 — `main.py`

FastMCP Server-Einstiegspunkt. Registriert alle Tools:

**Vault-Management (3):** `list_vaults`, `add_vault`, `remove_vault`
**Notizen (5):** `create_note`, `read_note`, `update_note`, `delete_note`, `move_note`
**Ordner (5):** `create_folder`, `delete_folder`, `move_folder`, `list_folder`, `get_vault_tree`
**Suche (2):** `search_notes`, `search_by_tag`
**Metadaten (4):** `read_frontmatter`, `write_frontmatter`, `get_backlinks`, `get_outlinks`
**Attachments (3):** `list_attachments`, `read_attachment`, `delete_attachment`

**CLI-Parameter:**
```
--transport  stdio | sse    (default: sse)
--host       127.0.0.1      (default)
--port       3333           (default)
```

---

## Testen nach Phase 1

```bash
cd server
pip install -r requirements.txt

# SSE-Modus testen (für VS Code, OpenWebUI)
python main.py --transport sse --port 3333

# In separatem Terminal — Vault hinzufügen via MCP Inspector
# oder claude_desktop_config.json konfigurieren für stdio-Test
```

**Erwartetes Ergebnis:** Server läuft, alle 22 Tools sind über MCP erreichbar.

---

## Abhängigkeit zu anderen Phasen

- Phase 2 (Plugin) braucht den kompilierten Server aus Phase 1
- Phase 3 (PyInstaller) baut auf dem fertigen `main.py` auf
- Phase 4 (Chat-Sidebar) ist unabhängig von Phase 1 (nutzt Server als Blackbox)
