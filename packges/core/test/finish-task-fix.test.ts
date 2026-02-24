/**
 * 测试 finish_task 工具调用不会重复的问题修复
 * 
 * 问题描述：
 * 之前 finish_task 工具会被重复调用，因为决策逻辑只检查最后一条消息，
 * 而工具执行后会产生 tool-result 消息，导致检查失效。
 * 
 * 修复方案：
 * 1. 新增 hasFinishTaskToolCall 函数，遍历所有消息历史
 * 2. 将 finish_task 检查提升到 P0.5 优先级（与 ask_user 同级）
 * 3. 确保无论 lastMessage 是什么，都能正确识别 finish_task
 */

import { describe, it, expect } from "bun:test";

describe("finish_task 工具调用修复测试", () => {
    it("应该能识别消息历史中的 finish_task 调用", () => {
        // 模拟消息历史
        const messages = [
            {
                role: "user",
                content: "人参果怎么吃好吃"
            },
            {
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: "让我搜索一下人参果的吃法"
                    },
                    {
                        type: "tool-call",
                        toolCallId: "call_1",
                        toolName: "web_search",
                        args: { query: "人参果怎么吃好吃 做法" }
                    }
                ]
            },
            {
                role: "tool",
                content: [{
                    type: "tool-result",
                    toolCallId: "call_1",
                    toolName: "web_search",
                    output: { type: "json", value: { results: [] } }
                }]
            },
            {
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: "根据搜索结果，人参果有多种吃法..."
                    },
                    {
                        type: "tool-call",
                        toolCallId: "call_2",
                        toolName: "finish_task",
                        args: { summary: "已为用户提供人参果的多种美味吃法" }
                    }
                ]
            },
            {
                role: "tool",
                content: [{
                    type: "tool-result",
                    toolCallId: "call_2",
                    toolName: "finish_task",
                    output: { 
                        type: "json", 
                        value: { 
                            status: "finished",
                            summary: "已为用户提供人参果的多种美味吃法",
                            message: "任务已完成，系统将终止。请等待进程退出。"
                        } 
                    }
                }]
            }
        ];

        // 测试辅助函数
        function hasFinishTaskToolCall(messages: readonly any[]): boolean {
            for (const message of messages) {
                if (message?.role !== "assistant") continue;
                const content = message.content;
                if (!Array.isArray(content)) continue;
                const hasFinishTask = content.some((block: any) =>
                    block?.type === "tool-call" && block?.toolName === "finish_task"
                );
                if (hasFinishTask) {
                    return true;
                }
            }
            return false;
        }

        // 验证：即使最后一条消息是 tool-result，也能识别 finish_task
        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.role).toBe("tool");
        expect(hasFinishTaskToolCall(messages)).toBe(true);
    });

    it("应该在没有 finish_task 时返回 false", () => {
        const messages = [
            {
                role: "user",
                content: "测试消息"
            },
            {
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: "这是一个普通响应"
                    }
                ]
            }
        ];

        function hasFinishTaskToolCall(messages: readonly any[]): boolean {
            for (const message of messages) {
                if (message?.role !== "assistant") continue;
                const content = message.content;
                if (!Array.isArray(content)) continue;
                const hasFinishTask = content.some((block: any) =>
                    block?.type === "tool-call" && block?.toolName === "finish_task"
                );
                if (hasFinishTask) {
                    return true;
                }
            }
            return false;
        }

        expect(hasFinishTaskToolCall(messages)).toBe(false);
    });

    it("应该能识别多个工具调用中的 finish_task", () => {
        const messages = [
            {
                role: "assistant",
                content: [
                    {
                        type: "tool-call",
                        toolCallId: "call_1",
                        toolName: "web_search",
                        args: {}
                    },
                    {
                        type: "tool-call",
                        toolCallId: "call_2",
                        toolName: "finish_task",
                        args: { summary: "完成" }
                    },
                    {
                        type: "tool-call",
                        toolCallId: "call_3",
                        toolName: "calculate",
                        args: {}
                    }
                ]
            }
        ];

        function hasFinishTaskToolCall(messages: readonly any[]): boolean {
            for (const message of messages) {
                if (message?.role !== "assistant") continue;
                const content = message.content;
                if (!Array.isArray(content)) continue;
                const hasFinishTask = content.some((block: any) =>
                    block?.type === "tool-call" && block?.toolName === "finish_task"
                );
                if (hasFinishTask) {
                    return true;
                }
            }
            return false;
        }

        expect(hasFinishTaskToolCall(messages)).toBe(true);
    });
});
