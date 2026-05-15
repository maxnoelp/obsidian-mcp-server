import * as http from "http";

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

interface PendingRequest {
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
}

export class MCPClient {
	private port: number;
	private sessionUrl = "";
	private req: http.ClientRequest | null = null;
	private pending = new Map<number, PendingRequest>();
	private nextId = 1;
	private buffer = "";
	private connected = false;

	constructor(port: number) {
		this.port = port;
	}

	// ── Connection ────────────────────────────────────────────────────────────

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.disconnect();
				reject(new Error("Verbindungs-Timeout (10s). Ist der Server gestartet?"));
			}, 10000);

			this.req = http.get(
				{ hostname: "127.0.0.1", port: this.port, path: "/sse" },
				(res) => {
					if (res.statusCode !== 200) {
						clearTimeout(timer);
						reject(new Error(`Server antwortet mit HTTP ${res.statusCode}`));
						return;
					}

					res.setEncoding("utf-8");

					res.on("data", (chunk: string) => {
						this.buffer += chunk;
						this.parseBuffer(resolve, timer);
					});

					res.on("error", (err) => {
						clearTimeout(timer);
						reject(new Error(`Stream-Fehler: ${err.message}`));
					});

					res.on("end", () => {
						this.connected = false;
					});
				}
			);

			this.req.on("error", (err) => {
				clearTimeout(timer);
				reject(new Error(`Verbindung fehlgeschlagen: ${err.message}`));
			});
		});
	}

	// Parse incoming SSE stream line by line
	private parseBuffer(onEndpoint?: (v: void) => void, timer?: ReturnType<typeof setTimeout>): void {
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";

		let evtType = "";
		let evtData = "";

		for (const line of lines) {
			if (line.startsWith("event:")) {
				evtType = line.slice(6).trim();
			} else if (line.startsWith("data:")) {
				evtData = line.slice(5).trim();
			} else if (line.trim() === "") {
				this.handleEvent(evtType, evtData, onEndpoint, timer);
				evtType = "";
				evtData = "";
			}
		}
	}

	private handleEvent(
		type: string,
		data: string,
		onEndpoint?: (v: void) => void,
		timer?: ReturnType<typeof setTimeout>
	): void {
		if (type === "endpoint" && data) {
			this.sessionUrl = data.startsWith("http")
				? data
				: `http://127.0.0.1:${this.port}${data}`;
			this.connected = true;

			if (onEndpoint && timer) {
				clearTimeout(timer);
				this.initialize().then(onEndpoint).catch(console.error);
			}
		} else if (type === "message" && data) {
			try {
				const msg = JSON.parse(data) as {
					id: number;
					result?: unknown;
					error?: { message: string };
				};
				const handler = this.pending.get(msg.id);
				if (!handler) return;
				this.pending.delete(msg.id);
				if (msg.error) handler.reject(new Error(msg.error.message));
				else handler.resolve(msg.result);
			} catch {
				// ignore malformed messages
			}
		}
	}

	private async initialize(): Promise<void> {
		await this.send("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "obsidian-mcp-chat", version: "1.0.0" },
		});
	}

	// ── JSON-RPC ──────────────────────────────────────────────────────────────

	private send(method: string, params?: unknown): Promise<unknown> {
		const id = this.nextId++;
		const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });

		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });

			const url = new URL(this.sessionUrl);
			const opts: http.RequestOptions = {
				hostname: url.hostname,
				port: parseInt(url.port || "80"),
				path: url.pathname + url.search,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(body),
				},
			};

			const req = http.request(opts, (res) => {
				// Response arrives via SSE stream, not here
				res.resume();
			});
			req.on("error", reject);
			req.write(body);
			req.end();

			setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					reject(new Error(`Timeout bei ${method}`));
				}
			}, 30000);
		});
	}

	// ── Public API ────────────────────────────────────────────────────────────

	async listTools(): Promise<MCPTool[]> {
		const result = await this.send("tools/list") as { tools?: MCPTool[] };
		return result?.tools ?? [];
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		const result = await this.send("tools/call", { name, arguments: args }) as {
			content?: Array<{ type: string; text?: string }>;
		};
		if (Array.isArray(result?.content)) {
			return result.content
				.filter((c) => c.type === "text")
				.map((c) => c.text ?? "")
				.join("\n");
		}
		return JSON.stringify(result, null, 2);
	}

	disconnect(): void {
		this.req?.destroy();
		this.req = null;
		this.sessionUrl = "";
		this.connected = false;
		this.buffer = "";
		this.pending.clear();
	}

	isConnected(): boolean {
		return this.connected;
	}
}
