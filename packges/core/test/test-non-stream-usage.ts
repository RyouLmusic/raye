import { generateTextWrapper } from "@/session/stream-text-wrapper.js";
import { loadAndGetAgent } from "@/agent/agent.js";

/**
 * 测试非流式模式的 usage 信息
 */
async function testNonStreamUsage() {
    console.log("=== 测试非流式模式 Usage ===\n");
    
    const agentConfig = loadAndGetAgent().summary!;

    const result = await generateTextWrapper({
        agent: agentConfig,
        timeout: 60000,
        messages: [
            {
                role: 'user',
                content: '1+1等于多少？请简短回答。'
            }
        ]
    });
    
    console.log('\n=== 结果 ===');
    console.log('Text:', result.text);
    console.log('\n=== Usage ===');
    console.log(JSON.stringify(result.usage, null, 2));
    console.log('\n=== Raw Usage ===');
    console.log('Input Tokens:', result.usage.inputTokens);
    console.log('Output Tokens:', result.usage.outputTokens);
    console.log('Total Tokens:', result.usage.totalTokens);
    console.log('Reasoning Tokens:', result.usage.reasoningTokens);
    
    if (result.usage.raw) {
        console.log('\n=== Raw API Usage ===');
        console.log(JSON.stringify(result.usage.raw, null, 2));
    }
}

testNonStreamUsage().catch(console.error);
