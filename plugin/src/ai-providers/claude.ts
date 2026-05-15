import { MCPTool } from "../mcp-client";
import { AIMessage, AIProvider, AIResponse, ToolCall } from "./base";
import { nodePost } from "./request";

export class ClaudeProvider implements AIProvider {
	readonly name = "Claude";
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model = "claude-sonnet-4-6") {
		this.apiKey = apiKey;
		this.model = model;
	}

	async chat(messages: AIMessage[], tools: MCPTool[]): Promise<AIResponse> {
		const body: Record<string, unknown> = {
			model: this.model,
			max_tokens: 4096,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
		};
		if (tools.length > 0) {
			body.tools = tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.inputSchema,
			}));
		}

		const raw = await nodePost(
			"https://api.anthropic.com/v1/messages",
			{
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01",
			},
			JSON.stringify(body)
		);

		const data = JSON.parse(raw) as {
			content: Array<{
				type: string;
				text?: string;
				id?: string;
				name?: string;
				input?: Record<string, unknown>;
			}>;
		};

		const text = data.content
			.filter((c) => c.type === "text")
			.map((c) => c.text ?? "")
			.join("\n");

		const toolUses = data.content.filter((c) => c.type === "tool_use");
		if (toolUses.length > 0) {
			return {
				content: text,
				toolCalls: toolUses.map((t): ToolCall => ({
					id: t.id ?? crypto.randomUUID(),
					name: t.name ?? "",
					arguments: t.input ?? {},
				})),
			};
		}
		return { content: text };
	}
}
