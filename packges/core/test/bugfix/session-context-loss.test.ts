/**
 * Bug Condition Exploration Test for Session Context Loss
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * Bug: In AgentLoop's PLANNING and EXECUTING phases, `processResutlToSession()` 
 * returns a new session object (immutable pattern), but the return value is ignored.
 * This causes plan/reason/execute messages to be lost.
 * 
 * Test Strategy:
 * - Mock the Processor.plan(), Processor.reason(), and Processor.execute() calls
 * - Execute the AgentLoop through PLANNING and EXECUTING phases
 * - Verify that messages are correctly written to context.session
 * - Verify that SessionManager.save() persists all messages
 * 
 * Expected Outcome on UNFIXED code:
 * - Test FAILS (this is correct - it proves the bug exists)
 * - Counterexamples show:
 *   - PLANNING phase: plan/reason messages NOT in context.session.messages
 *   - EXECUTING phase: assistant/tool-result messages NOT in context.session.messages
 *   - SessionManager: saved session missing PLANNING phase messages
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { AgentLoop } from "@/session/loop";
import { Processor, processResutlToSession } from "@/session/processor";
import { SessionManager, MemorySessionStorage, SessionOps, SessionContext } from "@/session/seesion";
import type { ProcessorStepResult, AgentLoopState } from "@/session/type";
import type { AgentConfig } from "@/agent/type";

describe("Bug Condition Exploration: Session Context Loss", () => {
    let sessionManager: SessionManager;
    let testAgentConfig: AgentConfig;

    beforeEach(() => {
        // Create a fresh SessionManager with memory storage for each test
        sessionManager = new SessionManager(new MemorySessionStorage());
        
        // Create a minimal agent config for testing
        testAgentConfig = {
            name: "test-agent",
            model: "test-model",
            provider: "test-provider",
            max_retries: 1,
            timeout: 5000,
        } as AgentConfig;
    });

    test("PLANNING phase - Plan call: plan message should be in context.session", async () => {
        // Mock Processor.plan to return a controlled result
        const planResult: ProcessorStepResult = {
            text: "Plan: I will help you with this task",
            reasoning: "Planning the approach",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Plan: I will help you with this task",
            },
        };

        const originalPlan = Processor.plan;
        Processor.plan = mock(async () => planResult);

        // Mock Processor.execute to stop after first iteration
        const executeResult: ProcessorStepResult = {
            text: "Task completed",
            reasoning: "",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Task completed",
            },
        };
        const originalExecute = Processor.execute;
        Processor.execute = mock(async () => executeResult);

        try {
            // Execute the loop
            const result = await AgentLoop.loop(
                {
                    sessionId: "test-plan-session",
                    agentConfig: testAgentConfig,
                    message: {
                        role: "user",
                        content: "Help me with a task",
                    },
                    maxIterations: 1,
                    compactThreshold: 50,
                },
                sessionManager
            );

            // Load the saved session
            const savedSession = await sessionManager.get("test-plan-session");
            expect(savedSession).not.toBeNull();

            // CRITICAL ASSERTION: Plan message should be in the session
            // On UNFIXED code, this will FAIL because processResutlToSession return value is ignored
            const planMessage = savedSession!.messages.find(
                (m) => m.role === "assistant" && 
                       typeof m.content === "string" && 
                       m.content.includes("Plan:")
            );

            expect(planMessage).toBeDefined();
            expect(planMessage?.content).toContain("Plan: I will help you with this task");

            console.log("✅ UNEXPECTED: Plan message found in session (bug may be fixed)");
        } catch (error) {
            console.log("❌ EXPECTED FAILURE: Plan message NOT in session (bug confirmed)");
            console.log("Counterexample: Plan message lost after Processor.plan() call");
            throw error;
        } finally {
            // Restore original functions
            Processor.plan = originalPlan;
            Processor.execute = originalExecute;
        }
    });

    test("PLANNING phase - Reason call: reason message should be in context.session", async () => {
        // Mock Processor.plan for first iteration
        const planResult: ProcessorStepResult = {
            text: "Initial plan",
            reasoning: "",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Initial plan",
            },
        };
        const originalPlan = Processor.plan;
        Processor.plan = mock(async () => planResult);

        // Mock Processor.reason for second iteration
        const reasonResult: ProcessorStepResult = {
            text: "Reason: Based on the observation, I should continue",
            reasoning: "Reasoning about next steps",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Reason: Based on the observation, I should continue",
            },
        };
        const originalReason = Processor.reason;
        Processor.reason = mock(async () => reasonResult);

        // Mock Processor.execute to trigger second iteration
        let executeCallCount = 0;
        const originalExecute = Processor.execute;
        Processor.execute = mock(async () => {
            executeCallCount++;
            if (executeCallCount === 1) {
                // First iteration: return tool-calls to trigger continue
                return {
                    text: "Using tool",
                    reasoning: "",
                    finishReason: "tool-calls",
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "Using tool" }],
                    },
                    toolCalls: [
                        {
                            id: "call-1",
                            name: "test-tool",
                            args: {},
                        },
                    ],
                    toolResults: [
                        {
                            toolCallId: "call-1",
                            toolName: "test-tool",
                            content: JSON.stringify({ result: "success" }),
                            isError: false,
                        },
                    ],
                };
            } else {
                // Second iteration: stop
                return {
                    text: "Task completed",
                    reasoning: "",
                    finishReason: "stop",
                    message: {
                        role: "assistant",
                        content: "Task completed",
                    },
                };
            }
        });

        try {
            // Execute the loop with 2 iterations
            await AgentLoop.loop(
                {
                    sessionId: "test-reason-session",
                    agentConfig: testAgentConfig,
                    message: {
                        role: "user",
                        content: "Help me with a task",
                    },
                    maxIterations: 2,
                    compactThreshold: 50,
                },
                sessionManager
            );

            // Load the saved session
            const savedSession = await sessionManager.get("test-reason-session");
            expect(savedSession).not.toBeNull();

            // CRITICAL ASSERTION: Reason message should be in the session
            // On UNFIXED code, this will FAIL because processResutlToSession return value is ignored
            const reasonMessage = savedSession!.messages.find(
                (m) => m.role === "assistant" && 
                       typeof m.content === "string" && 
                       m.content.includes("Reason:")
            );

            expect(reasonMessage).toBeDefined();
            expect(reasonMessage?.content).toContain("Reason: Based on the observation");

            console.log("✅ UNEXPECTED: Reason message found in session (bug may be fixed)");
        } catch (error) {
            console.log("❌ EXPECTED FAILURE: Reason message NOT in session (bug confirmed)");
            console.log("Counterexample: Reason message lost after Processor.reason() call");
            throw error;
        } finally {
            // Restore original functions
            Processor.plan = originalPlan;
            Processor.reason = originalReason;
            Processor.execute = originalExecute;
        }
    });

    test("EXECUTING phase - Execute call: assistant and tool-result messages should be in context.session", async () => {
        // Mock Processor.plan
        const planResult: ProcessorStepResult = {
            text: "Plan",
            reasoning: "",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Plan",
            },
        };
        const originalPlan = Processor.plan;
        Processor.plan = mock(async () => planResult);

        // Mock Processor.execute with tool calls
        const executeResult: ProcessorStepResult = {
            text: "I will use the test tool",
            reasoning: "",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "I will use the test tool",
            },
            toolCalls: [
                {
                    id: "call-1",
                    name: "test-tool",
                    args: { param: "value" },
                },
            ],
            toolResults: [
                {
                    toolCallId: "call-1",
                    toolName: "test-tool",
                    content: JSON.stringify({ result: "tool executed successfully" }),
                    isError: false,
                },
            ],
        };
        const originalExecute = Processor.execute;
        Processor.execute = mock(async () => executeResult);

        try {
            // Execute the loop
            await AgentLoop.loop(
                {
                    sessionId: "test-execute-session",
                    agentConfig: testAgentConfig,
                    message: {
                        role: "user",
                        content: "Execute a tool",
                    },
                    maxIterations: 1,
                    compactThreshold: 50,
                },
                sessionManager
            );

            // Load the saved session
            const savedSession = await sessionManager.get("test-execute-session");
            expect(savedSession).not.toBeNull();

            // CRITICAL ASSERTION 1: Assistant message with tool-call should be in session
            // On UNFIXED code, this will FAIL because processResutlToSession return value is ignored
            const assistantMessage = savedSession!.messages.find(
                (m) => m.role === "assistant" && 
                       Array.isArray(m.content) &&
                       m.content.some((block: any) => block.type === "tool-call")
            );

            expect(assistantMessage).toBeDefined();
            console.log("✅ Assistant message with tool-call found");

            // CRITICAL ASSERTION 2: Tool result message should be in session
            const toolResultMessage = savedSession!.messages.find(
                (m) => m.role === "tool" &&
                       Array.isArray(m.content) &&
                       m.content.some((block: any) => block.type === "tool-result")
            );

            expect(toolResultMessage).toBeDefined();
            console.log("✅ Tool result message found");

            console.log("✅ UNEXPECTED: Execute messages found in session (bug may be fixed)");
        } catch (error) {
            console.log("❌ EXPECTED FAILURE: Execute messages NOT in session (bug confirmed)");
            console.log("Counterexample: Assistant and tool-result messages lost after Processor.execute() call");
            throw error;
        } finally {
            // Restore original functions
            Processor.plan = originalPlan;
            Processor.execute = originalExecute;
        }
    });

    test("SessionManager.save() - Saved session should contain all PLANNING and EXECUTING phase messages", async () => {
        // Mock Processor.plan
        const planResult: ProcessorStepResult = {
            text: "Comprehensive plan",
            reasoning: "Planning phase reasoning",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Comprehensive plan",
            },
        };
        const originalPlan = Processor.plan;
        Processor.plan = mock(async () => planResult);

        // Mock Processor.execute
        const executeResult: ProcessorStepResult = {
            text: "Execution complete",
            reasoning: "",
            finishReason: "stop",
            message: {
                role: "assistant",
                content: "Execution complete",
            },
            toolCalls: [
                {
                    id: "call-1",
                    name: "test-tool",
                    args: {},
                },
            ],
            toolResults: [
                {
                    toolCallId: "call-1",
                    toolName: "test-tool",
                    content: JSON.stringify({ result: "success" }),
                    isError: false,
                },
            ],
        };
        const originalExecute = Processor.execute;
        Processor.execute = mock(async () => executeResult);

        try {
            // Execute the loop
            await AgentLoop.loop(
                {
                    sessionId: "test-persistence-session",
                    agentConfig: testAgentConfig,
                    message: {
                        role: "user",
                        content: "Complete task",
                    },
                    maxIterations: 1,
                    compactThreshold: 50,
                },
                sessionManager
            );

            // Load the saved session
            const savedSession = await sessionManager.get("test-persistence-session");
            expect(savedSession).not.toBeNull();

            // CRITICAL ASSERTION: All messages should be persisted
            // Expected messages:
            // 1. User message: "Complete task"
            // 2. Plan message: "Comprehensive plan"
            // 3. Assistant message with tool-call: "Execution complete"
            // 4. Tool result message

            const userMessages = savedSession!.messages.filter((m) => m.role === "user");
            const assistantMessages = savedSession!.messages.filter((m) => m.role === "assistant");
            const toolMessages = savedSession!.messages.filter((m) => m.role === "tool");

            expect(userMessages.length).toBeGreaterThanOrEqual(1);
            
            // On UNFIXED code, these will FAIL because plan and execute messages are lost
            expect(assistantMessages.length).toBeGreaterThanOrEqual(2); // Plan + Execute
            expect(toolMessages.length).toBeGreaterThanOrEqual(1); // Tool result

            // Verify plan message is persisted
            const planMessage = assistantMessages.find(
                (m) => typeof m.content === "string" && m.content.includes("Comprehensive plan")
            );
            expect(planMessage).toBeDefined();

            // Verify execute message is persisted
            // Note: When toolCalls are present, content becomes an array with tool-call blocks
            const executeMessage = assistantMessages.find(
                (m) => {
                    if (typeof m.content === "string") {
                        return m.content.includes("Execution complete");
                    }
                    if (Array.isArray(m.content)) {
                        return m.content.some((block: any) => 
                            block.type === "text" && block.text.includes("Execution complete")
                        );
                    }
                    return false;
                }
            );
            expect(executeMessage).toBeDefined();

            console.log("✅ UNEXPECTED: All messages persisted correctly (bug may be fixed)");
        } catch (error) {
            console.log("❌ EXPECTED FAILURE: Saved session missing PLANNING/EXECUTING messages (bug confirmed)");
            console.log("Counterexample: SessionManager.save() persists incomplete session");
            throw error;
        } finally {
            // Restore original functions
            Processor.plan = originalPlan;
            Processor.execute = originalExecute;
        }
    });
});

/**
 * Preservation Property Tests for Session Context Loss Bugfix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests verify that the immutable pattern integrity is preserved after the fix.
 * They should PASS on both unfixed and fixed code, confirming no regressions.
 * 
 * Test Strategy:
 * - Use property-based testing to generate many test cases
 * - Verify SessionOps operations maintain immutability
 * - Verify processResutlToSession maintains immutability
 * - Verify message transformation logic remains consistent
 * - Verify state transition flow is preserved
 */

describe("Preservation Property Tests: Immutable Pattern Integrity", () => {
    
    describe("Property 2.1: SessionOps Immutability", () => {
        test("addMessage returns new session without modifying original", () => {
            // Generate multiple test cases
            const testCases = [
                { role: "user" as const, content: "Hello" },
                { role: "assistant" as const, content: "Hi there" },
                { role: "user" as const, content: "How are you?" },
                { role: "assistant" as const, content: [{ type: "text" as const, text: "I'm good" }] },
            ];

            for (const message of testCases) {
                const originalSession = SessionOps.create("test-session", "test-agent");
                const originalMessagesLength = originalSession.messages.length;
                const originalMetadata = { ...originalSession.metadata };

                // Perform operation
                const newSession = SessionOps.addMessage(originalSession, message);

                // Verify immutability: original unchanged
                expect(originalSession.messages.length).toBe(originalMessagesLength);
                expect(originalSession.metadata.createdAt).toEqual(originalMetadata.createdAt);
                expect(originalSession.metadata.totalIterations).toBe(originalMetadata.totalIterations);

                // Verify new object returned
                expect(newSession).not.toBe(originalSession);
                expect(newSession.messages).not.toBe(originalSession.messages);
                expect(newSession.messages.length).toBe(originalMessagesLength + 1);
                expect(newSession.messages[newSession.messages.length - 1]).toEqual(message);
            }
        });

        test("addMessages returns new session without modifying original", () => {
            const testCases = [
                [],
                [{ role: "user" as const, content: "Message 1" }],
                [
                    { role: "user" as const, content: "Message 1" },
                    { role: "assistant" as const, content: "Reply 1" },
                ],
                [
                    { role: "user" as const, content: "Message 1" },
                    { role: "assistant" as const, content: "Reply 1" },
                    { role: "user" as const, content: "Message 2" },
                ],
            ];

            for (const messages of testCases) {
                const originalSession = SessionOps.create("test-session", "test-agent");
                const originalMessagesLength = originalSession.messages.length;

                // Perform operation
                const newSession = SessionOps.addMessages(originalSession, messages);

                // Verify immutability: original unchanged
                expect(originalSession.messages.length).toBe(originalMessagesLength);

                // Verify new object returned
                if (messages.length === 0) {
                    // Empty array should return same session (optimization)
                    expect(newSession).toBe(originalSession);
                } else {
                    expect(newSession).not.toBe(originalSession);
                    expect(newSession.messages).not.toBe(originalSession.messages);
                    expect(newSession.messages.length).toBe(originalMessagesLength + messages.length);
                }
            }
        });

        test("addTokens returns new session without modifying original", () => {
            const testCases = [0, 100, 1000, 5000, 10000];

            for (const tokens of testCases) {
                const originalSession = SessionOps.create("test-session", "test-agent");
                const originalTotalTokens = originalSession.metadata.totalTokens;

                // Perform operation
                const newSession = SessionOps.addTokens(originalSession, tokens);

                // Verify immutability: original unchanged
                expect(originalSession.metadata.totalTokens).toBe(originalTotalTokens);

                // Verify new object returned
                expect(newSession).not.toBe(originalSession);
                expect(newSession.metadata).not.toBe(originalSession.metadata);
                expect(newSession.metadata.totalTokens).toBe(originalTotalTokens + tokens);
            }
        });

        test("incrementIterations returns new session without modifying original", () => {
            const testCases = [1, 2, 5, 10];

            for (const count of testCases) {
                const originalSession = SessionOps.create("test-session", "test-agent");
                const originalIterations = originalSession.metadata.totalIterations;

                // Perform operation
                const newSession = SessionOps.incrementIterations(originalSession, count);

                // Verify immutability: original unchanged
                expect(originalSession.metadata.totalIterations).toBe(originalIterations);

                // Verify new object returned
                expect(newSession).not.toBe(originalSession);
                expect(newSession.metadata).not.toBe(originalSession.metadata);
                expect(newSession.metadata.totalIterations).toBe(originalIterations + count);
            }
        });

        test("compressMessages returns new session without modifying original", () => {
            // Create session with multiple messages
            let session = SessionOps.create("test-session", "test-agent");
            for (let i = 0; i < 20; i++) {
                session = SessionOps.addMessage(session, {
                    role: i % 2 === 0 ? "user" : "assistant",
                    content: `Message ${i + 1}`,
                });
            }

            const testCases = [5, 10, 15];

            for (const keepCount of testCases) {
                const originalSession = session;
                const originalMessagesLength = originalSession.messages.length;

                // Perform operation
                const newSession = SessionOps.compressMessages(originalSession, keepCount);

                // Verify immutability: original unchanged
                expect(originalSession.messages.length).toBe(originalMessagesLength);

                // Verify new object returned
                expect(newSession).not.toBe(originalSession);
                expect(newSession.messages).not.toBe(originalSession.messages);
                expect(newSession.messages.length).toBeLessThanOrEqual(keepCount);
                expect(newSession.metadata.lastCompactionAt).toBeDefined();
            }
        });
    });

    describe("Property 2.2: processResutlToSession Immutability", () => {
        test("processResutlToSession returns new session without modifying SessionContext", async () => {
            const testCases: ProcessorStepResult[] = [
                // Simple text message
                {
                    text: "Simple response",
                    reasoning: "",
                    finishReason: "stop",
                    message: {
                        role: "assistant",
                        content: "Simple response",
                    },
                },
                // Message with reasoning
                {
                    text: "Response with reasoning",
                    reasoning: "I thought about this carefully",
                    finishReason: "stop",
                    message: {
                        role: "assistant",
                        content: [
                            { type: "reasoning", text: "I thought about this carefully" },
                            { type: "text", text: "Response with reasoning" },
                        ],
                    },
                },
                // Message with tool calls
                {
                    text: "Using tools",
                    reasoning: "",
                    finishReason: "tool-calls",
                    message: {
                        role: "assistant",
                        content: "Using tools",
                    },
                    toolCalls: [
                        {
                            id: "call-1",
                            name: "test-tool",
                            args: { param: "value" },
                        },
                    ],
                    toolResults: [
                        {
                            toolCallId: "call-1",
                            toolName: "test-tool",
                            content: JSON.stringify({ result: "success" }),
                            isError: false,
                        },
                    ],
                },
            ];

            for (const result of testCases) {
                const originalSession = SessionOps.create("test-session", "test-agent");
                const originalMessagesLength = originalSession.messages.length;

                // Run in SessionContext
                await SessionContext.run(originalSession, async () => {
                    // Perform operation
                    const newSession = processResutlToSession(result);

                    // Verify immutability: original unchanged
                    expect(originalSession.messages.length).toBe(originalMessagesLength);

                    // Verify new object returned
                    expect(newSession).not.toBe(originalSession);
                    expect(newSession.messages).not.toBe(originalSession.messages);
                    expect(newSession.messages.length).toBeGreaterThan(originalMessagesLength);

                    // Verify SessionContext.current() still returns original
                    const contextSession = SessionContext.current();
                    expect(contextSession).toBe(originalSession);
                    expect(contextSession.messages.length).toBe(originalMessagesLength);
                });
            }
        });
    });

    describe("Property 2.3: Message Transformation Logic Consistency", () => {
        test("assistant message with tool-calls is correctly transformed", async () => {
            const result: ProcessorStepResult = {
                text: "I will use the tool",
                reasoning: "",
                finishReason: "tool-calls",
                message: {
                    role: "assistant",
                    content: "I will use the tool",
                },
                toolCalls: [
                    {
                        id: "call-1",
                        name: "test-tool",
                        args: { param: "value" },
                    },
                    {
                        id: "call-2",
                        name: "another-tool",
                        args: { key: "data" },
                    },
                ],
                toolResults: [
                    {
                        toolCallId: "call-1",
                        toolName: "test-tool",
                        content: JSON.stringify({ result: "success" }),
                        isError: false,
                    },
                    {
                        toolCallId: "call-2",
                        toolName: "another-tool",
                        content: JSON.stringify({ data: "output" }),
                        isError: false,
                    },
                ],
            };

            const originalSession = SessionOps.create("test-session", "test-agent");

            await SessionContext.run(originalSession, async () => {
                const newSession = processResutlToSession(result);

                // Verify assistant message has tool-call blocks
                const assistantMessage = newSession.messages[0];
                expect(assistantMessage.role).toBe("assistant");
                expect(Array.isArray(assistantMessage.content)).toBe(true);

                const content = assistantMessage.content as any[];
                const toolCallBlocks = content.filter((block) => block.type === "tool-call");
                expect(toolCallBlocks.length).toBe(2);
                expect(toolCallBlocks[0].toolCallId).toBe("call-1");
                expect(toolCallBlocks[1].toolCallId).toBe("call-2");

                // Verify tool-result messages
                const toolMessages = newSession.messages.filter((m) => m.role === "tool");
                expect(toolMessages.length).toBe(2);

                const toolMessage1 = toolMessages[0];
                expect(Array.isArray(toolMessage1.content)).toBe(true);
                const toolContent1 = toolMessage1.content as any[];
                expect(toolContent1[0].type).toBe("tool-result");
                expect(toolContent1[0].toolCallId).toBe("call-1");
            });
        });

        test("assistant message without tool-calls is correctly transformed", async () => {
            const result: ProcessorStepResult = {
                text: "Simple response",
                reasoning: "",
                finishReason: "stop",
                message: {
                    role: "assistant",
                    content: "Simple response",
                },
            };

            const originalSession = SessionOps.create("test-session", "test-agent");

            await SessionContext.run(originalSession, async () => {
                const newSession = processResutlToSession(result);

                // Verify assistant message is added as-is
                const assistantMessage = newSession.messages[0];
                expect(assistantMessage.role).toBe("assistant");
                expect(assistantMessage.content).toBe("Simple response");
            });
        });

        test("token usage is correctly added to metadata", async () => {
            const result: ProcessorStepResult = {
                text: "Response",
                reasoning: "",
                finishReason: "stop",
                message: {
                    role: "assistant",
                    content: "Response",
                },
                usage: {
                    totalTokens: 1500,
                },
            };

            const originalSession = SessionOps.create("test-session", "test-agent");

            await SessionContext.run(originalSession, async () => {
                const newSession = processResutlToSession(result);

                // Verify token usage is added
                expect(newSession.metadata.totalTokens).toBe(1500);
                expect(originalSession.metadata.totalTokens).toBe(0);
            });
        });
    });

    describe("Property 2.4: State Transition Flow Preservation", () => {
        test("state transitions follow PLANNING → EXECUTING → OBSERVING sequence", async () => {
            const sessionManager = new SessionManager(new MemorySessionStorage());
            const testAgentConfig: AgentConfig = {
                name: "test-agent",
                model: "test-model",
                provider: "test-provider",
                max_retries: 1,
                timeout: 5000,
            } as AgentConfig;

            const stateTransitions: AgentLoopState[] = [];

            // Mock Processor functions
            const planResult: ProcessorStepResult = {
                text: "Plan",
                reasoning: "",
                finishReason: "stop",
                message: { role: "assistant", content: "Plan" },
            };
            const originalPlan = Processor.plan;
            Processor.plan = mock(async () => planResult);

            const executeResult: ProcessorStepResult = {
                text: "Execute",
                reasoning: "",
                finishReason: "stop",
                message: { role: "assistant", content: "Execute" },
            };
            const originalExecute = Processor.execute;
            Processor.execute = mock(async () => executeResult);

            try {
                await AgentLoop.loop(
                    {
                        sessionId: "state-test-session",
                        agentConfig: testAgentConfig,
                        message: { role: "user", content: "Test" },
                        maxIterations: 1,
                        compactThreshold: 50,
                        observer: {
                            onStateChange: (from, to) => {
                                stateTransitions.push(to);
                            },
                        },
                    },
                    sessionManager
                );

                // Verify state transition sequence
                expect(stateTransitions).toContain("PLANNING");
                expect(stateTransitions).toContain("EXECUTING");
                expect(stateTransitions).toContain("OBSERVING");

                // Verify order: PLANNING comes before EXECUTING
                const planningIndex = stateTransitions.indexOf("PLANNING");
                const executingIndex = stateTransitions.indexOf("EXECUTING");
                const observingIndex = stateTransitions.indexOf("OBSERVING");

                expect(planningIndex).toBeLessThan(executingIndex);
                expect(executingIndex).toBeLessThan(observingIndex);
            } finally {
                Processor.plan = originalPlan;
                Processor.execute = originalExecute;
            }
        });
    });

    describe("Property 2.5: SessionContext Behavior Preservation", () => {
        test("SessionContext.run() and current() behavior unchanged", async () => {
            const session1 = SessionOps.create("session-1", "agent-1");
            const session2 = SessionOps.create("session-2", "agent-2");

            // Test nested contexts
            await SessionContext.run(session1, async () => {
                const current1 = SessionContext.current();
                expect(current1.sessionId).toBe("session-1");

                await SessionContext.run(session2, async () => {
                    const current2 = SessionContext.current();
                    expect(current2.sessionId).toBe("session-2");
                });

                // After inner context, should return to outer
                const current1Again = SessionContext.current();
                expect(current1Again.sessionId).toBe("session-1");
            });

            // Outside context, should throw
            expect(() => SessionContext.current()).toThrow();
        });

        test("SessionContext.hasContext() works correctly", async () => {
            expect(SessionContext.hasContext()).toBe(false);

            const session = SessionOps.create("test-session", "test-agent");

            await SessionContext.run(session, async () => {
                expect(SessionContext.hasContext()).toBe(true);
            });

            expect(SessionContext.hasContext()).toBe(false);
        });

        test("SessionContext.tryGetCurrent() returns undefined outside context", () => {
            expect(SessionContext.tryGetCurrent()).toBeUndefined();
        });
    });
});
