import { MCPTool } from "../mcp-client";

export interface AIMessage {
	role: "user" | "assistant";
	content: string;
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
