import { tool } from "ai";
import { z } from "zod";

/**
 * 结束任务工具
 * 
 * 当大模型认为任务已完成时,必须调用此工具以告知外层循环退出。
 */
export const finish_task = tool({
    description: "当任务已按照用户需求全部完成，代码修改完毕且测试通过时调用此工具。",
    inputSchema: z.object({
        summary: z.string().describe("用一句话简练总结你完成的工作内容。"),
    }),
    execute: async (args) => {
        console.log(`[Tool] finish_task: ${args.summary}`);
        // 返回明确的完成标识，循环可以通过识别此工具调用来停止
        return {
            status: "finished",
            summary: args.summary,
            message: "任务已完成，系统将终止。请等待进程退出。"
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
                return {
                    status: "answered",
                    question: args.question,
                    answer: userReply,
                    message: `用户回复: ${userReply}`,
                };
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
