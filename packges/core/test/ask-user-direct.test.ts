/**
 * ask_user 工具直接 UI 交互测试
 * 
 * 测试通过全局回调实现实时用户输入
 */

import { ask_user, setAskUserHandler, clearAskUserHandler } from "../src/tools/control";

describe("ask_user 直接 UI 交互", () => {
    afterEach(() => {
        clearAskUserHandler();
    });

    test("应该通过全局回调获取用户输入", async () => {
        // 模拟 UI 层设置回调
        setAskUserHandler(async (question: string) => {
            // 模拟用户输入
            if (question.includes("报告")) {
                return "PDF";
            }
            return "是的";
        });

        // LLM 调用 ask_user 工具
        const result = await ask_user.execute!({ question: "您想要生成哪种报告？" });

        // 验证返回结果
        expect(result).toEqual({
            status: "answered",
            question: "您想要生成哪种报告？",
            answer: "PDF",
            message: "用户回复: PDF",
        });
    });

    test("应该支持异步等待", async () => {
        let resolveInput: ((answer: string) => void) | null = null;

        // 模拟 UI 层的异步交互
        setAskUserHandler(async (question: string) => {
            return new Promise<string>((resolve) => {
                resolveInput = resolve;
            });
        });

        // LLM 调用 ask_user（不等待）
        const resultPromise = ask_user.execute!({ question: "确认删除吗？" });

        // 模拟用户延迟输入
        await new Promise(resolve => setTimeout(resolve, 100));
        resolveInput!("确认");

        // 等待工具返回
        const result = await resultPromise;

        expect(result).toEqual({
            status: "answered",
            question: "确认删除吗？",
            answer: "确认",
            message: "用户回复: 确认",
        });
    });

    test("没有设置回调时应该返回等待状态", async () => {
        // 不设置回调
        const result = await ask_user.execute!({ question: "测试问题" });

        expect(result).toEqual({
            status: "waiting_for_user",
            question: "测试问题",
            message: "[等待用户回复] 测试问题",
        });
    });

    test("应该处理回调错误", async () => {
        // 模拟回调抛出错误
        setAskUserHandler(async () => {
            throw new Error("用户取消");
        });

        const result = await ask_user.execute!({ question: "测试问题" });

        expect(result.status).toBe("error");
        expect(result.message).toContain("获取用户输入失败");
    });

    test("应该支持多次调用", async () => {
        const answers = ["第一次回答", "第二次回答", "第三次回答"];
        let callCount = 0;

        setAskUserHandler(async (question: string) => {
            return answers[callCount++] || "默认回答";
        });

        // 第一次调用
        const result1 = await ask_user.execute!({ question: "问题1" });
        expect(result1.answer).toBe("第一次回答");

        // 第二次调用
        const result2 = await ask_user.execute!({ question: "问题2" });
        expect(result2.answer).toBe("第二次回答");

        // 第三次调用
        const result3 = await ask_user.execute!({ question: "问题3" });
        expect(result3.answer).toBe("第三次回答");
    });

    test("返回值应该包含所有必需字段", async () => {
        setAskUserHandler(async () => "测试答案");

        const result = await ask_user.execute!({ question: "测试问题" }) as any;

        // 验证字段存在
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("question");
        expect(result).toHaveProperty("answer");
        expect(result).toHaveProperty("message");

        // 验证字段类型
        expect(typeof result.status).toBe("string");
        expect(typeof result.question).toBe("string");
        expect(typeof result.answer).toBe("string");
        expect(typeof result.message).toBe("string");

        // 验证字段值
        expect(result.status).toBe("answered");
        expect(result.question).toBe("测试问题");
        expect(result.answer).toBe("测试答案");
    });
});

/**
 * 集成测试：模拟完整的 Agent Loop
 */
describe("ask_user 在 Agent Loop 中的使用", () => {
    test("应该在工具执行期间阻塞等待用户输入", async () => {
        const timeline: string[] = [];

        // 模拟 UI 层的异步交互
        setAskUserHandler(async (question: string) => {
            timeline.push("UI: 显示问题");
            await new Promise(resolve => setTimeout(resolve, 50));
            timeline.push("UI: 用户输入");
            return "用户的答案";
        });

        timeline.push("开始: LLM 调用 ask_user");
        const result = await ask_user.execute!({ question: "测试" });
        timeline.push("结束: ask_user 返回");

        // 验证执行顺序
        expect(timeline).toEqual([
            "开始: LLM 调用 ask_user",
            "UI: 显示问题",
            "UI: 用户输入",
            "结束: ask_user 返回",
        ]);

        expect(result.answer).toBe("用户的答案");
    });

    afterEach(() => {
        clearAskUserHandler();
    });
});

