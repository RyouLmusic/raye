import { loadAndGetAgent } from "@/agent/agent.ts";

/**
 * 测试：验证 prompt 占位符是否被正确替换
 */
function testPromptReplacement() {
    console.log("=== 测试 Prompt 占位符替换 ===\n");
    
    const agents = loadAndGetAgent();
    
    // 测试 plan agent
    if (agents.plan) {
        console.log("✓ Plan Agent:");
        console.log("  Name:", agents.plan.name);
        console.log("  Prompt 长度:", agents.plan.prompt?.length || 0);
        console.log("  Prompt 内容:", agents.plan.prompt || "(空)");
        console.log("  是否包含占位符:", agents.plan.prompt?.includes('{PLAN_PROMPT}') ? '❌ 是' : '✓ 否');
        console.log();
    }
    
    // 测试 agent
    if (agents.agent) {
        console.log("✓ Agent:");
        console.log("  Name:", agents.agent.name);
        console.log("  Prompt 长度:", agents.agent.prompt?.length || 0);
        console.log("  Prompt 内容:", agents.agent.prompt || "(空)");
        console.log("  是否包含占位符:", agents.agent.prompt?.includes('{AGENT_PROMPT}') ? '❌ 是' : '✓ 否');
        console.log();
    }
    
    // 测试 summary agent
    if (agents.summary) {
        console.log("✓ Summary Agent:");
        console.log("  Name:", agents.summary.name);
        console.log("  Prompt 长度:", agents.summary.prompt?.length || 0);
        console.log("  Prompt 内容:", agents.summary.prompt || "(空)");
        console.log("  是否包含占位符:", agents.summary.prompt?.includes('{SUMMARY_PROMPT}') ? '❌ 是' : '✓ 否');
        console.log();
    }
    
    // 测试 agent2
    if (agents.agent2) {
        console.log("✓ Agent2:");
        console.log("  Name:", agents.agent2.name);
        console.log("  Prompt 长度:", agents.agent2.prompt?.length || 0);
        console.log("  Prompt 内容:", agents.agent2.prompt || "(空)");
        console.log("  是否包含占位符:", agents.agent2.prompt?.includes('{AGENT_PROMPT}') ? '❌ 是' : '✓ 否');
        console.log();
    }
    
    // 检查是否所有占位符都被替换了
    const allAgents = Object.values(agents);
    const hasPlaceholders = allAgents.some(agent => 
        agent.prompt && (
            agent.prompt.includes('{PLAN_PROMPT}') ||
            agent.prompt.includes('{AGENT_PROMPT}') ||
            agent.prompt.includes('{SUMMARY_PROMPT}')
        )
    );
    
    if (hasPlaceholders) {
        console.log("❌ 测试失败：仍然存在未替换的占位符");
    } else {
        console.log("✅ 测试通过：所有占位符都已被替换");
    }
    
    console.log("\n=== 详细配置 ===\n");
    for (const [name, agent] of Object.entries(agents)) {
        console.log(`Agent: ${name}`);
        console.log("  Provider:", agent.provider);
        console.log("  Model:", agent.model);
        console.log("  Tools:", agent.tools.join(', ') || '(无)');
        console.log();
    }
}

testPromptReplacement();
