import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useAgentLoop } from "../hooks/useAgentLoop";
import type { AgentConfig } from "core/agent/type";

/**
 * ask_user 工具直接 UI 交互示例
 * 
 * 演示如何使用 onAskUser 回调实现实时弹窗式交互
 */

interface PendingQuestion {
    question: string;
    resolve: (answer: string) => void;
}

export function AskUserExample() {
    const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
    const [userInput, setUserInput] = useState("");

    // Agent 配置（示例，实际使用时需要完整配置）
    const agentConfig = {
        name: "ask-user-demo",
        model: "gpt-4",
        provider: "openai",
        version: "1.0.0",
        description: "Ask user demo agent",
        base_url: "",
        api_key: "",
        model_id: "gpt-4",
        extra_body: {},
        max_retries: 3,
        timeout: 30000,
    } as AgentConfig;

    // 使用 useAgentLoop hook，传入 onAskUser 回调
    const { state } = useAgentLoop(agentConfig, "demo-session", {
        // 🔥 当 LLM 调用 ask_user 时，此函数被调用
        onAskUser: async (question: string) => {
            return new Promise<string>((resolve) => {
                // 显示问题并等待用户输入
                setPendingQuestion({ question, resolve });
            });
        }
    });

    // 处理用户输入
    useInput(
        (char, key) => {
            if (!pendingQuestion) return;

            if (key.return) {
                const trimmed = userInput.trim();
                if (trimmed) {
                    // Resolve Promise，让 ask_user 工具返回答案
                    pendingQuestion.resolve(trimmed);
                    // 清空状态
                    setPendingQuestion(null);
                    setUserInput("");
                }
                return;
            }

            if (key.backspace || key.delete) {
                setUserInput(v => v.slice(0, -1));
                return;
            }

            // Ctrl+C 取消
            if (key.ctrl && char === 'c') {
                pendingQuestion.resolve("[用户取消]");
                setPendingQuestion(null);
                setUserInput("");
                return;
            }

            // 过滤控制字符
            if (char && !key.ctrl && !key.meta) {
                setUserInput(v => v + char);
            }
        },
        { isActive: !!pendingQuestion }
    );

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Ask User Demo</Text>
            <Text dimColor>演示 ask_user 工具的实时交互</Text>
            
            {/* 聊天消息列表 */}
            <Box flexDirection="column" marginTop={1}>
                {state.messages.map((msg) => (
                    <Box key={msg.id} marginY={0}>
                        <Text color={msg.role === "user" ? "cyan" : "green"}>
                            {msg.role === "user" ? "👤 " : "🤖 "}
                        </Text>
                        <Text>{msg.content}</Text>
                    </Box>
                ))}
            </Box>

            {/* ask_user 弹窗 - 使用醒目的黄色主题 */}
            {pendingQuestion && (
                <Box 
                    flexDirection="column" 
                    borderStyle="double" 
                    borderColor="yellowBright"
                    padding={1}
                    marginTop={1}
                    marginBottom={1}
                >
                    {/* 标题栏 */}
                    <Box marginBottom={1}>
                        <Text bold color="black" backgroundColor="yellowBright">
                            {" ⚠️  AGENT 正在询问 "}
                        </Text>
                    </Box>
                    
                    {/* 问题内容 */}
                    <Box 
                        flexDirection="column" 
                        paddingX={1} 
                        paddingY={1}
                        borderStyle="round"
                        borderColor="yellow"
                    >
                        <Text color="white" bold>{pendingQuestion.question}</Text>
                    </Box>
                    
                    {/* 输入区域 */}
                    <Box marginTop={1} flexDirection="column">
                        <Text color="cyanBright" bold>您的回答:</Text>
                        <Box marginTop={0}>
                            <Text color="cyan">▶ </Text>
                            <Text color="white">{userInput}</Text>
                            <Text color="cyan">_</Text>
                        </Box>
                    </Box>
                    
                    {/* 提示信息 */}
                    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text dimColor>💡 按 </Text>
                        <Text color="green" bold>Enter</Text>
                        <Text dimColor> 提交 | </Text>
                        <Text color="red" bold>Ctrl+C</Text>
                        <Text dimColor> 取消</Text>
                    </Box>
                </Box>
            )}

            {/* 状态显示 */}
            <Box marginTop={1}>
                <Text dimColor>
                    状态: {state.loopState} | 迭代: {state.iteration}/{state.maxIterations}
                </Text>
            </Box>

            {/* 错误提示 */}
            {state.error && (
                <Box marginTop={1}>
                    <Text color="red">错误: {state.error}</Text>
                </Box>
            )}
        </Box>
    );
}

/**
 * 使用说明：
 * 
 * 1. 当 LLM 调用 ask_user({ question: "..." }) 时
 * 2. onAskUser 回调被触发，返回一个 pending 的 Promise
 * 3. UI 显示黄色边框的弹窗，展示问题
 * 4. 用户在输入框中输入答案并按 Enter
 * 5. Promise resolve，ask_user 工具返回答案
 * 6. LLM 收到答案并继续执行
 * 
 * 整个过程中，Loop 不会停止，用户的回复直接作为工具返回值。
 */
