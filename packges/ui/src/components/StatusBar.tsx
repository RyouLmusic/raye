import React from "react";
import { Box, Text } from "ink";
import type { AgentLoopState } from "core/session/type";

interface StatusBarProps {
    loopState: AgentLoopState | "IDLE";
    iteration: number;
    maxIterations: number;
    sessionId: string;
}

/**
 * 极简全局状态栏
 * 采用反差色设计，强化系统边界感。
 */
export function StatusBar({ loopState, iteration, maxIterations, sessionId }: StatusBarProps) {
    return (
        <Box
            width="100%"
            flexDirection="row"
            justifyContent="space-between"
            marginBottom={1}
        >
            <Box>
                <Text backgroundColor="cyan" color="black" bold> RAYE </Text>
                <Text color="gray"> │ Session: {sessionId.slice(0, 8)} │ </Text>
                <Text color="white">State: </Text>
                <Text color={loopState === 'FAILED' ? 'redBright' : 'cyanBright'}>{loopState}</Text>
            </Box>

            <Box>
                <Text color="gray"> Iter: </Text>
                <Text color="white">{iteration}/{maxIterations} </Text>
            </Box>
        </Box>
    );
}
