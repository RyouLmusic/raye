import React from "react";
import { Box, Text } from "ink";
import type { TurnMessage } from "../hooks/useAgentLoop";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallLog } from "./ToolCallLog";

interface MessageListProps {
    messages: TurnMessage[];
}

/**
 * 历史消息列表
 *
 * - user      → 蓝色，左对齐
 * - assistant（phase: execute） → 白色，AI 回复
 * - assistant（phase: plan/reason） → 折叠的 ThinkingBlock（灰色）
 * - tool      → ToolCallLog 条目
 */
export function MessageList({ messages }: MessageListProps) {
    return (
        <Box flexDirection="column" flexGrow={1}>
            {messages.map(msg => (
                <MessageItem key={msg.id} msg={msg} />
            ))}
        </Box>
    );
}

function MessageItem({ msg }: { msg: TurnMessage }) {
    // 用户消息
    if (msg.role === "user") {
        return (
            <Box marginY={0} paddingLeft={1}>
                <Text color="blue" bold>You  </Text>
                <Text color="white">{msg.content}</Text>
            </Box>
        );
    }

    // 工具调用条目
    if (msg.role === "tool") {
        return <ToolCallLog msg={msg} />;
    }

    // AI 消息 — plan/reason 折叠展示
    if (msg.phase === "plan" || msg.phase === "reason") {
        const label = msg.phase === "plan" ? "Planning" : "Reasoning";
        return (
            <Box marginY={0}>
                <ThinkingBlock
                    label={label}
                    text=""
                    collapsed
                    fullText={msg.content}
                />
            </Box>
        );
    }

    // AI 消息 — execute 阶段（主回复）
    return (
        <Box flexDirection="column" paddingLeft={1} marginY={0}>
            <Box>
                <Text color="green" bold>AI   </Text>
            </Box>
            <Box paddingLeft={5}>
                <Text color="white" wrap="wrap">{msg.content}</Text>
            </Box>
        </Box>
    );
}
