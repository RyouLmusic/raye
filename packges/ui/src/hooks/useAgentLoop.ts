import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentConfig } from "core/agent/type";
import type { LoopObserver, AgentLoopState, LoopInput } from "core/session/type";
import { AgentLoop } from "core/session/loop";
import { setAskUserHandler, clearAskUserHandler } from "core/tools/control";

// ── 消息类型 ──────────────────────────────────────────────

export type MessagePhase = "plan" | "reason" | "execute";

export interface TurnMessage {
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    phase?: MessagePhase;
    // 工具调用专属字段
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
    toolCallId?: string;
}

// ── UI 状态 ───────────────────────────────────────────────

export interface AgentLoopUIState {
    /** 已完成的消息列表 */
    messages: TurnMessage[];
    /**
     * 各阶段正在 streaming 的文本（streaming 期间非空，完成后清空）
     * plan / reason → ThinkingBlock
     * execute       → StreamingBlock
     * executeReasoning → ThinkingBlock (execute 阶段的思考过程)
     */
    streaming: {
        plan: string;
        reason: string;
        execute: string;
        executeReasoning: string;
    };
    /** 当前 Loop 状态 */
    loopState: AgentLoopState | "IDLE";
    /** 当前迭代序号 */
    iteration: number;
    /** 最大迭代次数 */
    maxIterations: number;
    /** 是否正在运行 */
    isRunning: boolean;
    /** 错误提示 */
    error?: string;
}

const INITIAL_STATE: AgentLoopUIState = {
    messages: [],
    streaming: { plan: "", reason: "", execute: "", executeReasoning: "" },
    loopState: "IDLE",
    iteration: 0,
    maxIterations: 10,
    isRunning: false,
};

// ── Hook 主体 ─────────────────────────────────────────────

let msgIdCounter = 0;
function nextId() { return `msg-${++msgIdCounter}`; }

export interface UseAgentLoopOptions {
    /** 当 ask_user 工具被调用时触发，返回 Promise<string> 作为用户回复 */
    onAskUser?: (question: string) => Promise<string>;
}

export function useAgentLoop(
    agentConfig: AgentConfig, 
    sessionId: string,
    options?: UseAgentLoopOptions
) {
    const [state, setState] = useState<AgentLoopUIState>(INITIAL_STATE);
    // 用 ref 跟踪当前 streaming 内容，避免在 onDelta 闭包中拿到旧 state
    const streamingRef = useRef({ plan: "", reason: "", execute: "", executeReasoning: "" });

    // 设置全局 ask_user 回调
    useEffect(() => {
        if (options?.onAskUser) {
            setAskUserHandler(options.onAskUser);
        }
        return () => {
            clearAskUserHandler();
        };
    }, [options?.onAskUser]);

    // ── 构建 observer ────────────────────────────────────────
    const buildObserver = useCallback((): LoopObserver => {
        // 每次 submit 重置 streaming 缓存
        streamingRef.current = { plan: "", reason: "", execute: "", executeReasoning: "" };

        return {
            // ── Loop 级别 ──────────────────────────────────
            onLoopStart: (sid) => {
                setState(s => ({
                    ...s,
                    isRunning: true,
                    error: undefined,
                    streaming: { plan: "", reason: "", execute: "", executeReasoning: "" },
                }));
            },

            onStateChange: (_, to, iteration) => {
                setState(s => ({ ...s, loopState: to, iteration }));
            },

            onIterationStart: (iteration, maxIterations) => {
                setState(s => ({ ...s, iteration, maxIterations }));
            },

            onLoopEnd: ({ success, iterations, error }) => {
                setState(s => ({
                    ...s,
                    isRunning: false,
                    loopState: success ? "COMPLETED" : "FAILED",
                    error: error?.message,
                }));
            },

            onError: (error, loopState) => {
                setState(s => ({
                    ...s,
                    error: `[${loopState}] ${error.message}`,
                }));
            },

            // ── 首轮全局规划 → streaming.plan ──────────────
            planHandlers: {
                reasoning: {
                    onDelta: (text: string) => {
                        streamingRef.current.plan += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, plan: streamingRef.current.plan },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        if (!fullText) return;
                        streamingRef.current.plan = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, plan: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "plan",
                            }],
                        }));
                    },
                },
                text: {
                    onDelta: (text: string) => {
                        streamingRef.current.plan += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, plan: streamingRef.current.plan },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        if (!fullText) return;
                        streamingRef.current.plan = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, plan: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "plan",
                            }],
                        }));
                    },
                },
            },

            // ── 后续轮即时推理 → streaming.reason ──────────
            reasonHandlers: {
                reasoning: {
                    onDelta: (text: string) => {
                        streamingRef.current.reason += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, reason: streamingRef.current.reason },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        if (!fullText) return;
                        streamingRef.current.reason = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, reason: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "reason",
                            }],
                        }));
                    },
                },
                text: {
                    onDelta: (text: string) => {
                        streamingRef.current.reason += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, reason: streamingRef.current.reason },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        if (!fullText) return;
                        streamingRef.current.reason = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, reason: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "reason",
                            }],
                        }));
                    },
                },
            },

            // ── 主执行阶段 → streaming.execute + streaming.executeReasoning + 工具调用 ──
            executeHandlers: {
                reasoning: {
                    onDelta: (text: string) => {
                        streamingRef.current.executeReasoning += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, executeReasoning: streamingRef.current.executeReasoning },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        // 将 execute 阶段的 reasoning 保存为一条独立消息（可折叠）
                        if (!fullText) return;
                        streamingRef.current.executeReasoning = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, executeReasoning: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "reason", // 复用 reason phase，折叠显示
                            }],
                        }));
                    },
                },
                text: {
                    onDelta: (text: string) => {
                        streamingRef.current.execute += text;
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, execute: streamingRef.current.execute },
                        }));
                    },
                    onEnd: (fullText: string) => {
                        if (!fullText) return;
                        streamingRef.current.execute = "";
                        setState(s => ({
                            ...s,
                            streaming: { ...s.streaming, execute: "" },
                            messages: [...s.messages, {
                                id: nextId(),
                                role: "assistant",
                                content: fullText,
                                phase: "execute",
                            }],
                        }));
                    },
                },
                tool: {
                    onCall: (_id: string, name: string, args: unknown) => {
                        const msgId = nextId();
                        setState(s => ({
                            ...s,
                            messages: [...s.messages, {
                                id: msgId,
                                role: "tool",
                                content: "",
                                toolCallId: _id,
                                toolName: name,
                                toolArgs: args,
                                phase: "execute",
                            }],
                        }));
                    },
                    onResult: (_id: string, name: string, result: unknown) => {
                        setState(s => {
                            const msgs = [...s.messages];
                            // 找到对应的工具调用条目并填充结果
                            const idx = msgs.findLastIndex(
                                m => m.role === "tool" && m.toolCallId === _id
                            );
                            if (idx !== -1) {
                                const resultObj = result as any;
                                // 特殊处理 ask_user 工具：显示问题和答案
                                let displayContent: string;
                                if (name === "ask_user") {
                                    if (resultObj?.status === "answered") {
                                        displayContent = `❓ ${resultObj.question}\n✅ ${resultObj.answer}`;
                                    } else if (resultObj?.question) {
                                        displayContent = `❓ ${resultObj.question}`;
                                    } else {
                                        displayContent = JSON.stringify(result);
                                    }
                                } else {
                                    displayContent = JSON.stringify(result);
                                }
                                msgs[idx] = { 
                                    ...msgs[idx]!, 
                                    toolResult: result, 
                                    content: displayContent 
                                };
                            }
                            return { ...s, messages: msgs };
                        });
                    },
                },
            },
        };
    }, []);

    // ── 提交用户消息 ─────────────────────────────────────────
    const submit = useCallback(async (userMessage: string) => {
        // Cast through unknown to bridge z.infer<modelMessageSchema> vs ModelMessage
        const userMsg = { role: "user" as const, content: userMessage } as unknown as LoopInput["message"];
        setState(s => ({
            ...s,
            messages: [...s.messages, {
                id: nextId(),
                role: "user",
                content: userMessage,
            }],
        }));

        try {
            await AgentLoop.loop({
                sessionId,
                agentConfig,
                message: userMsg,
                observer: buildObserver(),
                maxIterations: 10,
                compactThreshold: 20,
                debug: false,
            });
        } catch (err) {
            setState(s => ({
                ...s,
                isRunning: false,
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }, [sessionId, agentConfig, buildObserver]);

    return { state, submit };
}
