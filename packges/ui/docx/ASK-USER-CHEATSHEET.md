# ask_user 工具速查表

## 🚀 快速集成（3 步）

### 1. 设置回调
```typescript
const [pendingQuestion, setPendingQuestion] = useState(null);

const { state, submit } = useAgentLoop(config, sessionId, {
    onAskUser: async (question) => {
        return new Promise((resolve) => {
            setPendingQuestion({ question, resolve });
        });
    }
});
```

### 2. 显示模态框
```typescript
{pendingQuestion && (
    <AskUserModal
        question={pendingQuestion.question}
        onSubmit={(answer) => {
            pendingQuestion.resolve(answer);
            setPendingQuestion(null);
        }}
    />
)}
```

### 3. Agent 调用
```typescript
ask_user({ question: "您想要什么？" })
```

## 🎨 颜色速查

| 元素 | 颜色 | 用途 |
|------|------|------|
| 边框 | `yellowBright` | 主强调 |
| 标题背景 | `yellowBright` | 反色标题 |
| 标题文字 | `black` | 反色文字 |
| 问题 | `white`/`yellow` | 问题内容 |
| 输入提示 | `cyanBright` | 用户操作 |
| 用户输入 | `cyan` | 输入文字 |

## 📦 组件 API

### AskUserModal
```typescript
<AskUserModal
    question={string}              // 必需
    onSubmit={(answer) => void}    // 必需
    onCancel={() => void}          // 可选
    showCancelHint={boolean}       // 可选，默认 true
/>
```

**注意：** AskUserModal 使用 Ink 的 `useInput` hook 处理键盘输入，不需要 `ink-text-input` 包。

### AskUserInline
```typescript
<AskUserInline
    question={string}              // 必需
    onSubmit={(answer) => void}    // 必需
/>
```

## 🔧 工具 API

### 设置回调
```typescript
import { setAskUserHandler } from "core/tools/control";

setAskUserHandler(async (question) => {
    // 返回 Promise<string>
    return userInput;
});
```

### 清理回调
```typescript
import { clearAskUserHandler } from "core/tools/control";

clearAskUserHandler();
```

## ⌨️ 输入处理

项目使用 Ink 的 `useInput` hook 而不是 `TextInput` 组件：

```typescript
import { useInput } from "ink";

useInput(
    (char, key) => {
        if (key.return) {
            // 处理 Enter 键
        }
        if (key.backspace || key.delete) {
            // 处理删除
        }
        if (char && !key.ctrl && !key.meta) {
            // 添加字符
        }
    },
    { isActive: true }
);
```

## 📝 常见场景

### 确认操作
```typescript
ask_user({ question: "确认删除吗？(yes/no)" })
```

### 选择选项
```typescript
ask_user({ question: "选择：1) PDF  2) Excel" })
```

### 获取信息
```typescript
ask_user({ question: "请输入 API 密钥：" })
```

## 🎯 视觉效果

### 模态框
```
╔═══════════════════════════════════╗
║  ⚠️  AGENT 正在询问               ║
║  ╭───────────────────────────╮   ║
║  │ 您想要什么？              │   ║
║  ╰───────────────────────────╯   ║
║  您的回答:                        ║
║  ▶ [输入]___________________      ║
╚═══════════════════════════════════╝
```

### 历史记录
```
? ASK_USER → 您想要什么？
  ✓ 用户回复: PDF
```

## 🐛 故障排查

### 模态框不显示
- 检查 `onAskUser` 是否设置
- 检查 `pendingQuestion` 状态

### 输入无反应
- 检查 `useInput` 的 `isActive` 参数
- 检查 `resolve` 是否调用
- 检查状态是否清空

### TextInput 错误
- 项目使用 `useInput` hook，不是 `TextInput` 组件
- 不需要安装 `ink-text-input` 包

### 样式不对
- 检查终端颜色支持
- 检查 Ink 版本（需要 ^5.1.0）

## 📚 文档链接

- [快速开始](./ASK-USER-QUICK-START.md)
- [UI 设计](./ASK-USER-UI-DESIGN.md)
- [视觉演示](./ASK-USER-VISUAL-DEMO.md)
- [技术文档](../../core/docs/ASK-USER-DIRECT-UI.md)
- [完整索引](./ASK-USER-INDEX.md)

## ⌨️ 键盘操作

| 按键 | 功能 |
|------|------|
| `Enter` | 提交答案 |
| `Backspace` / `Delete` | 删除字符 |
| `Ctrl+C` | 取消输入 |
| 字母/数字 | 输入字符 |

## 💡 最佳实践

### ✅ 好的问题
- 具体明确
- 提供选项
- 说明上下文

### ❌ 不好的问题
- 太模糊
- 缺少上下文
- 没有说明

## 🔗 相关文件

```
packges/
├── core/src/tools/control.ts
├── ui/src/
│   ├── hooks/useAgentLoop.ts
│   ├── components/
│   │   ├── AskUserModal.tsx      ← 使用 useInput
│   │   └── PromptInput.tsx       ← useInput 示例
│   └── app.tsx
└── core/test/ask-user-direct.test.ts
```

---

**快速链接：** [索引](./ASK-USER-INDEX.md) | [快速开始](./ASK-USER-QUICK-START.md) | [示例](../src/examples/AskUserExample.tsx)
