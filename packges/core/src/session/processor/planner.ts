import type { ModelMessage } from "ai";

export interface Planner {
    plan(messages: ModelMessage[]): Promise<ModelMessage[]>;
}

export function createPlanner(): Planner {
    return {
        plan,
    };
}

/**
 * 规划消息处理
 * @param messages 输入消息列表
 * @returns 规划后的消息列表
 */
async function plan(messages: ModelMessage[]): Promise<ModelMessage[]> {
    // TODO: 实现规划逻辑
    return messages;
}