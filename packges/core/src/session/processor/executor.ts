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
 * 默认的 execute 阶段流式回调（降级到 console.log）
 * 当外部未注入 streamHandlers 时使用，保持原有的调试输出行为。
 */
const defaultExecuteHandlers: StreamHandlers = {
    reasoning: {
        onStart: ()     => console.log("💭 [Executor] 开始推理..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   ()     => console.log("\n⚡ [Executor] 推理完成"),
    },
    text: {
        onStart: ()     => console.log("💡 [Executor] 输出响应..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   (full) => console.log(`\n⚡ [Executor] 响应完成: ${full.substring(0, 80)}...`),
    },
    tool: {
        onCall:   (id, name, args)   => console.log(`🔧 [Executor] 工具调用: ${name}`, args),
        onResult: (id, name, result) => console.log(`✅ [Executor] 工具返回 - ${name}:`, result),
    },
    onError:  (err)    => console.error("❌ [Executor] 执行过程中发生错误:", err),
    onFinish: (result) => {
        console.log("🎉 [Executor] 执行流程结束");
        console.log("结束原因:", result.finishReason);
        console.log("使用量:", result.usage);
    },
};

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
        maxRetries: input.maxRetries ?? 3,
        retryDelay: 1000,
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
    const messages = [...session.messages, ...input.messages];
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
                
                try {
                    // 将 ExecuteInput 字段映射到 StreamTextInput，再调用 streamTextWrapper
                    // maxRetries: 0 —— 重试由状态机自身的 RETRYING 状态管理，不依赖 SDK 重试
                    streamResult = await streamTextWrapper({
                        agent:           input.agent,
                        messages:        messages,
                        tools:           input.tools,
                        maxOutputTokens: input.maxOutputTokens,
                        temperature:     input.temperature,
                        topP:            input.topP,
                        maxRetries:      0,
                        abortSignal:     input.abortSignal,
                    });

                    context.state = "STREAMING";
                } catch (error) {
                    context.error = error as Error;
                    context.state = isRetryableError(error) && context.retryCount < context.maxRetries
                        ? "RETRYING"
                        : "ERROR";
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
                    context.state = isRetryableError(error) && context.retryCount < context.maxRetries
                        ? "RETRYING"
                        : "ERROR";
                }
                break;
            }

            // ── RETRYING - 指数退避后重新发起调用 ────────────────────
            case "RETRYING": {
                context.retryCount++;

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
                                output: JSON.parse(tr.content),
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

                // 指数退避，最大 10 秒
                await sleep(context.retryDelay);
                context.retryDelay = Math.min(context.retryDelay * 2, 10_000);

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
function isRetryableError(error: unknown): boolean {
    if (!error) return false;

    const err = error as RetryableErrorShape;

    if (err.code === "ECONNREFUSED" ||
        err.code === "ETIMEDOUT"    ||
        err.code === "ENOTFOUND") {
        return true;
    }

    const status = err.status ?? err.statusCode;
    if (status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504) {
        return true;
    }

    if (err.message?.toLowerCase().includes("timeout")) {
        return true;
    }

    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 内部辅助类型 ──────────────────────────────────────────────────

interface RetryableErrorShape {
    code?: string;
    status?: number;
    statusCode?: number;
    message?: string;
}