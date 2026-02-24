import React from "react";
import { render } from "ink";
import { App } from "./app";
import { loadAndGetAgent } from "core/agent/agent";

/**
 * TUI 入口启动函数
 *
 * 用法：
 *   bun packges/ui/src/tui.tsx [sessionId]
 *
 * sessionId 可选，不传时使用时间戳生成一个新 session。
 */
export function startTUI(options?: { sessionId?: string }) {
    const sessionId = options?.sessionId ?? `session-${Date.now()}`;
    const agents = loadAndGetAgent();
    const agentConfig = agents.agent4!;

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
