import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { Icon } from "./Icon";

interface ThinkingBlockProps {
    label: string;
    text: string;
    collapsed?: boolean;
    fullText?: string;
}

export function ThinkingBlock({ label, text, collapsed = false, fullText }: ThinkingBlockProps) {
    if (collapsed && fullText) {
        // 历史记录完整展示：显示所有内容，不折叠不省略
        const lines = fullText.split("\n").filter(l => l.trim().length > 0);

        return (
            <Box flexDirection="column" marginY={0}>
                <Box>
                    <Icon name="expand" color="gray" />
                    <Text color="gray"> [{label}]</Text>
                </Box>
                {lines.map((line, i) => (
                    <Box key={i} paddingLeft={2}>
                        <Text color="gray" dimColor>{line}</Text>
                    </Box>
                ))}
            </Box>
        );
    }

    // 运行态：实时显示最后 4 行 + Spinner
    const lines = text.split("\n");
    const visible = lines.slice(-4);

    return (
        <Box flexDirection="column" paddingX={0} marginY={0}>
            <Box>
                <Text color="gray">[</Text>
                <Text color="gray">{label}</Text>
                <Text color="gray">] </Text>
                <Text color="gray"><Spinner type="dots" /></Text>
            </Box>
            {visible.map((line, i) => (
                <Box key={i} paddingLeft={2}>
                    <Text color="gray" dimColor>: {line}</Text>
                </Box>
            ))}
        </Box>
    );
}
