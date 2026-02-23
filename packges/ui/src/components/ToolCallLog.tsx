import React from "react";
import { Box, Text } from "ink";
import type { TurnMessage } from "../hooks/useAgentLoop";
import { Icon } from "./Icon";

interface ToolCallLogProps {
    msg: TurnMessage;
}

/**
 * 工具调用极简日志条目
 */
export function ToolCallLog({ msg }: ToolCallLogProps) {
    const { toolName, toolArgs, toolResult } = msg;
    const argsStr = toolArgs ? JSON.stringify(toolArgs) : "";
    const isPending = toolResult === undefined;
    const isError = typeof toolResult === "object"
        && toolResult !== null
        && "error" in toolResult;

    // 特殊处理 ask_user 工具 - 使用醒目的样式
    if (toolName === "ask_user") {
        const resultObj = toolResult as any;
        const question = resultObj?.question || (toolArgs as any)?.question || "";
        const answer = resultObj?.answer;
        const status = resultObj?.status;

        // 如果已经有答案，显示问答对
        if (status === "answered" && answer) {
            return (
                <Box flexDirection="column" paddingLeft={0} marginY={1}>
                    {/* 问题行 */}
                    <Box>
                        <Icon name="ask_user" color="yellowBright" />
                        <Text color="yellowBright" bold> ASK_USER</Text>
                        <Text color="gray"> </Text>
                        <Icon name="arrow_right" color="gray" />
                        <Text color="gray"> </Text>
                        <Text color="yellow">{question}</Text>
                    </Box>
                    {/* 答案行 */}
                    <Box paddingLeft={2}>
                        <Icon name="user_reply" color="cyanBright" />
                        <Text color="cyanBright"> 用户回复: </Text>
                        <Text color="cyan">{answer}</Text>
                    </Box>
                </Box>
            );
        }

        // 等待用户输入状态
        if (isPending || status === "waiting_for_user") {
            return (
                <Box paddingLeft={0} marginY={1}>
                    <Icon name="ask_user" color="yellowBright" />
                    <Text color="yellowBright" bold> ASK_USER</Text>
                    <Text color="gray"> </Text>
                    <Icon name="arrow_right" color="gray" />
                    <Text color="gray"> </Text>
                    <Text color="yellow">{question}</Text>
                    <Text color="gray" dimColor> (等待输入...)</Text>
                </Box>
            );
        }

        // 默认显示（有问题但状态未知）
        return (
            <Box paddingLeft={0} marginY={1}>
                <Icon name="ask_user" color="yellowBright" />
                <Text color="yellowBright" bold> ASK_USER</Text>
                <Text color="gray"> </Text>
                <Icon name="arrow_right" color="gray" />
                <Text color="gray"> </Text>
                <Text color="yellow">{question}</Text>
            </Box>
        );
    }

    return (
        <Box paddingLeft={0} marginY={0}>
            {isPending ? (
                <>
                    <Icon name="tool_pending" color="yellow" />
                    <Text color="yellow"> </Text>
                    <Text color="yellow">{toolName ?? "tool"}</Text>
                    <Text color="gray" dimColor> (args: {argsStr.slice(0, 50)}{argsStr.length > 50 ? "…" : ""})</Text>
                </>
            ) : isError ? (
                <>
                    <Icon name="error" color="redBright" />
                    <Text color="redBright"> </Text>
                    <Text color="redBright">{toolName ?? "tool"}</Text>
                    <Text color="gray"> </Text>
                    <Icon name="arrow_right" color="gray" />
                    <Text color="gray"> </Text>
                    <Text color="redBright">[Error: {JSON.stringify(toolResult).slice(0, 60)}]</Text>
                </>
            ) : (
                <>
                    <Icon name="tool_done" color="cyan" />
                    <Text color="cyan"> </Text>
                    <Text color="cyan">{toolName ?? "tool"}</Text>
                    <Text color="gray" dimColor> [{argsStr.length} bytes]</Text>
                </>
            )}
        </Box>
    );
}
