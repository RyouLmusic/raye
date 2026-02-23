# ask_user 工具 UI 设计

## 设计理念

`ask_user` 工具是 Agent 与用户的关键交互点，需要：
1. **高度可见性** - 用户必须立即注意到 Agent 在等待输入
2. **清晰的上下文** - 问题内容要醒目且易读
3. **明确的操作指引** - 用户知道如何回复
4. **视觉层次** - 与普通消息和工具调用区分开

## 颜色方案

### 主题色：黄色系
- **yellowBright** - 主要强调色，用于标题和边框
- **yellow** - 次要强调色，用于问题文本
- **cyanBright** - 输入提示色
- **cyan** - 用户输入文本色

### 为什么选择黄色？
- ⚠️ 警告/注意的通用色彩语言
- 在深色终端背景下高度可见
- 与其他工具调用（cyan/magenta）形成对比
- 传达"需要用户介入"的紧迫感

## 组件层次

### 1. ToolCallLog 中的显示

```
? ASK_USER → 您想要生成哪种报告？
  ✓ 用户回复: PDF
```

**样式特点：**
- 图标：`?` (问号) - 表示询问
- 工具名：`ASK_USER` (全大写 + bold) - 强调重要性
- 问题：黄色文本
- 答案：青色文本，带 `✓` 图标

### 2. AskUserModal 模态框

```
╔═══════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                       ║
╠═══════════════════════════════════════════╣
║ ╭─────────────────────────────────────╮  ║
║ │ 您想要生成哪种报告？                │  ║
║ ╰─────────────────────────────────────╯  ║
║                                           ║
║ 您的回答:                                ║
║ ▶ [输入框]________________________       ║
║                                           ║
║ ┌─────────────────────────────────────┐  ║
║ │ 💡 按 Enter 提交 | Ctrl+C 取消      │  ║
║ └─────────────────────────────────────┘  ║
╚═══════════════════════════════════════════╝
```

**样式特点：**
- 双层边框（`double` + `round`）- 增强视觉层次
- 反色标题栏（黑底黄字）- 最高优先级
- 内嵌问题框 - 突出问题内容
- 清晰的操作提示 - 降低用户困惑

### 3. AskUserInline 内联版本

```
? 您想要生成哪种报告？
▶ [输入框]________________________
```

**样式特点：**
- 极简设计，适合嵌入式场景
- 保留黄色主题色
- 无边框，减少视觉噪音

## 视觉对比

### 普通工具调用
```
◆ calculate [42 bytes]
```
- 青色 (cyan)
- 简洁的单行显示
- 低视觉优先级

### ask_user 工具调用
```
? ASK_USER → 您想要生成哪种报告？
  ✓ 用户回复: PDF
```
- 黄色 (yellow/yellowBright)
- 多行显示，包含问答对
- 高视觉优先级

### ask_user 模态框
```
╔═══════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                       ║
║ ...                                       ║
╚═══════════════════════════════════════════╝
```
- 黄色边框 + 反色标题
- 占据独立区域
- 最高视觉优先级

## 交互流程

### 1. Agent 调用 ask_user
```typescript
ask_user({ question: "您想要生成哪种报告？" })
```

### 2. UI 显示模态框
- 黄色双层边框弹出
- 问题内容高亮显示
- 输入框自动聚焦

### 3. 用户输入答案
- 实时显示输入内容（青色）
- Enter 提交，Ctrl+C 取消

### 4. 答案返回给 Agent
- 模态框消失
- ToolCallLog 显示问答对
- Agent 继续执行

## 代码示例

### 基础使用
```typescript
import { AskUserModal } from "@/components/AskUserModal";

<AskUserModal
    question="您想要生成哪种报告？"
    onSubmit={(answer) => console.log(answer)}
    showCancelHint={true}
/>
```

### 集成到 App
```typescript
const [pendingQuestion, setPendingQuestion] = useState(null);

const { state, submit } = useAgentLoop(agentConfig, sessionId, {
    onAskUser: async (question) => {
        return new Promise((resolve) => {
            setPendingQuestion({ question, resolve });
        });
    }
});

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

## 可访问性考虑

1. **键盘导航** - 输入框自动聚焦，Enter 提交
2. **清晰提示** - 明确的操作说明
3. **高对比度** - 黄色在深色背景下清晰可见
4. **视觉层次** - 边框和颜色区分不同元素

## 未来扩展

### 可能的增强功能
1. **超时提示** - 显示倒计时
2. **历史建议** - 显示之前的答案
3. **验证提示** - 实时验证用户输入
4. **多选/单选** - 支持选项式问答
5. **富文本问题** - 支持 Markdown 格式

### 主题定制
```typescript
interface AskUserTheme {
    borderColor: string;
    titleColor: string;
    questionColor: string;
    inputColor: string;
}
```

## 总结

通过醒目的黄色主题、双层边框设计和清晰的操作提示，`ask_user` 工具的 UI 能够：
- ✅ 立即吸引用户注意
- ✅ 清晰传达问题内容
- ✅ 提供流畅的输入体验
- ✅ 与其他 UI 元素明确区分

这种设计确保了 Agent 与用户的交互高效、直观且不易出错。
