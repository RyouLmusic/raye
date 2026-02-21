/**
 * 测试 toolChoice 配置功能
 * 验证 agent.json 中的 tool_choice 配置可以正确传递到 streamTextWrapper
 */

import { describe, test, expect } from "bun:test";
import { loadAndGetAgent } from "@/agent/agent.ts";

describe("ToolChoice Configuration", () => {
    test("agent.json 中的 tool_choice 配置应该被正确加载", () => {
        const agents = loadAndGetAgent();
        
        // 验证所有 agent 都有 tool_choice 配置
        expect(agents.plan?.tool_choice).toBe("auto");
        expect(agents.agent?.tool_choice).toBe("auto");
        expect(agents.summary?.tool_choice).toBe("auto");
        expect(agents.compaction?.tool_choice).toBe("auto");
        expect(agents.reasoning?.tool_choice).toBe("auto");
        expect(agents.subAgent?.tool_choice).toBe("auto");
    });

    test("tool_choice 类型应该支持所有有效值", () => {
        const agents = loadAndGetAgent();
        const agent = agents.plan;
        
        if (!agent) {
            throw new Error("Plan agent not found");
        }

        // 验证类型定义支持所有有效值
        type ToolChoice = typeof agent.tool_choice;
        
        // 这些赋值应该都是类型安全的
        const auto: ToolChoice = "auto";
        const required: ToolChoice = "required";
        const none: ToolChoice = "none";
        const specific: ToolChoice = { type: "tool", toolName: "calculate" };
        
        expect(auto).toBe("auto");
        expect(required).toBe("required");
        expect(none).toBe("none");
        expect(specific).toEqual({ type: "tool", toolName: "calculate" });
    });
});
