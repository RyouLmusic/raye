import { streamWithUsage } from "@/session/stream-with-usage.js";
import { loadAndGetAgent } from "@/agent/agent.js";

/**
 * 示例：流式显示 + 准确的 Usage 统计
 */
async function exampleStreamWithUsage() {
    console.log("=== 流式显示 + Usage 统计示例 ===\n");
    
    const agentConfig = loadAndGetAgent().summary!;

    const { stream, getUsage } = await streamWithUsage({
        agent: agentConfig,
        messages: [
            {
                role: 'user',
                content: '请用一句话解释什么是人工智能？'
            }
        ]
    });

    console.log("📝 流式输出:\n");
    
    // 实时显示文本给用户
    for await (const textPart of stream.textStream) {
        process.stdout.write(textPart);
    }
    
    console.log('\n\n' + '─'.repeat(60));
    
    // 获取准确的 usage 统计
    console.log('\n⏳ 获取 Usage 统计中...\n');
    const usage = await getUsage();
    
    console.log('📊 Token 使用统计:');
    console.log('─'.repeat(60));
    console.log(`输入 Tokens:  ${usage.inputTokens}`);
    console.log(`输出 Tokens:  ${usage.outputTokens}`);
    console.log(`推理 Tokens:  ${usage.reasoningTokens || 0}`);
    console.log(`总计 Tokens:  ${usage.totalTokens}`);
    console.log('─'.repeat(60));
    
    // 其他信息
    const [finishReason, reasoning] = await Promise.all([
        stream.finishReason,
        stream.reasoning
    ]);
    
    if (reasoning) {
        console.log('\n💭 思考过程:');
        const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning);
        console.log(reasoningStr.substring(0, 200));
    }
    
    console.log('\n✓ 完成原因:', finishReason);
}

exampleStreamWithUsage().catch(console.error);
