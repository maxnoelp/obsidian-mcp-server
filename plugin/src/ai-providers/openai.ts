import { MCPTool } from "../mcp-client";
import { AIMessage, AIProvider, AIResponse, ToolCall } from "./base";
import { nodePost } from "./request";

export class OpenAIProvider implements AIProvider {
	readonly name = "OpenAI";
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model = "gpt-4o") {
		this.apiKey = apiKey;
		this.model = model;
	}

	async chat(messages: AIMessage[], tools: MCPTool[]): Promise<AIResponse> {
		const body: Record<string, unknown> = {
			model: this.model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
		};
		if (tools.length > 0) {
			body.tools = tools.map((t) => ({
				type: "function",
				function: { name: t.name, description: t.description, parameters: t.inputSchema },
			}));
			body.tool_choice = "auto";
		}

		const raw = await nodePost(
			"https://api.openai.com/v1/chat/completions",
			{
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			JSON.stringify(body)
		);

		const data = JSON.parse(raw) as {
			choices: Array<{
				message: {
					content: string | null;
					tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
				};
			}>;
		};

		const msg = data.choices[0].message;
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			return {
				content: msg.content ?? "",
				toolCalls: msg.tool_calls.map((t): ToolCall => ({
					id: t.id,
					name: t.function.name,
					arguments: JSON.parse(t.function.arguments) as Record<string, unknown>,
				})),
			};
		}
		return { content: msg.content ?? "" };
	}
}
