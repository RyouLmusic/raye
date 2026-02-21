import React from "react";
import { Box, Text } from "ink";

interface ThinkingBlockProps {
    /** 阶段标签：Planning 或 Reasoning */
    label: string;
    /** 当前正在 streaming 的文本 */
    text: string;
    /** 是否已完成（历史消息中折叠展示） */
    collapsed?: boolean;
    /** 完整文本（折叠时展示摘要） */
    fullText?: string;
}

/**
 * 推理/规划阶段的 TUI 展示块
 *
 * streaming 中：实时展示最后几行，前面加 label 标签
 * collapsed  ：只显示第一行作为摘要（带 ▸ 折叠标记）
 */
export function ThinkingBlock({ label, text, collapsed = false, fullText }: ThinkingBlockProps) {
    if (collapsed && fullText) {
        // 折叠视图：取第一行作为摘要
        const summary = fullText.split("\n")[0]?.slice(0, 80) ?? "";
        return (
            <Box>
                <Text color="gray">▸ </Text>
                <Text color="cyan" dimColor>[{label}] </Text>
                <Text color="gray">{summary}{fullText.length > 80 ? "…" : ""}</Text>
            </Box>
        );
    }

    // streaming 中：展示最后 6 行
    const lines = text.split("\n");
    const visible = lines.slice(-6);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
            <Box>
                <Text bold color="cyan">▼ {label}</Text>
                <Text color="gray"> (thinking…)</Text>
            </Box>
            {visible.map((line, i) => (
                <Text key={i} color="cyan" dimColor>
                    {line}
                </Text>
            ))}
        </Box>
    );
}
