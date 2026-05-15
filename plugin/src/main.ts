import * as path from "path";
import { Plugin, WorkspaceLeaf } from "obsidian";
import { ObsidianMCPSettings, DEFAULT_SETTINGS, ServerStatus } from "./types";
import { ServerManager } from "./server-manager";
import { ObsidianMCPSettingTab } from "./settings";
import { MCPChatView, VIEW_TYPE_MCP_CHAT } from "./views/chat-view";

export default class ObsidianMCPPlugin extends Plugin {
	settings!: ObsidianMCPSettings;
	serverManager!: ServerManager;
	private statusBarItem!: HTMLElement;

	async onload() {
		await this.loadSettings();

		const basePath = (this.app.vault.adapter as any).getBasePath() as string;
		const pluginDir = path.join(basePath, ".obsidian", "plugins", this.manifest.id);

		this.serverManager = new ServerManager(
			this.settings,
			pluginDir,
			(status: ServerStatus) => this.onServerStatusChange(status)
		);

		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass("obsidian-mcp-status");
		this.updateStatusBar("stopped");

		this.addSettingTab(new ObsidianMCPSettingTab(this.app, this));

		this.addCommand({
			id: "restart-mcp-server",
			name: "MCP Server neu starten",
			callback: async () => {
				await this.serverManager.restart();
			},
		});

		// Chat-Sidebar registrieren (immer, Sichtbarkeit via Settings)
		this.registerView(VIEW_TYPE_MCP_CHAT, (leaf) => new MCPChatView(leaf, this));

		this.addRibbonIcon("message-square", "MCP Chat öffnen", () => {
			this.activateChatView();
		});

		this.addCommand({
			id: "open-mcp-chat",
			name: "MCP Chat öffnen",
			callback: () => this.activateChatView(),
		});

		this.app.workspace.onLayoutReady(async () => {
			await this.serverManager.start();
		});
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MCP_CHAT);
		await this.serverManager.stop();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.serverManager?.updateSettings(this.settings);
	}

	async activateChatView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MCP_CHAT);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false) as WorkspaceLeaf;
		await leaf.setViewState({ type: VIEW_TYPE_MCP_CHAT, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private onServerStatusChange(status: ServerStatus): void {
		this.updateStatusBar(status);
	}

	private updateStatusBar(status: ServerStatus): void {
		const labels: Record<ServerStatus, string> = {
			stopped: "MCP: gestoppt",
			starting: "MCP: startet...",
			running: `MCP :${this.settings.serverPort}`,
			error: "MCP: Fehler",
		};
		this.statusBarItem.setText(labels[status]);
		this.statusBarItem.removeClass("running", "error");
		if (status === "running") this.statusBarItem.addClass("running");
		if (status === "error") this.statusBarItem.addClass("error");
	}
}
