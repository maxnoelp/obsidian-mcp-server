# Phase 2 – Obsidian Plugin Kern (Server-Manager + Settings)

**Ziel:** Obsidian Plugin das den MCP-Server automatisch startet/stoppt und
Vaults über eine Settings-UI konfigurierbar macht. Keine Chat-Funktion.

**Voraussetzung:** Phase 1 abgeschlossen (Server läuft manuell).

---

## Dateien die erstellt werden

```
plugin/
├── src/
│   ├── main.ts
│   ├── types.ts
│   ├── settings.ts
│   └── server-manager.ts
├── manifest.json
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

---

## Schritt 2.1 — `manifest.json`

```json
{
  "id": "obsidian-mcp",
  "name": "Obsidian MCP",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Startet einen lokalen MCP-Server für KI-Zugriff auf deinen Vault.",
  "author": "obsidian-mcp",
  "isDesktopOnly": true
}
```

`isDesktopOnly: true` weil wir `child_process` (Node.js) nutzen — läuft
nur im Electron Desktop, nicht in der Mobile-App.

---

## Schritt 2.2 — `package.json`

Dependencies:
- `obsidian` (Typ-Definitionen)
- `@types/node` (child_process, path, fs)
- `esbuild` (Bundler)
- `typescript`

Keine Runtime-Dependencies außer Obsidian — alles wird gebundelt.

---

## Schritt 2.3 — `tsconfig.json`

Standard Obsidian Plugin Config:
- `target: "ES2018"`
- `lib: ["ES6", "DOM"]`
- `moduleResolution: "node"`
- `strict: true`

---

## Schritt 2.4 — `esbuild.config.mjs`

Standard Obsidian Plugin Build:
- Entry: `src/main.ts`
- Output: `main.js` (CJS, gebundelt)
- Extern: `obsidian`, `electron`, alle Node builtins
- Dev-Modus: `--watch`
- Prod-Modus: minifiziert, kein Sourcemap

---

## Schritt 2.5 — `types.ts`

```typescript
export interface VaultConfig {
  name: string;
  path: string;
}

export interface ObsidianMCPSettings {
  serverPort: number;
  vaults: VaultConfig[];
  serverExecutablePath: string;  // leer = auto-detect
  enableChat: boolean;           // Phase 4
  chatProvider: "claude" | "openai" | "ollama";
  claudeApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export const DEFAULT_SETTINGS: ObsidianMCPSettings = {
  serverPort: 3333,
  vaults: [],
  serverExecutablePath: "",
  enableChat: false,
  chatProvider: "ollama",
  claudeApiKey: "",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
};
```

---

## Schritt 2.6 — `server-manager.ts`

Verantwortlich für:
1. Executable-Pfad ermitteln (gebundelt in `plugin/bin/` oder manuell)
2. Server-Prozess starten (`child_process.spawn`)
3. Warten bis Server bereit ist (Health-Check gegen `/sse`)
4. Vault-Konfiguration in `~/.obsidian-mcp/config.json` schreiben
5. Server stoppen beim Beenden

```typescript
class ServerManager {
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  syncVaults(vaults: VaultConfig[]): Promise<void>  // schreibt config.json
  getStatus(): "stopped" | "starting" | "running" | "error"
}
```

**Executable-Suche (Priorität):**
1. `settings.serverExecutablePath` (manuell gesetzt)
2. `{pluginDir}/bin/obsidian-mcp-server.exe` (gebundelt)
3. `python {pluginDir}/../../server/main.py` (Dev-Fallback)

**Vault-Sync:** Schreibt direkt in `~/.obsidian-mcp/config.json` und
startet den Server neu, damit die neuen Vaults geladen werden.

---

## Schritt 2.7 — `settings.ts`

Settings Tab mit folgenden Abschnitten:

### Abschnitt: Server
- Port (default: 3333)
- Executable-Pfad (optional, für manuelle Installation)
- Server-Status Anzeige (grün/rot Indikator + "Restart" Button)

### Abschnitt: Vaults
- Liste aller konfigurierten Vaults (Name + Pfad)
- "Aktuellen Vault hinzufügen" Button (liest `app.vault.adapter.getBasePath()`)
- "Anderen Vault hinzufügen" (manueller Pfad)
- Entfernen-Button pro Vault

### Abschnitt: Verbindungs-Info (read-only)
```
MCP Server läuft auf: http://127.0.0.1:3333/sse

Für Claude Desktop: stdio-Modus
  Command: C:\...\obsidian-mcp-server.exe
  Args: --transport stdio

Für VS Code / OpenWebUI:
  URL: http://127.0.0.1:3333/sse
```

### Abschnitt: Chat (Phase 4 Platzhalter)
- Toggle "Chat-Sidebar aktivieren" (deaktiviert solange Phase 4 nicht fertig)

---

## Schritt 2.8 — `main.ts`

```typescript
export default class ObsidianMCPPlugin extends Plugin {
  settings: ObsidianMCPSettings;
  serverManager: ServerManager;

  async onload() {
    await this.loadSettings();
    this.serverManager = new ServerManager(this.settings, this.getPluginDir());
    await this.serverManager.start();

    this.addSettingTab(new ObsidianMCPSettingTab(this.app, this));

    // Status-Bar Item (zeigt Server-Port)
    const statusBar = this.addStatusBarItem();
    statusBar.setText(`MCP :${this.settings.serverPort}`);
  }

  async onunload() {
    await this.serverManager.stop();
  }
}
```

---

## Testen nach Phase 2

```bash
cd plugin
npm install
npm run dev   # startet esbuild --watch
```

1. Plugin-Ordner in `.obsidian/plugins/obsidian-mcp/` verlinken/kopieren
2. Obsidian neu laden
3. Settings öffnen → Vault hinzufügen → Server-Status prüfen
4. `http://127.0.0.1:3333/sse` im Browser aufrufen → sollte SSE-Stream zeigen
5. Claude Desktop config setzen → Verbindung testen

**Erwartetes Ergebnis:**
- Server startet automatisch mit Obsidian
- Vaults werden in config.json synchronisiert
- Externe Clients können sich verbinden

---

## Abhängigkeit zu anderen Phasen

- Braucht Phase 1 (Server)
- Phase 3 (PyInstaller) liefert die `.exe` die hier gestartet wird
- Phase 4 (Chat) erweitert dieses Plugin um die Sidebar
