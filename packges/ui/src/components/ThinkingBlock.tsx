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
        // 折叠视图：最精简的摘要
        const lines = fullText.split("\n").filter(l => l.trim().length > 0);
        const summary = lines[0]?.slice(0, 60) ?? "";
        return (
            <Box>
                <Icon name="expand" color="gray" />
                <Text color="gray"> </Text>
                <Text color="gray">[{label}] </Text>
                <Text color="gray" dimColor>{summary}{fullText.length > 60 ? "…" : ""} </Text>
                <Text color="gray" dimColor>({fullText.length} chars)</Text>
            </Box>
        );
    }

    // 运行态：冷峻的点阵/字符，加 Spinner
    const lines = text.split("\n");
    const visible = lines.slice(-4); // 显示最后 4 行，保持紧凑

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
