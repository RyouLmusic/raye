import { describe, expect, test, beforeEach, spyOn, mock } from "bun:test";
import { Provider } from "../src/provider/provider.js";
import * as aiModule from "ai";
import type { AgentConfig } from "../src/agent/type.js";

// Mock language model for testing
const mockLanguageModel = {
    doGenerate: mock(),
    doStream: mock(),
    provider: "test-provider",
    modelId: "test-model",
    specificationVersion: "v3" as const
};

// Mock agent config
const mockAgentConfig: AgentConfig = {
    name: "test-agent",
    provider: "openai",
    model: "gpt-4",
    apiKey: "test-key",
    baseurl: "https://api.openai.com/v1",
    extra_body: {
        temperature: 0.7
    }
};

// Create async iterable for textStream
const createMockTextStream = () => {
    return (async function* () {
        yield "Test";
        yield " response";
    })();
};

describe("streamTextWrapper", () => {
    let getAgentLanguageSpy: ReturnType<typeof spyOn>;
    let streamTextSpy: ReturnType<typeof spyOn>;

    beforeEach(async () => {
        // Spy on Provider methods
        getAgentLanguageSpy = spyOn(Provider, "getAgentLanguage");
        getAgentLanguageSpy.mockReturnValue(mockLanguageModel as any);
        
        // Spy on streamText - create fresh mock for each test
        streamTextSpy = spyOn(aiModule, "streamText");
        streamTextSpy.mockReturnValue({
            textStream: createMockTextStream(),
            text: Promise.resolve("Test response"),
            finishReason: Promise.resolve("stop" as const),
            fullStream: createMockTextStream()
        } as any);
    });

    test("should successfully create stream with valid agent", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        const result = streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }]
        });
        
        expect(result).toBeDefined();
        expect(getAgentLanguageSpy).toHaveBeenCalled();
        expect(streamTextSpy).toHaveBeenCalled();
    });

    test("should call streamText with correct parameters", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }]
        });

        const callArgs = streamTextSpy.mock.calls[streamTextSpy.mock.calls.length - 1][0];
        expect(callArgs).toHaveProperty("model");
        expect(callArgs).toHaveProperty("messages");
        expect(callArgs.model).toBe(mockLanguageModel);
    });

    test("should throw error when agent language model not found", async () => {
        getAgentLanguageSpy.mockReturnValue(null);
        
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        expect(() => streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }]
        })).toThrow("Agent 'agent1' not found in config");
    });

    test("should pass through advanced parameters", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }],
            system: "You are a helpful assistant",
            temperature: 0.5,
            maxOutputTokens: 1000,
            maxRetries: 3
        });
        
        const callArgs = streamTextSpy.mock.calls[streamTextSpy.mock.calls.length - 1][0];
        expect(callArgs.system).toBe("You are a helpful assistant");
        expect(callArgs.temperature).toBe(0.5);
        expect(callArgs.maxOutputTokens).toBe(1000);
        expect(callArgs.maxRetries).toBe(3);
    });

    test("should include provider options from agent config", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }]
        });
        
        const callArgs = streamTextSpy.mock.calls[streamTextSpy.mock.calls.length - 1][0];
        expect(callArgs).toHaveProperty("providerOptions");
        expect(callArgs.providerOptions).toEqual(mockAgentConfig.extra_body);
    });

    test("should pass through callbacks", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        const onFinish = mock();
        const onError = mock();
        
        streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }],
            onFinish,
            onError
        });
        
        const callArgs = streamTextSpy.mock.calls[streamTextSpy.mock.calls.length - 1][0];
        expect(callArgs.onFinish).toBe(onFinish);
        expect(callArgs.onError).toBe(onError);
    });

    test("should return result from streamText call", async () => {
        const { streamTextWrapper } = await import("../src/session/stream-text-wrapper.js");
        
        const result = streamTextWrapper({
            agent: mockAgentConfig,
            messages: [{ role: 'user', content: '你好' }]
        });
        
        expect(result).toBeDefined();
        expect(streamTextSpy).toHaveBeenCalled();
        expect(streamTextSpy.mock.results[streamTextSpy.mock.results.length - 1].value).toBeDefined();
    });
});


