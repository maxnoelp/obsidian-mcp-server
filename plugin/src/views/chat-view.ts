import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import { MCPClient, MCPTool } from "../mcp-client";
import { AIMessage } from "../ai-providers/base";
import { ClaudeProvider } from "../ai-providers/claude";
import { OpenAIProvider } from "../ai-providers/openai";
import { OllamaProvider } from "../ai-providers/ollama";
import type ObsidianMCPPlugin from "../main";

export const VIEW_TYPE_MCP_CHAT = "obsidian-mcp-chat";

export class MCPChatView extends ItemView {
	private plugin: ObsidianMCPPlugin;
	private mcpClient: MCPClient | null = null;
	private tools: MCPTool[] = [];
	private history: AIMessage[] = [];

	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianMCPPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return VIEW_TYPE_MCP_CHAT; }
	getDisplayText() { return "MCP Chat"; }
	getIcon() { return "message-square"; }

	async onOpen() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("mcp-chat-root");

		this.buildUI(root);
		await this.connectToServer();
	}

	private buildUI(root: HTMLElement) {
		// Header
		const header = root.createDiv("mcp-chat-header");
		header.createEl("span", { text: "MCP Chat", cls: "mcp-chat-title" });
		const clearBtn = header.createEl("button", { text: "Leeren", cls: "mcp-chat-clear-btn" });
		clearBtn.onclick = () => this.clearChat();

		// Messages
		this.messagesEl = root.createDiv("mcp-chat-messages");

		// Input row
		const inputRow = root.createDiv("mcp-chat-input-row");
		this.inputEl = inputRow.createEl("textarea", {
			placeholder: "Nachricht eingeben… (Enter = senden, Shift+Enter = neue Zeile)",
			cls: "mcp-chat-textarea",
		});
		this.inputEl.rows = 2;
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.handleSend();
			}
		});

		this.sendBtn = inputRow.createEl("button", { text: "→", cls: "mcp-chat-send-btn" });
		this.sendBtn.onclick = () => this.handleSend();
	}

	private providerLabel(): string {
		const s = this.plugin.settings;
		if (s.chatProvider === "claude") return `Claude (${s.claudeModel})`;
		if (s.chatProvider === "openai") return `OpenAI (${s.openaiModel})`;
		return `Ollama (${s.ollamaModel})`;
	}

	private getProvider() {
		const s = this.plugin.settings;
		switch (s.chatProvider) {
			case "claude":  return new ClaudeProvider(s.claudeApiKey, s.claudeModel);
			case "openai":  return new OpenAIProvider(s.openaiApiKey, s.openaiModel);
			default:        return new OllamaProvider(s.ollamaUrl, s.ollamaModel);
		}
	}

	// ── Connection ────────────────────────────────────────────────────────────

	private async connectToServer() {
		this.addSystemMsg("Verbinde mit MCP-Server…");
		try {
			this.mcpClient?.disconnect();
			this.mcpClient = new MCPClient(this.plugin.settings.serverPort);
			await this.mcpClient.connect();
			this.tools = await this.mcpClient.listTools();
			this.addSystemMsg(`Verbunden · ${this.tools.length} Tools · Provider: ${this.providerLabel()}`);
		} catch (e) {
			this.addSystemMsg(`Fehler: ${(e as Error).message}`);
		}
	}

	// ── Sending ───────────────────────────────────────────────────────────────

	private validateProvider(): string | null {
		const s = this.plugin.settings;
		if (s.chatProvider === "claude" && !s.claudeApiKey.trim())
			return "Kein Anthropic API-Key konfiguriert. Bitte in Settings → Obsidian MCP → Chat eintragen.";
		if (s.chatProvider === "openai" && !s.openaiApiKey.trim())
			return "Kein OpenAI API-Key konfiguriert. Bitte in Settings → Obsidian MCP → Chat eintragen.";
		return null;
	}

	private async handleSend() {
		const text = this.inputEl.value.trim();
		if (!text) return;

		const configError = this.validateProvider();
		if (configError) {
			this.addSystemMsg(configError);
			return;
		}

		this.inputEl.value = "";
		this.setInputEnabled(false);

		this.addMsg("user", text);
		this.history.push({ role: "user", content: text });

		if (!this.mcpClient?.isConnected()) {
			await this.connectToServer();
		}

		this.addSystemMsg("Denkt…");
		try {
			await this.runLoop();
		} catch (e) {
			this.removeLastSystemMsg();
			const msg = (e as Error).message;
			if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
				const p = this.plugin.settings.chatProvider;
				if (p === "ollama")
					this.addSystemMsg(`Ollama nicht erreichbar (${this.plugin.settings.ollamaUrl}). Ist Ollama gestartet?`);
				else
					this.addSystemMsg(`API nicht erreichbar: ${msg}`);
			} else {
				this.addSystemMsg(`Fehler: ${msg}`);
			}
		} finally {
			this.setInputEnabled(true);
			this.inputEl.focus();
		}
	}

	private async runLoop() {
		const provider = this.getProvider();

		for (let round = 0; round < 8; round++) {
			const response = await provider.chat(this.history, this.tools);
			this.removeLastSystemMsg();

			if (!response.toolCalls || response.toolCalls.length === 0) {
				this.addMsg("assistant", response.content);
				this.history.push({ role: "assistant", content: response.content });
				return;
			}

			// Show partial text if present
			if (response.content.trim()) {
				this.addMsg("assistant", response.content);
			}

			// Execute each tool call
			const toolResultLines: string[] = [];
			for (const tc of response.toolCalls) {
				let result: string;
				try {
					result = await this.mcpClient!.callTool(tc.name, tc.arguments);
				} catch (e) {
					result = `Fehler: ${(e as Error).message}`;
				}
				this.addToolMsg(tc.name, result);
				toolResultLines.push(`[${tc.name}]\n${result}`);
			}

			// Append to history and continue loop
			const toolNames = response.toolCalls.map((t) => t.name).join(", ");
			const assistantEntry = response.content.trim()
				? `${response.content}\n(Tools aufgerufen: ${toolNames})`
				: `(Tools aufgerufen: ${toolNames})`;
			this.history.push({ role: "assistant", content: assistantEntry });
			this.history.push({ role: "user", content: `Tool-Ergebnisse:\n${toolResultLines.join("\n\n")}` });

			this.addSystemMsg("Verarbeitet Ergebnisse…");
		}

		this.removeLastSystemMsg();
		this.addSystemMsg("Maximale Runden erreicht.");
	}

	// ── UI helpers ────────────────────────────────────────────────────────────

	private addMsg(role: "user" | "assistant", content: string) {
		const el = this.messagesEl.createDiv(`mcp-msg mcp-msg-${role}`);
		el.createEl("strong", { text: role === "user" ? "Du" : this.providerLabel(), cls: "mcp-msg-label" });
		const body = el.createDiv("mcp-msg-body");
		MarkdownRenderer.render(this.app, content, body, "", this);
		this.scrollBottom();
	}

	private addToolMsg(toolName: string, result: string) {
		const el = this.messagesEl.createDiv("mcp-msg mcp-msg-tool");
		const details = el.createEl("details");
		details.createEl("summary", { text: `🔧 ${toolName}` });
		const pre = details.createEl("pre", { cls: "mcp-tool-result" });
		pre.textContent = result.length > 800 ? result.slice(0, 800) + "\n…" : result;
		this.scrollBottom();
	}

	private addSystemMsg(text: string) {
		const el = this.messagesEl.createDiv("mcp-msg mcp-msg-system");
		el.dataset.system = "1";
		el.createEl("em", { text });
		this.scrollBottom();
	}

	private removeLastSystemMsg() {
		const items = this.messagesEl.querySelectorAll("[data-system='1']");
		items[items.length - 1]?.remove();
	}

	private clearChat() {
		this.history = [];
		this.messagesEl.empty();
		this.addSystemMsg("Chat geleert.");
	}

	private setInputEnabled(enabled: boolean) {
		this.inputEl.disabled = !enabled;
		this.sendBtn.disabled = !enabled;
	}

	private scrollBottom() {
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	async onClose() {
		this.mcpClient?.disconnect();
	}
}
