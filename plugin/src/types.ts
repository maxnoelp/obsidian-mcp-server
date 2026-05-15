export interface VaultConfig {
	name: string;
	path: string;
}

export interface ObsidianMCPSettings {
	serverPort: number;
	vaults: VaultConfig[];
	serverExecutablePath: string;
	enableChat: boolean;
	chatProvider: "claude" | "openai" | "ollama";
	claudeApiKey: string;
	claudeModel: string;
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
	claudeModel: "claude-sonnet-4-6",
	openaiApiKey: "",
	openaiModel: "gpt-4o",
	ollamaUrl: "http://localhost:11434",
	ollamaModel: "llama3.2",
};

export type ServerStatus = "stopped" | "starting" | "running" | "error";
