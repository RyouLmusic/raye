import type { StreamTextResult, ToolSet, ModelMessage } from "ai";
import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { processFullStream } from "@/session/stream-handler";
import type { StreamHandlers } from "@/session/stream-handler";
import { SessionContext } from "@/session/seesion";
import type {
    ProcessContext,
    ExecuteInput,
    ProcessToolCall,
    ToolExecutionResult,
    ProcessorStepResult,
} from "@/session/type";
import { buildAssistantMessage } from "@/session/processor/utils";
import { processResutlToSession } from ".";
import { createLogger } from "common";

export interface Executor {
    execute(input: ExecuteInput): Promise<ProcessorStepResult>;
}

/**
 * 创建 LLM Process 执行器（组合式）
 */
export function createExecutor(): Executor {
    return {
        execute,
    };
}

// ============ 默认回调 ============

/**
 * 默认的 execute 阶段流式回调（使用 logger）
 * 当外部未注入 streamHandlers 时使用，保持原有的调试输出行为。
 */
function createDefaultExecuteHandlers(): StreamHandlers {
    const logger = createLogger("Executor", process.env.RAYE_DEBUG === "1");
    return {
        reasoning: {
            onStart: ()     => logger.log("💭 开始推理..."),
            onDelta: (text) => { process.stdout.write(text); },
            onEnd:   ()     => logger.log("\n⚡ 推理完成"),
        },
        text: {
            onStart: ()     => logger.log("💡 输出响应..."),
            onDelta: (text) => { process.stdout.write(text); },
            onEnd:   (full) => logger.log(`\n⚡ 响应完成: ${full.substring(0, 80)}...`),
        },
        tool: {
            onCall:   (id, name, args)   => logger.log(`🔧 工具调用: ${name}`, args),
            onResult: (id, name, result) => logger.log(`✅ 工具返回 - ${name}:`, result),
        },
        onError:  (err)    => logger.error("❌ 执行过程中发生错误:", err),
        onFinish: (result) => {
            logger.log("🎉 执行流程结束");
            logger.log("结束原因:", result.finishReason);
            logger.log("使用量:", result.usage);
        },
    };
}

const defaultExecuteHandlers = createDefaultExecuteHandlers();

// ============ 执行函数 ============

/**
 * 执行 LLM 调用 - 内层循环
 *
 * 状态转换流程：
 * IDLE → CALLING → STREAMING → SUCCESS
 *          ↓ (on error)   ↓ (retryable / soft tool error)
 *       RETRYING ←────────┘
 *          ↓ (retry exhausted)
 *        ERROR
 *
 * SDK 在 STREAMING 阶段自动执行工具并返回 tool-result 事件，
 * 无需单独的 TOOL_EXECUTING 状态。
 * 若工具返回软错误（{ error: ... }）且未超过重试次数 → RETRYING，
 * 让 LLM 重新调用以尝试不同策略。
 *
 * @param input - 执行输入参数
 * @returns 执行结果
 */
async function execute(input: ExecuteInput): Promise<ProcessorStepResult> {
    // ── 初始化内层状态机上下文 ──────────────────────────────
    const context: ProcessContext = {
        state: "IDLE",
        retryCount: 0,
        maxRetries: input.maxRetries ?? 5,  // 增加默认重试次数到 5
        retryDelay: 2000,  // 增加初始延迟到 2 秒
    };
    const session = SessionContext.current();
    // 结果累积器（在 SUCCESS 状态组装为完整的 ProcessorStepResult）
    const acc: {
        text: string;
        reasoning: string;
        finishReason: string;
        usage?: unknown;
        message?: ReturnType<typeof buildAssistantMessage>;
        toolCalls?: ProcessToolCall[];
        toolResults?: ToolExecutionResult[];
    } = { text: "", reasoning: "", finishReason: "stop" };
    // 直接使用调用方提供的完整消息列表（loop.ts 已传入 [...context.session.messages]）
    // 不再与 session.messages 合并，否则会导致消息重复，引发 AI SDK schema 校验失败
    const messages = input.messages;
    // CALLING → STREAMING 之间共享的流对象
    let streamResult: StreamTextResult<ToolSet, never> | undefined;

    // ── 主循环 - 状态机驱动 ────────────────────────────────
    while (true) {
        switch (context.state) {

            // ── IDLE → CALLING ──────────────────────────────────────
            case "IDLE": {
                context.state = "CALLING";
                break;
            }

            // ── CALLING - 发起 LLM API 调用 ─────────────────────────
            case "CALLING": {
                const logger = createLogger("Executor", input.debug ?? false);
                
                const agentCfg = input.agent;
                const toolNames = Array.isArray(agentCfg.tools) ? agentCfg.tools : [];
                logger.log(`\n${"═".repeat(60)}`);
                logger.log(`LLM 调用参数 (retry=${context.retryCount})`);
                logger.log(`${"─".repeat(60)}`);
                logger.log(`  agent        : ${agentCfg.name} v${agentCfg.version}`);
                logger.log(`  model        : ${agentCfg.model}`);
                logger.log(`  provider     : ${agentCfg.provider ?? "unknown"}`);
                logger.log(`  base_url     : ${agentCfg.base_url}`);
                logger.log(`  temperature  : ${input.temperature ?? agentCfg.temperature ?? "default"}`);
                logger.log(`  top_p        : ${input.topP ?? agentCfg.top_p ?? "default"}`);
                logger.log(`  maxOutputTok : ${input.maxOutputTokens ?? agentCfg.max_output_tokens ?? "default"}`);
                logger.log(`  maxSteps     : 5`);
                logger.log(`  maxRetries   : 0 (executor-managed)`);
                logger.log(`  toolChoice   : ${JSON.stringify(input.toolChoice ?? agentCfg.tool_choice ?? "auto")}`);
                logger.log(`  tools        : [${toolNames.join(", ")}]`);
                if (agentCfg.extra_body && Object.keys(agentCfg.extra_body).length > 0) {
                    logger.log(`  extra_body   : ${JSON.stringify(agentCfg.extra_body)}`);
                }
                logger.log(`${"─".repeat(60)}`);
                logger.log(`  messages (count=${messages.length}):`);
                messages.forEach((m, i) => {
                    if (Array.isArray(m.content)) {
                        logger.log(`  [${String(i).padStart(2, "0")}] role=${m.role}`);
                        m.content.forEach((b: any, bi: number) => {
                            if (b.type === "tool-call") {
                                logger.log(`       [${bi}] tool-call  | name=${b.toolName}  id=${b.toolCallId}`);
                                logger.log(`             args=${JSON.stringify(b.args ?? {})}`);
                            } else if (b.type === "tool-result") {
                                const outType = (b.output as any)?.type ?? typeof b.output;
                                const outVal  = JSON.stringify((b.output as any)?.value ?? b.output).substring(0, 80);
                                logger.log(`       [${bi}] tool-result| name=${b.toolName}  id=${b.toolCallId}`);
                                logger.log(`             output=(${outType}) ${outVal}`);
                            } else if (b.type === "text") {
                                logger.log(`       [${bi}] text       | ${String(b.text ?? "").substring(0, 100)}`);
                            } else if (b.type === "reasoning") {
                                logger.log(`       [${bi}] reasoning  | ${String(b.text ?? "").substring(0, 60)}...`);
                            } else {
                                logger.log(`       [${bi}] ${b.type}`);
                            }
                        });
                    } else {
                        const text = String(m.content ?? "").substring(0, 120);
                        logger.log(`  [${String(i).padStart(2, "0")}] role=${m.role} | ${text}`);
                    }
                });
                logger.log(`${"═".repeat(60)}\n`);
                try {
                    // 将 ExecuteInput 字段映射到 StreamTextInput，再调用 streamTextWrapper
                    // maxRetries: 0 —— 重试由状态机自身的 RETRYING 状态管理，不依赖 SDK 重试
                    streamResult = await streamTextWrapper({
                        agent:           input.agent,
                        messages:        messages,
                        tools:           input.tools,
                        toolChoice:      input.toolChoice,
                        maxOutputTokens: input.maxOutputTokens,
                        temperature:     input.temperature,
                        topP:            input.topP,
                        maxRetries:      0,
                        abortSignal:     input.abortSignal,
                        // 允许 SDK 完成完整的 LLM→工具→LLM 循环，避免 finishReason="tool-calls"
                        // 触发外层 ReAct 循环重新进入 PLANNING，导致 Reasoner 收到
                        // 残留 tool-result 消息而报 InvalidPromptError
                        maxSteps:        5,
                    });

                    context.state = "STREAMING";
                } catch (error) {
                    context.error = error as Error;
                    const retryInfo = getRetryInfo(error);
                    
                    const logger = createLogger("Executor", input.debug ?? process.env.RAYE_DEBUG === "1");
                    
                    if (retryInfo.isRetryable && context.retryCount < context.maxRetries) {
                        // 记录错误类型和重试信息
                        const err = error as any;
                        const errorType = err.name || "Unknown";
                        const errorMsg = err.message?.substring(0, 100) || "No message";
                        
                        logger.warn(`⚠️  LLM 调用失败 (${errorType}): ${errorMsg}`);
                        logger.log(`🔄 将在 ${context.retryDelay}ms 后重试 (${context.retryCount + 1}/${context.maxRetries})`);
                        
                        context.state = "RETRYING";
                        // 对于类型验证错误，使用较短的延迟（1秒）
                        if (err.name === "AI_TypeValidationError") {
                            context.retryDelay = 1000;
                        } else if (retryInfo.retryAfter) {
                            context.retryDelay = retryInfo.retryAfter * 1000;
                        } else if (retryInfo.statusCode === 429) {
                            // 对于速率限制，初始延迟 5 秒起步
                            context.retryDelay = Math.max(context.retryDelay, 5000);
                        }
                    } else {
                        logger.error(`❌ LLM 调用失败，无法重试或已达最大重试次数`);
                        context.state = "ERROR";
                    }
                }
                break;
            }

            // ── STREAMING - 处理流式输出 ─────────────────────────────
            case "STREAMING": {
                try {
                    // 收集流过程中产生的工具调用和工具结果
                    // SDK 会在流中自动执行工具并返回 tool-result 事件，无需手动执行
                    const capturedToolCalls: ProcessToolCall[] = [];
                    const capturedToolResults: ToolExecutionResult[] = [];

                    let captured = {
                        text: "",
                        reasoning: "",
                        finishReason: "stop",
                        usage: undefined as unknown,
                    };

                    // 合并外部 handlers 与 defaultExecuteHandlers（同 planner/reasoner 模式）
                    const baseHandlers = input.streamHandlers ?? defaultExecuteHandlers;
                    const mergedHandlers: StreamHandlers = {
                        ...baseHandlers,
                        tool: {
                            // 在透传外部回调的同时，收集工具调用信息
                            onCall: async (id, name, args) => {
                                capturedToolCalls.push({ id, name, args });
                                await baseHandlers.tool?.onCall?.(id, name, args);
                            },
                            // 收集 SDK 自动执行后的工具结果，同时检测软错误（工具返回了错误对象）
                            onResult: async (id, name, result) => {
                                const isError = result !== null &&
                                    typeof result === "object" &&
                                    "error" in result &&
                                    typeof (result as Record<string, unknown>).error === "string";
                                capturedToolResults.push({
                                    toolCallId: id,
                                    toolName:   name,
                                    content:    JSON.stringify(result),
                                    isError,
                                });
                                await baseHandlers.tool?.onResult?.(id, name, result);
                            },
                        },
                        onFinish: async (res) => {
                            captured.text         = res.text;
                            captured.reasoning    = res.reasoning;
                            captured.finishReason = res.finishReason;
                            captured.usage        = res.usage;
                            await baseHandlers.onFinish?.(res);
                        },
                    };

                    await processFullStream(streamResult!, {
                        handlers: mergedHandlers,
                        debug: false,
                    });

                    // 组装 assistant message（含 reasoning 时使用数组格式）
                    acc.text         = captured.text;
                    acc.reasoning    = captured.reasoning;
                    acc.finishReason = captured.finishReason;
                    acc.usage        = captured.usage;
                    acc.message      = buildAssistantMessage(captured.text, captured.reasoning);
                    acc.toolCalls    = capturedToolCalls;
                    acc.toolResults  = capturedToolResults;

                    // 若工具结果中存在软错误（工具返回了 { error: ... }），触发 RETRYING
                    // 让 LLM 重新发起调用以尝试不同的工具策略
                    const hasToolErrors = capturedToolResults.some(r => r.isError);
                    context.state = (hasToolErrors && context.retryCount < context.maxRetries)
                        ? "RETRYING"
                        : "SUCCESS";
                } catch (error) {
                    context.error = error as Error;
                    const retryInfo = getRetryInfo(error);
                    
                    const logger = createLogger("Executor", input.debug ?? process.env.RAYE_DEBUG === "1");
                    
                    if (retryInfo.isRetryable && context.retryCount < context.maxRetries) {
                        // 记录错误类型和重试信息
                        const err = error as any;
                        const errorType = err.name || "Unknown";
                        const errorMsg = err.message?.substring(0, 100) || "No message";
                        
                        logger.warn(`⚠️  LLM 调用失败 (${errorType}): ${errorMsg}`);
                        logger.log(`🔄 将在 ${context.retryDelay}ms 后重试 (${context.retryCount + 1}/${context.maxRetries})`);
                        
                        context.state = "RETRYING";
                        if (retryInfo.retryAfter) {
                            context.retryDelay = retryInfo.retryAfter * 1000;
                        } else if (retryInfo.statusCode === 429) {
                            context.retryDelay = Math.max(context.retryDelay, 5000);
                        }
                    } else {
                        logger.error(`❌ LLM 调用失败，无法重试或已达最大重试次数`);
                        context.state = "ERROR";
                    }
                }
                break;
            }

            // ── RETRYING - 指数退避后重新发起调用 ────────────────────
            case "RETRYING": {
                context.retryCount++;
                
                const logger = createLogger("Executor", input.debug ?? process.env.RAYE_DEBUG === "1");
                logger.log(`⏳ 重试 ${context.retryCount}/${context.maxRetries}，等待 ${context.retryDelay}ms...`);

                // 将本轮产生的 assistant message 和 tool-result 追加到 messages，
                // 让 LLM 在重试时能看到上一轮的输出和工具执行结果
                if (acc.toolCalls && acc.toolCalls.length > 0) {
                    const baseContent = acc.message
                        ? (Array.isArray(acc.message.content)
                            ? [...(acc.message.content as object[])]
                            : acc.message.content
                            ? [{ type: "text" as const, text: acc.message.content as string }]
                            : [])
                        : [];
                    const toolCallBlocks = acc.toolCalls.map((tc) => ({
                        type: "tool-call" as const,
                        toolCallId: tc.id,
                        toolName: tc.name,
                        args: tc.args ?? {},
                    }));
                    const assistantMsg = {
                        role: "assistant" as const,
                        content: [...baseContent, ...toolCallBlocks],
                    } as ModelMessage;
                    messages.push(assistantMsg);

                    if (acc.toolResults && acc.toolResults.length > 0) {
                        const toolResultMsgs: ModelMessage[] = acc.toolResults.map((tr) => ({
                            role: "tool" as const,
                            content: [{
                                type: "tool-result" as const,
                                toolCallId: tr.toolCallId,
                                toolName: tr.toolName,
                                // AI SDK v6: must be ToolResultOutput typed object
                                output: { type: "json" as const, value: JSON.parse(tr.content) },
                            }],
                        }));
                        messages.push(...toolResultMsgs);
                    }
                } else if (acc.message) {
                    // 无工具调用，仅追加 assistant 文本消息
                    messages.push(acc.message);
                }

                // 重置累积器，准备下一轮
                // acc.text = "";
                // acc.reasoning = "";
                // acc.finishReason = "stop";
                // acc.usage = undefined;
                // acc.message = undefined;
                // acc.toolCalls = undefined;
                // acc.toolResults = undefined;

                // 指数退避，最大 30 秒（对于速率限制，需要更长的等待时间）
                await sleep(context.retryDelay);
                // 如果当前延迟已经很大（如设置了 Retry-After），下次仍保持较长延迟
                if (context.retryDelay >= 5000) {
                    context.retryDelay = Math.min(context.retryDelay * 1.5, 30_000);
                } else {
                    context.retryDelay = Math.min(context.retryDelay * 2, 30_000);
                }

                context.state = "CALLING";
                break;
            }

            // ── SUCCESS - 返回结果 ────────────────────────────────────
            case "SUCCESS": {
                return {
                    text:         acc.text,
                    reasoning:    acc.reasoning,
                    finishReason: acc.finishReason,
                    usage:        acc.usage,
                    message:      acc.message!,
                    toolCalls:    acc.toolCalls,
                    toolResults:  acc.toolResults,
                };
            }

            // ── ERROR - 抛出错误，由外层循环处理 ─────────────────────
            case "ERROR": {
                throw context.error;
            }

            default: {
                throw new Error(`[Executor] 未知状态: ${context.state}`);
            }
        }
    }
}

// ============ 工具函数 ============

/**
 * 判断错误是否可以重试
 *
 * 可重试：
 *   - 网络错误 (ECONNREFUSED / ETIMEDOUT / ENOTFOUND)
 *   - 限流     (429)
 *   - 服务器故障 (500 / 502 / 503 / 504)
 *   - 超时关键字
 *
 * 不可重试：
 *   - 认证错误 (401 / 403)
 *   - 请求错误 (400 / 404)
 *   - 业务逻辑错误
 */
/**
 * 获取重试信息（包括是否可重试、重试延迟等）
 */
function getRetryInfo(error: unknown): RetryInfo {
    if (!error) {
        return { isRetryable: false };
    }

    const err = error as RetryableErrorShape;
    const status = err.status ?? err.statusCode;
    
    // 检查 AI SDK 类型验证错误（模型返回格式不符合预期）
    // 这类错误通常是临时的，可以重试
    if (err.name === "AI_TypeValidationError" || 
        err.message?.includes("Type validation failed") ||
        err.message?.includes("Invalid input")) {
        return { isRetryable: true };
    }
    
    // 检查网络错误
    if (err.code === "ECONNREFUSED" ||
        err.code === "ETIMEDOUT"    ||
        err.code === "ENOTFOUND") {
        return { isRetryable: true };
    }

    // 检查 HTTP 状态码
    if (status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504) {
        
        // 尝试获取 Retry-After 头
        let retryAfter: number | undefined;
        if (err.responseHeaders) {
            const retryAfterHeader = err.responseHeaders['retry-after'] || 
                                   err.responseHeaders['Retry-After'];
            if (retryAfterHeader) {
                const parsed = parseInt(String(retryAfterHeader), 10);
                if (!isNaN(parsed)) {
                    retryAfter = parsed;
                }
            }
        }
        
        return { 
            isRetryable: true, 
            statusCode: status,
            retryAfter 
        };
    }

    // 检查超时错误
    if (err.message?.toLowerCase().includes("timeout")) {
        return { isRetryable: true };
    }

    return { isRetryable: false };
}

/**
 * 向后兼容的函数
 */
function isRetryableError(error: unknown): boolean {
    return getRetryInfo(error).isRetryable;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 内部辅助类型 ──────────────────────────────────────────────────

interface RetryableErrorShape {
    name?: string;
    code?: string;
    status?: number;
    statusCode?: number;
    message?: string;
    responseHeaders?: Record<string, string | string[]>;
}

interface RetryInfo {
    isRetryable: boolean;
    statusCode?: number;
    retryAfter?: number;  // 重试延迟（秒）
}