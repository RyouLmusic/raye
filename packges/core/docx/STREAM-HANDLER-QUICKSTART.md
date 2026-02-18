# Stream Handler 使用指南

## 快速上手示例

```typescript
import { streamTextWrapper, processFullStream, createConsoleHandlers } from "core";

// 方式 1: 使用预设的彩色控制台输出（最简单）
const result = await streamTextWrapper({
    agent: yourAgent,
    messages: [{ role: 'user', content: '你好' }]
});

await processFullStream(result, {
    handlers: createConsoleHandlers()
});
```

## 主要功能

### 1. 实时流式显示

支持实时展示：
- 💭 推理过程（reasoning）
- 📝 文本响应（text）
- 🔧 工具调用（tool call）
- 📊 执行步骤（steps）

### 2. 数据收集

```typescript
import { createCollectorHandlers } from "core";

const { handlers, getCollected } = createCollectorHandlers();
await processFullStream(result, { handlers });

// 获取所有数据
const data = getCollected();
console.log(data.text);        // 完整响应文本
console.log(data.reasoning);   // 完整推理内容
console.log(data.toolCalls);   // 所有工具调用
```

### 3. 自定义样式

```typescript
const customHandlers = {
    text: {
        onStart: () => console.log('开始回复...'),
        onDelta: (text) => {
            // 添加自定义格式化
            process.stdout.write(text);
        },
        onEnd: (fullText) => {
            console.log(`\n共 ${fullText.length} 字`);
        }
    }
};

await processFullStream(result, { 
    handlers: customHandlers 
});
```

## 典型应用场景

1. **CLI 工具**：实时显示 AI 响应
2. **Web 应用**：通过 WebSocket 推送流式内容
3. **日志系统**：记录完整的对话过程
4. **调试工具**：观察推理过程和工具调用

## 完整示例

参考文件：`/packges/core/test/stream-handler-examples.test.ts`
详细文档：`/packges/core/docs/STREAM-HANDLER-README.md`
