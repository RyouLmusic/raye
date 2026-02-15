import { streamTextWrapper } from "@/session/stream-text-wrapper.js";
import { loadAndGetAgent } from "@/agent/agent.js";

/**
 * 调试 usage 信息
 */
async function debugUsage() {
    console.log("=== Debug Usage ===\n");
    
    // 使用 agent 而不是 summary
    const agentConfig = loadAndGetAgent().summary!;

    const result = await streamTextWrapper({
        agent: agentConfig,
        timeout: 60000, // 增加超时时间到 60 秒
        messages: [
            {
                role: 'user',
                content: '你好，请简单回答这个问题：1+1等于多少？'
            }
        ]
    });

    // 检查所有可能包含 usage 的地方
    let stepCount = 0;
    
    for await (const chunk of result.fullStream) {
        if (chunk.type === 'finish') {
            console.log('\n=== Final Finish ===');
            console.log('Total Usage:', JSON.stringify(chunk.totalUsage, null, 2));
            console.log('Finish Reason:', chunk.finishReason);
            console.log('Chunk Keys:', Object.keys(chunk));
        }
        
        // 检查是否有 raw chunk
        if (chunk.type === 'raw') {
            console.log('\n=== Raw Chunk ===');
            console.log(JSON.stringify(chunk, null, 2));
        }
        
        // 打印所有 chunk 类型
        if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta' && chunk.type !== 'tool-input-delta') {
            console.log(`Chunk Type: ${chunk.type}`);
        }
    }
    
    // 等待所有 Promise 完成
    const [text, usage, finishReason] = await Promise.all([
        result.text,
        result.usage,
        result.finishReason
    ]);
    
    console.log('\n=== After Stream Consumed ===');
    console.log('Text:', text?.substring(0, 100));
    console.log('Usage:', JSON.stringify(usage, null, 2));
    console.log('Finish Reason:', finishReason);
}

debugUsage().catch(console.error);
