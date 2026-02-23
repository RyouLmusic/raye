import { Processor, processResutlToSession } from "@/session/processor";
import type { ModelMessage } from "ai";
import type {
    LoopInput,
    AgentLoopContext,
    AgentLoopState,
    LoopDecision,
    Session
} from "@/session/type";
import {
    SessionOps,
    SessionManager,
    SessionContext,
    defaultSessionManager
} from "@/session/seesion";
import { createLogger } from "common";

/**
 * Agent ReAct Loop 命名空间
 * 
 * 实现 Agent 的 Reasoning-Acting 循环：
 * 1. Reasoning: 规划下一步行动
 * 2. Acting: 执行 LLM 调用和工具调用
 * 3. Observation: 观察结果并决定下一步
 */
export namespace AgentLoop {

    /**
     * 主循环函数 - 外层 ReAct 循环
     * 
     * 状态转换流程：
     * INIT → PLANNING → EXECUTING → OBSERVING → [决策] 
     *         ↑           |                        ↓
     *         |           ↓                    COMPACTING
     *         ←────────────────────────────────────┘
     *                     ↓
     *              COMPLETED/FAILED
     * 
     * @param input - 循环输入参数
     * @param sessionManager - Session 管理器（可选，默认使用全局实例）
     * @returns 最终的消息列表
     */
    export async function loop(input: LoopInput,
        sessionManager: SessionManager = defaultSessionManager) {
        // ============ 状态：INIT - 初始化 ============

        // 1. 从 SessionManager 获取或创建 Session（包含所有历史消息）
        let session = await sessionManager.getOrCreate(
            input.sessionId,
            input.agentConfig.name
        );

        const debug = input.debug ?? (process.env.RAYE_DEBUG === "1");
        const logger = createLogger("AgentLoop", debug);
        
        logger.log(`加载 Session: ${input.sessionId}`);
        logger.log(`历史消息数: ${session.messages.length}`);

        // 2. 添加当前轮的用户新消息
        logger.log(`添加新消息: ${input.message.role}`);
        session = SessionOps.addMessage(session, input.message);
        // 立即保存新消息
        await sessionManager.save(session);

        // 3. 创建执行上下文（引用 Session）
        const context: AgentLoopContext = {
            session,  // 引用 Session，不复制数据
            state: "INIT",
            iteration: 0,
            maxIterations: input.maxIterations,
            needsCompaction: false,
            compactThreshold: input.compactThreshold,
        };

        logger.log(`初始化 Session: ${input.sessionId}`);
        logger.log(`最大迭代次数: ${context.maxIterations}`);
        logger.log(`当前消息数: ${context.session.messages.length}`);

        // 通知 observer：Loop 整体开始
        input.observer?.onLoopStart?.(input.sessionId);

        // 转换到 PLANNING 状态
        context.state = "PLANNING";

        // ============ 在 Session 上下文中执行（支持 SessionContext.current()）============
        return await SessionContext.run(context.session, async () => {
            try {
                return await executeLoop(context, input, sessionManager, logger);
            } finally {
                // 确保最后保存 Session
                await sessionManager.save(context.session);
            }
        });
    }

    /**
     * 执行循环的主逻辑
     */
    async function executeLoop(
        context: AgentLoopContext,
        input: LoopInput,
        sessionManager: SessionManager,
        logger: ReturnType<typeof createLogger>
    ) {
        // ============ 主循环 ============
        while (true) {
            const prevState = context.state;
            logger.log(`状态: ${context.state}, 迭代: ${context.iteration}/${context.maxIterations}`);

            // ============ 状态：PLANNING - 规划 (Reasoning) ============
            if (context.state === "PLANNING") {
                // 1. 进入新一轮 ReAct 循环，增加迭代计数
                context.iteration++;
                input.observer?.onStateChange?.(prevState, "PLANNING", context.iteration);

                // 2. 检查是否达到最大迭代次数
                if (context.iteration > context.maxIterations) {
                    // TODO 最后一次执行，强行要求llm返回最后的结果
                    logger.log(`达到最大迭代次数，退出`);
                    context.state = "COMPLETED";
                    continue;
                }

                input.observer?.onIterationStart?.(context.iteration, context.maxIterations);

                // 3. 检查是否需要压缩上下文
                if (shouldCompact(context)) {
                    logger.log(`检测到需要压缩上下文`);
                    context.state = "COMPACTING";
                    continue;
                }

                // 4. 最佳实践推荐：对于支持原生 Tool Calling 和思考模式的大模型，
                // 应当直接在 Execute 阶段使用 maxSteps 完成单次流式输出，
                // 强行分离独立的 plan / reason 会引发多余的调用甚至导致格式错乱。
                logger.log(`第 ${context.iteration} 轮：规划阶段结束（交由 Execute 阶段原生推理）`);

                // 5. 转换到 EXECUTING 状态
                context.state = "EXECUTING";
                continue;
            }

            // ============ 状态：EXECUTING - 执行 (Acting) ============
            if (context.state === "EXECUTING") {
                input.observer?.onStateChange?.(prevState, "EXECUTING", context.iteration);
                logger.log(`执行 LLM 调用 - 进入内层循环`);

                try {
                    // 调用内层循环 - 处理 LLM 调用、重试、流式输出等
                    const executeResult = await Processor.execute({
                        agent: input.agentConfig,
                        messages: [...context.session.messages],  // 传递只读副本
                        maxRetries: input.agentConfig.max_retries ?? 5,  // 增加默认重试次数
                        timeout: input.agentConfig.timeout,
                        streamHandlers: input.observer?.executeHandlers,
                        debug: input.debug ?? (process.env.RAYE_DEBUG === "1"),
                    });
                    context.session = await SessionContext.run(context.session, () =>
                        Promise.resolve(processResutlToSession(executeResult))
                    );
                    // 保存执行元数据，供 makeDecision 使用
                    context.lastFinishReason = executeResult.finishReason;
                    context.lastToolCallCount = executeResult.toolCalls?.length ?? 0;
                    logger.log(`LLM 调用成功，工具调用: ${context.lastToolCallCount}，finishReason: ${executeResult.finishReason}`);
                    logger.log(`当前消息数: ${context.session.messages.length}`);

                    // 保存到 SessionManager
                    await sessionManager.save(context.session);

                    input.observer?.onIterationEnd?.(context.iteration);
                    // 转换到 OBSERVING 状态
                    context.state = "OBSERVING";
                } catch (error) {
                    const err = error as any;
                    const statusCode = err?.statusCode || err?.status;
                    const errorName = err?.name;
                    
                    if (statusCode === 429) {
                        logger.error(`⚠️  LLM 调用失败 - 速率限制 (429 Too Many Requests)`);
                        logger.error(`   模型: ${input.agentConfig.model}`);
                        logger.error(`   建议: 请稍后重试，或考虑使用其他模型/API 提供商`);
                    } else if (errorName === "AI_TypeValidationError") {
                        logger.error(`⚠️  LLM 调用失败 - 响应格式错误 (AI_TypeValidationError)`);
                        logger.error(`   模型: ${input.agentConfig.model}`);
                        logger.error(`   提供商: ${input.agentConfig.provider}`);
                        logger.error(`   建议: 该模型可能不完全兼容 OpenAI API 格式，考虑更换模型或提供商`);
                        logger.error(`   注意: 系统已自动重试 ${input.agentConfig.max_retries ?? 5} 次但仍失败`);
                    } else {
                        logger.error(`❌ LLM 调用失败:`, error);
                    }
                    
                    context.error = error as Error;
                    input.observer?.onError?.(error as Error, "EXECUTING");
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：OBSERVING - 观察结果 ============
            if (context.state === "OBSERVING") {
                input.observer?.onStateChange?.(prevState, "OBSERVING", context.iteration);
                logger.log(`观察执行结果并决策`);

                // 1. 分析最后一条消息
                const messages = context.session.messages;
                const lastMessage = messages[messages.length - 1];

                // 2. 做出决策
                const decision = makeDecision(context, lastMessage, logger);

                logger.log(`决策结果: ${decision}`);

                // 3. 根据决策转换状态
                switch (decision) {
                    case "continue":
                        // 继续下一轮 ReAct 循环
                        context.state = "PLANNING";
                        break;

                    case "compact":
                        // 需要压缩上下文
                        context.needsCompaction = true;
                        context.state = "COMPACTING";
                        break;

                    case "stop":
                        // 任务完成
                        context.state = "COMPLETED";
                        break;
                }
                continue;
            }

            // ============ 状态：COMPACTING - 压缩上下文 ============
            if (context.state === "COMPACTING") {
                input.observer?.onStateChange?.(prevState, "COMPACTING", context.iteration);
                logger.log(`开始压缩上下文`);
                logger.log(`压缩前消息数: ${context.session.messages.length}`);

                try {
                    // 调用压缩器（不可变操作）
                    const keepCount = Math.floor(context.compactThreshold * 0.7);
                    context.session = SessionOps.compressMessages(context.session, keepCount);

                    logger.log(`压缩后消息数: ${context.session.messages.length}`);

                    // 保存压缩后的 Session
                    await sessionManager.save(context.session);

                    context.needsCompaction = false;
                    context.state = "PLANNING";
                } catch (error) {
                    logger.error(`压缩失败:`, error);
                    context.error = error as Error;
                    input.observer?.onError?.(error as Error, "COMPACTING");
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：COMPLETED - 完成 ============
            if (context.state === "COMPLETED") {
                input.observer?.onStateChange?.(prevState, "COMPLETED", context.iteration);
                logger.log(`循环完成，总迭代次数: ${context.iteration}`);
                logger.log(`最终消息数: ${context.session.messages.length}`);

                // 更新元数据
                context.session = SessionOps.incrementIterations(context.session, context.iteration);
                await sessionManager.save(context.session);

                const loopResult = {
                    success: true,
                    session: context.session,
                    messages: [...context.session.messages],
                    iterations: context.iteration,
                };
                input.observer?.onLoopEnd?.({ success: true, iterations: context.iteration });
                return loopResult;
            }

            // ============ 状态：FAILED - 失败 ============
            if (context.state === "FAILED") {
                input.observer?.onStateChange?.(prevState, "FAILED", context.iteration);
                logger.error(`循环失败，迭代: ${context.iteration}`);
                logger.error(`错误:`, context.error);

                // 尝试保存当前状态
                try {
                    await sessionManager.save(context.session);
                } catch (saveError) {
                    logger.error(`保存失败状态时出错:`, saveError);
                }

                const loopResult = {
                    success: false,
                    session: context.session,
                    messages: [...context.session.messages],
                    iterations: context.iteration,
                    error: context.error,
                };
                input.observer?.onLoopEnd?.({ success: false, iterations: context.iteration, error: context.error });
                return loopResult;
            }

            // 不应该到达这里
            throw new Error(`[AgentLoop] 未知状态: ${context.state}`);
        }
    }

    /**
     * 判断是否需要压缩上下文
     */
    function shouldCompact(context: AgentLoopContext): boolean {
        // 1. 检查消息数量是否超过阈值
        if (context.session.messages.length >= context.compactThreshold) {
            return true;
        }

        // 2. 检查 token 数量（如果需要）
        // if (context.tokenCount >= context.maxTokens) {
        //     return true;
        // }

        return false;
    }

    // ================================================================
    // makeDecision 及其辅助函数
    // ================================================================

    /**
     * 从 ModelMessage 的 content 中提取纯文本
     */
    function extractTextContent(message: any): string {
        const content = message?.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
            return content
                .filter((b: any) => b?.type === "text")
                .map((b: any) => b.text ?? "")
                .join("");
        }
        return "";
    }

    /**
     * 判断 assistant message 的 content 中是否含有 tool-call 块
     *
     * processResutlToSession 将工具调用以 content 块的形式写入 session，
     * 而非 ModelMessage 上的顶层 `toolCalls` 属性。
     */
    function hasToolCallContent(message: any): boolean {
        const content = message?.content;
        if (!Array.isArray(content)) return false;
        return content.some((b: any) => b?.type === "tool-call");
    }

    /**
     * 检查消息历史中是否存在 ask_user 工具调用
     *
     * 遍历所有消息，查找任何 role="assistant" 的消息中是否包含 ask_user 工具调用。
     * 用于 P0.5 优先级检查，确保无论 finishReason 是什么值，只要检测到 ask_user 就立即停止。
     *
     * @param messages - 消息历史数组
     * @returns 如果找到 ask_user 工具调用返回 true，否则返回 false
     */
    function hasAskUserToolCall(messages: readonly any[]): boolean {
        for (const message of messages) {
            // 只检查 assistant 消息
            if (message?.role !== "assistant") continue;

            const content = message.content;
            // 检查 content 是否为数组（包含 tool-call 块）
            if (!Array.isArray(content)) continue;

            // 查找是否有 ask_user 工具调用
            const hasAskUser = content.some((block: any) =>
                block?.type === "tool-call" && block?.toolName === "ask_user"
            );

            if (hasAskUser) {
                return true;
            }
        }

        return false;
    }


    /**
     * 根据执行结果做出决策 — 判断 ReAct 循环是否应该继续
     *
     * # 设计背景
     *
     * 以 Cursor 修复 Bug 为例，一次完整的任务流程：
     *   1. 读取目录结构      → list_dir
     *   2. 识别相关文件      → (LLM 推理)
     *   3. 读取文件内容      → read_file
     *   4. 修改文件          → edit_file
     *   5. 验证修改          → read_file / run_test
     *   6. 返回最终结果      → 纯文本响应
     *
     * 步骤 1-5 都涉及工具调用，外层 ReAct 循环必须持续驱动。
     * 核心判断：工具调用尚未结束 → continue，LLM 自然停止 → stop。
     *
     * # 信号来源与可靠性
     *
     * ## `finishReason`（来自 SDK，最权威）
     *
     * SDK `streamText` 结束时报告最后一步的 finishReason：
     *
     * | finishReason       | 含义                         | 决策        |
     * |--------------------|------------------------------|-------------|
     * | `"stop"`           | LLM 自然结束                 | **stop**    |
     * | `"end-turn"`       | Anthropic 等同 stop          | **stop**    |
     * | `"tool-calls"`     | LLM 仍想调用工具但被截停     | **continue**|
     * | `"length"`         | maxOutputTokens 截断         | **stop**    |
     * | `"content-filter"` | 安全过滤拦截                 | **stop**    |
     * | `"error"` / 其他    | 异常                         | → fallback  |
     *
     * ### 为什么 `"stop"` 意味着任务完成？
     *
     * 与 maxSteps（stopWhen）的关系：
     *
     * **无 maxSteps 限制（当前默认）：**
     *   SDK 内部循环：LLM → tool → LLM → tool → ... → LLM → stop
     *   所有工具调用在单次 EXECUTING 内完成。
     *   `finishReason: "stop"` = LLM 用完了所有它需要的工具后自行停止。
     *
     * **有 maxSteps 限制（如 maxSteps=3）：**
     *   SDK 最多允许 3 轮 LLM→tool，超出时强制停止。
     *   `finishReason: "tool-calls"` = SDK 截停，LLM 仍有未完成的工具意图。
     *   此时外层 ReAct 循环 REASON → EXECUTE 补上剩余步骤。
     *
     * 因此：`"stop"` 总是代表 LLM 认为本轮工作已完成。
     *
     * ## `lastMessage`（Session 消息结构，防御性兜底）
     *
     * 仅在 `finishReason` 未知/缺失时使用：
     * - `role: "tool"`      → 工具结果刚写入，LLM 还没看到 → continue
     * - `role: "assistant"` + tool-call 块 → 工具调用已发出 → continue
     * - `role: "assistant"` + 纯文本 → 无工具意图 → stop
     *
     * # 优先级
     *
     * P0 上下文压缩  >  P0.5 控制流工具  >  P1 finishReason  >  P2 消息结构  >  P3 默认 continue
     */
    function makeDecision(context: AgentLoopContext, lastMessage: any, logger: ReturnType<typeof createLogger>): LoopDecision {
        const fr = context.lastFinishReason;
        const tc = context.lastToolCallCount ?? 0;
        const decisionLogger = createLogger("makeDecision", logger.log !== (() => {}));

        // ── P0: 运维约束 ─ 上下文压缩（优先级最高）──────────────
        if (context.needsCompaction || shouldCompact(context)) {
            decisionLogger.log(`需要压缩上下文 (messages=${context.session.messages.length}, threshold=${context.compactThreshold}) → compact`);
            return "compact";
        }

        // ── P0.5: 控制流工具检查（优先级高于 finishReason）──────────
        if (hasAskUserToolCall(context.session.messages)) {
            decisionLogger.log(`检测到 ask_user 工具调用 → stop (等待用户介入)`);
            return "stop";
        }

        // ── P1: finishReason（最权威信号）────────────────────────
        if (fr) {
            switch (fr) {
                // ---- 自然停止：LLM 认为工作完成 ----
                case "stop":
                case "end-turn":
                    decisionLogger.log(`finishReason="${fr}", toolCalls=${tc} → stop`);
                    return "stop";

                // ---- SDK 截停：maxSteps 耗尽，LLM 仍有工具调用意图 ----
                case "tool-calls":
                    decisionLogger.log(`finishReason="tool-calls", toolCalls=${tc} → continue (maxSteps 截停)`);
                    return "continue";

                // ---- 输出截断 ----
                case "length":
                    // maxOutputTokens 耗尽，输出被截断。
                    // 无法确定 LLM 是否还想调用工具，保守终止以避免无限循环。
                    // 如果任务因此不完整，应增大 agent config 的 max_output_tokens。
                    decisionLogger.warn(`finishReason="length" → stop (输出被截断，保守终止)`);
                    return "stop";

                // ---- 安全过滤 ----
                case "content-filter":
                    decisionLogger.warn(`finishReason="content-filter" → stop (内容被安全策略拦截)`);
                    return "stop";

                // ---- 未识别的 finishReason → fallthrough 到 P2 ----
                default:
                    decisionLogger.warn(`未知 finishReason="${fr}", toolCalls=${tc} → 降级到消息分析`);
                    break;
            }
        }

        // ── P1.5: 特定控制工具的强制流转 ──────────────────────────
        if (lastMessage && lastMessage.role === "assistant" && hasToolCallContent(lastMessage)) {
            const content = lastMessage.content;
            if (Array.isArray(content)) {
                if (content.some((b: any) => b.type === "tool-call" && b.toolName === "finish_task")) {
                    decisionLogger.log(`检测到 finish_task 工具调用 → stop`);
                    return "stop";
                }
            }
        }

        // ── P2: 消息结构分析（防御性兜底）────────────────────────
        //
        // 到达此处说明 finishReason 缺失或不可识别，
        // 通过 session 中最后一条消息的结构来推断。

        if (!lastMessage) {
            decisionLogger.log("无最后消息 → stop (无法判断，终止)");
            return "stop";
        }

        // 最后是工具结果消息 → LLM 尚未看到这些结果，必须继续
        // （只有 finishReason 缺失时才会走到这里，正常路径由 P1 处理）
        if (lastMessage.role === "tool") {
            decisionLogger.log(`[P2 fallback] lastMessage.role="tool" → continue`);
            return "continue";
        }

        if (lastMessage.role === "assistant") {
            // content 中有 tool-call 块 → 工具调用已发出，外层需继续驱动
            if (hasToolCallContent(lastMessage)) {
                decisionLogger.log(`[P2 fallback] assistant 含 tool-call 块 → continue`);
                return "continue";
            }

            // 纯文本响应，无任何工具调用 → 任务自然完成
            decisionLogger.log(`[P2 fallback] assistant 纯文本 → stop`);
            return "stop";
        }

        // ── P3: 默认策略 ────────────────────────────────────────
        decisionLogger.log(`[P3 default] role=${lastMessage?.role} → continue (保守)`);
        return "continue";
    }
}