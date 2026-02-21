import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent";
import { SessionContext } from "@/session/seesion";
import { processFullStream } from "@/session/stream-handler";
import type { StreamHandlers } from "@/session/stream-handler";
import type { ReasonInput, ProcessorStepResult } from "@/session/type";
import { buildAssistantMessage } from "@/session/processor/utils";

export interface Reasoner {
    reason(input: ReasonInput): Promise<ProcessorStepResult>;
}

export function createReasoner(): Reasoner {
    return {
        reason,
    };
}

/**
 * 默认的 reason 阶段流式回调（降级到 console.log）
 * 当外部未注入 handlers 时使用，保持原有的调试输出行为。
 */
const defaultReasonHandlers: StreamHandlers = {
    reasoning: {
        onStart: () => console.log("🧠 [Reasoner] 开始推理当前步骤..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   (_)    => console.log("\n[Reasoner] 内部推理完成"),
    },
    text: {
        onStart: () => console.log("💡 [Reasoner] 输出下一步行动..."),
        onDelta: (text) => { process.stdout.write(text); },
        onEnd:   (full) => console.log(`\n📍 [Reasoner] 下一步行动: ${full.substring(0, 80)}...`),
    },
    tool: {
        onCall:   (id, name, args)   => console.log(`🔧 [Reasoner] 工具调用: ${name}`, args),
        onResult: (id, name, result) => console.log(`✅ [Reasoner] 工具返回 - ${name}:`, result),
    },
    onError:  (err)    => console.error("❌ [Reasoner] 推理过程中发生错误:", err),
    onFinish: (result) => {
        console.log("🎉 [Reasoner] 推理流程结束");
        console.log("结束原因:", result.finishReason);
        console.log("使用量:", result.usage);
    },
};

/**
 * 即时推理（iter>1 的每轮 PLANNING 阶段）
 *
 * 与 planner 的区别：
 *   - planner：任务开始时一次性生成全局计划（全局视野）
 *   - reasoner：每轮 OBSERVING → PLANNING 时，针对当前观察即时推理下一步（局部视野）
 *
 * @param input.messages  完整的消息历史（含工具结果 observation）
 * @param input.handlers  外部注入的流式回调（由 LoopObserver.reasonHandlers 传入）；
 *                        未提供时降级到 defaultReasonHandlers（console.log）
 */
async function reason(input: ReasonInput): Promise<ProcessorStepResult> {
    const { messages, handlers } = input;
    const reasoningAgent = loadAndGetAgent().reasoning!;
    const session = SessionContext.current();

    const streamResult = await streamTextWrapper({
        agent: reasoningAgent,
        messages: [...messages],
        maxRetries: 0,
    });

    let captured: { text: string; reasoning: string; finishReason: string; usage?: unknown } = {
        text: "",
        reasoning: "",
        finishReason: "stop",
    };

    const baseHandlers = handlers ?? defaultReasonHandlers;
    const mergedHandlers: StreamHandlers = {
        ...baseHandlers,
        onFinish: async (result) => {
            captured = { ...result };
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