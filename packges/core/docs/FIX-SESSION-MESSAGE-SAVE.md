# Session消息保存问题修复

## 问题描述

用户报告AI的完整回答没有被保存到session中，只有第一次回答和工具调用内容被保存。日志中显示的Array内容也没有被完整打印出来。

## 根本原因

1. **SessionContext使用问题**：在`loop.ts`中，使用了`SessionContext.run()`来执行`processResutlToSession`，但这创建了一个新的上下文，可能导致session更新不一致。

2. **日志输出问题**：使用`console.log`打印对象时，由于默认深度限制，Array内容显示为`[Object ...]`，无法看到完整内容。

## 修复方案

### 1. 修改`processResutlToSession`函数签名

**文件**: `packges/core/src/session/processor/index.ts`

将函数改为接受可选的`inputSession`参数，而不是总是从`SessionContext.current()`获取：

```typescript
export function processResutlToSession(result: ProcessorStepResult, inputSession?: Session): Session {
    let session = inputSession ?? SessionContext.current();
    // ... 处理逻辑
    return session;
}
```

### 2. 修改`loop.ts`中的调用方式

**文件**: `packges/core/src/session/loop.ts`

直接传递`context.session`作为参数，而不是使用`SessionContext.run()`：

```typescript
// 修改前
context.session = await SessionContext.run(context.session, () =>
    Promise.resolve(processResutlToSession(executeResult))
);

// 修改后
context.session = processResutlToSession(executeResult, context.session);
```

### 3. 改进日志输出

使用`JSON.stringify`来完整打印消息内容：

```typescript
console.log("Processed session:", JSON.stringify({
    sessionId: session.sessionId,
    messageCount: session.messages.length,
    messages: session.messages.map((m, i) => ({
        index: i,
        role: m.role,
        content: Array.isArray(m.content) 
            ? m.content.map(c => ({ 
                type: (c as any).type, 
                text: (c as any).text?.substring(0, 100),
                toolName: (c as any).toolName,
                toolCallId: (c as any).toolCallId
            }))
            : typeof m.content === 'string' ? m.content.substring(0, 100) : m.content
    }))
}, null, 2));
```

## 测试验证

创建了测试文件`packges/core/test/session-message-save.test.ts`来验证修复：

1. **测试1**: 验证纯文本回复（带reasoning）能正确保存到session
2. **测试2**: 验证带工具调用的回复能正确保存到session

测试结果：✅ 所有测试通过

## 修改的文件

1. `packges/core/src/session/processor/index.ts` - 修改`processResutlToSession`函数签名和日志输出
2. `packges/core/src/session/loop.ts` - 修改调用方式和日志输出
3. `packges/core/test/session-message-save.test.ts` - 新增测试文件

## 影响范围

- 修复了session消息保存的问题，确保AI的完整回答都能被正确保存
- 改进了日志输出，便于调试和问题排查
- 不影响现有功能，向后兼容

## 注意事项

- `processResutlToSession`函数现在接受可选的`inputSession`参数，如果不传递则从`SessionContext.current()`获取（保持向后兼容）
- 日志输出使用`JSON.stringify`，对于大型对象可能影响性能，但便于调试
- 建议在生产环境中可以通过环境变量控制日志详细程度
