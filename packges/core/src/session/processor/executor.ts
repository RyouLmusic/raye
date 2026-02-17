import type { ProcessContext, StreamTextInput } from "@/session/type";
import type { ModelMessage } from "ai";

interface ToolCall {
    id: string;
    name: string;
    args?: Record<string, unknown>;
}

interface RetryableErrorShape {
    code?: string;
    status?: number;
    statusCode?: number;
    message?: string;
}

/**
 * 执行结果接口
 */
export interface ExecuteResult {
    /** 是否成功 */
    success: boolean;
    /** LLM 生成的消息 */
    message?: ModelMessage;
    /** 工具调用列表 */
    toolCalls?: ToolCall[];
    /** 工具执行结果 */
    toolResults?: ToolExecutionResult[];
    /** 错误信息 */
    error?: Error;
}

/**
 * 执行输入参数
 */
export interface ExecuteInput extends StreamTextInput {
    maxRetries?: number;
    timeout?: number;
}

/**
 * 流式处理结果接口
 */
interface StreamResult {
    message: ModelMessage;
    toolCalls?: ToolCall[];
}

export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    content: string;
    isError: boolean;
}

/**
 * 执行器能力定义
 */
export interface Executor {
    execute(input: ExecuteInput): Promise<ExecuteResult>;
}

/**
 * 创建 LLM Process 执行器（组合式）
 */
export function createExecutor(): Executor {
    return {
        execute,
    };
}

    /**
     * 执行 LLM 调用 - 内层循环
     * 
     * 状态转换流程：
     * IDLE → CALLING → STREAMING → [TOOL_EXECUTING] → SUCCESS
     *          ↓ (on error)             ↓ (on error)
     *       RETRYING ←───────────────────┘
     *          ↓ (retry exhausted)
     *        ERROR
     * 
     * @param input - 执行输入参数
     * @returns 执行结果
     */
async function execute(input: ExecuteInput): Promise<ExecuteResult> {
        // ============ 状态：IDLE - 初始化上下文 ============
        const context: ProcessContext = {
            state: "IDLE",
            retryCount: 0,
            maxRetries: input.maxRetries ?? 3,
            retryDelay: 1000, // 初始延迟 1 秒
        };

        console.log(`[Process] 开始执行 LLM 调用`);
        console.log(`[Process] 最大重试次数: ${context.maxRetries}`);

        // 结果存储
        let result: ExecuteResult = {
            success: false,
        };

        // ============ 主循环 - 处理重试 ============
        while (true) {
            console.log(`[Process] 状态: ${context.state}, 重试: ${context.retryCount}/${context.maxRetries}`);

            // ============ 状态：IDLE → CALLING ============
            if (context.state === "IDLE") {
                context.state = "CALLING";
                continue;
            }

            // ============ 状态：CALLING - 调用 LLM ============
            if (context.state === "CALLING") {
                console.log(`[Process] 发起 LLM API 调用`);

                try {
                    // 1. 准备调用参数
                    const callParams = prepareCallParams(input);

                    // 2. 发起流式调用
                    // const stream = await streamText(callParams);
                    
                    console.log(`[Process] LLM API 调用成功，开始流式处理`);

                    // 3. 转换到 STREAMING 状态
                    context.state = "STREAMING";

                    // 注意：这里我们暂时模拟，实际应该在 STREAMING 状态处理
                    // 为了演示，这里直接跳到下一个状态
                    
                } catch (error) {
                    console.error(`[Process] LLM API 调用失败:`, error);
                    context.error = error as Error;
                    
                    // 检查是否可以重试
                    if (isRetryableError(error) && context.retryCount < context.maxRetries) {
                        context.state = "RETRYING";
                    } else {
                        context.state = "ERROR";
                    }
                }
                continue;
            }

            // ============ 状态：STREAMING - 处理流式输出 ============
            if (context.state === "STREAMING") {
                console.log(`[Process] 处理流式输出`);

                try {
                    // 1. 处理流式事件
                    const streamResult = await processStream(input);

                    // 2. 保存结果
                    result.message = streamResult.message;
                    result.toolCalls = streamResult.toolCalls;

                    // 3. 检查是否有工具调用
                    if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
                        console.log(`[Process] 检测到 ${streamResult.toolCalls.length} 个工具调用`);
                        context.state = "TOOL_EXECUTING";
                    } else {
                        console.log(`[Process] 无工具调用，流式处理完成`);
                        context.state = "SUCCESS";
                    }

                } catch (error) {
                    console.error(`[Process] 流式处理失败:`, error);
                    context.error = error as Error;

                    // 检查是否可以重试
                    if (isRetryableError(error) && context.retryCount < context.maxRetries) {
                        context.state = "RETRYING";
                    } else {
                        context.state = "ERROR";
                    }
                }
                continue;
            }

            // ============ 状态：TOOL_EXECUTING - 执行工具调用 ============
            if (context.state === "TOOL_EXECUTING") {
                console.log(`[Process] 执行工具调用`);

                try {
                    // 1. 执行所有工具调用
                    const toolResults = await executeTools(result.toolCalls);

                    // 2. 保存工具执行结果
                    result.toolResults = toolResults;

                    console.log(`[Process] 工具执行完成，结果数: ${toolResults.length}`);

                    // 3. 转换到 SUCCESS 状态
                    context.state = "SUCCESS";

                } catch (error) {
                    console.error(`[Process] 工具执行失败:`, error);
                    context.error = error as Error;

                    // 工具执行失败通常不重试 LLM 调用
                    // 而是将错误作为工具结果返回，让 LLM 处理
                    result.toolResults = [{
                        toolCallId: "unknown",
                        toolName: "unknown",
                        content: `Tool execution error: ${(error as Error).message}`,
                        isError: true,
                    }];

                    context.state = "SUCCESS";
                }
                continue;
            }

            // ============ 状态：RETRYING - 重试 ============
            if (context.state === "RETRYING") {
                context.retryCount++;
                
                console.log(`[Process] 准备重试 (${context.retryCount}/${context.maxRetries})`);
                console.log(`[Process] 延迟 ${context.retryDelay}ms 后重试`);

                // 1. 等待一段时间后重试（指数退避）
                await sleep(context.retryDelay);
                
                // 2. 增加下次重试的延迟时间（指数退避策略）
                context.retryDelay = Math.min(context.retryDelay * 2, 10000); // 最大 10 秒

                // 3. 转换回 CALLING 状态
                context.state = "CALLING";
                continue;
            }

            // ============ 状态：SUCCESS - 成功 ============
            if (context.state === "SUCCESS") {
                console.log(`[Process] 执行成功`);
                
                result.success = true;
                return result;
            }

            // ============ 状态：ERROR - 失败 ============
            if (context.state === "ERROR") {
                console.error(`[Process] 执行失败，已尝试 ${context.retryCount} 次`);
                console.error(`[Process] 错误:`, context.error);

                result.success = false;
                result.error = context.error;
                
                // 抛出错误，让外层循环处理
                throw context.error;
            }

            // 不应该到达这里
            throw new Error(`[Process] 未知状态: ${context.state}`);
        }
    }

    /**
     * 准备 LLM 调用参数
     */
function prepareCallParams(input: ExecuteInput) {
    return {
        model: input.agent.model,
        messages: input.messages,
        tools: input.tools,
        maxTokens: input.maxOutputTokens,
        temperature: input.temperature,
        topP: input.topP,
        // ... 其他参数
    };
}

    /**
     * 处理流式输出
     * 
     * 监听各种流式事件：
     * - text-delta: 文本增量
     * - tool-call: 工具调用
     * - tool-result: 工具结果
     * - finish: 流结束
     * - error: 错误
     */
async function processStream(input: ExecuteInput): Promise<StreamResult> {
    // 这里应该调用真实的 streamText 函数
    // 并监听各种事件

    // 模拟流式处理
    return new Promise<StreamResult>((resolve, reject) => {
        // 模拟 LLM 响应
        const mockMessage: ModelMessage = {
            role: "assistant",
            content: "This is a mock response",
        };

        // 模拟流式事件处理
        // stream.on('text-delta', (delta) => { ... });
        // stream.on('tool-call', (toolCall) => { ... });
        // stream.on('finish', () => { ... });
        // stream.on('error', (error) => { ... });

        // 模拟成功
        setTimeout(() => {
            resolve({
                message: mockMessage,
                toolCalls: [],
            });
        }, 100);
    });
}

    /**
     * 执行工具调用
     */
async function executeTools(toolCalls?: ToolCall[]): Promise<ToolExecutionResult[]> {
    if (!toolCalls || toolCalls.length === 0) {
        return [];
    }

    console.log(`[Process] 执行 ${toolCalls.length} 个工具`);

    const results: ToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
        try {
            // 1. 查找并执行工具
            // const tool = findTool(toolCall.name);
            // const result = await tool.execute(toolCall.args);

            // 2. 模拟工具执行
            const result: ToolExecutionResult = {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: JSON.stringify({ success: true }),
                isError: false,
            };

            results.push(result);
            console.log(`[Process] 工具 ${toolCall.name} 执行成功`);

        } catch (error) {
            console.error(`[Process] 工具 ${toolCall.name} 执行失败:`, error);

            // 将错误作为工具结果
            const toolErrorResult: ToolExecutionResult = {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: JSON.stringify({
                    error: (error as Error).message,
                }),
                isError: true,
            };
            results.push(toolErrorResult);
        }
    }

    return results;
}

    /**
     * 判断错误是否可以重试
     * 
     * 可重试的错误类型：
     * - 网络错误 (Network error, ECONNREFUSED, ETIMEDOUT)
     * - 超时错误 (Timeout)
     * - 限流错误 (Rate limit, 429)
     * - 服务器错误 (500, 502, 503, 504)
     * 
     * 不可重试的错误类型：
     * - 认证错误 (401, 403)
     * - 请求错误 (400, 404)
     * - 业务逻辑错误
     */
function isRetryableError(error: unknown): boolean {
    if (!error) return false;

    const err = error as RetryableErrorShape;

    // 1. 检查网络错误
    if (err.code === "ECONNREFUSED" || 
        err.code === "ETIMEDOUT" || 
        err.code === "ENOTFOUND") {
        return true;
    }

    // 2. 检查 HTTP 状态码
    if (err.status || err.statusCode) {
        const status = err.status || err.statusCode;

        // 可重试的状态码
        if (status === 429 ||  // Rate limit
            status === 500 ||  // Internal server error
            status === 502 ||  // Bad gateway
            status === 503 ||  // Service unavailable
            status === 504) {  // Gateway timeout
            return true;
        }
    }

    // 3. 检查超时错误
    if (err.message && err.message.toLowerCase().includes("timeout")) {
        return true;
    }

    // 默认不重试
    return false;
}

    /**
     * 延迟函数
     */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}