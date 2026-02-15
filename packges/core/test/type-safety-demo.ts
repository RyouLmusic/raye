import type { AgentConfig } from "@/agent/type.js";
import type { ToolName } from "@/tools/tools-register.ts";

/**
 * 演示类型安全的工具配置
 */

// ✅ 正确：使用已注册的工具名称
const validConfig: AgentConfig = {
    name: "test-agent",
    version: "1.0.0",
    description: "Test agent",
    base_url: "https://api.example.com",
    api_key: "test-key",
    model: "test-model",
    model_id: "test",
    provider: "test",
    extra_body: {},
    tools: ["calculate"],  // ✅ TypeScript 知道这是有效的工具名称
    mcp: {}
};

// ❌ 错误：使用未注册的工具名称
// 取消注释下面的代码会看到 TypeScript 错误
/*
const invalidConfig: AgentConfig = {
    name: "test-agent",
    version: "1.0.0",
    description: "Test agent",
    base_url: "https://api.example.com",
    api_key: "test-key",
    model: "test-model",
    model_id: "test",
    provider: "test",
    extra_body: {},
    tools: ["nonexistent-tool"],  // ❌ TypeScript 错误：Type '"nonexistent-tool"' is not assignable to type 'ToolName'
    mcp: {}
};
*/

// ✅ 正确：空工具数组
const noToolsConfig: AgentConfig = {
    name: "simple-agent",
    version: "1.0.0",
    description: "Simple agent without tools",
    base_url: "https://api.example.com",
    api_key: "test-key",
    model: "test-model",
    model_id: "test",
    provider: "test",
    extra_body: {},
    tools: [],  // ✅ 空数组是有效的
    mcp: {}
};

// ✅ TypeScript IntelliSense 会提示可用的工具名称
function getToolName(): ToolName {
    return "calculate";  // IDE 会自动补全可用的工具名称
}

console.log("✅ Type-safe tool configuration works!");
console.log("Valid config:", validConfig.tools);
console.log("Available tool:", getToolName());
