import React from "react";
import { Box, Text } from "ink";
import type { TurnMessage } from "../hooks/useAgentLoop";

interface ToolCallLogProps {
    msg: TurnMessage;
}

/**
 * 工具调用条目
 *
 * 等待结果：🔧 calculate({"a":1,"op":"add","b":2})  …
 * 有结果：  ✓ calculate → 3
 * 出错：    ✗ calculate → Error: ...
 */
export function ToolCallLog({ msg }: ToolCallLogProps) {
    const { toolName, toolArgs, toolResult } = msg;
    const argsStr = toolArgs ? JSON.stringify(toolArgs) : "";
    const isPending = toolResult === undefined;
    const isError = typeof toolResult === "object"
        && toolResult !== null
        && "error" in toolResult;

    return (
        <Box paddingLeft={2} marginY={0}>
            {isPending ? (
                <>
                    <Text color="yellow">⏳ </Text>
                    <Text color="yellow">{toolName ?? "tool"}</Text>
                    <Text color="gray">({argsStr.slice(0, 60)}{argsStr.length > 60 ? "…" : ""})</Text>
                </>
            ) : isError ? (
                <>
                    <Text color="red">✗  </Text>
                    <Text color="red">{toolName ?? "tool"}</Text>
                    <Text color="gray"> → </Text>
                    <Text color="red">{JSON.stringify(toolResult)}</Text>
                </>
            ) : (
                <>
                    <Text color="green">✓  </Text>
                    <Text color="green">{toolName ?? "tool"}</Text>
                    <Text color="gray">({argsStr.slice(0, 40)}{argsStr.length > 40 ? "…" : ""})</Text>
                    <Text color="gray"> → </Text>
                    <Text color="white">
                        {typeof toolResult === "string"
                            ? toolResult.slice(0, 100)
                            : JSON.stringify(toolResult).slice(0, 100)}
                    </Text>
                </>
            )}
        </Box>
    );
}
