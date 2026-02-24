import { describe, test, expect } from "bun:test";
import { processResutlToSession } from "@/session/processor";
import { SessionOps } from "@/session/seesion";
import type { ProcessorStepResult, Session } from "@/session/type";

describe("Session Message Save Test", () => {
    test("should save assistant message with text content to session", () => {
        // 创建一个初始session
        let session: Session = SessionOps.create("test-session", "test-agent");
        
        // 添加用户消息
        session = SessionOps.addMessage(session, {
            role: "user",
            content: "人参果怎么吃好吃"
        });
        
        console.log("Initial session:", {
            messageCount: session.messages.length,
            messages: session.messages.map((m, i) => ({
                index: i,
                role: m.role,
                content: typeof m.content === 'string' ? m.content.substring(0, 50) : m.content
            }))
        });
        
        // 模拟一个ProcessorStepResult（没有工具调用，只有文本回复）
        const result: ProcessorStepResult = {
            text: "人参果（又名香瓜茄、长寿果）是一种风味独特、营养丰富的水果...",
            reasoning: "用户想知道人参果怎么吃好吃。我需要提供一些人参果的食用方法和建议。",
            finishReason: "stop",
            usage: { totalTokens: 1000 },
            message: {
                role: "assistant",
                content: [
                    { type: "reasoning", text: "用户想知道人参果怎么吃好吃。我需要提供一些人参果的食用方法和建议。" },
                    { type: "text", text: "人参果（又名香瓜茄、长寿果）是一种风味独特、营养丰富的水果..." }
                ]
            }
        };
        
        // 处理结果并更新session
        session = processResutlToSession(result, session);
        
        console.log("After processing:", {
            messageCount: session.messages.length,
            messages: session.messages.map((m, i) => ({
                index: i,
                role: m.role,
                content: Array.isArray(m.content) 
                    ? m.content.map(c => ({ type: (c as any).type, preview: JSON.stringify(c).substring(0, 100) }))
                    : typeof m.content === 'string' ? m.content.substring(0, 100) : m.content
            }))
        });
        
        // 验证
        expect(session.messages.length).toBe(2); // user + assistant
        expect(session.messages[1].role).toBe("assistant");
        expect(Array.isArray(session.messages[1].content)).toBe(true);
        
        const content = session.messages[1].content as any[];
        expect(content.length).toBe(2); // reasoning + text
        expect(content[0].type).toBe("reasoning");
        expect(content[1].type).toBe("text");
        expect(content[1].text).toContain("人参果");
    });
    
    test("should save assistant message with tool calls to session", () => {
        // 创建一个初始session
        let session: Session = SessionOps.create("test-session", "test-agent");
        
        // 添加用户消息
        session = SessionOps.addMessage(session, {
            role: "user",
            content: "搜索人参果的吃法"
        });
        
        // 模拟一个ProcessorStepResult（有工具调用）
        const result: ProcessorStepResult = {
            text: "我来帮你搜索一下人参果的吃法",
            reasoning: "",
            finishReason: "tool-calls",
            usage: { totalTokens: 500 },
            message: {
                role: "assistant",
                content: "我来帮你搜索一下人参果的吃法"
            },
            toolCalls: [
                {
                    id: "call_123",
                    name: "web_search",
                    args: { query: "人参果 怎么吃 好吃 食用方法" }
                }
            ],
            toolResults: [
                {
                    toolCallId: "call_123",
                    toolName: "web_search",
                    content: JSON.stringify({ results: ["结果1", "结果2"] }),
                    isError: false
                }
            ]
        };
        
        // 处理结果并更新session
        session = processResutlToSession(result, session);
        
        console.log("After processing with tools:", {
            messageCount: session.messages.length,
            messages: session.messages.map((m, i) => ({
                index: i,
                role: m.role,
                content: Array.isArray(m.content) 
                    ? m.content.map(c => ({ type: (c as any).type, preview: JSON.stringify(c).substring(0, 100) }))
                    : typeof m.content === 'string' ? m.content.substring(0, 100) : m.content
            }))
        });
        
        // 验证
        expect(session.messages.length).toBe(3); // user + assistant + tool
        expect(session.messages[1].role).toBe("assistant");
        expect(session.messages[2].role).toBe("tool");
        
        // 验证assistant消息包含tool-call
        const assistantContent = session.messages[1].content as any[];
        expect(Array.isArray(assistantContent)).toBe(true);
        const toolCallBlock = assistantContent.find(b => b.type === "tool-call");
        expect(toolCallBlock).toBeDefined();
        expect(toolCallBlock.toolName).toBe("web_search");
        
        // 验证tool消息
        const toolContent = session.messages[2].content as any[];
        expect(Array.isArray(toolContent)).toBe(true);
        expect(toolContent[0].type).toBe("tool-result");
        expect(toolContent[0].toolName).toBe("web_search");
    });
});
