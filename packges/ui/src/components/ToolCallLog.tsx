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
