import type { ModelMessage } from "ai";

/**
 * 将 LLM 输出的 text + reasoning 组装为可直接写入 Session 的 assistant ModelMessage。
 *
 * 消息内容结构规则：
 * - reasoning 非空 → content 为数组 [{ type:"reasoning" }, { type:"text" }]
 *   方便后续轮次的 LLM 读取推理过程，也方便 TUI 区分展示。
 * - reasoning 为空  → content 为纯字符串，节省 token 空间。
 */
export function buildAssistantMessage(text: string, reasoning: string): ModelMessage {
    if (reasoning) {
        return {
            role: "assistant",
            content: [
                { type: "reasoning", text: reasoning },
                { type: "text",      text },
            ],
        };
    }
    return { role: "assistant", content: text };
}
