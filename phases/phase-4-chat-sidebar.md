# Phase 4 – Optionale Chat-Sidebar

**Ziel:** Eingebettete Chat-UI direkt in Obsidian für Nutzer mit eigenem API-Key.
Kommuniziert mit dem bereits laufenden MCP-Server (Phase 1) für Vault-Operationen.

**Voraussetzung:** Phase 1 + 2 abgeschlossen. Phase 3 optional.

**Aktivierung:** Settings → "Chat-Sidebar aktivieren" Toggle.

---

## Dateien die erstellt/erweitert werden

```
plugin/src/
├── views/
│   └── chat-view.ts          ← neu
├── ai-providers/
│   ├── base.ts               ← neu
│   ├── claude.ts             ← neu
│   ├── openai.ts             ← neu
│   └── ollama.ts             ← neu
└── mcp-client.ts             ← neu
```

Außerdem: `settings.ts` + `main.ts` werden erweitert.

---

## Datenfluss

```
Nutzer schreibt im Chat
        │
        ▼
chat-view.ts: Nachricht aufnehmen
        │
        ▼
mcp-client.ts: tools/list → Server holt verfügbare MCP-Tools
        │
        ▼
ai-provider: Nachricht + Tools an KI senden
   ┌────┴────────────────┐
   │ claude.ts           │ → api.anthropic.com/v1/messages
   │ openai.ts           │ → api.openai.com/v1/chat/completions
   │ ollama.ts           │ → localhost:11434/api/chat
   └────┬────────────────┘
        │
        ▼
KI antwortet mit tool_calls?
   ├── Nein → Text direkt im Chat anzeigen
   └── Ja  → mcp-client.ts: tools/call → Server → Vault
               │
               ▼
           Ergebnis zurück an KI → finale Antwort → Chat
```

---

## Schritt 4.1 — `mcp-client.ts`

MCP-Client der via SSE mit dem lokalen Server kommuniziert.

```typescript
class MCPClient {
  constructor(port: number)

  // Verbindung aufbauen
  connect(): Promise<void>
  disconnect(): void

  // MCP-Protokoll
  listTools(): Promise<MCPTool[]>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
}
```

Implementiert MCP JSON-RPC über SSE:
- `GET /sse` — SSE-Stream öffnen (erhält Session-ID)
- `POST /messages/?session_id=<id>` — Requests senden
- Responses kommen via SSE-Stream zurück

---

## Schritt 4.2 — `ai-providers/base.ts`

Interface das alle Provider implementieren:

```typescript
export interface AIMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface AIProvider {
  readonly name: string;
  chat(messages: AIMessage[], tools: MCPTool[]): Promise<AIResponse>;
}
```

---

## Schritt 4.3 — `ai-providers/claude.ts`

Anthropic Messages API:

```typescript
class ClaudeProvider implements AIProvider {
  // Modell: claude-sonnet-4-6 (default, konfigurierbar)
  // Endpoint: https://api.anthropic.com/v1/messages
  // Auth: x-api-key Header
  // Tool-Format: Anthropic tool_use / tool_result
}
```

Tool-Format für Anthropic:
```json
{
  "tools": [{
    "name": "create_note",
    "description": "...",
    "input_schema": { "type": "object", "properties": {...} }
  }]
}
```

---

## Schritt 4.4 — `ai-providers/openai.ts`

OpenAI Chat Completions API:

```typescript
class OpenAIProvider implements AIProvider {
  // Modell: gpt-4o (default)
  // Endpoint: https://api.openai.com/v1/chat/completions
  // Auth: Bearer Token
  // Tool-Format: OpenAI function calling
}
```

Tool-Format für OpenAI:
```json
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "create_note",
      "description": "...",
      "parameters": { "type": "object", "properties": {...} }
    }
  }]
}
```

---

## Schritt 4.5 — `ai-providers/ollama.ts`

Ollama Chat API (OpenAI-kompatibel):

```typescript
class OllamaProvider implements AIProvider {
  // Modell: frei wählbar (llama3.2, qwen2.5, etc.)
  // Endpoint: http://localhost:11434/api/chat
  // Kein Auth nötig
  // Tool-Format: identisch zu OpenAI
}
```

> Ollama unterstützt Tool-Use ab Version 0.3.x mit kompatiblen Modellen
> (llama3.2, qwen2.5-coder, mistral-nemo, etc.).

---

## Schritt 4.6 — `views/chat-view.ts`

Obsidian `ItemView` in der rechten Sidebar.

### UI-Elemente:
```
┌─────────────────────────────────────┐
│  Obsidian MCP Chat          [⚙️]   │
│  Provider: [Claude ▼]              │
├─────────────────────────────────────┤
│                                     │
│  Du: Erstelle eine Notiz über KI   │
│                                     │
│  Claude: Ich habe die Notiz         │
│  "KI-Überblick.md" erstellt mit... │
│                                     │
│  [Tool: create_note ✓]              │
│                                     │
├─────────────────────────────────────┤
│  [Nachricht eingeben...     ] [→]  │
└─────────────────────────────────────┘
```

### Verhalten:
- Tool-Calls werden als eingeklappte Blöcke angezeigt (`[Tool: create_note ✓]`)
- Streaming-Antworten wo möglich (Claude + OpenAI)
- Markdown-Rendering in Antworten
- Vault-Kontext wird automatisch hinzugefügt (welcher Vault aktiv ist)
- "Aktuelle Notiz teilen" Button (fügt aktuell geöffnete Notiz als Kontext ein)

---

## Schritt 4.7 — Settings-Erweiterungen

Neuer Abschnitt in `settings.ts`:

```
[✓] Chat-Sidebar aktivieren

Provider: [Claude ▼] [OpenAI] [Ollama]

Wenn Claude:
  API Key: [sk-ant-...]
  Modell:  [claude-sonnet-4-6 ▼]

Wenn OpenAI:
  API Key: [sk-...]
  Modell:  [gpt-4o ▼]

Wenn Ollama:
  URL:     [http://localhost:11434]
  Modell:  [llama3.2]
```

---

## Schritt 4.8 — `main.ts` Erweiterungen

```typescript
// View registrieren (nur wenn Chat aktiviert)
if (this.settings.enableChat) {
  this.registerView(
    VIEW_TYPE_MCP_CHAT,
    (leaf) => new MCPChatView(leaf, this)
  );

  this.addRibbonIcon("message-square", "MCP Chat öffnen", () => {
    this.activateChatView();
  });

  this.addCommand({
    id: "open-mcp-chat",
    name: "MCP Chat öffnen",
    callback: () => this.activateChatView(),
  });
}
```

---

## Testen nach Phase 4

1. Settings → Chat aktivieren → API-Key eingeben
2. Ribbon-Icon klicken → Chat-Sidebar öffnet sich
3. "Erstelle eine Notiz namens Test" → Notiz soll im Vault auftauchen
4. "Zeige mir die Struktur meines Vaults" → Tree soll angezeigt werden
5. Provider wechseln → gleiche Anfragen testen

**Erwartetes Ergebnis:** Vollständiger Obsidian-interner KI-Assistent.

---

## Abhängigkeit zu anderen Phasen

- Braucht Phase 1 (Server muss laufen)
- Braucht Phase 2 (Plugin-Grundstruktur)
- Phase 3 unabhängig (Chat funktioniert auch mit Python-Fallback)
