import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.js";

async function main() {
    const agentd = loadAndGetAgent().agent!; // DeepSeek with enable_thinking

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

    console.log("📝 === Debug Stream Chunks ===\n");

    for await (const chunk of fullStream) {
        console.log('Chunk:', JSON.stringify(chunk, null, 2));
    }
}

main().catch(console.error);
