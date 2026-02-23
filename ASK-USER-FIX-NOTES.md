# ask_user 工具 TextInput 错误修复说明

## 问题

运行时出现错误：
```
SyntaxError: Export named 'TextInput' not found in module 'ink'
```

## 原因

项目使用的是 Ink v5.1.0，该版本的核心包不包含 `TextInput` 组件。`TextInput` 是一个独立的包 `ink-text-input`，但项目选择使用 Ink 内置的 `useInput` hook 来处理键盘输入。

## 解决方案

将所有使用 `TextInput` 的地方改为使用 `useInput` hook。

### 修改前
```typescript
import { Box, Text, TextInput } from "ink";

<TextInput 
    value={input}
    onChange={setInput}
    onSubmit={handleSubmit}
    placeholder="输入您的答案..."
    focus={true}
/>
```

### 修改后
```typescript
import { Box, Text, useInput } from "ink";

const [input, setInput] = useState("");

useInput(
    (char, key) => {
        if (key.return) {
            // 处理 Enter 键提交
            const trimmed = input.trim();
            if (trimmed) {
                onSubmit(trimmed);
                setInput("");
            }
            return;
        }

        if (key.backspace || key.delete) {
            // 处理删除
            setInput(v => v.slice(0, -1));
            return;
        }

        // 过滤控制字符，添加普通字符
        if (char && !key.ctrl && !key.meta) {
            setInput(v => v + char);
        }
    },
    { isActive: true }
);

// 显示输入
<Box>
    <Text color="cyan">▶ </Text>
    <Text color="white">{input}</Text>
    <Text color="cyan">_</Text>
</Box>
```

## 修改的文件

### 1. `packges/ui/src/components/AskUserModal.tsx`
- ✅ 将 `TextInput` 改为 `useInput`
- ✅ 添加键盘事件处理
- ✅ 手动渲染输入文本和光标

### 2. `packges/ui/src/examples/AskUserExample.tsx`
- ✅ 将 `TextInput` 改为 `useInput`
- ✅ 添加键盘事件处理
- ✅ 修复 AgentConfig 类型错误

### 3. `packges/ui/docx/ASK-USER-CHEATSHEET.md`
- ✅ 更新文档说明使用 `useInput`
- ✅ 添加输入处理示例
- ✅ 更新故障排查部分

## useInput Hook 使用指南

### 基本用法
```typescript
import { useInput } from "ink";

useInput(
    (char, key) => {
        // char: 输入的字符（如 'a', 'b', '1'）
        // key: 特殊键对象
        //   - key.return: Enter 键
        //   - key.backspace: Backspace 键
        //   - key.delete: Delete 键
        //   - key.ctrl: Ctrl 键是否按下
        //   - key.meta: Meta/Alt 键是否按下
    },
    { isActive: true }  // 是否激活输入监听
);
```

### 常见模式

#### 1. 文本输入
```typescript
const [input, setInput] = useState("");

useInput((char, key) => {
    if (key.backspace || key.delete) {
        setInput(v => v.slice(0, -1));
        return;
    }
    if (char && !key.ctrl && !key.meta) {
        setInput(v => v + char);
    }
}, { isActive: true });
```

#### 2. Enter 提交
```typescript
useInput((char, key) => {
    if (key.return) {
        onSubmit(input);
        setInput("");
    }
}, { isActive: true });
```

#### 3. Ctrl+C 取消
```typescript
useInput((char, key) => {
    if (key.ctrl && char === 'c') {
        onCancel();
    }
}, { isActive: true });
```

#### 4. 条件激活
```typescript
// 只在模态框显示时激活输入
useInput(
    (char, key) => { /* ... */ },
    { isActive: !!pendingQuestion }
);
```

## 视觉效果

### 输入显示
```typescript
<Box>
    <Text color="cyan">▶ </Text>
    <Text color="white">{input}</Text>
    <Text color="cyan">_</Text>  {/* 光标 */}
</Box>
```

效果：
```
▶ Hello World_
```

## 参考实现

项目中已有的 `PromptInput` 组件是一个完整的 `useInput` 使用示例：
- 文件：`packges/ui/src/components/PromptInput.tsx`
- 功能：处理用户输入、Enter 提交、Backspace 删除
- 可以作为参考模板

## 验证

运行以下命令验证修复：
```bash
bun packges/ui/src/tui.tsx
```

应该不再出现 `TextInput not found` 错误。

## 总结

- ❌ 不要使用 `TextInput` 组件（需要额外安装 `ink-text-input`）
- ✅ 使用 Ink 内置的 `useInput` hook
- ✅ 手动管理输入状态和渲染
- ✅ 更灵活，更符合项目风格

这种方式与项目现有的 `PromptInput` 组件保持一致，无需额外依赖。
