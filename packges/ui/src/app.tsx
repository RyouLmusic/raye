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
 * TUI 根组件 (极客无框版)
 *
 * 布局（采用自然流，无固定100%高度，由 Static 将历史推出终端底部）：
 *   StatusBar          — 顶部应用边界
 *   MessageList        — 通过 <Static> 印在终端缓冲区的历史记录
 *   ThinkingBlock      — 当前 streaming 态的暗灰色思考内容
 *   StreamingBlock     — 当前 execute 的输出
 *   PromptInput        — 提供用户输入
 */
export function App({ agentConfig, sessionId }: AppProps) {
    const { state, submit } = useAgentLoop(agentConfig, sessionId);
    const { streaming, messages, loopState, iteration, maxIterations, isRunning, error } = state;

    return (
        <Box flexDirection="column">
            {/* 顶部应用边界，保持整个 Agent 体验框架感 */}
            <StatusBar
                loopState={loopState}
                iteration={iteration}
                maxIterations={maxIterations}
                sessionId={sessionId}
            />

            {/* 历史消息由 Static 组件拦截渲染，自然上推，不占当前屏幕固定空间，避免闪屏 */}
            <MessageList messages={messages} />

            {/* 活跃区域：实时日志与回复 */}
            <Box flexDirection="column" marginY={1}>
                {streaming.plan && (
                    <ThinkingBlock label="Planning" text={streaming.plan} />
                )}
                {streaming.reason && (
                    <ThinkingBlock label="Reasoning" text={streaming.reason} />
                )}
                {streaming.execute && (
                    <StreamingBlock text={streaming.execute} />
                )}
            </Box>

            {/* 用户交互区 */}
            <PromptInput
                disabled={isRunning}
                onSubmit={submit}
                error={error}
            />
        </Box>
    );
}
