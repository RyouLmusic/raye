import React from "react";
import { Box } from "ink";
import type { AgentConfig } from "core/agent/type";
import { useAgentLoop } from "./hooks/useAgentLoop";
import { MessageList } from "./components/MessageList";
import { StreamingBlock } from "./components/StreamingBlock";
import { ThinkingBlock } from "./components/ThinkingBlock";
import { StatusBar } from "./components/StatusBar";
import { PromptInput } from "./components/PromptInput";

interface AppProps {
    agentConfig: AgentConfig;
    sessionId: string;
}

/**
 * TUI 根组件
 *
 * 布局（从上到下）：
 *   StatusBar          — 顶部状态栏（session id / loop state / iter）
 *   MessageList        — 历史消息滚动区
 *   ThinkingBlock      — 当前 plan/reason 阶段 streaming（可选）
 *   StreamingBlock     — 当前 execute 阶段 streaming（可选）
 *   PromptInput        — 底部输入框（Loop 运行时 disabled）
 */
export function App({ agentConfig, sessionId }: AppProps) {
    const { state, submit } = useAgentLoop(agentConfig, sessionId);
    const { streaming, messages, loopState, iteration, maxIterations, isRunning, error } = state;

    return (
        <Box flexDirection="column" height="100%">
            {/* 顶部状态栏 */}
            <StatusBar
                loopState={loopState}
                iteration={iteration}
                maxIterations={maxIterations}
                sessionId={sessionId}
            />

            {/* 消息区（弹性增长） */}
            <Box flexDirection="column" flexGrow={1} overflowY="hidden">
                <MessageList messages={messages} />

                {/* 首轮全局规划 streaming */}
                {streaming.plan && (
                    <ThinkingBlock label="Planning" text={streaming.plan} />
                )}

                {/* 后续轮即时推理 streaming */}
                {streaming.reason && (
                    <ThinkingBlock label="Reasoning" text={streaming.reason} />
                )}

                {/* 主执行阶段 streaming */}
                {streaming.execute && (
                    <StreamingBlock text={streaming.execute} />
                )}
            </Box>

            {/* 底部输入框 */}
            <PromptInput
                disabled={isRunning}
                onSubmit={submit}
                error={error}
            />
        </Box>
    );
}
