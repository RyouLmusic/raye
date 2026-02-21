import React from "react";
import { Box, Text } from "ink";
import type { AgentLoopUIState } from "../hooks/useAgentLoop";

interface StatusBarProps {
    loopState: AgentLoopUIState["loopState"];
    iteration: number;
    maxIterations: number;
    sessionId: string;
}

const STATE_COLOR: Record<string, string> = {
    IDLE:       "gray",
    INIT:       "gray",
    PLANNING:   "yellow",
    EXECUTING:  "green",
    OBSERVING:  "cyan",
    COMPACTING: "magenta",
    COMPLETED:  "green",
    FAILED:     "red",
};

const STATE_LABEL: Record<string, string> = {
    IDLE:       "idle",
    INIT:       "init",
    PLANNING:   "planning",
    EXECUTING:  "executing",
    OBSERVING:  "observing",
    COMPACTING: "compacting",
    COMPLETED:  "done",
    FAILED:     "failed",
};

/**
 * 顶部状态栏
 *
 * raye  ·  session: abc123  ·  iter: 3/10  ·  executing
 */
export function StatusBar({ loopState, iteration, maxIterations, sessionId }: StatusBarProps) {
    const color = STATE_COLOR[loopState] ?? "white";
    const label = STATE_LABEL[loopState] ?? loopState.toLowerCase();
    const shortId = sessionId.slice(0, 8);

    return (
        <Box
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
        >
            <Text bold color="magenta">raye</Text>
            <Text color="gray">  ·  session: </Text>
            <Text color="white">{shortId}</Text>
            <Text color="gray">  ·  iter: </Text>
            <Text color="white">{iteration}/{maxIterations}</Text>
            <Text color="gray">  ·  </Text>
            <Text color={color} bold>{label}</Text>
        </Box>
    );
}
