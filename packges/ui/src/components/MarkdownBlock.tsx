import React from "react";
import { Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// 初始化 marked-terminal 插件 (使用 any 规避旧版类型声明与最新 marked 不匹配的问题)
marked.use(markedTerminal() as any);

interface MarkdownBlockProps {
    text: string;
}

/**
 * 封装在静态历史记录区中的 Markdown 终端内容渲染器。
 * 将 AI 输出的大段 markdown 解析为高亮、带粗体/颜色和符号的终端原生展示。
 */
export function MarkdownBlock({ text }: MarkdownBlockProps) {
    // parse 可能会带有尾部回车，我们用 trim 去掉以保持 ink 布局严谨
    const rendered = (marked.parse(text) as string).trim();

    return (
        <Text>{rendered}</Text>
    );
}
