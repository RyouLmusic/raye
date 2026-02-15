import { streamText } from "ai";
import { Provider } from "@/provider/provider.js";
import { loadAndGetAgent } from "@/agent/agent.js";
import { calculate } from "@/tools/caculate.js";
import { createUnifiedStreamTransform } from "@/session/stream-transformer.js";

/**
 * 示例：在 streamText 中使用 calculateTool
 */
async function main() {
    const agentd = loadAndGetAgent().agent!;
    const languageModel = Provider.getAgentLanguage(agentd);
    
    if (!languageModel) {
        throw new Error("Language model not found");
    }

    const result = streamText({
        model: languageModel,
        messages: [
            {
                role: 'user',
                content: '请帮我计算 123 加 456 等于多少？'
            }
        ],
        tools: {
            calculate: calculate
        },
        providerOptions: {
            ...agentd.extra_body,
        },
        experimental_transform: createUnifiedStreamTransform(),
    });

    console.log("📝 === Calculate Tool Example ===\n");

    for await (const chunk of result.fullStream) {
        // 处理推理内容
        if (chunk.type === 'reasoning-delta' && chunk.text) {
            process.stdout.write('\x1b[36m' + chunk.text + '\x1b[0m');
        } else if (chunk.type === 'reasoning-end') {
            process.stdout.write('\n\n');
        }
        // 处理文本内容
        else if (chunk.type === 'text-delta' && chunk.text) {
            process.stdout.write(chunk.text);
        }
        // 处理工具调用 - 使用正确的类型
        else if (chunk.type === 'tool-call' && chunk.toolName === 'calculate') {
            console.log(`\n🔧 调用工具: ${chunk.toolName}`);
            console.log(`   参数:`, chunk.input);
        } else if (chunk.type === 'tool-result' && chunk.toolName === 'calculate') {
            console.log(`✅ 工具结果:`, chunk.output);
        }
        // 处理完成
        else if (chunk.type === 'finish') {
            process.stdout.write('\n\n');
        }
    }

    console.log("完成！");
}

main().catch(console.error);
