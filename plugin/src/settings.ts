import { App, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";
import ObsidianMCPPlugin from "./main";
import { VaultConfig } from "./types";

export class ObsidianMCPSettingTab extends PluginSettingTab {
	plugin: ObsidianMCPPlugin;

	constructor(app: App, plugin: ObsidianMCPPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Server ────────────────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "MCP Server" });

		new Setting(containerEl)
			.setName("Port")
			.setDesc("Port auf dem der MCP-Server lauscht (Standard: 3333)")
			.addText((t) =>
				t.setPlaceholder("3333")
					.setValue(String(this.plugin.settings.serverPort))
					.onChange(async (v) => {
						const port = parseInt(v);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.serverPort = port;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Server-Executable (optional)")
			.setDesc("Pfad zur obsidian-mcp-server.exe. Leer = automatische Erkennung.")
			.addText((t) =>
				t.setPlaceholder("C:/pfad/zu/obsidian-mcp-server.exe")
					.setValue(this.plugin.settings.serverExecutablePath)
					.onChange(async (v) => {
						this.plugin.settings.serverExecutablePath = v.trim();
						await this.plugin.saveSettings();
					})
			);

		// Server Status
		const statusSetting = new Setting(containerEl)
			.setName("Server-Status")
			.setDesc("Aktueller Zustand des MCP-Servers");
		const statusRow = statusSetting.settingEl.createDiv("mcp-server-status");
		const dot = statusRow.createDiv("mcp-status-dot");
		const statusText = statusRow.createSpan();
		this.refreshStatusDisplay(dot, statusText);

		statusSetting
			.addButton((btn) =>
				btn.setButtonText("Neustart").setCta().onClick(async () => {
					btn.setDisabled(true).setButtonText("Startet…");
					await this.plugin.serverManager.restart();
					btn.setDisabled(false).setButtonText("Neustart");
					this.refreshStatusDisplay(dot, statusText);
				})
			)
			.addButton((btn) =>
				btn.setButtonText("Log öffnen").onClick(() => {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const { shell } = require("electron");
					shell.openPath(this.plugin.serverManager.logPath);
				})
			);

		// ── Vaults ───────────────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "Vaults" });
		this.renderVaultList(containerEl);

		new Setting(containerEl)
			.setName("Aktuellen Vault hinzufügen")
			.setDesc("Fügt den aktuell in Obsidian geöffneten Vault hinzu")
			.addButton((btn) =>
				btn.setButtonText("Hinzufügen").setCta().onClick(async () => {
					const basePath = (this.app.vault.adapter as any).getBasePath?.() as string | undefined;
					if (!basePath) { new Notice("Vault-Pfad nicht ermittelbar."); return; }
					const name = this.app.vault.getName();
					if (this.plugin.settings.vaults.some((v) => v.path === basePath)) {
						new Notice(`Vault '${name}' ist bereits konfiguriert.`); return;
					}
					this.plugin.settings.vaults.push({ name, path: basePath });
					await this.plugin.saveSettings();
					await this.plugin.serverManager.syncVaults(this.plugin.settings.vaults);
					new Notice(`Vault '${name}' hinzugefügt.`);
					this.display();
				})
			);

		let mName = "", mPath = "";
		new Setting(containerEl)
			.setName("Anderen Vault hinzufügen")
			.setDesc("Vault manuell über Name und Pfad hinzufügen")
			.addText((t: TextComponent) => { t.setPlaceholder("Name").onChange((v) => { mName = v.trim(); }); return t; })
			.addText((t: TextComponent) => { t.setPlaceholder("C:/Pfad/zum/Vault").onChange((v) => { mPath = v.trim(); }); return t; })
			.addButton((btn) =>
				btn.setButtonText("Hinzufügen").onClick(async () => {
					if (!mName || !mPath) { new Notice("Name und Pfad angeben."); return; }
					this.plugin.settings.vaults.push({ name: mName, path: mPath });
					await this.plugin.saveSettings();
					await this.plugin.serverManager.syncVaults(this.plugin.settings.vaults);
					new Notice(`Vault '${mName}' hinzugefügt.`);
					mName = ""; mPath = "";
					this.display();
				})
			);

		// ── Verbindungs-Info ─────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "Verbindungs-Info" });
		const port = this.plugin.settings.serverPort;
		const info = containerEl.createDiv("mcp-connection-info");
		info.createEl("p").innerHTML = `<strong>VS Code / OpenWebUI:</strong> <code>http://127.0.0.1:${port}/sse</code>`;
		info.createEl("p").innerHTML = `<strong>Claude Desktop:</strong> Executable mit <code>--transport stdio</code> starten`;

		// ── Chat-Sidebar ──────────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "Chat-Sidebar" });

		new Setting(containerEl)
			.setName("Chat-Sidebar aktivieren")
			.setDesc("Eingebettete KI-Chat-Sidebar direkt in Obsidian (eigener API-Key nötig)")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableChat).onChange(async (v) => {
					this.plugin.settings.enableChat = v;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		if (this.plugin.settings.enableChat) {
			new Setting(containerEl)
				.setName("KI-Provider")
				.setDesc("Welchen KI-Dienst soll der Chat verwenden?")
				.addDropdown((d) =>
					d.addOption("claude", "Claude (Anthropic)")
						.addOption("openai", "OpenAI (GPT)")
						.addOption("ollama", "Ollama (lokal)")
						.setValue(this.plugin.settings.chatProvider)
						.onChange(async (v) => {
							this.plugin.settings.chatProvider = v as "claude" | "openai" | "ollama";
							await this.plugin.saveSettings();
							this.display();
						})
				);

			if (this.plugin.settings.chatProvider === "claude") {
				new Setting(containerEl)
					.setName("Anthropic API-Key")
					.setDesc("sk-ant-…")
					.addText((t) =>
						t.setPlaceholder("sk-ant-api03-…")
							.setValue(this.plugin.settings.claudeApiKey)
							.onChange(async (v) => {
								this.plugin.settings.claudeApiKey = v.trim();
								await this.plugin.saveSettings();
							})
					);
				new Setting(containerEl)
					.setName("Modell")
					.addDropdown((d) =>
						d.addOption("claude-sonnet-4-6", "Claude Sonnet 4.6")
							.addOption("claude-opus-4-7", "Claude Opus 4.7")
							.addOption("claude-haiku-4-5-20251001", "Claude Haiku 4.5")
							.setValue(this.plugin.settings.claudeModel)
							.onChange(async (v) => {
								this.plugin.settings.claudeModel = v;
								await this.plugin.saveSettings();
							})
					);
			}

			if (this.plugin.settings.chatProvider === "openai") {
				new Setting(containerEl)
					.setName("OpenAI API-Key")
					.setDesc("sk-…")
					.addText((t) =>
						t.setPlaceholder("sk-…")
							.setValue(this.plugin.settings.openaiApiKey)
							.onChange(async (v) => {
								this.plugin.settings.openaiApiKey = v.trim();
								await this.plugin.saveSettings();
							})
					);
				new Setting(containerEl)
					.setName("Modell")
					.addDropdown((d) =>
						d.addOption("gpt-4o", "GPT-4o")
							.addOption("gpt-4o-mini", "GPT-4o mini")
							.addOption("gpt-4-turbo", "GPT-4 Turbo")
							.setValue(this.plugin.settings.openaiModel)
							.onChange(async (v) => {
								this.plugin.settings.openaiModel = v;
								await this.plugin.saveSettings();
							})
					);
			}

			if (this.plugin.settings.chatProvider === "ollama") {
				new Setting(containerEl)
					.setName("Ollama URL")
					.addText((t) =>
						t.setPlaceholder("http://localhost:11434")
							.setValue(this.plugin.settings.ollamaUrl)
							.onChange(async (v) => {
								this.plugin.settings.ollamaUrl = v.trim();
								await this.plugin.saveSettings();
							})
					);
				new Setting(containerEl)
					.setName("Modell")
					.setDesc("z.B. llama3.2, qwen2.5, mistral")
					.addText((t) =>
						t.setPlaceholder("llama3.2")
							.setValue(this.plugin.settings.ollamaModel)
							.onChange(async (v) => {
								this.plugin.settings.ollamaModel = v.trim();
								await this.plugin.saveSettings();
							})
					);
			}

			new Setting(containerEl)
				.setName("Chat öffnen")
				.addButton((btn) =>
					btn.setButtonText("Chat-Sidebar öffnen").setCta().onClick(() => {
						this.plugin.activateChatView();
					})
				);
		}
	}

	private renderVaultList(containerEl: HTMLElement) {
		const vaults = this.plugin.settings.vaults;
		if (vaults.length === 0) {
			containerEl.createEl("p", { text: "Noch keine Vaults konfiguriert.", cls: "setting-item-description" });
			return;
		}
		const list = containerEl.createDiv("mcp-vault-list");
		for (const vault of vaults) {
			const item = list.createDiv("mcp-vault-item");
			const info = item.createDiv("mcp-vault-info");
			info.createDiv({ text: vault.name, cls: "mcp-vault-name" });
			info.createDiv({ text: vault.path, cls: "mcp-vault-path" });
			const btn = item.createEl("button", { text: "Entfernen" });
			btn.onclick = async () => {
				this.plugin.settings.vaults = this.plugin.settings.vaults.filter((v) => v.path !== vault.path);
				await this.plugin.saveSettings();
				await this.plugin.serverManager.syncVaults(this.plugin.settings.vaults);
				this.display();
			};
		}
	}

	private refreshStatusDisplay(dot: HTMLElement, text: HTMLElement) {
		const s = this.plugin.serverManager.getStatus();
		dot.className = `mcp-status-dot ${s}`;
		const labels: Record<string, string> = {
			stopped: "Gestoppt",
			starting: "Startet…",
			running: `Läuft auf Port ${this.plugin.settings.serverPort}`,
			error: "Fehler beim Starten",
		};
		text.textContent = labels[s] ?? s;
	}
}
