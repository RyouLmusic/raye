import React from "react";
import { render } from "ink";
import { App } from "./app";
import type { AgentConfig } from "core/agent/type";

/**
 * TUI 入口启动函数
 *
 * @param options - 启动选项
 * @param options.sessionId - 会话 ID（可选，默认使用时间戳生成）
 * @param options.agentConfig - Agent 配置（可选，如果不提供则从 core 加载默认配置）
 * @param options.workDir - 工作目录（可选）
 *
 * 用法：
 *   // 使用自定义配置
 *   await startTUI({ 
 *     sessionId: 'my-session',
 *     agentConfig: myConfig,
 *     workDir: '/path/to/project'
 *   });
 *
 *   // 使用默认配置（向后兼容）
 *   await startTUI({ sessionId: 'my-session' });
 */
export function startTUI(options?: { 
    sessionId?: string;
    agentConfig?: AgentConfig;
    workDir?: string;
}) {
    const sessionId = options?.sessionId ?? `session-${Date.now()}`;
    
    // 如果提供了 agentConfig，使用它；否则加载默认配置（向后兼容）
    let agentConfig: AgentConfig;
    if (options?.agentConfig) {
        agentConfig = options.agentConfig;
    } else {
        // 向后兼容：如果没有提供配置，从 core 加载默认配置
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
