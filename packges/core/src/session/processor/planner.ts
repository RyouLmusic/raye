import type { ModelMessage, StreamTextResult, ToolSet } from "ai";
import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent";
import { SessionContext } from "@/session/seesion";
import { processFullStream } from "@/session/stream-handler";
import type { StreamHandlers } from "@/session/stream-handler";
import type { PlanInput, ProcessorStepResult } from "@/session/type";
import { buildAssistantMessage } from "@/session/processor/utils";

export interface Planner {
    plan(input: PlanInput): Promise<ProcessorStepResult>;
}

export function createPlanner(): Planner {
    return {
        plan,
    };
}

/**
 * 默认的 plan 阶段流式回调（降级到 console.log）
 * 当外部未注入 handlers 时使用，保持原有的调试输出行为。
 */
const defaultPlanHandlers: StreamHandlers = {
    reasoning: {
        onStart: () => console.log("💭 [Planner] 开始推理..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   (full) => console.log("\n📋 [Planner] 规划推理完成"),
    },
    text: {
        onStart: () => console.log("💡 [Planner] 输出规划结果..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   (full) => console.log(`\n📋 [Planner] 规划完成: ${full.substring(0, 80)}...`),
    },
    tool: {
        onCall:   (id, name, args)   => console.log(`🔧 [Planner] 工具调用: ${name}`, args),
        onResult: (id, name, result) => console.log(`✅ [Planner] 工具返回 - ${name}:`, result),
    },
    onError:  (err)    => console.error("❌ [Planner] 规划过程中发生错误:", err),
    onFinish: (result) => {
        console.log("🎉 [Planner] 规划流程结束");
        console.log("结束原因:", result.finishReason);
        console.log("使用量:", result.usage);
    },
};

/**
 * 全局规划（首轮 PLANNING 阶段）
 *
 * 返回值中的 `message` 是已组装好的 assistant ModelMessage，
 * 由 loop.ts 写入 Session，使后续 EXECUTING 阶段能看到规划内容。
 *
 * @param input.messages  完整消息历史（只读副本）
 * @param input.handlers  外部注入的流式回调；未提供时降级到 defaultPlanHandlers
 */
async function plan(input: PlanInput): Promise<ProcessorStepResult> {
    const { messages, handlers } = input;
    const planAgent = loadAndGetAgent().plan!;
    const session = SessionContext.current();

    const streamResult = await streamTextWrapper({
        agent: planAgent,
        messages: [...messages],
        maxRetries: 0,
    });

    // 捕获 LLM 完整输出（通过拦截 onFinish）
    // onFinish 由 processFullStream 在流结束后调用，包含 text/reasoning/finishReason/usage
    let captured: { text: string; reasoning: string; finishReason: string; usage?: unknown } = {
        text: "",
        reasoning: "",
        finishReason: "stop",
    };

    const baseHandlers = handlers ?? defaultPlanHandlers;
    const mergedHandlers: StreamHandlers = {
        ...baseHandlers,
        onFinish: async (result) => {
            captured = { ...result };
            // 同时透传给外部的 onFinish（如 TUI 的 usage 统计）
            await baseHandlers.onFinish?.(result);
        },
    };

    await processFullStream(streamResult, {
        handlers: mergedHandlers,
        debug: false,
    });

    const { text, reasoning, finishReason, usage } = captured;
    const message = buildAssistantMessage(text, reasoning);

    return { text, reasoning, finishReason, usage, message };
}