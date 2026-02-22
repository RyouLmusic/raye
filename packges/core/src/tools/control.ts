import { tool } from "ai";
import { z } from "zod";

/**
 * 结束任务工具
 * 
 * 当大模型认为任务已完成时，必须调用此工具以告知外层循环退出。
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
 * 询问用户工具
 * 
 * 当遇到模糊不清的需求或遇到无法自主决定的情况时，强制暂停向用户询问。
 */
export const ask_user = tool({
    description: "遇到了歧义、难以决断的情况，或者需要用户提供前置信息（如密码、确认权限）时调用。调用后引擎会暂停并等待用户答复。",
    inputSchema: z.object({
        question: z.string().describe("你具体想询问用户的问题，语气要礼貌、清晰。"),
    }),
    execute: async (args) => {
        console.log(`[Tool] ask_user: ${args.question}`);
        // 实际场景下可以通过抛出特定错误或特殊状态给外层 UI
        return {
            status: "waiting_for_user",
            question: args.question,
        };
    }
});
