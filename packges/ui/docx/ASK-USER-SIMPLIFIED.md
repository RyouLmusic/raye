# ask_user UI 简化版本

## 设计改进

### 之前（复杂版）
```
╔═══════════════════════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                                       ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ╭───────────────────────────────────────────────────╮   ║
║  │                                                   │   ║
║  │  您想了解人参果的哪些吃法呢？                    │   ║
║  │                                                   │   ║
║  ╰───────────────────────────────────────────────────╯   ║
║                                                           ║
║  您的回答:                                                ║
║  ▶ 直接吃_____________________________________           ║
║                                                           ║
║  ┌───────────────────────────────────────────────────┐   ║
║  │ 💡 按 Enter 提交 | Ctrl+C 取消                    │   ║
║  └───────────────────────────────────────────────────┘   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**问题：**
- 双层边框过于复杂
- 占用屏幕空间大
- 视觉噪音多
- 标题栏不必要

### 之后（简化版）
```
╭───────────────────────────────────────────────────────╮
│ ? 您想了解人参果的哪些吃法呢？                        │
│                                                       │
│ ▶ 直接吃_                                             │
│                                                       │
│ 按 Enter 提交 | Ctrl+C 取消                           │
╰───────────────────────────────────────────────────────╯
```

**优点：**
- 单层圆角边框，简洁清爽
- 占用空间更小
- 保留黄色主题，依然醒目
- 去掉不必要的装饰

## 历史记录显示

### 问答对格式
```
? 您想了解人参果的哪些吃法呢？
  ▶ 直接吃
```

**特点：**
- 问题用黄色 `?` 标记
- 答案用青色 `▶` 标记，缩进显示
- 清晰的层次关系
- 易于翻看历史

### 完整对话示例
```
❯ 人参果怎么吃好吃

? 您想了解人参果的哪些吃法呢？
  ▶ 直接吃

RAYE  根据您的需求，这里是人参果直接食用的建议：

1. 选择成熟的人参果
   - 果皮呈金黄色
   - 手感略软
   - 有淡淡香味

2. 清洗干净
   - 用清水冲洗
   - 可以用软刷轻刷表面

3. 直接食用
   - 可以连皮一起吃
   - 也可以削皮后食用
   - 口感清甜，类似黄瓜和梨的结合

◆ search_recipes [找到 5 个相关食谱]
```

## 视觉对比

### 模态框

| 元素 | 之前 | 之后 |
|------|------|------|
| 边框 | 双层（double + round） | 单层（round） |
| 标题栏 | 反色标题 "⚠️ AGENT 正在询问" | 无，直接显示问题 |
| 问题标记 | 无 | 黄色 `?` |
| 输入提示 | "您的回答:" | 无，直接显示 `▶` |
| 操作提示 | 边框包裹 + 💡 图标 | 简单文本 |
| 总高度 | ~12 行 | ~6 行 |

### 历史记录

| 元素 | 之前 | 之后 |
|------|------|------|
| 工具名 | `ASK_USER` (全大写) | 无 |
| 图标 | `?` + `✓` | `?` + `▶` |
| 箭头 | `→` | 无 |
| 标签 | "用户回复:" | 无 |
| 总行数 | 3 行 | 2 行 |

## 代码改动

### AskUserModal 组件

**之前：**
```typescript
<Box borderStyle="double" borderColor="yellowBright" padding={1}>
    <Box marginBottom={1}>
        <Text bold color="black" backgroundColor="yellowBright">
            {" ⚠️  AGENT 正在询问 "}
        </Text>
    </Box>
    <Box borderStyle="round" borderColor="yellow" paddingX={1} paddingY={1}>
        <Text color="white" bold>{question}</Text>
    </Box>
    <Box flexDirection="column" marginBottom={1}>
        <Text color="cyanBright" bold>您的回答:</Text>
        <Box><Text>▶ {input}_</Text></Box>
    </Box>
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>💡 按 Enter 提交 | Ctrl+C 取消</Text>
    </Box>
</Box>
```

**之后：**
```typescript
<Box borderStyle="round" borderColor="yellowBright" paddingX={1} marginY={1}>
    <Box marginBottom={1}>
        <Text color="yellowBright" bold>? </Text>
        <Text color="yellow">{question}</Text>
    </Box>
    <Box>
        <Text color="cyanBright">▶ </Text>
        <Text color="white">{input}_</Text>
    </Box>
    <Box marginTop={1}>
        <Text dimColor>按 Enter 提交 | Ctrl+C 取消</Text>
    </Box>
</Box>
```

### ToolCallLog 组件

**之前：**
```typescript
<Box flexDirection="column">
    <Box>
        <Icon name="ask_user" />
        <Text bold> ASK_USER</Text>
        <Icon name="arrow_right" />
        <Text>{question}</Text>
    </Box>
    <Box paddingLeft={2}>
        <Icon name="user_reply" />
        <Text> 用户回复: </Text>
        <Text>{answer}</Text>
    </Box>
</Box>
```

**之后：**
```typescript
<Box flexDirection="column">
    <Box>
        <Text color="yellowBright" bold>? </Text>
        <Text color="yellow">{question}</Text>
    </Box>
    <Box paddingLeft={2}>
        <Text color="cyanBright">▶ </Text>
        <Text color="cyan">{answer}</Text>
    </Box>
</Box>
```

## 保留的特性

✅ 黄色主题 - 依然醒目  
✅ 实时输入 - 功能不变  
✅ 键盘操作 - Enter 提交，Ctrl+C 取消  
✅ 历史记录 - 可以翻看问答对  
✅ 阻塞等待 - 工具真正等待用户输入  

## 去掉的元素

❌ 双层边框 - 过于复杂  
❌ 反色标题栏 - 不必要  
❌ 内嵌问题框 - 多余的边框  
❌ "您的回答:" 标签 - `▶` 已经足够清晰  
❌ 边框包裹的提示 - 简化为纯文本  
❌ 💡 图标 - 减少视觉噪音  
❌ "ASK_USER" 工具名 - 历史记录中不需要  
❌ "用户回复:" 标签 - `▶` 已经表明是用户输入  
❌ `→` 箭头 - 不必要的连接符  

## 用户体验改进

### 1. 更少的视觉干扰
- 去掉多余的边框和标签
- 保留核心信息
- 更容易聚焦在问题和输入上

### 2. 更小的屏幕占用
- 从 12 行减少到 6 行
- 在小终端窗口中更友好
- 可以看到更多历史消息

### 3. 更清晰的历史记录
- 问答对格式简洁
- 易于快速扫描
- 缩进表示层次关系

### 4. 保持一致性
- 与其他工具调用的简洁风格一致
- 符合整体 TUI 的极简美学
- 减少认知负担

## 总结

简化后的 UI：
- 🎯 更聚焦 - 去掉不必要的装饰
- 📏 更紧凑 - 占用空间减半
- 👁️ 更清晰 - 问答对易于识别
- 🔄 可翻看 - 历史记录完整保留
- ⚡ 更快速 - 减少渲染元素

同时保留了所有核心功能和黄色主题的醒目特性！
