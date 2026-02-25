import { render } from "ink";
import { App } from "./app";
import type { AgentConfig, ConnectionConfig, BehaviorConfig } from "core/agent/type";
import { loadBehaviorConfig } from "core/agent/agent";

/**
 * TUI 入口启动函数
 *
 * @param options - 启动选项
 * @param options.sessionId - 会话 ID（可选，默认使用时间戳生成）
 * @param options.connectionConfig - 连接配置（CLI 传入，包含 API 连接信息）
 * @param options.workDir - 工作目录（可选）
 * @param options.agentConfig - 完整配置（向后兼容，如果提供则直接使用）
 *
 * 用法：
 *   // 方案 3：使用连接配置（推荐）
 *   await startTUI({ 
 *     sessionId: 'my-session',
 *     connectionConfig: {
 *       name: 'agent',
 *       base_url: 'https://api.openai.com/v1',
 *       api_key: process.env.OPENAI_API_KEY,
 *       model: 'gpt-4',
 *     },
 *     workDir: '/path/to/project'
 *   });
 *
 *   // 向后兼容：使用完整配置
 *   await startTUI({ 
 *     sessionId: 'my-session',
 *     agentConfig: fullConfig
 *   });
 */
export function startTUI(options?: { 
    sessionId?: string;
    connectionConfig?: ConnectionConfig;
    agentConfig?: AgentConfig;
    workDir?: string;
}) {
    const sessionId = options?.sessionId ?? `session-${Date.now()}`;
    
    let agentConfig: AgentConfig;
    
    if (options?.agentConfig) {
        // 向后兼容：直接使用提供的完整配置
        agentConfig = options.agentConfig;
    } else if (options?.connectionConfig) {
        // 方案 3：从连接配置构建完整配置
        const connection = options.connectionConfig;
        
        // 1. 加载行为配置
        const behavior: BehaviorConfig = loadBehaviorConfig(connection.name);
        
        // 2. 合并连接配置和行为配置
        agentConfig = {
            // 行为层（来自 Core）
            ...behavior,
            // 连接层（来自 CLI）
            name: connection.name,
            base_url: connection.base_url,
            api_key: connection.api_key,
            model: connection.model,
            // 可选的运行时参数覆盖
            max_retries: connection.max_retries ?? behavior.max_retries,
            timeout: connection.timeout ?? behavior.timeout,
            // 应用用户的覆盖配置
            ...(connection.overrides || {}),
        } as AgentConfig;
    } else {
        // 默认：加载默认配置（向后兼容）
        const { loadAndGetAgent } = require("core/agent/agent");
        const agents = loadAndGetAgent();
        agentConfig = agents.agent4!;
    }

    const { waitUntilExit } = render(
        <App agentConfig={agentConfig} sessionId={sessionId} />
    );

    return waitUntilExit();
}

// 直接运行时启动
const sessionId = process.argv[2];
startTUI({ sessionId }).then(() => {
    process.exit(0);
}).catch((err: unknown) => {
    console.error("TUI error:", err);
    process.exit(1);
});
