import { MCPTool } from "../mcp-client";
import { AIMessage, AIProvider, AIResponse, ToolCall } from "./base";
import { nodePost } from "./request";

export class OllamaProvider implements AIProvider {
	readonly name = "Ollama";
	private url: string;
	private model: string;

	constructor(url = "http://localhost:11434", model = "llama3.2") {
		this.url = url.replace(/\/$/, "");
		this.model = model;
	}

	async chat(messages: AIMessage[], tools: MCPTool[]): Promise<AIResponse> {
		const body: Record<string, unknown> = {
			model: this.model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			stream: false,
		};
		if (tools.length > 0) {
			body.tools = tools.map((t) => ({
				type: "function",
				function: { name: t.name, description: t.description, parameters: t.inputSchema },
			}));
		}

		const raw = await nodePost(
			`${this.url}/api/chat`,
			{ "Content-Type": "application/json" },
			JSON.stringify(body)
		);

		const data = JSON.parse(raw) as {
			message: {
				content: string;
				tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
			};
		};

		const msg = data.message;
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			return {
				content: msg.content ?? "",
				toolCalls: msg.tool_calls.map((t, i): ToolCall => ({
					id: `ollama-${Date.now()}-${i}`,
					name: t.function.name,
					arguments: t.function.arguments,
				})),
			};
		}
		return { content: msg.content ?? "" };
	}
}
