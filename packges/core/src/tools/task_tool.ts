import { tool, type ModelMessage } from "ai";
import { z } from "zod";
import { loadAndGetAgent } from "@/agent/agent.js";
import { defaultSessionManager } from "@/session/seesion.js";
import { createLogger } from "common";

const logger = createLogger("Tool", process.env.RAYE_DEBUG === "1");

/**
 * 子代理任务调度工具
 */
export const spawn_agent = tool({
    description: "派遣一个子代理去执行繁重或包含大量子步骤的任务（例如大规模搜索文件内容、复杂的推演流程、或修改多个独立模块）。它开启一个完全隔离的新会话，避免中间步骤污染主会话上下文。子代理内部能够自行调用底层工具完成既定任务并携带工作摘要归来。",
    inputSchema: z.object({
        taskName: z.string().describe("为子代理设定的易读且简短的名称（如: explore-frontend-components）。"),
        instruction: z.string().describe("向子代理下达具体、清晰、详实的指令。包含背景、目标，以及指明它需要反馈什么格式/内容的结论给你。"),
    }),
    execute: async (args) => {
        logger.log(`🚀 调度启动子代理 - 任务名: ${args.taskName}`);

        // 动态导入以避免工具和循环引擎互相形成循环依赖 (loop <-> executor <-> tools <-> loop)
        const { AgentLoop } = await import("@/session/loop.js");

        const allAgents = loadAndGetAgent();
        // 如果我们有独立配置的 'subAgent' 则使用，没有则降级使用 'agent'
        const subAgentConfig = allAgents["subAgent"] || allAgents["agent"];
        if (!subAgentConfig) throw new Error("Agent configuration not found");

        const subSessionId = `subagent-${args.taskName}-${Date.now()}`;

        // 编排首轮沟通提示词，强化它作为子代理的定位与收尾职责
        const initialMessage: ModelMessage = {
            role: "user",
            content: `【来自总指挥代理的任务指令】\n任务目标：\n${args.instruction}\n\n执行要求：\n你需要利用配置好的各类工具完成以上排查或执行工作。\n无论成功或因客观阻断原因停滞，当你的分析或执行闭环后，请务必调用 \`finish_task\` 汇报出详细结果/进展摘要！`
        };

        try {
            const loopResult = await AgentLoop.loop({
                sessionId: subSessionId,
                agentConfig: subAgentConfig,
                message: initialMessage,
                maxIterations: 15,
                compactThreshold: 25
            }, defaultSessionManager);

            const msgs = loopResult.messages;
            const lastMsg = msgs[msgs.length - 1];

            let finalSummary = "子代理解释任务已终结，但在解析其最后反馈时未能捕获有效文本摘要。";

            // 尝试精准分析其最后一次返回的信息：文本或 `finish_task` 中的摘要
            if (lastMsg && lastMsg.role === "assistant") {
                const content = lastMsg.content;
                if (Array.isArray(content)) {
                    // 首先尝试寻找 finish_task 的传参
                    const finishTool = content.find((b: any) => b.type === "tool-call" && b.toolName === "finish_task") as any;
                    if (finishTool && finishTool.args) {
                        const toolArgs = finishTool.args;
                        finalSummary = toolArgs.summary ?? JSON.stringify(toolArgs);
                    } else {
                        // 降级截别普通的文本响应
                        const textChunks = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
                        if (textChunks) finalSummary = textChunks;
                    }
                } else if (typeof content === "string" && content) {
                    finalSummary = content;
                }
            }

            logger.log(`✅ 子代理 ${args.taskName} 顺利返航汇报结果。`);

            return {
                status: loopResult.success ? "success" : "failed",
                subSessionId,
                iterationsUsed: loopResult.iterations,
                summary: finalSummary
            };
        } catch (error) {
            logger.error(`❌ 子代理 ${args.taskName} 运行时崩溃: `, error);
            return {
                status: "crashed",
                subSessionId,
                message: "内部错误，子代理无法完成预期任务",
                error: (error as Error).message
            };
        }
    }
});
