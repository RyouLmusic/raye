import { createCompressor } from "@/session/processor/compressor";
import { createExecutor } from "@/session/processor/executor";
import { createPlanner } from "@/session/processor/planner";
import { createReasoner } from "@/session/processor/reasoner";
import type { ProcessorStepResult } from "@/session/type";
import { SessionContext, SessionOps } from "../seesion";
import type { Session } from "@/session/type";
import type { ModelMessage } from "ai";

export interface Processor {
    execute: ReturnType<typeof createExecutor>["execute"];
    plan: ReturnType<typeof createPlanner>["plan"];
    reason: ReturnType<typeof createReasoner>["reason"];
    compress: ReturnType<typeof createCompressor>["compress"];
}

export function createProcessor(): Processor {
    const executor = createExecutor();
    const planner = createPlanner();
    const reasoner = createReasoner();
    const compressor = createCompressor();

    return {
        execute: executor.execute,
        plan: planner.plan,
        reason: reasoner.reason,
        compress: compressor.compress,
    };
}


export function processResutlToSession(result: ProcessorStepResult): Session {
    let session = SessionContext.current();

    
    // 1. 将 assistant message 写入 session
    //    若有工具调用，需将 tool-call 内容块追加到 assistant message 的 content 数组中，
    //    否则 tool-result 消息将缺少对应的 tool-call，导致后续 LLM 上下文不完整。
    if (result.toolCalls && result.toolCalls.length > 0) {
        const baseContent = Array.isArray(result.message.content)
            ? [...result.message.content]
            : result.message.content
            ? [{ type: "text" as const, text: result.message.content as string }]
            : [];

        const toolCallBlocks = result.toolCalls.map((tc) => ({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.args ?? {},
        }));

        const messageWithToolCalls = {
            role: "assistant" as const,
            content: [...baseContent, ...toolCallBlocks],
        } as ModelMessage;
        session = SessionOps.addMessage(session, messageWithToolCalls);
    } else {
        session = SessionOps.addMessage(session, result.message);
    }

    // 2. 如果有工具执行结果，转换为 tool role messages 并写入 session
    if (result.toolResults && result.toolResults.length > 0) {
        const toolResultMessages: ModelMessage[] = result.toolResults.map((toolResult) => ({
            role: "tool",
            content: [
                {
                    type: "tool-result",
                    toolCallId: toolResult.toolCallId,
                    toolName: toolResult.toolName,
                    output: JSON.parse(toolResult.content),
                },
            ],
        }));
        session = SessionOps.addMessages(session, toolResultMessages);
    }

    // 3. 如果有 token 使用量，更新元数据
    if (result.usage) {
        const usage = result.usage as { totalTokens?: number };
        if (typeof usage.totalTokens === "number") {
            session = SessionOps.addTokens(session, usage.totalTokens);
        }
    }

    return session;
}
export const Processor = createProcessor();

export type { ExecuteInput, ToolExecutionResult } from "@/session/type";
export type { PlanInput, ReasonInput, ProcessorStepResult } from "@/session/type";
export type { Executor } from "@/session/processor/executor";
export type { Planner } from "@/session/processor/planner";
export type { Reasoner } from "@/session/processor/reasoner";