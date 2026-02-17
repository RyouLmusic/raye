import { Processor } from "@/session/processor";
import type { ModelMessage } from "ai";
import type { 
    LoopInput, 
    AgentLoopContext, 
    AgentLoopState,
    LoopDecision 
} from "@/session/type";

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
     * @returns 最终的消息列表
     */
    export async function loop(input: LoopInput) {
        // 获取session
        // ============ 状态：INIT - 初始化 ============
        const context: AgentLoopContext = {
            state: "INIT",
            iteration: 0,
            maxIterations: input.maxIterations,
            messages: [...input.initialMessages],
            needsCompaction: false,
            compactThreshold: input.compactThreshold,
        };

        console.log(`[AgentLoop] 初始化 Session: ${input.sessionId}`);
        console.log(`[AgentLoop] 最大迭代次数: ${context.maxIterations}`);
        
        // 转换到 PLANNING 状态
        context.state = "PLANNING";

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
                        messages: context.messages,
                        maxRetries: input.agentConfig.max_retries ?? 3,
                        timeout: input.agentConfig.timeout,
                    });

                    // 将 LLM 的响应添加到消息列表
                    if (result.message) {
                        context.messages.push(result.message);
                    }

                    // 将工具调用结果添加到消息列表
                    if (result.toolResults && result.toolResults.length > 0) {
                        const toolResultMessages: ModelMessage[] = result.toolResults.map((toolResult) => ({
                            role: "assistant",
                            content: `[Tool:${toolResult.toolName}] ${toolResult.content}`,
                        }));
                        context.messages.push(...toolResultMessages);
                    }

                    console.log(`[AgentLoop] LLM 调用成功，收到 ${result.toolCalls?.length ?? 0} 个工具调用`);

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
                const lastMessage = context.messages[context.messages.length - 1];
                
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
                console.log(`[AgentLoop] 压缩前消息数: ${context.messages.length}`);

                try {
                    // 调用压缩器
                    // context.messages = await compressMessages(context.messages);
                    
                    // 临时实现：保留最近的 N 条消息
                    const keepCount = Math.floor(context.compactThreshold * 0.7);
                    const systemMessages = context.messages.filter(m => m.role === "system");
                    const recentMessages = context.messages.slice(-keepCount);
                    context.messages = [...systemMessages, ...recentMessages];

                    console.log(`[AgentLoop] 压缩后消息数: ${context.messages.length}`);
                    
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
                console.log(`[AgentLoop] 最终消息数: ${context.messages.length}`);
                
                // 返回最终的消息列表
                return {
                    success: true,
                    messages: context.messages,
                    iterations: context.iteration,
                };
            }

            // ============ 状态：FAILED - 失败 ============
            if (context.state === "FAILED") {
                console.error(`[AgentLoop] 循环失败，迭代: ${context.iteration}`);
                console.error(`[AgentLoop] 错误:`, context.error);
                
                // 返回错误信息
                return {
                    success: false,
                    messages: context.messages,
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
        if (context.messages.length >= context.compactThreshold) {
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
    function makeDecision(
        context: AgentLoopContext, 
        lastMessage: any
    ): LoopDecision {
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