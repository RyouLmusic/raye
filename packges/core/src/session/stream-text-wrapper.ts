import { generateText, streamText, stepCountIs, type ModelMessage, type StreamTextResult } from "ai";
import { Provider } from "@/provider/provider.js";
import type { StreamTextInput } from "@/session/type.js";
import { createUnifiedStreamTransform } from "@/session/stream-transformer.js";
import type { ToolSet } from "ai";
import { getToolsByNames } from "@/tools/tools-register.ts";
// 从 common 包导入
import { APP_NAME, formatDate } from "common";


export async function streamTextWrapper<TOOLS extends ToolSet = ToolSet>(input: StreamTextInput<TOOLS>): Promise<StreamTextResult<TOOLS, never>> {
    const agentConfig = input.agent;
    const languageModel = Provider.getAgentLanguage(agentConfig);
    if (!languageModel) {
        throw new Error("Agent not found in config");
    }

    // 默认错误处理回调
    const defaultOnError: typeof input.onError = (error) => {
        console.error(`[${APP_NAME}] Stream Error:`, {
            timestamp: formatDate(new Date()),
            agent: agentConfig.name,
            model: agentConfig.model,
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        });
    };

    // 默认完成回调
    const defaultOnFinish: typeof input.onFinish = (result) => {
        // 使用 totalUsage 而不是 usage，因为在流式处理中 usage 需要等流消费完才有值
        const usage = result.totalUsage || result.usage;
        
        console.log(`[${APP_NAME}] Stream Finished:`, {
            timestamp: formatDate(new Date()),
            agent: agentConfig.name,
            model: agentConfig.model,
            usage: {
                inputTokens: usage?.inputTokenDetails.noCacheTokens || 0,
                outputTokens: usage?.outputTokenDetails.textTokens || 0,
                reasoningTokens: usage?.outputTokenDetails.reasoningTokens || 0,
                totalTokens: usage?.totalTokens || 0,
            },
            finishReason: result.finishReason,
            steps: result.steps?.length || 0,
            reasoningText: result.reasoningText || '',
            text: result.text || ''
        });
    };

    const system = []
    system.push(
        [
            ...(input.agent.prompt ? [input.agent.prompt] : []),
            // any custom prompt passed into this call
            ...(input.system ?? [])
        ]
            .filter((x) => x)
            .join("\n"),
    )


    // 优先使用传入的工具，否则使用 agentConfig 中定义的工具
    let tools: ToolSet | undefined = input.tools;

    // 如果没有传入工具，但 agentConfig 中定义了工具，则从注册表加载
    if (!tools && agentConfig.tools && agentConfig.tools.length > 0) {
        tools = getToolsByNames(agentConfig.tools);
    }

    return streamText({
        // ============ 必需参数 ============
        /**
         * model: 要使用的语言模型
         * 指定用于生成文本的 AI 模型实例
         */
        model: languageModel,

        // ============ 提示词参数 (Prompt) ============
        /**
         * messages: 消息列表
         * 包含用户和助手之间的对话历史
         * 与 prompt 二选一使用
         */
        messages: [
            ...system.map(
                (x): ModelMessage => ({
                    role: "system",
                    content: x,
                }),
            ),
            ...input.messages,
        ],

        /**
         * system: 系统消息 (可选)
         * 用于设置 AI 助手的角色和行为准则
         * 可以是字符串或消息对象
         */
        // system: system,

        // ============ 工具相关参数 (Tools) ============
        /**
         * tools: 工具集合 (可选)
         * 定义模型可以调用的工具函数
         * 需要模型支持工具调用功能
         */
        tools: tools,

        /**
         * toolChoice: 工具选择策略 (可选)
         * 控制模型如何选择使用工具
         * 可选值: 'auto' | 'required' | 'none' | { type: 'tool', toolName: string }
         * 默认: 'auto'
         */
        // toolChoice: 'auto',

        /**
         * activeTools: 激活的工具列表 (可选)
         * 限制模型可调用的工具，但不改变工具类型
         */
        // activeTools: ['calculate', 'weather'],

        // ============ 生成控制参数 (CallSettings) ============
        /**
         * maxOutputTokens: 最大输出令牌数 (可选)
         * 限制生成文本的最大长度
         * 优先使用 input 中的值，否则使用 agentConfig 中的值
         */
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : (agentConfig.max_output_tokens !== undefined && { maxOutputTokens: agentConfig.max_output_tokens })),

        /**
         * temperature: 温度设置 (可选)
         * 控制输出的随机性，范围取决于提供商
         * 较高值 (如 0.8) 更随机，较低值 (如 0.2) 更确定
         * 建议只设置 temperature 或 topP 之一
         * 优先使用 input 中的值，否则使用 agentConfig 中的值
         */
        ...(input.temperature !== undefined ? { temperature: input.temperature } : (agentConfig.temperature !== undefined && { temperature: agentConfig.temperature })),

        /**
         * topP: 核采样概率 (可选)
         * 范围 0-1，控制采样的概率质量
         * 例如 0.1 表示只考虑前 10% 概率的令牌
         * 建议只设置 temperature 或 topP 之一
         * 优先使用 input 中的值，否则使用 agentConfig 中的值
         */
        ...(input.topP !== undefined ? { topP: input.topP } : (agentConfig.top_p !== undefined && { topP: agentConfig.top_p })),

        /**
         * topK: Top-K 采样 (可选)
         * 只从概率最高的 K 个选项中采样
         * 用于移除"长尾"低概率响应
         */
        // topK: 50,

        /**
         * presencePenalty: 存在惩罚 (可选)
         * 影响模型重复提示中已有信息的可能性
         * 范围 -1 (增加重复) 到 1 (减少重复)，0 表示无惩罚
         */
        // presencePenalty: 0,

        /**
         * frequencyPenalty: 频率惩罚 (可选)
         * 影响模型重复使用相同词汇的可能性
         * 范围 -1 (增加重复) 到 1 (减少重复)，0 表示无惩罚
         */
        // frequencyPenalty: 0,

        /**
         * stopSequences: 停止序列 (可选)
         * 当生成这些序列时停止生成
         * 提供商可能限制停止序列的数量
         */
        // stopSequences: ['\n\n', '---'],

        /**
         * seed: 随机种子 (可选)
         * 用于确定性采样的整数种子
         * 如果设置且模型支持，调用将生成确定性结果
         */
        // seed: 42,

        // ============ 请求控制参数 ============
        /**
         * maxRetries: 最大重试次数 (可选)
         * 设置为 0 禁用重试
         * 默认: 2
         * 优先使用 input 中的值，否则使用 agentConfig 中的值
         */
        ...(input.maxRetries !== undefined ? { maxRetries: input.maxRetries } : (agentConfig.max_retries !== undefined && { maxRetries: agentConfig.max_retries })),

        /**
         * abortSignal: 中止信号 (可选)
         * 用于取消正在进行的请求
         */
        ...(input.abortSignal && { abortSignal: input.abortSignal }),

        /**
         * timeout: 超时时间 (可选)
         * 以毫秒为单位，超时后调用将被中止
         * 可以是数字或对象 { totalMs: number }
         * 优先使用 input 中的值，否则使用 agentConfig 中的值
         */
        ...(input.timeout !== undefined ? { timeout: input.timeout } : (agentConfig.timeout !== undefined && { timeout: agentConfig.timeout })),

        /**
         * headers: 额外的 HTTP 头 (可选)
         * 仅适用于基于 HTTP 的提供商
         */
        // headers: { 'Custom-Header': 'value' },

        // ============ 提供商特定参数 ============
        /**
         * providerOptions: 提供商特定选项 (可选)
         * 传递给提供商的额外选项
         * 用于启用提供商特定的功能
         */
        providerOptions: {
            ...agentConfig.extra_body,
        },

        // ============ 高级控制参数 ============
        /**
         * stopWhen: 停止条件 (可选)
         * 在有工具结果时的停止生成条件，控制工具调用的最大轮次
         * 通过 maxSteps 转换而来：maxSteps=N → stopWhen: stepCountIs(N)
         * 默认: stepCountIs(1)（单步，不自动循环）
         */
        ...(input.maxSteps !== undefined && { stopWhen: stepCountIs(input.maxSteps) }),

        /**
         * prepareStep: 步骤准备函数 (可选)
         * 为每个步骤提供不同的设置
         * 接收 { steps, stepNumber, model } 作为参数
         */
        // prepareStep: ({ steps, stepNumber }) => ({ temperature: 0.7 }),

        /**
         * experimental_repairToolCall: 工具调用修复函数 (可选)
         * 尝试修复解析失败的工具调用
         */
        // experimental_repairToolCall: (toolCall) => { ... },

        /**
         * experimental_transform: 流转换器 (可选)
         * 对输出流进行自定义转换
         * 可以是单个转换器或转换器数组
         * 必须保持流结构以确保 streamText 正常工作
         */
        experimental_transform: createUnifiedStreamTransform(),

        /**
         * experimental_download: 自定义下载函数 (可选)
         * 用于下载 URL 的自定义函数
         * 默认情况下，如果模型不支持 URL，会自动下载文件
         */
        // experimental_download: async (url) => { ... },

        /**
         * includeRawChunks: 包含原始数据块 (可选)
         * 启用后，流中会包含类型为 'raw' 的原始数据块
         * 允许访问提供商的未处理数据
         * 默认: false
         */
        // includeRawChunks: false,

        // ============ 结构化输出 ============
        /**
         * output: 结构化输出规范 (可选)
         * 用于从 LLM 响应中解析结构化输出
         */
        // output: { ... },

        // ============ 回调函数 ============
        /**
         * onChunk: 数据块回调 (可选)
         * 为流的每个数据块调用
         * 流处理将暂停直到回调 promise 解析
         */
        // onChunk: async (chunk) => { console.log(chunk); },

        /**
         * onError: 错误回调 (可选)
         * 在流处理过程中发生错误时调用
         * 可用于记录错误
         */
        onError: input.onError || defaultOnError,

        /**
         * onFinish: 完成回调 (可选)
         * 在 LLM 响应和所有工具执行完成后调用
         * usage 是所有步骤的综合使用情况
         */
        onFinish: input.onFinish || defaultOnFinish,

        /**
         * onAbort: 中止回调 (可选)
         * 在请求被中止时调用
         */
        onAbort: async () => { console.log('已中止'); },

        /**
         * onStepFinish: 步骤完成回调 (可选)
         * 在每个步骤 (LLM 调用) 完成时调用，包括中间步骤
         */
        // onStepFinish: async ({ text, usage }) => { console.log('步骤完成'); },

        // ============ 实验性参数 ============
        /**
         * experimental_telemetry: 遥测配置 (可选)
         * 用于配置遥测数据收集
         */
        // experimental_telemetry: { isEnabled: true },

        /**
         * experimental_context: 上下文对象 (可选)
         * 传递给工具执行的上下文
         * 实验性功能，可能在补丁版本中变更
         */
        // experimental_context: { userId: '123' },

        /**
         * experimental_include: 包含设置 (可选)
         * 控制步骤结果中包含哪些数据
         * 禁用某些数据可以减少内存使用
         */
        // experimental_include: { requestBody: false },
    });
}

export async function generateTextWrapper(input: StreamTextInput) {
    const agentConfig = input.agent;
    const languageModel = Provider.getAgentLanguage(agentConfig);
    if (!languageModel) {
        throw new Error("Agent 'agent1' not found in config");
    }
    return generateText({
        model: languageModel,
        messages: input.messages,
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : (agentConfig.max_output_tokens !== undefined && { maxOutputTokens: agentConfig.max_output_tokens })),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : (agentConfig.temperature !== undefined && { temperature: agentConfig.temperature })),
        ...(input.topP !== undefined ? { topP: input.topP } : (agentConfig.top_p !== undefined && { topP: agentConfig.top_p })),
        ...(input.maxRetries !== undefined ? { maxRetries: input.maxRetries } : (agentConfig.max_retries !== undefined && { maxRetries: agentConfig.max_retries })),
        ...(input.timeout !== undefined ? { timeout: input.timeout } : (agentConfig.timeout !== undefined && { timeout: agentConfig.timeout })),
        providerOptions: {
            ...agentConfig.extra_body,
        }
    });
}
