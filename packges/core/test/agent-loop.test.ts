/**
 * Agent Loop 状态机测试示例
 * 
 * 这个文件演示如何使用双层状态机系统
 */

import { AgentLoop } from "@/session/loop";
import type { LoopInput } from "@/session/type";

// ============ 测试用例 1: 基本的 ReAct 循环 ============
async function testBasicReActLoop() {
    console.log("\n========================================");
    console.log("测试用例 1: 基本的 ReAct 循环");
    console.log("========================================\n");

    const input: LoopInput = {
        sessionId: "test-session-001",
        agentConfig: {
            name: "test-agent",
            version: "1.0.0",
            description: "测试代理",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-test-key",
            model: "gpt-4",
            model_id: "gpt-4-0613",
            provider: "openai",
            extra_body: {},
            tools: [],
            mcp: {},
            max_retries: 3,
            timeout: 30000,
        },
        initialMessages: [
            {
                role: "user",
                content: "请帮我计算 123 + 456"
            }
        ],
        maxIterations: 5,
        compactThreshold: 20,
    };

    try {
        const result = await AgentLoop.loop(input);
        
        if (result.success) {
            console.log("\n✅ 测试成功！");
            console.log(`📊 迭代次数: ${result.iterations}`);
            console.log(`💬 消息数量: ${result.messages.length}`);
        } else {
            console.log("\n❌ 测试失败！");
            console.log(`❌ 错误: ${result.error?.message}`);
        }
    } catch (error) {
        console.error("测试异常:", error);
    }
}

// ============ 测试用例 2: 带工具调用的循环 ============
async function testLoopWithTools() {
    console.log("\n========================================");
    console.log("测试用例 2: 带工具调用的 ReAct 循环");
    console.log("========================================\n");

    const input: LoopInput = {
        sessionId: "test-session-002",
        agentConfig: {
            name: "calculator-agent",
            version: "1.0.0",
            description: "计算器代理",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-test-key",
            model: "gpt-4",
            model_id: "gpt-4-0613",
            provider: "openai",
            extra_body: {},
            tools: ["calculator", "search"],  // 启用工具
            mcp: {},
            max_retries: 3,
            timeout: 30000,
        },
        initialMessages: [
            {
                role: "user",
                content: "请搜索最新的 AI 新闻，并计算相关公司的市值总和"
            }
        ],
        maxIterations: 10,
        compactThreshold: 20,
    };

    try {
        const result = await AgentLoop.loop(input);
        
        if (result.success) {
            console.log("\n✅ 测试成功！");
            console.log(`📊 迭代次数: ${result.iterations}`);
            console.log(`💬 消息数量: ${result.messages.length}`);
            
            // 统计工具调用
            const toolCalls = result.messages.filter(m => 
                m.role === "assistant" && m.toolCalls?.length > 0
            );
            console.log(`🔧 工具调用次数: ${toolCalls.length}`);
        } else {
            console.log("\n❌ 测试失败！");
            console.log(`❌ 错误: ${result.error?.message}`);
        }
    } catch (error) {
        console.error("测试异常:", error);
    }
}

// ============ 测试用例 3: 触发上下文压缩 ============
async function testContextCompaction() {
    console.log("\n========================================");
    console.log("测试用例 3: 上下文压缩");
    console.log("========================================\n");

    // 创建大量初始消息以触发压缩
    const manyMessages = [];
    for (let i = 0; i < 15; i++) {
        manyMessages.push({
            role: "user",
            content: `消息 ${i + 1}: 这是一条测试消息`
        });
        manyMessages.push({
            role: "assistant",
            content: `回复 ${i + 1}: 收到消息`
        });
    }

    const input: LoopInput = {
        sessionId: "test-session-003",
        agentConfig: {
            name: "test-agent",
            version: "1.0.0",
            description: "测试代理",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-test-key",
            model: "gpt-4",
            model_id: "gpt-4-0613",
            provider: "openai",
            extra_body: {},
            tools: [],
            mcp: {},
            max_retries: 3,
            timeout: 30000,
        },
        initialMessages: manyMessages,
        maxIterations: 5,
        compactThreshold: 20,  // 当消息数超过 20 时触发压缩
    };

    try {
        const result = await AgentLoop.loop(input);
        
        if (result.success) {
            console.log("\n✅ 测试成功！");
            console.log(`📊 迭代次数: ${result.iterations}`);
            console.log(`💬 初始消息数: ${manyMessages.length}`);
            console.log(`💬 最终消息数: ${result.messages.length}`);
            console.log(`✂️ 压缩效果: ${((1 - result.messages.length / manyMessages.length) * 100).toFixed(2)}% 减少`);
        } else {
            console.log("\n❌ 测试失败！");
            console.log(`❌ 错误: ${result.error?.message}`);
        }
    } catch (error) {
        console.error("测试异常:", error);
    }
}

// ============ 测试用例 4: 达到最大迭代次数 ============
async function testMaxIterations() {
    console.log("\n========================================");
    console.log("测试用例 4: 达到最大迭代次数");
    console.log("========================================\n");

    const input: LoopInput = {
        sessionId: "test-session-004",
        agentConfig: {
            name: "test-agent",
            version: "1.0.0",
            description: "测试代理",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-test-key",
            model: "gpt-4",
            model_id: "gpt-4-0613",
            provider: "openai",
            extra_body: {},
            tools: ["calculator"],  // 持续触发工具调用
            mcp: {},
            max_retries: 3,
            timeout: 30000,
        },
        initialMessages: [
            {
                role: "user",
                content: "请持续计算，直到我说停止"
            }
        ],
        maxIterations: 3,  // 设置较小的最大迭代次数
        compactThreshold: 50,
    };

    try {
        const result = await AgentLoop.loop(input);
        
        console.log("\n✅ 测试完成！");
        console.log(`📊 迭代次数: ${result.iterations}`);
        console.log(`🛑 是否达到限制: ${result.iterations >= input.maxIterations ? "是" : "否"}`);
    } catch (error) {
        console.error("测试异常:", error);
    }
}

// ============ 运行所有测试 ============
async function runAllTests() {
    console.log("\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║   Agent Loop 状态机测试套件               ║");
    console.log("╚════════════════════════════════════════════╝");
    
    await testBasicReActLoop();
    await testLoopWithTools();
    await testContextCompaction();
    await testMaxIterations();
    
    console.log("\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║   所有测试完成                             ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n");
}

// 运行测试
if (import.meta.main) {
    runAllTests().catch(console.error);
}
