import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.ts";

/**
 * 示例：使用带有自定义 prompt 的 agent
 * 展示如何使用 system prompt 来定义 AI 的角色和行为
 */
async function useAgentWithSystemPrompt() {
    console.log("=== 使用自定义 Prompt 的 Agent ===\n");
    
    const agents = loadAndGetAgent();
    
    // 使用 summary agent（总结专家）
    console.log("📝 使用 Summary Agent 总结内容\n");
    console.log(`System Prompt: ${agents.summary.prompt?.substring(0, 50)}...\n`);
    
    const summaryResult = await streamTextWrapper({
        agent: agents.summary,
        
        // system prompt 会从 agent 配置中自动读取
        // 也可以通过 input.system 参数覆盖
        system: agents.summary.prompt,
        
        messages: [
            {
                role: 'user',
                content: `请总结以下内容：

人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。
这些任务包括视觉感知、语音识别、决策制定和语言翻译等。AI 技术已经在各个领域得到广泛应用，
从医疗诊断到自动驾驶汽车，从金融分析到个性化推荐系统。近年来，深度学习的突破性进展推动了
AI 的快速发展，使得机器能够处理更复杂的任务并取得接近甚至超过人类的表现。然而，AI 也带来了
一些挑战，包括数据隐私、算法偏见、就业影响等伦理和社会问题，需要我们在推进技术发展的同时
认真思考和解决。`
            }
        ]
    });

    console.log("📄 总结结果:\n");
    
    for await (const chunk of summaryResult.fullStream) {
        if (chunk.type === 'text-delta' && chunk.text) {
            process.stdout.write(chunk.text);
        }
    }
    
    console.log('\n\n' + '='.repeat(60) + '\n');
}

/**
 * 示例：使用 plan agent 制定计划
 */
async function usePlanAgent() {
    console.log("=== 使用 Plan Agent 制定计划 ===\n");
    
    const agents = loadAndGetAgent();
    
    console.log(`System Prompt: ${agents.plan.prompt?.substring(0, 50)}...\n`);
    
    const planResult = await streamTextWrapper({
        agent: agents.plan,
        system: agents.plan.prompt,
        messages: [
            {
                role: 'user',
                content: '我想在3个月内学会 TypeScript 和 React，请帮我制定一个学习计划。'
            }
        ]
    });

    console.log("📋 学习计划:\n");
    
    for await (const chunk of planResult.fullStream) {
        if (chunk.type === 'text-delta' && chunk.text) {
            process.stdout.write(chunk.text);
        }
    }
    
    console.log('\n\n' + '='.repeat(60) + '\n');
}

/**
 * 示例：对比有无 system prompt 的差异
 */
async function compareWithAndWithoutSystemPrompt() {
    console.log("=== 对比有无 System Prompt 的差异 ===\n");
    
    const agents = loadAndGetAgent();
    const question = "请介绍一下人工智能";
    
    // 1. 不使用 system prompt
    console.log("1️⃣  不使用 System Prompt:\n");
    
    const result1 = await streamTextWrapper({
        agent: agents.agent2,
        messages: [{ role: 'user', content: question }]
    });
    
    let response1 = '';
    for await (const chunk of result1.fullStream) {
        if (chunk.type === 'text-delta' && chunk.text) {
            response1 += chunk.text;
            process.stdout.write(chunk.text);
        }
    }
    
    console.log('\n\n' + '-'.repeat(60) + '\n');
    
    // 2. 使用 system prompt
    console.log("2️⃣  使用 System Prompt (作为技术助手):\n");
    
    const result2 = await streamTextWrapper({
        agent: agents.agent,
        system: agents.agent.prompt,
        messages: [{ role: 'user', content: question }]
    });
    
    let response2 = '';
    for await (const chunk of result2.fullStream) {
        if (chunk.type === 'text-delta' && chunk.text) {
            response2 += chunk.text;
            process.stdout.write(chunk.text);
        }
    }
    
    console.log('\n\n' + '='.repeat(60) + '\n');
    
    console.log("📊 分析:");
    console.log("  - 不使用 System Prompt: 可能得到通用回答");
    console.log("  - 使用 System Prompt: 回答风格符合预设角色特征");
    console.log();
}

// 根据命令行参数运行不同示例
const mode = process.argv[2] || 'summary';

if (mode === 'plan') {
    usePlanAgent().catch(console.error);
} else if (mode === 'compare') {
    compareWithAndWithoutSystemPrompt().catch(console.error);
} else {
    useAgentWithSystemPrompt().catch(console.error);
}
