import { z } from "zod";
import { agentConfig } from "@/agent/type.js";
import type { AgentConfig } from "@/agent/type.js";
import { modelMessageSchema } from "ai";
import type { ToolSet, SystemModelMessage, StreamTextOnFinishCallback, StreamTextOnErrorCallback } from "ai";

const streamTextInput = z.object({
    agent: agentConfig,
    messages: z.array(modelMessageSchema),
    tools: z.any().optional()
});

// 使用自定义的 AgentConfig 类型而不是从 Zod 推断
export type StreamTextInput<TOOLS extends ToolSet = ToolSet> = {
    /** Agent 配置 */
    agent: AgentConfig;
    /** 消息列表 */
    messages: z.infer<typeof modelMessageSchema>[];
    /** 工具集合（可选） */
    tools?: TOOLS;
    
    // ============ 提示词参数 ============
    /** 系统消息（可选）- 用于设置 AI 助手的角色和行为准则 */
    system?: string[];
    
    // ============ 生成控制参数 ============
    /** 最大输出令牌数（可选）- 限制生成文本的最大长度 */
    maxOutputTokens?: number;
    /** 温度设置（可选）- 控制输出的随机性，范围 0-2，较高值更随机 */
    temperature?: number;
    /** 核采样概率（可选）- 范围 0-1，控制采样的概率质量 */
    topP?: number;
    
    // ============ 请求控制参数 ============
    /** 最大重试次数（可选）- 默认 2，设置为 0 禁用重试 */
    maxRetries?: number;
    /** 中止信号（可选）- 用于取消正在进行的请求 */
    abortSignal?: AbortSignal;
    /** 超时时间（可选）- 以毫秒为单位 */
    timeout?: number;
    
    // ============ 回调函数 ============
    /** 完成回调（可选）- 在 LLM 响应和所有工具执行完成后调用 */
    onFinish?: StreamTextOnFinishCallback<TOOLS>;
    /** 错误回调（可选）- 在流处理过程中发生错误时调用 */
    onError?: StreamTextOnErrorCallback;
};