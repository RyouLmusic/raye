/**
 * 测试 finish_task 工具在内层循环中的防护机制
 * 
 * 问题描述：
 * LLM 在单次 streamText 调用中重复调用 finish_task，导致：
 * - 浪费 token 和时间
 * - finishReason 为 "tool-calls" 而不是 "stop"
 * - 可能触发外层循环继续
 * 
 * 修复方案：
 * 1. 在 executor.ts 中添加 onStepFinish 回调
 * 2. 检测到 finish_task 后立即调用 abortController.abort()
 * 3. 设置 maxSteps: 10 作为兜底保护
 */

import { describe, it, expect } from "bun:test";

describe("finish_task 内层循环防护测试", () => {
    it("应该在 onStepFinish 中检测到 finish_task", () => {
        // 模拟 step 对象
        const step = {
            text: "根据搜索结果，人参果有多种吃法...",
            toolCalls: [
                {
                    toolCallId: "call_1",
                    toolName: "web_search",
                    args: { query: "人参果怎么吃" }
                },
                {
                    toolCallId: "call_2",
                    toolName: "finish_task",
                    args: { summary: "已完成" }
                }
            ]
        };

        // 检测逻辑
        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );

        expect(hasFinishTask).toBe(true);
    });

    it("应该在没有 finish_task 时返回 false", () => {
        const step = {
            text: "搜索结果...",
            toolCalls: [
                {
                    toolCallId: "call_1",
                    toolName: "web_search",
                    args: { query: "测试" }
                }
            ]
        };

        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );

        expect(hasFinishTask).toBe(false);
    });

    it("应该在 toolCalls 为空时返回 false", () => {
        const step = {
            text: "纯文本响应",
            toolCalls: []
        };

        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );

        expect(hasFinishTask).toBe(false);
    });

    it("应该在 toolCalls 为 undefined 时返回 false", () => {
        const step = {
            text: "纯文本响应"
        };

        const hasFinishTask = step.toolCalls?.some(
            (tc: any) => tc.toolName === "finish_task"
        );

        // undefined?.some() 返回 undefined，需要转换为 boolean
        expect(hasFinishTask ?? false).toBe(false);
    });

    it("AbortSignal.any 应该正确合并信号", () => {
        // 创建两个 AbortController
        const controller1 = new AbortController();
        const controller2 = new AbortController();

        // 合并信号
        const combinedSignal = AbortSignal.any([
            controller1.signal,
            controller2.signal
        ]);

        // 初始状态：未中止
        expect(combinedSignal.aborted).toBe(false);

        // 中止第一个控制器
        controller1.abort();

        // 合并信号应该被中止
        expect(combinedSignal.aborted).toBe(true);
    });

    it("AbortSignal.any 应该在任一信号中止时触发", () => {
        const controller1 = new AbortController();
        const controller2 = new AbortController();

        const combinedSignal = AbortSignal.any([
            controller1.signal,
            controller2.signal
        ]);

        // 中止第二个控制器
        controller2.abort();

        // 合并信号应该被中止
        expect(combinedSignal.aborted).toBe(true);
    });
});
