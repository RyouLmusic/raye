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

// ============ 状态机定义 ============

/**
 * 外层状态机 - Agent ReAct Loop States
 * 
 * 状态转换流程：
 * INIT → PLANNING → EXECUTING → OBSERVING → [COMPACTING] → PLANNING/COMPLETED/FAILED
 * 
 * INIT: 初始化 session，加载配置和初始消息
 * PLANNING: 基于当前上下文和历史，规划下一步行动（Reasoning）
 * EXECUTING: 执行 LLM 调用，处理工具调用（Acting）- 进入内层循环
 * OBSERVING: 观察执行结果，收集工具输出，更新状态
 * COMPACTING: 上下文压缩，当消息数量或token数超过阈值时触发
 * COMPLETED: 任务成功完成
 * FAILED: 任务失败
 */
export const AgentLoopState = z.enum([
    "INIT",         // 初始化
    "PLANNING",     // 规划（Reasoning）
    "EXECUTING",    // 执行（Acting）
    "OBSERVING",    // 观察结果
    "COMPACTING",   // 压缩上下文
    "COMPLETED",    // 完成
    "FAILED"        // 失败
]);

export type AgentLoopState = z.infer<typeof AgentLoopState>;

/**
 * 内层状态机 - LLM Process States
 * 
 * 状态转换流程：
 * IDLE → CALLING → STREAMING → [TOOL_EXECUTING] → SUCCESS/ERROR
 *                              ↓ (on error)
 *                           RETRYING → CALLING/ERROR
 * 
 * IDLE: 空闲状态，等待执行
 * CALLING: 发起 LLM API 调用
 * STREAMING: 处理流式输出（text-delta, tool-call, reasoning 等）
 * TOOL_EXECUTING: 执行工具调用
 * RETRYING: 遇到可重试错误，准备重试
 * SUCCESS: 执行成功
 * ERROR: 执行失败（不可重试或超过重试次数）
 */
export const ProcessState = z.enum([
    "IDLE",             // 空闲
    "CALLING",          // 调用中
    "STREAMING",        // 流式处理中
    "TOOL_EXECUTING",   // 工具执行中
    "RETRYING",         // 重试中
    "SUCCESS",          // 成功
    "ERROR"             // 错误
]);

export type ProcessState = z.infer<typeof ProcessState>;

/**
 * 外层循环的决策结果
 */
export const LoopDecision = z.enum([
    "continue",   // 继续下一轮 ReAct 循环
    "compact",    // 需要压缩上下文
    "stop"        // 停止循环（完成或失败）
]);

export type LoopDecision = z.infer<typeof LoopDecision>;

/**
 * 内层循环的执行结果
 */
export const ProcessResult = z.enum([
    "success",    // 成功完成
    "retry",      // 需要重试
    "error"       // 失败
]);

export type ProcessResult = z.infer<typeof ProcessResult>;

// ============ Loop 输入输出类型 ============

const loopInput = z.object({
    sessionId: z.string(),
    agentConfig: agentConfig,
    initialMessages: z.array(modelMessageSchema),
    /** 最大迭代次数 */
    maxIterations: z.number().default(10),
    /** 上下文压缩阈值（token数量） */
    compactThreshold: z.number().default(20),
    /** 最大 token 数量 */
    maxTokens: z.number().optional(),
});

export type LoopInput = z.infer<typeof loopInput>;

/**
 * Agent Loop 的执行上下文
 */
export interface AgentLoopContext {
    /** 当前状态 */
    state: AgentLoopState;
    /** 当前迭代次数 */
    iteration: number;
    /** 最大迭代次数 */
    maxIterations: number;
    /** 当前消息列表 */
    messages: z.infer<typeof modelMessageSchema>[];
    /** 是否需要压缩 */
    needsCompaction: boolean;
    /** 压缩阈值 */
    compactThreshold: number;
    /** 错误信息 */
    error?: Error;
}

/**
 * Process 的执行上下文
 */
export interface ProcessContext {
    /** 当前状态 */
    state: ProcessState;
    /** 重试次数 */
    retryCount: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 当前延迟时间（毫秒） */
    retryDelay: number;
    /** 错误信息 */
    error?: Error;
}