import * as http from "http";
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ObsidianMCPSettings, ServerStatus, VaultConfig } from "./types";

export class ServerManager {
	private process: ChildProcess | null = null;
	private status: ServerStatus = "stopped";
	private settings: ObsidianMCPSettings;
	private pluginDir: string;
	private onStatusChange: (status: ServerStatus) => void;
	private logStream: fs.WriteStream | null = null;

	readonly logPath: string;

	constructor(
		settings: ObsidianMCPSettings,
		pluginDir: string,
		onStatusChange: (status: ServerStatus) => void
	) {
		this.settings = settings;
		this.pluginDir = pluginDir;
		this.onStatusChange = onStatusChange;
		this.logPath = path.join(pluginDir, "server.log");
	}

	// ── Logging ───────────────────────────────────────────────────────────────

	private openLog(): void {
		try {
			this.logStream = fs.createWriteStream(this.logPath, { flags: "a" });
		} catch {
			this.logStream = null;
		}
	}

	private log(line: string): void {
		const ts = new Date().toISOString();
		const entry = `[${ts}] ${line}\n`;
		console.log("[MCP]", line);
		this.logStream?.write(entry);
	}

	private closeLog(): void {
		this.logStream?.end();
		this.logStream = null;
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private setStatus(status: ServerStatus): void {
		this.status = status;
		this.onStatusChange(status);
	}

	private getExecutablePath(): { cmd: string; args: string[] } {
		if (this.settings.serverExecutablePath) {
			const exists = fs.existsSync(this.settings.serverExecutablePath);
			this.log(`Manueller Pfad: ${this.settings.serverExecutablePath} (existiert: ${exists})`);
			return { cmd: this.settings.serverExecutablePath, args: [] };
		}

		const suffix =
			process.platform === "win32"
				? "obsidian-mcp-server.exe"
				: process.platform === "darwin"
				? "obsidian-mcp-server-macos"
				: "obsidian-mcp-server-linux";

		const bundled = path.join(this.pluginDir, "bin", suffix);
		this.log(`Suche Executable: ${bundled} (existiert: ${fs.existsSync(bundled)})`);

		if (fs.existsSync(bundled)) {
			return { cmd: bundled, args: [] };
		}

		const serverScript = path.join(this.pluginDir, "..", "..", "server", "main.py");
		this.log(`Fallback auf Python: ${serverScript} (existiert: ${fs.existsSync(serverScript)})`);
		return { cmd: "python", args: [serverScript] };
	}

	private getConfigPath(): string {
		return path.join(os.homedir(), ".obsidian-mcp", "config.json");
	}

	async syncVaults(vaults: VaultConfig[]): Promise<void> {
		const configDir = path.join(os.homedir(), ".obsidian-mcp");
		if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
		const vaultMap: Record<string, string> = {};
		for (const v of vaults) vaultMap[v.name] = v.path;
		const configJson = JSON.stringify({ vaults: vaultMap }, null, 2);
		fs.writeFileSync(this.getConfigPath(), configJson, "utf-8");
		this.log(`Vault-Config geschrieben: ${this.getConfigPath()}\n${configJson}`);
	}

	// Uses Node's http module — works with streaming SSE endpoints
	private waitForReady(port: number, timeoutMs = 25000): Promise<boolean> {
		return new Promise((resolve) => {
			const deadline = Date.now() + timeoutMs;
			let attempts = 0;

			const tryConnect = () => {
				if (Date.now() >= deadline) {
					this.log(`Health-Check: Timeout nach ${attempts} Versuchen`);
					resolve(false);
					return;
				}
				attempts++;
				const req = http.get(
					{ hostname: "127.0.0.1", port, path: "/sse", timeout: 2000 },
					(res) => {
						req.destroy();
						this.log(`Health-Check: HTTP ${res.statusCode} nach ${attempts} Versuchen`);
						resolve(res.statusCode === 200);
					}
				);
				req.on("error", (e) => {
					this.log(`Health-Check #${attempts}: ${e.message}`);
					setTimeout(tryConnect, 800);
				});
				req.on("timeout", () => {
					req.destroy();
					setTimeout(tryConnect, 800);
				});
			};

			setTimeout(tryConnect, 2000); // Give PyInstaller time to extract
		});
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	private isPortInUse(port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const req = http.get({ hostname: "127.0.0.1", port, path: "/sse", timeout: 1000 }, (res) => {
				req.destroy();
				resolve(res.statusCode === 200);
			});
			req.on("error", () => resolve(false));
			req.on("timeout", () => { req.destroy(); resolve(false); });
		});
	}

	async start(): Promise<void> {
		if (this.status === "running" || this.status === "starting") return;

		this.openLog();
		this.log("=".repeat(60));
		this.log(`START — Plattform: ${process.platform}, Plugin: ${this.pluginDir}`);

		// If port is already responding, adopt that server instead of spawning a new one
		const alreadyRunning = await this.isPortInUse(this.settings.serverPort);
		if (alreadyRunning) {
			this.log(`Port ${this.settings.serverPort} antwortet bereits — übernehme laufenden Server.`);
			this.setStatus("running");
			return;
		}

		await this.syncVaults(this.settings.vaults);
		this.setStatus("starting");

		const { cmd, args } = this.getExecutablePath();
		const serverArgs = [
			...args,
			"--transport", "sse",
			"--host", "127.0.0.1",
			"--port", String(this.settings.serverPort),
		];

		this.log(`Befehl: ${cmd} ${serverArgs.join(" ")}`);

		try {
			this.process = spawn(cmd, serverArgs, {
				stdio: ["ignore", "pipe", "pipe"],
				detached: false,
			});

			this.log(`Prozess gestartet (PID: ${this.process.pid})`);

			this.process.stdout?.on("data", (data: Buffer) => {
				this.log(`STDOUT: ${data.toString().trim()}`);
			});
			this.process.stderr?.on("data", (data: Buffer) => {
				this.log(`STDERR: ${data.toString().trim()}`);
			});

			this.process.on("exit", (code, signal) => {
				this.log(`Prozess beendet — Code: ${code}, Signal: ${signal}`);
				if (this.status !== "stopped") this.setStatus("error");
				this.process = null;
				this.closeLog();
			});

			this.process.on("error", (err) => {
				this.log(`SPAWN-FEHLER: ${err.message}`);
				this.setStatus("error");
				this.process = null;
				this.closeLog();
			});

			const ready = await this.waitForReady(this.settings.serverPort);
			if (ready) {
				this.log("Server bereit.");
				this.setStatus("running");
			} else {
				this.log("FEHLER: Server nicht erreichbar nach Timeout.");
				this.setStatus("error");
			}
		} catch (err) {
			this.log(`EXCEPTION beim Start: ${err}`);
			this.setStatus("error");
			this.closeLog();
		}
	}

	async stop(): Promise<void> {
		if (!this.process) { this.setStatus("stopped"); return; }
		this.log("Stoppe Server…");
		this.setStatus("stopped");
		this.process.kill("SIGTERM");
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => { this.process?.kill("SIGKILL"); resolve(); }, 3000);
			this.process?.on("exit", () => { clearTimeout(timeout); resolve(); });
		});
		this.process = null;
		this.closeLog();
	}

	async restart(): Promise<void> {
		await this.stop();
		await new Promise((r) => setTimeout(r, 800));
		await this.start();
	}

	isRunning(): boolean { return this.status === "running"; }
	getStatus(): ServerStatus { return this.status; }
	updateSettings(settings: ObsidianMCPSettings): void { this.settings = settings; }
}
