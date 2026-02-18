import { Processor } from "@/session/processor";
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
            console.log(`[AgentLoop] 状态: ${context.state}, 迭代: ${context.iteration}/${context.maxIterations}`);

            // ============ 状态：PLANNING - 规划 (Reasoning) ============
            if (context.state === "PLANNING") {
                // 1. 检查是否达到最大迭代次数
                if (context.iteration >= context.maxIterations) {
                    // TODO 最后一次执行，强行要求llm返回最后的结果
                    console.log(`[AgentLoop] 达到最大迭代次数，退出`);
                    context.state = "COMPLETED";
                    continue;
                }

                // 2. 增加迭代计数
                context.iteration++;

                // 3. 检查是否需要压缩上下文
                if (shouldCompact(context)) {
                    console.log(`[AgentLoop] 检测到需要压缩上下文`);
                    context.state = "COMPACTING";
                    continue;
                }

                // 4. 准备 Planning Prompt（如果需要）
                // 这里可以添加特殊的 planning 系统提示词
                // const planningPrompt = generatePlanningPrompt(context);
                const { fullStream } = await Processor.plan(context.session.messages);
                console.log(`[AgentLoop] 开始规划第 ${context.iteration} 轮行动`);
              
                // 5. 转换到 EXECUTING 状态
                context.state = "EXECUTING";
                continue;
            }

            // ============ 状态：EXECUTING - 执行 (Acting) ============
            if (context.state === "EXECUTING") {
                console.log(`[AgentLoop] 执行 LLM 调用 - 进入内层循环`);

                try {
                    // 调用内层循环 - 处理 LLM 调用、重试、流式输出等
                    const result = await Processor.execute({
                        agent: input.agentConfig,
                        messages: [...context.session.messages],  // 传递只读副本
                        maxRetries: input.agentConfig.max_retries ?? 3,
                        timeout: input.agentConfig.timeout,
                    });

                    // 将 LLM 的响应添加到 Session（不可变操作）
                    if (result.message) {
                        context.session = SessionOps.addMessage(context.session, result.message);
                    }

                    // 将工具调用结果添加到 Session
                    if (result.toolResults && result.toolResults.length > 0) {
                        const toolResultMessages: ModelMessage[] = result.toolResults.map((toolResult) => ({
                            role: "tool",
                            content: [
                                {
                                    type: "tool-result",
                                    toolCallId: toolResult.toolCallId,
                                    toolName: toolResult.toolName,
                                    output: JSON.parse(toolResult.content),  // output 应该是对象，不是字符串
                                }
                            ],
                        }));
                        context.session = SessionOps.addMessages(context.session, toolResultMessages);
                    }

                    console.log(`[AgentLoop] LLM 调用成功，收到 ${result.toolCalls?.length ?? 0} 个工具调用`);
                    console.log(`[AgentLoop] 当前消息数: ${context.session.messages.length}`);

                    // 保存到 SessionManager
                    await sessionManager.save(context.session);

                    // 转换到 OBSERVING 状态
                    context.state = "OBSERVING";
                } catch (error) {
                    console.error(`[AgentLoop] LLM 调用失败:`, error);
                    context.error = error as Error;
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：OBSERVING - 观察结果 ============
            if (context.state === "OBSERVING") {
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
                    context.state = "FAILED";
                }
                continue;
            }

            // ============ 状态：COMPLETED - 完成 ============
            if (context.state === "COMPLETED") {
                console.log(`[AgentLoop] 循环完成，总迭代次数: ${context.iteration}`);
                console.log(`[AgentLoop] 最终消息数: ${context.session.messages.length}`);
                
                // 更新元数据
                context.session = SessionOps.incrementIterations(context.session, context.iteration);
                await sessionManager.save(context.session);
                
                // 返回最终的消息列表
                return {
                    success: true,
                    session: context.session,
                    messages: [...context.session.messages],  // 返回副本
                    iterations: context.iteration,
                };
            }

            // ============ 状态：FAILED - 失败 ============
            if (context.state === "FAILED") {
                console.error(`[AgentLoop] 循环失败，迭代: ${context.iteration}`);
                console.error(`[AgentLoop] 错误:`, context.error);
                
                // 尝试保存当前状态
                try {
                    await sessionManager.save(context.session);
                } catch (saveError) {
                    console.error(`[AgentLoop] 保存失败状态时出错:`, saveError);
                }
                
                // 返回错误信息
                return {
                    success: false,
                    session: context.session,
                    messages: [...context.session.messages],
                    iterations: context.iteration,
                    error: context.error,
                };
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

    /**
     * 根据执行结果做出决策
     * 
     * 决策逻辑：
     * 1. 如果 LLM 没有发起工具调用，说明认为任务完成 → stop
     * 2. 如果有工具调用，说明需要继续 → continue
     * 3. 如果消息过多，需要压缩 → compact
     */
    function makeDecision(context: AgentLoopContext, lastMessage: any): LoopDecision {
        // 1. 检查是否需要强制压缩
        if (context.needsCompaction) {
            return "compact";
        }

        // 2. 检查是否有工具调用
        const hasToolCalls = lastMessage?.role === "assistant" && 
                           lastMessage?.toolCalls && 
                           lastMessage?.toolCalls.length > 0;

        if (hasToolCalls) {
            // 有工具调用，继续循环
            return "continue";
        }

        // 3. 检查是否有明确的停止信号
        // 可以检查 LLM 输出的特殊标记，例如 "[DONE]", "[COMPLETE]" 等
        const content = lastMessage?.content;
        if (typeof content === "string") {
            if (content.includes("[DONE]") || content.includes("[COMPLETE]")) {
                return "stop";
            }
        }

        // 4. 如果 LLM 没有工具调用，认为任务完成
        if (lastMessage?.role === "assistant") {
            return "stop";
        }

        // 5. 默认继续
        return "continue";
    }
}