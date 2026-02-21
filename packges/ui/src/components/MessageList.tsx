import React from "react";
import { Box, Static, Text } from "ink";
import type { TurnMessage } from "../hooks/useAgentLoop";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallLog } from "./ToolCallLog";
import { Icon } from "./Icon";
import { MarkdownBlock } from "./MarkdownBlock";

interface MessageListProps {
    messages: TurnMessage[];
}

/**
 * 历史消息列表 - 基于 Static 组件
 *
 * 【极简字符布局】
 * user      → ❯  请帮我分析...
 * tool      → ◇ read_file
 * reasoning → + Planning (xxx chars)
 * assistant → RAYE: 回复内容...
 */
export function MessageList({ messages }: MessageListProps) {
    return (
        <Static items={messages}>
            {msg => <MessageItem key={msg.id} msg={msg} />}
        </Static>
    );
}

function MessageItem({ msg }: { msg: TurnMessage }) {
    // ---------------- 用户输入 ----------------
    if (msg.role === "user") {
        return (
            <Box marginTop={1}>
                <Icon name="user" color="cyanBright" />
                <Text color="cyanBright"> </Text>
                <Text color="cyanBright">{msg.content}</Text>
            </Box>
        );
    }

    // ---------------- 工具调用 ----------------
    if (msg.role === "tool") {
        return <ToolCallLog msg={msg} />;
    }

    // ---------------- AI 思考阶段 ----------------
    if (msg.phase === "plan" || msg.phase === "reason") {
        const label = msg.phase === "plan" ? "Planning" : "Reasoning";
        return (
            <Box>
                <ThinkingBlock
                    label={label}
                    text=""
                    collapsed
                    fullText={msg.content}
                />
            </Box>
        );
    }

    // ---------------- AI 最终回答 ----------------
    return (
        <Box flexDirection="row" marginTop={1}>
            <Icon name="ai" color="whiteBright" />
            <Text color="whiteBright">:</Text>
            <Box paddingLeft={1}>
                <MarkdownBlock text={msg.content} />
            </Box>
        </Box>
    );
}
