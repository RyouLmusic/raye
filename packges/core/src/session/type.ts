import { z } from "zod";
import { agentConfig } from "@/agent/type.js";
import type { AgentConfig } from "@/agent/type.js";
import { modelMessageSchema } from "ai";
import type { ModelMessage, ToolSet, SystemModelMessage, StreamTextOnFinishCallback, StreamTextOnErrorCallback } from "ai";
import type { StreamHandlers } from "@/session/stream-handler";

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
    
    // ============ 工具相关参数 ============
    /** 工具选择策略（可选）- 控制模型如何选择使用工具，可选值: 'auto' | 'required' | 'none' | { type: 'tool', toolName: string } */
    toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
    
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
    /**
     * 最大步骤数（可选）- 控制 LLM 工具调用的最大轮次
     * SDK 会自动执行：LLM → 工具调用 → 工具结果 → LLM，直到 maxSteps 耗尽或无工具调用
     * 默认: 1（单步，不自动循环）
     */
    maxSteps?: number;
    
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
 * IDLE → CALLING → STREAMING → SUCCESS/ERROR
 *          ↓ (on error)    ↓ (tool soft error / retryable)
 *       RETRYING ←─────────────┘
 *          ↓ (retry exhausted)
 *        ERROR
 * 
 * IDLE: 空闲状态，等待执行
 * CALLING: 发起 LLM API 调用
 * STREAMING: 处理流式输出（text-delta, tool-call, tool-result, reasoning 等）
 *   - SDK 已在流中自动执行工具，无需手动 TOOL_EXECUTING
 *   - 检测工具结果软错误（{ error: ... }）且可重试时 → RETRYING
 * RETRYING: 遇到可重试错误，准备重试
 * SUCCESS: 执行成功
 * ERROR: 执行失败（不可重试或超过重试次数）
 */
export const ProcessState = z.enum([
    "IDLE",         // 空闲
    "CALLING",      // 调用中
    "STREAMING",    // 流式处理中（包括 SDK 自动工具执行）
    "RETRYING",     // 重试中
    "SUCCESS",      // 成功
    "ERROR"         // 错误
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

// ============ Processor 输入类型 ============

/**
 * PlanInput - 全局规划阶段输入
 *
 * Zod schema 只覆盖可序列化的数据字段；
 * StreamHandlers 是函数集合，无法被 Zod 验证，通过 TypeScript 类型扩展携带。
 */
export const planInput = z.object({
    /** 完整消息历史（只读副本） */
    messages: z.array(modelMessageSchema),
});

export type PlanInput = z.infer<typeof planInput> & {
    /**
     * 外部注入的流式回调（可选）
     * 由 loop.ts 从 LoopObserver.planHandlers 传入。
     * 未提供时 planner 内部降级到默认的 console.log 回调。
     */
    handlers?: StreamHandlers;
};

/**
 * ReasonInput - 即时推理阶段输入（每轮 iter>1 的 PLANNING）
 */
export const reasonInput = z.object({
    /** 完整消息历史（含上一步工具观察结果） */
    messages: z.array(modelMessageSchema),
});

export type ReasonInput = z.infer<typeof reasonInput> & {
    /**
     * 外部注入的流式回调（可选）
     * 由 loop.ts 从 LoopObserver.reasonHandlers 传入。
     * 未提供时 reasoner 内部降级到默认的 console.log 回调。
     */
    handlers?: StreamHandlers;
};

/**
 * ProcessorStepResult - plan / reason / execute 三个处理器统一的结构化返回值
 *
 * Processor 在流式处理完成后提取 LLM 的完整输出，
 * 组装成可直接写入 Session 的 `message`，
 * 同时透出文本和推理内容供上层（loop.ts / TUI）使用。
 *
 * 职责边界：
 *   - Processor 负责组装 message（知道如何把 text+reasoning 变成 ModelMessage）
 *   - loop.ts 负责把 message 写入 Session（拥有 Session 的写权）
 *   - 两者各守边界，不越权
 *
 * plan / reason 不会产生工具调用，toolCalls / toolResults 恒为 undefined；
 * execute 会填充这两个字段，失败时直接 throw，不通过返回值传递错误。
 */
export interface ProcessorStepResult {
    /** LLM 输出的完整文本 */
    text: string;
    /** 模型推理过程（extended thinking / reasoning 字段，可能为空字符串） */
    reasoning: string;
    /** 结束原因（stop / length / tool-calls 等） */
    finishReason: string;
    /** Token 使用量 */
    usage?: unknown;
    /**
     * 组装好的 assistant ModelMessage，可直接传给 SessionOps.addMessage。
     *
     * 消息内容结构：
     * - 若 reasoning 非空：content = [{ type:"reasoning", text }, { type:"text", text }]
     * - 若 reasoning 为空：content = text（字符串形式，节省 token 计算空间）
     */
    message: ModelMessage;
    /** 工具调用列表（execute 专属，plan/reason 不填充） */
    toolCalls?: ProcessToolCall[];
    /** 工具执行结果（execute 专属，plan/reason 不填充） */
    toolResults?: ToolExecutionResult[];
}

// ============ Session 数据结构（纯数据）============

/**
 * Session 元数据
 */
export interface SessionMetadata {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly totalIterations: number;
    readonly totalTokens: number;
    readonly lastCompactionAt?: Date;
}

/**
 * Session - 用户与 Agent 的对话会话（不可变数据结构）
 * 
 * 职责：
 * - 存储对话历史
 * - 可序列化/反序列化
 * - 支持持久化
 */
export interface Session {
    readonly sessionId: string;
    readonly userId?: string;
    readonly agentId: string;
    readonly messages: readonly z.infer<typeof modelMessageSchema>[];
    readonly metadata: SessionMetadata;
}

// ============ Loop 输入输出类型 ============

/**
 * LoopObserver - Loop 事件观察者接口
 *
 * TUI / CLI / 测试 等外部消费者实现此接口，注入到 LoopInput.observer。
 * Loop 在关键节点回调，观察者无需关心 loop 的内部实现细节。
 *
 * 流式回调按 Processor 阶段分组（而非按流类型分组），
 * 使消费者可以对 plan / reason / execute 三个阶段差异化处理。
 */
export interface LoopObserver {
    // ── 外层状态机生命周期 ──────────────────────────────────
    /** Loop 整体开始（session 已就绪，首条消息已写入） */
    onLoopStart?: (sessionId: string) => void;
    /** 外层状态机发生状态转换 */
    onStateChange?: (from: AgentLoopState, to: AgentLoopState, iteration: number) => void;
    /** 每轮迭代开始（iteration 从 1 计数） */
    onIterationStart?: (iteration: number, maxIterations: number) => void;
    /** 每轮迭代结束 */
    onIterationEnd?: (iteration: number) => void;
    /** Loop 整体结束（成功或失败） */
    onLoopEnd?: (result: { success: boolean; iterations: number; error?: Error }) => void;
    /** 任意阶段发生错误（附带当前 Loop 状态） */
    onError?: (error: Error, state: AgentLoopState) => void;

    // ── 按 Processor 阶段分组的流式回调 ──────────────────────
    /**
     * 首轮全局规划阶段（PLANNING iter=1）
     * 对应 Processor.plan() → processFullStream
     * TUI 建议渲染为可折叠的 ThinkingBlock（标签 "Planning"）
     */
    planHandlers?: StreamHandlers;

    /**
     * 后续轮即时推理阶段（PLANNING iter>1）
     * 对应 Processor.reason() → processFullStream
     * TUI 建议渲染为可折叠的 ThinkingBlock（标签 "Reasoning"）
     */
    reasonHandlers?: StreamHandlers;

    /**
     * 主执行阶段（EXECUTING）
     * 对应 Processor.execute() → processFullStream
     * TUI 渲染为主回复区 StreamingBlock，工具调用渲染为 ToolCallLog 条目
     */
    executeHandlers?: StreamHandlers;
}

const loopInput = z.object({
    /** Session ID - 用于从 SessionManager 获取或创建 session */
    sessionId: z.string(),
    /** Agent 配置 */
    agentConfig: agentConfig,
    /** 当前轮的用户新消息（每次对话必传）*/
    message: modelMessageSchema,
    /** 最大迭代次数 */
    maxIterations: z.number().default(10),
    /** 上下文压缩阈值（消息数量） */
    compactThreshold: z.number().default(20),
    /** 最大 token 数量 */
    maxTokens: z.number().optional(),
});

export type LoopInput = z.infer<typeof loopInput> & {
    /**
     * 可选的 UI 观察者。
     * 注入后 Loop 会在每个关键节点（状态转换、LLM streaming 等）回调。
     * 不注入时 Loop 行为退化为纯 console.log 输出（后向兼容）。
     */
    observer?: LoopObserver;
    /**
     * 开启详细调试日志（可选，默认 false）。
     * 启用后会在关键节点打印消息数组结构，帮助定位 schema 校验失败等问题。
     * 也可通过环境变量 RAYE_DEBUG=1 全局开启。
     */
    debug?: boolean;
};

/**
 * Agent Loop 的执行上下文（临时状态）
 * 
 * 职责：
 * - 管理状态机状态
 * - 管理迭代计数
 * - 引用 Session（不拥有数据）
 */
export interface AgentLoopContext {
    /** 关联的 Session（单一数据源）*/
    session: Session;
    
    // ========== 执行状态（临时的）==========
    /** 当前状态 */
    state: AgentLoopState;
    /** 当前迭代次数 */
    iteration: number;
    /** 最大迭代次数 */
    maxIterations: number;
    /** 是否需要压缩 */
    needsCompaction: boolean;
    /** 压缩阈值 */
    compactThreshold: number;
    /** 错误信息 */
    error?: Error;
    /**
     * 最近一次 execute 的结束原因（来自 SDK finishReason）
     * - "stop"       : LLM 自然结束，无更多工具调用意图
     * - "tool-calls" : LLM 发起了工具调用，SDK 执行后停止（maxSteps 耗尽）
     * - "length"     : 达到 maxOutputTokens 限制，输出被截断
     * - "end-turn"   : Anthropic 模型的自然结束信号（等同 stop）
     * - "content-filter" : 内容被过滤
     */
    lastFinishReason?: string;
    /**
     * 最近一次 execute 中 LLM 发起的工具调用数量
     *
     * 用于在 finishReason 不可靠或缺失时辅助判断：
     * - 0  → LLM 本轮没有使用任何工具，纯文本响应
     * - >0 → LLM 调用了工具，可能还需继续
     */
    lastToolCallCount?: number;
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

// ============ Executor 输入/输出类型 ============

/**
 * 执行阶段工具调用描述（executor 内部与外部共用）
 */
export interface ProcessToolCall {
    id: string;
    name: string;
    args?: Record<string, unknown>;
}

/**
 * 单次工具执行结果
 */
export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    /** 序列化后的工具输出（JSON 字符串） */
    content: string;
    isError: boolean;
}

/**
 * ExecuteInput - 执行阶段输入（内层状态机公共 API）
 *
 * 刻意 **不** 继承 StreamTextInput：
 *   - StreamTextInput 是 streamTextWrapper 的直接入参，携带 SDK 级别的回调
 *     （onFinish / onError / maxSteps 等），不应暴露到 executor 的公共 API。
 *   - executor 内部会将自身字段映射为 StreamTextInput 后再调用 streamTextWrapper。
 */
export interface ExecuteInput {
    /** Agent 配置 */
    agent: AgentConfig;
    /** 消息列表（只读副本由调用方保证） */
    messages: ModelMessage[];
    /** 工具集合（可选） */
    tools?: ToolSet;

    // ── 工具相关 ──────────────────────────────────
    /** 工具选择策略（可选）- 控制模型如何选择使用工具 */
    toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };

    // ── 生成控制 ──────────────────────────────────
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;

    // ── 请求控制（由 executor 状态机自身管理，不转发给 SDK） ──
    maxRetries?: number;
    timeout?: number;
    abortSignal?: AbortSignal;

    /**
     * 外部注入的流式回调（可选）
     * 由 loop.ts 从 LoopObserver.executeHandlers 传入，透传给 processFullStream。
     * 未提供时 executor 内部降级到 defaultExecuteHandlers。
     */
    streamHandlers?: StreamHandlers;
    /**
     * 开启详细调试日志（可选，默认 false）。
     * 启用后在发起 LLM 调用前打印完整消息数组结构。
     */
    debug?: boolean;
}

