import { tool } from "ai";
import { z } from "zod";

/**
 * 结束任务工具
 * 
 * 当大模型认为任务已完成时,必须调用此工具以告知外层循环退出。
 * 
 * 重要：此工具调用后会立即终止对话循环，不会再有后续交互。
 * 工具返回的结果仅用于系统内部状态标记，不会作为新消息添加到对话历史中。
 */
export const finish_task = tool({
    description: `当你已经完全完成用户的所有需求时，调用此工具结束任务。

使用时机：
- ✅ 所有子任务都已完成
- ✅ 用户的问题已经得到完整回答
- ✅ 没有遗留的待办事项
- ✅ 不需要等待用户的进一步指示

注意事项：
- 调用此工具后，对话会立即终止，你不会再收到任何响应
- 在调用前，确保你已经给用户提供了完整的答案或完成了所有操作
- 如果任务只完成了一部分，不要调用此工具
- 如果需要用户确认或提供更多信息，使用 ask_user 工具而不是此工具`,
    
    inputSchema: z.object({
        summary: z.string().describe("用一句话简洁总结你完成的工作内容（例如：'已完成代码重构并通过测试'）"),
    }),
    
    execute: async ({ summary }) => {
        console.log(`[Tool] finish_task: ${summary}`);
        
        // 返回简洁的完成标识
        // 注意：这个返回值主要用于系统内部检测，不会作为对话消息
        return {
            status: "finished",
            summary: summary,
            // 返回简短确认，避免冗长文本影响上下文
            message: "✓ 任务完成"
        };
    }
});

/**
 * 全局回调：用于 ask_user 工具获取用户输入
 * 
 * 使用方式：
 * 1. UI 层在初始化时设置此回调
 * 2. ask_user 工具调用此回调并等待 Promise 完成
 * 3. UI 层通过弹窗/输入框获取用户输入后 resolve Promise
 */
let globalAskUserHandler: ((question: string) => Promise<string>) | null = null;

export function setAskUserHandler(handler: (question: string) => Promise<string>) {
    globalAskUserHandler = handler;
}

export function clearAskUserHandler() {
    globalAskUserHandler = null;
}

/**
 * 询问用户工具
 * 
 * 当遇到模糊不清的需求或遇到无法自主决定的情况时，强制暂停向用户询问。
 * 
 * 工作流程：
 * 1. LLM 调用 ask_user({ question: "..." })
 * 2. 工具通过 globalAskUserHandler 触发 UI 交互
 * 3. 等待用户输入（Promise pending）
 * 4. 用户输入后返回答案
 * 5. LLM 收到答案并继续执行
 */
export const ask_user = tool({
    description: "遇到了歧义、难以决断的情况，或者需要用户提供前置信息（如信息无法确认怎么回答和操作、密码、确认权限）时调用。调用后引擎会暂停并等待用户答复。",
    inputSchema: z.object({
        question: z.string().describe("你具体想询问用户的问题，语气要礼貌、清晰。"),
    }),
    execute: async (args) => {
        console.log(`[Tool] ask_user: ${args.question}`);
        
        // 如果设置了全局回调，直接等待用户输入
        if (globalAskUserHandler) {
            try {
                const userReply = await globalAskUserHandler(args.question);
                const result = {
                    status: "answered",
                    question: args.question,
                    answer: userReply,
                    message: `用户回复: ${userReply}`,
                };
                console.log(`[Tool] ask_user result:`, result);
                return result;
            } catch (error) {
                return {
                    status: "error",
                    question: args.question,
                    message: `获取用户输入失败: ${error}`,
                };
            }
        }
        
        // 降级方案：返回等待状态，由 Loop 的 makeDecision 检测并停止
        return {
            status: "waiting_for_user",
            question: args.question,
            message: `[等待用户回复] ${args.question}`,
        };
    }
});
