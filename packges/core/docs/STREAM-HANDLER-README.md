# Stream Handler - fullStream 处理器

这是一个用于处理 `streamText` 返回的 `fullStream` 的工具库，提供了灵活的流式内容处理能力。

## 功能特性

- 📝 **文本响应处理**：实时捕获 AI 生成的文本内容
- 💭 **推理过程处理**：支持推理内容的流式展示（DeepSeek、MiniMax 等）
- 🔧 **工具调用处理**：处理工具调用和结果
- 📊 **步骤追踪**：支持多步骤执行的追踪
- 🎨 **预设样式**：提供开箱即用的彩色控制台输出
- 📦 **数据收集**：支持收集所有流式数据供后续使用
- 🔄 **混合使用**：可以同时实现实时显示和数据收集

## 快速开始

### 基础使用 - 预设控制台处理器

```typescript
import { streamTextWrapper, processFullStream, createConsoleHandlers } from "core";

const result = await streamTextWrapper({
    agent,
    messages: [{ role: 'user', content: '你好' }]
});

// 使用预设的彩色控制台输出
await processFullStream(result, {
    handlers: createConsoleHandlers({
        showReasoning: true,  // 显示推理过程
        showTools: true,      // 显示工具调用
        showSteps: true       // 显示步骤信息
    })
});
```

### 自定义处理器

完全自定义每种内容的处理方式：

```typescript
import { processFullStream, type StreamHandlers } from "core";

const customHandlers: StreamHandlers = {
    // 推理内容处理
    reasoning: {
        onStart: () => console.log('🧠 AI 正在思考...'),
        onDelta: (text) => process.stdout.write(text),
        onEnd: (fullText) => console.log(`\n思考了 ${fullText.length} 字符`)
    },
    
    // 文本响应处理
    text: {
        onStart: () => console.log('💬 回复:'),
        onDelta: (text) => process.stdout.write(text),
        onEnd: (fullText) => console.log(`\n[共 ${fullText.length} 字]`)
    },
    
    // 工具调用处理
    tool: {
        onCall: (id, name, args) => {
            console.log(`⚙️ 调用工具: ${name}`);
            console.log(`参数:`, args);
        },
        onResult: (id, name, result) => {
            console.log(`✅ 结果:`, result);
        }
    },
    
    // 完成回调
    onFinish: (result) => {
        console.log(`\n✅ 对话结束 (${result.finishReason})`);
    }
};

await processFullStream(result, { handlers: customHandlers });
```

### 数据收集器

收集所有内容而不立即显示，方便后续处理：

```typescript
import { processFullStream, createCollectorHandlers } from "core";

const { handlers, getCollected } = createCollectorHandlers();

await processFullStream(result, { handlers });

// 获取收集的所有数据
const collected = getCollected();

console.log('推理内容:', collected.reasoning);
console.log('回复内容:', collected.text);
console.log('工具调用:', collected.toolCalls);
console.log('步骤数:', collected.steps);
```

### 混合使用 - 实时显示 + 数据收集

同时实现实时显示和数据收集：

```typescript
const { handlers: collectorHandlers, getCollected } = createCollectorHandlers();
const consoleHandlers = createConsoleHandlers();

const hybridHandlers: StreamHandlers = {
    reasoning: {
        onStart: async () => {
            await collectorHandlers.reasoning?.onStart?.();
            await consoleHandlers.reasoning?.onStart?.();
        },
        onDelta: async (text) => {
            await collectorHandlers.reasoning?.onDelta?.(text);
            await consoleHandlers.reasoning?.onDelta?.(text);
        },
        onEnd: async (fullText) => {
            await collectorHandlers.reasoning?.onEnd?.(fullText);
            await consoleHandlers.reasoning?.onEnd?.(fullText);
        }
    },
    text: {
        onDelta: async (text) => {
            await collectorHandlers.text?.onDelta?.(text);
            await consoleHandlers.text?.onDelta?.(text);
        }
    },
    tool: {
        onCall: async (id, name, args) => {
            await collectorHandlers.tool?.onCall?.(id, name, args);
            await consoleHandlers.tool?.onCall?.(id, name, args);
        },
        onResult: async (id, name, result) => {
            await collectorHandlers.tool?.onResult?.(id, name, result);
            await consoleHandlers.tool?.onResult?.(id, name, result);
        }
    }
};

await processFullStream(result, { handlers: hybridHandlers });

// 流处理完成后，可以获取收集的数据
const collected = getCollected();
```

## API 参考

### StreamHandlers

处理器接口定义：

```typescript
interface StreamHandlers {
    // 推理内容处理器
    reasoning?: {
        onStart?: () => void | Promise<void>;
        onDelta?: (text: string) => void | Promise<void>;
        onEnd?: (fullReasoningText: string) => void | Promise<void>;
    };
    
    // 文本响应处理器
    text?: {
        onStart?: () => void | Promise<void>;
        onDelta?: (text: string) => void | Promise<void>;
        onEnd?: (fullText: string) => void | Promise<void>;
    };
    
    // 工具调用处理器
    tool?: {
        onCall?: (toolId: string, toolName: string, args: any) => void | Promise<void>;
        onResult?: (toolId: string, toolName: string, result: any) => void | Promise<void>;
    };
    
    // 步骤处理器
    step?: {
        onStart?: (stepNumber: number) => void | Promise<void>;
        onEnd?: (stepNumber: number) => void | Promise<void>;
    };
    
    // 错误处理器
    onError?: (error: unknown) => void | Promise<void>;
    
    // 完成处理器
    onFinish?: (result: {
        text: string;
        reasoning: string;
        finishReason: string;
        usage?: any;
    }) => void | Promise<void>;
}
```

### processFullStream

主要的流处理函数：

```typescript
async function processFullStream<TOOLS>(
    streamResult: StreamTextResult<TOOLS>,
    options: ProcessStreamOptions
): Promise<void>
```

**参数：**
- `streamResult`: `streamText` 或 `streamTextWrapper` 返回的结果
- `options.handlers`: 内容处理器
- `options.debug`: 是否显示调试信息（默认 `false`）

### createConsoleHandlers

创建预设的控制台处理器：

```typescript
function createConsoleHandlers(options?: {
    showReasoning?: boolean;  // 是否显示推理（默认 true）
    showTools?: boolean;      // 是否显示工具调用（默认 true）
    showSteps?: boolean;      // 是否显示步骤（默认 true）
    colors?: {                // 自定义颜色
        reasoning?: string;
        text?: string;
        tool?: string;
        step?: string;
        error?: string;
    };
}): StreamHandlers
```

### createCollectorHandlers

创建数据收集器处理器：

```typescript
function createCollectorHandlers(): {
    handlers: StreamHandlers;
    getCollected: () => {
        reasoning: string;
        text: string;
        toolCalls: Array<{
            id: string;
            name: string;
            args: any;
            result: any;
        }>;
        steps: number;
        error: any;
    };
}
```

## 使用场景

### 1. 终端应用

在命令行工具中提供实时的 AI 响应展示：

```typescript
await processFullStream(result, {
    handlers: createConsoleHandlers()
});
```

### 2. Web 应用

将流式内容发送到前端：

```typescript
const handlers: StreamHandlers = {
    reasoning: {
        onDelta: (text) => {
            ws.send(JSON.stringify({ type: 'reasoning', text }));
        }
    },
    text: {
        onDelta: (text) => {
            ws.send(JSON.stringify({ type: 'text', text }));
        }
    },
    tool: {
        onCall: (id, name, args) => {
            ws.send(JSON.stringify({ type: 'tool-call', name, args }));
        },
        onResult: (id, name, result) => {
            ws.send(JSON.stringify({ type: 'tool-result', name, result }));
        }
    }
};
```

### 3. 日志记录

记录完整的对话内容供后续分析：

```typescript
const { handlers, getCollected } = createCollectorHandlers();

await processFullStream(result, { handlers });

const data = getCollected();
await saveToDatabase({
    reasoning: data.reasoning,
    response: data.text,
    toolCalls: data.toolCalls
});
```

### 4. 进度显示

显示处理进度：

```typescript
let charCount = 0;

const progressHandlers: StreamHandlers = {
    text: {
        onStart: () => console.log('⏳ 生成中...'),
        onDelta: (text) => {
            charCount += text.length;
            process.stdout.write(`\r已生成 ${charCount} 字符`);
        },
        onEnd: () => console.log('\n✅ 完成')
    }
};
```

## 完整示例

查看 `/packges/core/test/stream-handler-examples.test.ts` 获取更多完整示例：

- 示例 1: 使用预设的控制台处理器
- 示例 2: 自定义处理器
- 示例 3: 收集器处理器
- 示例 4: 混合使用 - 实时显示 + 数据收集
- 示例 5: 带进度的处理器

## 注意事项

1. **异步处理**: 所有回调函数都支持异步操作，处理器会等待 Promise 完成
2. **错误处理**: 建议始终实现 `onError` 回调来处理可能的错误
3. **内存占用**: 使用收集器时注意内存使用，特别是对于长文本
4. **类型安全**: 使用 TypeScript 时可以获得完整的类型提示

## 支持的模型

- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic Claude
- ✅ DeepSeek (原生推理支持)
- ✅ MiniMax (通过 `<think>` 标签解析)
- ✅ 其他支持 AI SDK 的模型

## 相关文档

- [AI SDK 文档](https://sdk.vercel.ai/docs)
- [Stream Transformer 文档](./README-STREAM-TRANSFORMER.md)
- [使用示例](./SESSION-USAGE-EXAMPLES.md)
