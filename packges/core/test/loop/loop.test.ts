import { loadAndGetAgent } from "@/agent/agent";
import { AgentLoop } from "@/session/loop";

const agent = loadAndGetAgent().agent!;
await AgentLoop.loop({
    sessionId: 'test-session-001',
    agentConfig: agent,
    message: {
        role: 'user',
        content: '请帮我写一个笑话'
    },
    maxIterations: 10, // Example value
    compactThreshold: 50 // Example value
});
