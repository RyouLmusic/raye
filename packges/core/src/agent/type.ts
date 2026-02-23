import { z } from "zod";
import type { ToolName } from "@/tools/tools-register.ts";

export const agentConfig = z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    base_url: z.string(),
    api_key: z.string(),
    model: z.string(),
    model_id: z.string(),
    provider: z.string(),
    extra_body: z.record(z.string(), z.any()).default({}),
    prompt: z.string().optional(),
    max_output_tokens: z.number().optional(),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    max_retries: z.number().optional(),
    max_steps: z.number().optional(),
    timeout: z.number().optional(),  // 超时时间，单位为毫秒
    tools: z.array(z.string()).default([]),  // 字符串数组（工具名称）
    tool_choice: z.union([
        z.literal('auto'),
        z.literal('required'),
        z.literal('none'),
        z.object({
            type: z.literal('tool'),
            toolName: z.string()
        })
    ]).optional(),  // 工具选择策略
    mcp: z.record(z.string(), z.any()).default({})
});

export const agentConfigList = z.array(agentConfig);

// 基础类型（从 Zod 推断）
type BaseAgentConfig = z.infer<typeof agentConfig>;

// 增强类型：将 tools 细化为具体的工具名称类型
export type AgentConfig = Omit<BaseAgentConfig, 'tools'> & {
    tools: ToolName[];  // 类型安全的工具名称数组
};

export type AgentConfigs = AgentConfig[];