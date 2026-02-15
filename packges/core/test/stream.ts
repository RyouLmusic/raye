import { streamTextWrapper, generateTextWrapper  } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";

async function main() {
    const agentd = loadAndGetAgent().agent2!;

    const result = await streamTextWrapper({
        agent: agentd,
        messages: [
            {
                role: 'user',
                content: '请介绍一下你自己'
            }
        ]
    });

    const { fullStream } = result;

    console.log("📝 === Streaming Response ===\n");

    for await (const chunk of fullStream) {
        // 处理原生 reasoning chunks（所有模型都会被转换成这种格式）
        if (chunk.type === 'reasoning-start') {
            process.stdout.write('\x1b[36m💭 [Reasoning]\n\x1b[0m');
        } else if (chunk.type === 'reasoning-delta' && chunk.text) {
            process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
        } else if (chunk.type === 'reasoning-end') {
            process.stdout.write('\n\n\x1b[32m📄 [Response]\n\x1b[0m');
        } 
        // 处理文本 chunks
        else if (chunk.type === 'text-delta' && chunk.text) {
            process.stdout.write(chunk.text);
        } 
        // 处理完成
        else if (chunk.type === 'finish') {
            process.stdout.write('\n\n');
        }
    }

    // 可选：打印元数据
    const finishReason = await result.finishReason;
    const warnings = await result.warnings;
    console.log("Finish reason:", finishReason);
    console.log("Warnings:", warnings);

    // 获取完整的 reasoning（如果流式没有输出，这里会显示完整内容）
    const fullReasoning = await result.reasoning;
    if (fullReasoning) {
        console.log("\n📋 Full Reasoning:");
        console.log(fullReasoning);
    } else {
        console.log("Note: Reasoning not available (model/provider may not support it)");
    }
}

// const resut = await generateTextWrapper();
// await console.log(resut)

main().catch(console.error);