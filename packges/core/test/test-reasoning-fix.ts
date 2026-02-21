/**
 * 测试 reasoning agent 消息格式修复
 * 
 * 问题：当 session 中包含工具调用消息时，传递给 tool_choice="none" 的 agent 会导致验证错误
 * 解决：在传递给 reasoning/plan agent 之前清理工具相关内容
 */

import { AgentLoop } from "@/session/loop";
import { loadAndGetAgent } from "@/agent/agent";

const agent = loadAndGetAgent().agent!;

console.log("🧪 测试 reasoning agent 消息格式修复\n");

await AgentLoop.loop({
    sessionId: 'test-reasoning-fix',
    agentConfig: agent,
    message: {
        role: 'user',
        content: '计算 123 + 456 的结果'
    },
    maxIterations: 3,
    compactThreshold: 100,
    observer: {
        onLoopStart: (sessionId) => {
            console.log(`\n🚀 Loop 开始: ${sessionId}`);
        },
        onIterationStart: (iter, max) => {
            console.log(`\n📍 迭代 ${iter}/${max}`);
        },
        onStateChange: (from, to, iter) => {
            console.log(`  状态转换: ${from} → ${to}`);
        },
        onIterationEnd: (iter) => {
            console.log(`  ✓ 迭代 ${iter} 完成`);
        },
        onLoopEnd: (result) => {
            if (result.success) {
                console.log(`\n✅ Loop 成功完成，总迭代: ${result.iterations}`);
            } else {
                console.error(`\n❌ Loop 失败:`, result.error);
            }
        },
        onError: (error, state) => {
            console.error(`\n❌ 错误 (${state}):`, error);
        }
    }
});

console.log("\n✅ 测试完成！");
