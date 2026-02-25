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

/**
 * 连接配置：定义如何连接到 AI 服务
 * CLI 用户只需提供这些信息
 */
export interface ConnectionConfig {
    /** 行为配置名称（引用 Core 中的预设配置） */
    name: string;
    /** API 基础 URL */
    base_url: string;
    /** API 密钥 */
    api_key: string;
    /** 模型名称 */
    model: string;
    /** 最大重试次数（可选） */
    max_retries?: number;
    /** 超时时间（毫秒，可选） */
    timeout?: number;
    /** 覆盖行为配置（可选） */
    overrides?: Partial<BehaviorConfig>;
}

/**
 * 行为配置：定义 Agent 的行为特征
 * 由 Core 包提供，不包含连接信息
 */
export interface BehaviorConfig {
    /** 模型 ID */
    model_id: string;
    /** 提供商名称 */
    provider: string;
    /** 启用的工具列表 */
    tools: string[];
    /** 系统提示词 */
    prompt: string;
    /** 工具选择策略 */
    tool_choice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
    /** 额外的请求参数 */
    extra_body?: Record<string, any>;
    /** 最大输出 token 数 */
    max_output_tokens?: number;
    /** 温度参数 */
    temperature?: number;
    /** Top-p 参数 */
    top_p?: number;
    /** 最大步骤数 */
    max_steps?: number;
    /** 最大重试次数 */
    max_retries?: number;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 配置版本 */
    version?: string;
    /** 配置描述 */
    description?: string;
    /** MCP 配置 */
    mcp?: Record<string, any>;
}
