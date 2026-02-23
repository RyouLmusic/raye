# ask_user 工具快速开始

## 一分钟集成指南

### 1. 在 App 中启用 ask_user

```typescript
import { useState } from "react";
import { useAgentLoop } from "./hooks/useAgentLoop";
import { AskUserModal } from "./components/AskUserModal";

function App() {
    const [pendingQuestion, setPendingQuestion] = useState(null);

    const { state, submit } = useAgentLoop(agentConfig, sessionId, {
        onAskUser: async (question) => {
            return new Promise((resolve) => {
                setPendingQuestion({ question, resolve });
            });
        }
    });

    return (
        <>
            {/* 你的其他 UI */}
            
            {pendingQuestion && (
                <AskUserModal
                    question={pendingQuestion.question}
                    onSubmit={(answer) => {
                        pendingQuestion.resolve(answer);
                        setPendingQuestion(null);
                    }}
                />
            )}
        </>
    );
}
```

### 2. Agent 中使用 ask_user

```typescript
// 在 Agent prompt 中说明
"当需要用户输入时，调用 ask_user 工具"

// LLM 会这样调用
ask_user({ question: "您想要生成哪种报告？" })

// 用户输入后，LLM 收到答案
// { status: "answered", answer: "PDF" }
```

## 视觉效果

### ToolCallLog 显示（历史记录）

```
? ASK_USER → 您想要生成哪种报告？
  ✓ 用户回复: PDF
```

### AskUserModal 显示（实时交互）

```
╔═══════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                       ║
╠═══════════════════════════════════════════╣
║ ╭─────────────────────────────────────╮  ║
║ │ 您想要生成哪种报告？                │  ║
║ ╰─────────────────────────────────────╯  ║
║                                           ║
║ 您的回答:                                ║
║ ▶ PDF_________________________           ║
║                                           ║
║ ┌─────────────────────────────────────┐  ║
║ │ 💡 按 Enter 提交 | Ctrl+C 取消      │  ║
║ └─────────────────────────────────────┘  ║
╚═══════════════════════════════════════════╝
```

## 颜色方案

| 元素 | 颜色 | 说明 |
|------|------|------|
| 边框 | `yellowBright` | 醒目的黄色，吸引注意 |
| 标题 | `black` on `yellowBright` | 反色，最高优先级 |
| 问题 | `yellow` / `white` | 清晰可读 |
| 输入提示 | `cyanBright` | 青色，表示用户操作 |
| 用户输入 | `cyan` | 青色，与 Agent 输出区分 |

## 组件 API

### AskUserModal

```typescript
interface AskUserModalProps {
    question: string;              // 要询问的问题
    onSubmit: (answer: string) => void;  // 提交回调
    onCancel?: () => void;         // 取消回调（可选）
    showCancelHint?: boolean;      // 是否显示取消提示
}
```

### AskUserInline（简化版）

```typescript
interface AskUserInlineProps {
    question: string;
    onSubmit: (answer: string) => void;
}
```

## 常见场景

### 1. 确认操作
```typescript
ask_user({ question: "确认删除 10 个文件吗？(yes/no)" })
```

### 2. 选择选项
```typescript
ask_user({ question: "选择报告格式：1) PDF  2) Excel  3) CSV" })
```

### 3. 获取信息
```typescript
ask_user({ question: "请输入 API 密钥：" })
```

### 4. 澄清需求
```typescript
ask_user({ question: "您是想修改配置文件还是创建新的？" })
```

## 最佳实践

### ✅ 好的问题
- "您想要生成 PDF 还是 Excel 报告？"
- "确认删除这些文件吗？(yes/no)"
- "请选择：1) 继续  2) 取消  3) 重试"

### ❌ 不好的问题
- "怎么办？" (太模糊)
- "请输入" (没说输入什么)
- "是吗？" (缺少上下文)

## 故障排查

### 问题：模态框不显示
**检查：**
1. 是否设置了 `onAskUser` 回调？
2. `pendingQuestion` 状态是否正确更新？
3. 是否有其他组件遮挡？

### 问题：输入后没有反应
**检查：**
1. `onSubmit` 是否正确调用 `resolve`？
2. 是否清空了 `pendingQuestion` 状态？
3. 检查控制台是否有错误

### 问题：样式不正确
**检查：**
1. 终端是否支持颜色？
2. Ink 版本是否兼容？
3. 是否有自定义主题覆盖？

## 完整示例

参见：
- `packges/ui/src/examples/AskUserExample.tsx` - 完整示例
- `packges/ui/src/app.tsx` - 主应用集成
- `packges/core/docs/ASK-USER-DIRECT-UI.md` - 技术文档

## 下一步

- 📖 阅读 [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md) 了解设计理念
- 🔧 查看 [ASK-USER-DIRECT-UI.md](../core/docs/ASK-USER-DIRECT-UI.md) 了解实现细节
- 🧪 运行 `packges/core/test/ask-user-direct.test.ts` 测试功能
