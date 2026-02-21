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

        console.log(`[AgentLoop] 加载 Session: ${input.sessionId}`);
        console.log(`[AgentLoop] 历史消息数: ${session.messages.length}`);

        // 2. 添加当前轮的用户新消息
        console.log(`[AgentLoop] 添加新消息: ${input.message.role}`);
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

        console.log(`[AgentLoop] 初始化 Session: ${input.sessionId}`);
        console.log(`[AgentLoop] 最大迭代次数: ${context.maxIterations}`);
        console.log(`[AgentLoop] 当前消息数: ${context.session.messages.length}`);
        
        // 通知 observer：Loop 整体开始
        input.observer?.onLoopStart?.(input.sessionId);

        // 转换到 PLANNING 状态
        context.state = "PLANNING";

        // ============ 在 Session 上下文中执行（支持 SessionContext.current()）============
        return await SessionContext.run(context.session, async () => {
            try {
                return await executeLoop(context, input, sessionManager);
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
        sessionManager: SessionManager
    ) {
        // ============ 主循环 ============
        while (true) {
            const prevState = context.state;
            console.log(`[AgentLoop] 状态: ${context.state}, 迭代: ${context.iteration}/${context.maxIterations}`);

            // ============ 状态：PLANNING - 规划 (Reasoning) ============
            if (context.state === "PLANNING") {
                input.observer?.onStateChange?.(prevState, "PLANNING", context.iteration);

                // 1. 检查是否达到最大迭代次数
                if (context.iteration >= context.maxIterations) {
                    // TODO 最后一次执行，强行要求llm返回最后的结果
                    console.log(`[AgentLoop] 达到最大迭代次数，退出`);
                    context.state = "COMPLETED";
                    continue;
                }

                // 2. 增加迭代计数
                context.iteration++;
                input.observer?.onIterationStart?.(context.iteration, context.maxIterations);

                // 3. 检查是否需要压缩上下文
                if (shouldCompact(context)) {
                    console.log(`[AgentLoop] 检测到需要压缩上下文`);
                    context.state = "COMPACTING";
                    continue;
                }

                // 4. 首轮（iteration === 1）执行全局规划（Plan），后续轮执行即时推理（Reason）
                //    结果写入 session，EXECUTING 阶段可以看到规划/推理内容
                if (context.iteration === 1) {
                    console.log(`[AgentLoop] 首轮：执行全局任务规划（Plan）`);
                    const planResult = await Processor.plan({
                        messages: [...context.session.messages],
                        handlers: input.observer?.planHandlers,
                    });
                    processResutlToSession(planResult);
                    await sessionManager.save(context.session);
                } else {
                    console.log(`[AgentLoop] 第 ${context.iteration} 轮：基于观察进行即时推理（Reason）`);
                    const reasonResult = await Processor.reason({
                        messages: [...context.session.messages],
                        handlers: input.observer?.reasonHandlers,
                    });
                    processResutlToSession(reasonResult);                    
                    await sessionManager.save(context.session);
                }
                console.log(`[AgentLoop] 开始规划第 ${context.iteration} 轮行动`);
              
                // 5. 转换到 EXECUTING 状态
                context.state = "EXECUTING";
                continue;
            }

            // ============ 状态：EXECUTING - 执行 (Acting) ============
            if (context.state === "EXECUTING") {
                input.observer?.onStateChange?.(prevState, "EXECUTING", context.iteration);
                console.log(`[AgentLoop] 执行 LLM 调用 - 进入内层循环`);

                try {
                    // 调用内层循环 - 处理 LLM 调用、重试、流式输出等
                    const executeResult = await Processor.execute({
                        agent: input.agentConfig,
                        messages: [...context.session.messages],  // 传递只读副本
                        maxRetries: input.agentConfig.max_retries ?? 3,
                        timeout: input.agentConfig.timeout,
                        streamHandlers: input.observer?.executeHandlers,
                    });
                    processResutlToSession(executeResult);
                    // 保存执行元数据，供 makeDecision 使用
                    context.lastFinishReason = executeResult.finishReason;
                    context.lastToolCallCount = executeResult.toolCalls?.length ?? 0;
                    console.log(`[AgentLoop] LLM 调用成功，工具调用: ${context.lastToolCallCount}，finishReason: ${executeResult.finishReason}`);
                    console.log(`[AgentLoop] 当前消息数: ${context.session.messages.length}`);

                    // 保存到 SessionManager
                    await sessionManager.save(context.session);

                    input.observer?.onIterationEnd?.(context.iteration);
                    // 转换到 OBSERVING 状态
                    context.state = "OBSERVING";
                } catch (error) {
                    console.error(`[AgentLoop] LLM 调用失败:`, error);
                    context.error = error as Error;
                    input.observer?.onError?.(error as Error, "EXECUTING");
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：OBSERVING - 观察结果 ============
            if (context.state === "OBSERVING") {
                input.observer?.onStateChange?.(prevState, "OBSERVING", context.iteration);
                console.log(`[AgentLoop] 观察执行结果并决策`);

                // 1. 分析最后一条消息
                const messages = context.session.messages;
                const lastMessage = messages[messages.length - 1];
                
                // 2. 做出决策
                const decision = makeDecision(context, lastMessage);
                
                console.log(`[AgentLoop] 决策结果: ${decision}`);

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
                console.log(`[AgentLoop] 开始压缩上下文`);
                console.log(`[AgentLoop] 压缩前消息数: ${context.session.messages.length}`);

                try {
                    // 调用压缩器（不可变操作）
                    const keepCount = Math.floor(context.compactThreshold * 0.7);
                    context.session = SessionOps.compressMessages(context.session, keepCount);

                    console.log(`[AgentLoop] 压缩后消息数: ${context.session.messages.length}`);
                    
                    // 保存压缩后的 Session
                    await sessionManager.save(context.session);
                    
                    context.needsCompaction = false;
                    context.state = "PLANNING";
                } catch (error) {
                    console.error(`[AgentLoop] 压缩失败:`, error);
                    context.error = error as Error;
                    input.observer?.onError?.(error as Error, "COMPACTING");
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：COMPLETED - 完成 ============
            if (context.state === "COMPLETED") {
                input.observer?.onStateChange?.(prevState, "COMPLETED", context.iteration);
                console.log(`[AgentLoop] 循环完成，总迭代次数: ${context.iteration}`);
                console.log(`[AgentLoop] 最终消息数: ${context.session.messages.length}`);
                
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
                console.error(`[AgentLoop] 循环失败，迭代: ${context.iteration}`);
                console.error(`[AgentLoop] 错误:`, context.error);
                
                // 尝试保存当前状态
                try {
                    await sessionManager.save(context.session);
                } catch (saveError) {
                    console.error(`[AgentLoop] 保存失败状态时出错:`, saveError);
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
     * P0 上下文压缩  >  P1 finishReason  >  P2 消息结构  >  P3 默认 continue
     */
    function makeDecision(context: AgentLoopContext, lastMessage: any): LoopDecision {
        const fr = context.lastFinishReason;
        const tc = context.lastToolCallCount ?? 0;

        // ── P0: 运维约束 ─ 上下文压缩（优先级最高）──────────────
        if (context.needsCompaction || shouldCompact(context)) {
            console.log(`[makeDecision] 需要压缩上下文 (messages=${context.session.messages.length}, threshold=${context.compactThreshold}) → compact`);
            return "compact";
        }

        // ── P1: finishReason（最权威信号）────────────────────────
        if (fr) {
            switch (fr) {
                // ---- 自然停止：LLM 认为工作完成 ----
                case "stop":
                case "end-turn":
                    console.log(`[makeDecision] finishReason="${fr}", toolCalls=${tc} → stop`);
                    return "stop";

                // ---- SDK 截停：maxSteps 耗尽，LLM 仍有工具调用意图 ----
                case "tool-calls":
                    console.log(`[makeDecision] finishReason="tool-calls", toolCalls=${tc} → continue (maxSteps 截停)`);
                    return "continue";

                // ---- 输出截断 ----
                case "length":
                    // maxOutputTokens 耗尽，输出被截断。
                    // 无法确定 LLM 是否还想调用工具，保守终止以避免无限循环。
                    // 如果任务因此不完整，应增大 agent config 的 max_output_tokens。
                    console.warn(`[makeDecision] finishReason="length" → stop (输出被截断，保守终止)`);
                    return "stop";

                // ---- 安全过滤 ----
                case "content-filter":
                    console.warn(`[makeDecision] finishReason="content-filter" → stop (内容被安全策略拦截)`);
                    return "stop";

                // ---- 未识别的 finishReason → fallthrough 到 P2 ----
                default:
                    console.warn(`[makeDecision] 未知 finishReason="${fr}", toolCalls=${tc} → 降级到消息分析`);
                    break;
            }
        }

        // ── P2: 消息结构分析（防御性兜底）────────────────────────
        //
        // 到达此处说明 finishReason 缺失或不可识别，
        // 通过 session 中最后一条消息的结构来推断。

        if (!lastMessage) {
            console.log("[makeDecision] 无最后消息 → stop (无法判断，终止)");
            return "stop";
        }

        // 最后是工具结果消息 → LLM 尚未看到这些结果，必须继续
        // （只有 finishReason 缺失时才会走到这里，正常路径由 P1 处理）
        if (lastMessage.role === "tool") {
            console.log(`[makeDecision] [P2 fallback] lastMessage.role="tool" → continue`);
            return "continue";
        }

        if (lastMessage.role === "assistant") {
            // content 中有 tool-call 块 → 工具调用已发出，外层需继续驱动
            if (hasToolCallContent(lastMessage)) {
                console.log(`[makeDecision] [P2 fallback] assistant 含 tool-call 块 → continue`);
                return "continue";
            }

            // 纯文本响应，无任何工具调用 → 任务自然完成
            console.log(`[makeDecision] [P2 fallback] assistant 纯文本 → stop`);
            return "stop";
        }

        // ── P3: 默认策略 ────────────────────────────────────────
        console.log(`[makeDecision] [P3 default] role=${lastMessage?.role} → continue (保守)`);
        return "continue";
    }
}