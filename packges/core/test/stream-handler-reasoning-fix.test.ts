import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";
import { 
    processFullStream, 
    createConsoleHandlers
} from "@/session/stream-handler";

/**
 * 演示：reasoning 和 tool 的自然交替输出
 * 这不是 bug，而是 AI 的正常工作流程
 */

async function testInterleavedMode() {
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║      交替模式 - Reasoning 和 Tool 自然交替        ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("💡 这是正常的 AI 工作流程：");
    console.log("   推理1 → 工具调用1 → 推理2 → 工具调用2 → ...\n");
    
    const agentConfig = loadAndGetAgent().summary;
    if (!agentConfig) {
        console.error('❌ Agent 配置未找到！');
        return;
    }

    const result = await streamTextWrapper({
        agent: agentConfig,
        messages: [
            { role: 'user', content: '简单解释AI为什么总是失忆' }
        ],
        timeout: 60000
    });

    await processFullStream(result, {
        handlers: createConsoleHandlers({
            mode: 'interleaved',  // 交替模式（默认）
            showReasoning: true,
            showTools: true
        }),
        debug: false  // 开启调试模式，查看所有事件
    });
}

async function testSegmentedMode() {
    console.log("\n\n╔════════════════════════════════════════════════════╗");
    console.log("║        分段模式 - 清晰的分隔线区分各部分          ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    
    const agentConfig = loadAndGetAgent().subAgent;
    if (!agentConfig) {
        console.error('❌ Agent 配置未找到！');
        return;
    }

    const result = await streamTextWrapper({
        agent: agentConfig,
        messages: [
            { role: 'user', content: '计算 565+44 和 244*886 的结果' }
        ],
        timeout: 60000
    });

    await processFullStream(result, {
        handlers: createConsoleHandlers({
            mode: 'segmented',  // 分段模式
            showReasoning: true,
            showTools: true
        })
    });
}

async function main() {
    console.log('\n📘 Reasoning 和 Tool 的交替输出\n');
    console.log('重要理解：');
    console.log('  ✓ Reasoning 和 Tool 的交替是正常的 AI 工作方式');
    console.log('  ✓ reasoning-end 表示"本段推理结束"，不是"全部推理结束"');
    console.log('  ✓ 每次工具调用后，AI 可能继续推理并调用更多工具');
    console.log('  ✓ 这就是 ReAct (Reasoning + Acting) 模式\n');
    console.log('═'.repeat(56) + '\n');

    try {
        // 选择要测试的模式
        await testInterleavedMode();    // 轻量级、自然流畅
        // await testSegmentedMode();   // 清晰分隔、适合复杂场景
        
        console.log('\n✅ 演示完成！');
        console.log('\n💡 使用建议：');
        console.log('  - 简单对话：mode: "interleaved" （默认）');
        console.log('  - 复杂任务：mode: "segmented"');
        console.log('  - API 集成：自定义 handlers，实时推送到前端\n');
        
    } catch (error) {
        console.error('\n❌ 运行失败:', error);
        if (error instanceof Error) {
            console.error(error.message);
        }
    }
}

main();
