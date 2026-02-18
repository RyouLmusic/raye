import type { StreamTextResult } from "ai";

/**
 * 流式内容处理器的回调接口
 * 每种类型的内容都有对应的处理方法
 */
export interface StreamHandlers {
    /**
     * 推理（Reasoning）内容处理器
     */
    reasoning?: {
        /** 推理开始时调用 */
        onStart?: () => void | Promise<void>;
        /** 接收推理内容的增量文本 */
        onDelta?: (text: string) => void | Promise<void>;
        /** 推理结束时调用，提供完整的推理内容 */
        onEnd?: (fullReasoningText: string) => void | Promise<void>;
    };

    /**
     * 文本响应（Text）内容处理器
     */
    text?: {
        /** 文本响应开始时调用 */
        onStart?: () => void | Promise<void>;
        /** 接收文本的增量内容 */
        onDelta?: (text: string) => void | Promise<void>;
        /** 文本响应结束时调用，提供完整的文本内容 */
        onEnd?: (fullText: string) => void | Promise<void>;
    };

    /**
     * 工具调用（Tool Call）处理器
     */
    tool?: {
        /** 工具调用时调用（包含完整的工具调用信息） */
        onCall?: (toolId: string, toolName: string, args: any) => void | Promise<void>;
        /** 工具执行结果返回 */
        onResult?: (toolId: string, toolName: string, result: any) => void | Promise<void>;
    };

    /**
     * 步骤（Step）处理器 - 用于多步骤执行
     */
    step?: {
        /** 步骤开始 */
        onStart?: (stepNumber: number) => void | Promise<void>;
        /** 步骤结束 */
        onEnd?: (stepNumber: number) => void | Promise<void>;
    };

    /**
     * 错误处理器
     */
    onError?: (error: unknown) => void | Promise<void>;

    /**
     * 完成处理器
     */
    onFinish?: (result: {
        text: string;
        reasoning: string;
        finishReason: string;
        usage?: any;
    }) => void | Promise<void>;
}

/**
 * 处理 fullStream 的配置选项
 */
export interface ProcessStreamOptions {
    /** 内容处理器 */
    handlers: StreamHandlers;
    /** 是否显示调试信息 */
    debug?: boolean;
}

/**
 * 处理 streamText 返回的 fullStream
 * 
 * @example
 * ```typescript
 * const result = await streamTextWrapper({ agent, messages });
 * 
 * await processFullStream(result, {
 *   handlers: {
 *     reasoning: {
 *       onStart: () => console.log('💭 开始推理...'),
 *       onDelta: (text) => process.stdout.write(text),
 *       onEnd: (full) => console.log('\n推理完成')
 *     },
 *     text: {
 *       onDelta: (text) => process.stdout.write(text)
 *     },
 *     tool: {
 *       onCall: (id, name, args) => console.log(`🔧 调用工具: ${name}`, args),
 *       onResult: (id, name, result) => console.log(`✅ 工具结果:`, result)
 *     }
 *   }
 * });
 * ```
 */
export async function processFullStream<TOOLS extends Record<string, any> = Record<string, any>>(
    streamResult: StreamTextResult<TOOLS, any>,
    options: ProcessStreamOptions
): Promise<void> {
    const { handlers, debug = false } = options;
    const { fullStream } = streamResult;

    // 状态追踪
    const state = {
        reasoningText: '',
        responseText: '',
        currentStep: 0,
    };

    try {
        for await (const chunk of fullStream) {
            if (debug) {
                console.log('[DEBUG] Chunk type:', chunk.type);
            }

            switch (chunk.type) {
                // ============ 推理相关 ============
                case 'reasoning-start':
                    state.reasoningText = '';
                    if (debug) {
                        console.log('[DEBUG] reasoning-start');
                    }
                    await handlers.reasoning?.onStart?.();
                    break;

                case 'reasoning-delta':
                    if (chunk.text) {
                        state.reasoningText += chunk.text;
                        if (debug) {
                            console.log(`[DEBUG] reasoning-delta: "${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}" (${chunk.text.length} chars)`);
                        }
                        await handlers.reasoning?.onDelta?.(chunk.text);
                    }
                    break;

                case 'reasoning-end':
                    if (debug) {
                        console.log(`[DEBUG] reasoning-end, total: ${state.reasoningText.length} chars`);
                        console.log(`[DEBUG] Last 100 chars: "${state.reasoningText.substring(Math.max(0, state.reasoningText.length - 100))}"`);
                    }
                    await handlers.reasoning?.onEnd?.(state.reasoningText);
                    break;

                // ============ 文本响应相关 ============
                case 'text-start':
                    state.responseText = '';
                    await handlers.text?.onStart?.();
                    break;

                case 'text-delta':
                    if (chunk.text) {
                        state.responseText += chunk.text;
                        await handlers.text?.onDelta?.(chunk.text);
                    }
                    break;

                case 'text-end':
                    await handlers.text?.onEnd?.(state.responseText);
                    break;

                // ============ 工具调用相关 ============
                case 'tool-call':
                    if (debug) {
                        console.log(`[DEBUG] tool-call: ${chunk.toolName}`);
                    }
                    await handlers.tool?.onCall?.(
                        chunk.toolCallId,
                        chunk.toolName,
                        chunk.input
                    );
                    break;

                case 'tool-result':
                    if (debug) {
                        console.log(`[DEBUG] tool-result: ${chunk.toolName}`);
                    }
                    await handlers.tool?.onResult?.(
                        chunk.toolCallId,
                        chunk.toolName,
                        chunk.output
                    );
                    break;

                // ============ 步骤相关 ============
                case 'start-step':
                    state.currentStep++;
                    await handlers.step?.onStart?.(state.currentStep);
                    break;

                case 'finish-step':
                    await handlers.step?.onEnd?.(state.currentStep);
                    break;

                // ============ 错误处理 ============
                case 'error':
                    await handlers.onError?.(chunk.error);
                    break;

                // ============ 其他类型 ============
                case 'start':
                case 'finish':
                    // 这些类型通常不需要特殊处理
                    break;

                default:
                    if (debug) {
                        console.log('[DEBUG] 未处理的 chunk 类型:', (chunk as any).type);
                    }
            }
        }

        // 完成后的汇总信息
        if (handlers.onFinish) {
            const [text, reasoning, finishReason, usage] = await Promise.all([
                streamResult.text,
                streamResult.reasoning,
                streamResult.finishReason,
                streamResult.usage,
            ]);

            // 处理 reasoning 可能是数组的情况
            const reasoningText = Array.isArray(reasoning) 
                ? JSON.stringify(reasoning, null, 2)
                : typeof reasoning === 'string' 
                    ? reasoning 
                    : JSON.stringify(reasoning || '');

            await handlers.onFinish({
                text,
                reasoning: reasoningText,
                finishReason,
                usage,
            });
        }
    } catch (error) {
        await handlers.onError?.(error);
        throw error;
    }
}

/**
 * 创建带样式的控制台处理器
 * 提供开箱即用的彩色控制台输出
 * 
 * @param options.mode - 显示模式：
 *   - 'interleaved': 交替模式（默认）- reasoning 和 tool 自然交替显示
 *   - 'segmented': 分段模式 - 使用分隔线清晰区分各部分
 */
export function createConsoleHandlers(options?: {
    /** 是否显示推理内容 */
    showReasoning?: boolean;
    /** 是否显示工具调用 */
    showTools?: boolean;
    /** 是否显示步骤信息 */
    showSteps?: boolean;
    /** 显示模式 */
    mode?: 'interleaved' | 'segmented';
    /** 自定义颜色 */
    colors?: {
        reasoning?: string;
        text?: string;
        tool?: string;
        step?: string;
        error?: string;
    };
}): StreamHandlers {
    const {
        showReasoning = true,
        showTools = true,
        showSteps = true,
        mode = 'interleaved',
        colors = {}
    } = options || {};

    const defaultColors = {
        reasoning: '\x1b[36m', // 青色
        text: '\x1b[37m',      // 白色
        tool: '\x1b[33m',      // 黄色
        step: '\x1b[35m',      // 紫色
        error: '\x1b[31m',     // 红色
        reset: '\x1b[0m'       // 重置
    };

    const c = { ...defaultColors, ...colors };

    // 交替模式 - reasoning 和 tool 自然交替
    if (mode === 'interleaved') {
        let reasoningSessionCount = 0;
        
        return {
            reasoning: showReasoning ? {
                onStart: () => {
                    reasoningSessionCount++;
                    // 只在第一次推理时显示"开始推理"
                    if (reasoningSessionCount === 1) {
                        console.log(`${c.reasoning}💭 思考中...${c.reset}`);
                    } else {
                        // 后续推理段落，添加一个空行分隔
                        console.log('');
                    }
                },
                onDelta: (text) => {
                    process.stdout.write(`${c.reasoning}${text}${c.reset}`);
                },
                onEnd: (fullText) => {
                    // 推理结束时换行，为后续内容做准备
                    if (fullText) {
                        console.log('');  // 单个换行，保持紧凑
                    }
                }
            } : undefined,

            text: {
                onStart: () => {
                    console.log(`\n${c.text}📝 回复:${c.reset}`);
                },
                onDelta: (text) => {
                    process.stdout.write(`${c.text}${text}${c.reset}`);
                },
                onEnd: () => {
                    console.log('');
                }
            },

            tool: showTools ? {
                onCall: (id, name, args) => {
                    // 添加空行分隔
                    console.log(`\n${c.tool}🔧 ${name}${c.reset}`);
                    console.log(`${c.tool}   ${JSON.stringify(args)}${c.reset}`);
                },
                onResult: (id, name, result) => {
                    const resultStr = typeof result === 'object' 
                        ? JSON.stringify(result) 
                        : String(result);
                    console.log(`${c.tool}   → ${resultStr}${c.reset}`);
                }
            } : undefined,

            step: showSteps ? {
                onStart: (stepNumber) => {
                    if (stepNumber > 1) {
                        console.log(`\n${c.step}─── 步骤 ${stepNumber} ───${c.reset}\n`);
                    }
                }
            } : undefined,

            onError: (error) => {
                console.error(`\n${c.error}❌ 错误:${c.reset}`, error);
            },

            onFinish: (result) => {
                console.log(`\n${'─'.repeat(50)}`);
                console.log(`✓ ${result.finishReason}`);
                if (result.usage && result.usage.totalTokens > 0) {
                    console.log(`📊 Tokens: ${result.usage.totalTokens} (推理: ${result.usage.reasoningTokens || 0})`);
                }
                console.log('─'.repeat(50));
            }
        };
    }

    // 分段模式 - 使用分隔线清晰区分
    return {
        reasoning: showReasoning ? {
            onStart: () => {
                console.log(`\n${'━'.repeat(50)}`);
                console.log(`${c.reasoning}💭 推理${c.reset}`);
                console.log('━'.repeat(50));
            },
            onDelta: (text) => {
                process.stdout.write(`${c.reasoning}${text}${c.reset}`);
            },
            onEnd: () => {
                console.log(`\n${'━'.repeat(50)}\n`);
            }
        } : undefined,

        text: {
            onStart: () => {
                console.log(`${'━'.repeat(50)}`);
                console.log(`${c.text}📝 回复${c.reset}`);
                console.log('━'.repeat(50));
            },
            onDelta: (text) => {
                process.stdout.write(`${c.text}${text}${c.reset}`);
            },
            onEnd: () => {
                console.log(`\n${'━'.repeat(50)}\n`);
            }
        },

        tool: showTools ? {
            onCall: (id, name, args) => {
                console.log(`\n${'─'.repeat(50)}`);
                console.log(`${c.tool}🔧 ${name}${c.reset}`);
                console.log('─'.repeat(50));
                console.log(`参数: ${JSON.stringify(args, null, 2)}`);
            },
            onResult: (id, name, result) => {
                const resultStr = typeof result === 'object' 
                    ? JSON.stringify(result, null, 2) 
                    : String(result);
                console.log(`结果: ${resultStr}`);
                console.log('─'.repeat(50) + '\n');
            }
        } : undefined,

        step: showSteps ? {
            onStart: (stepNumber) => {
                console.log(`\n${c.step}─── 步骤 ${stepNumber} ───${c.reset}\n`);
            }
        } : undefined,

        onError: (error) => {
            console.error(`\n${c.error}❌ 错误:${c.reset}`, error);
        },

        onFinish: (result) => {
            console.log(`\n${'═'.repeat(50)}`);
            console.log(`✓ ${result.finishReason}`);
            if (result.usage && result.usage.totalTokens > 0) {
                console.log(`📊 Tokens: ${result.usage.totalTokens} (推理: ${result.usage.reasoningTokens || 0})`);
            }
            console.log('═'.repeat(50));
        }
    };
}

/**
 * 创建收集器处理器
 * 将流式内容收集到对象中，方便后续使用
 */
export function createCollectorHandlers() {
    const collected = {
        reasoning: '',
        text: '',
        toolCalls: [] as Array<{
            id: string;
            name: string;
            args: any;
            result: any;
        }>,
        steps: 0,
        error: null as any
    };

    const toolCallsMap = new Map<string, any>();

    const handlers: StreamHandlers = {
        reasoning: {
            onDelta: (text) => {
                collected.reasoning += text;
            }
        },
        text: {
            onDelta: (text) => {
                collected.text += text;
            }
        },
        tool: {
            onCall: (id, name, args) => {
                toolCallsMap.set(id, { id, name, args, result: null });
            },
            onResult: (id, name, result) => {
                const toolCall = toolCallsMap.get(id);
                if (toolCall) {
                    toolCall.result = result;
                    collected.toolCalls.push(toolCall);
                    toolCallsMap.delete(id);
                }
            }
        },
        step: {
            onStart: (stepNumber) => {
                collected.steps = stepNumber;
            }
        },
        onError: (error) => {
            collected.error = error;
        }
    };

    return {
        handlers,
        getCollected: () => collected
    };
}
