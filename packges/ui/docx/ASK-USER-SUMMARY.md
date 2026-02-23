# ask_user 工具 UI 增强总结

## 实现的功能

### ✅ 核心功能
1. **全局回调机制** - 通过 `setAskUserHandler` 实现工具与 UI 的直接连接
2. **Promise 阻塞** - `ask_user` 工具真正等待用户输入，无需 Loop 检测
3. **实时交互** - 用户输入立即返回给 LLM，保持对话连贯性

### ✅ UI 组件
1. **AskUserModal** - 醒目的黄色模态框，双层边框设计
2. **AskUserInline** - 简化版内联输入框
3. **ToolCallLog 增强** - 特殊显示 ask_user 工具调用和答案

### ✅ 视觉设计
1. **黄色主题** - 高度可见，传达"需要注意"的信号
2. **双层边框** - 增强视觉层次，突出重要性
3. **反色标题** - 黑底黄字，最高优先级
4. **清晰提示** - 操作说明一目了然

## 文件清单

### 核心文件
- `packges/core/src/tools/control.ts` - 添加全局回调机制
- `packges/ui/src/hooks/useAgentLoop.ts` - 集成 onAskUser 选项

### UI 组件
- `packges/ui/src/components/AskUserModal.tsx` - 新建模态框组件
- `packges/ui/src/components/ToolCallLog.tsx` - 增强 ask_user 显示
- `packges/ui/src/components/Icon.tsx` - 添加新图标
- `packges/ui/src/app.tsx` - 集成到主应用

### 示例和文档
- `packges/ui/src/examples/AskUserExample.tsx` - 完整使用示例
- `packges/core/docs/ASK-USER-DIRECT-UI.md` - 技术实现文档
- `packges/ui/docx/ASK-USER-UI-DESIGN.md` - UI 设计文档
- `packges/ui/docx/ASK-USER-QUICK-START.md` - 快速开始指南
- `packges/core/test/ask-user-direct.test.ts` - 测试用例

## 视觉效果对比

### 之前（Loop 检测方案）
```
◇ ask_user (args: {"question":"您想要什么？"})
[等待用户手动输入新消息...]
```
- 显示为普通工具调用
- 需要用户主动输入
- 无视觉强调

### 之后（直接 UI 交互）
```
╔═══════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                       ║
╠═══════════════════════════════════════════╣
║ ╭─────────────────────────────────────╮  ║
║ │ 您想要什么？                        │  ║
║ ╰─────────────────────────────────────╯  ║
║ 您的回答:                                ║
║ ▶ [自动聚焦的输入框]                     ║
╚═══════════════════════════════════════════╝
```
- 醒目的黄色模态框
- 自动弹出，输入框聚焦
- 清晰的视觉层次

## 技术亮点

### 1. 真正的阻塞等待
```typescript
export const ask_user = tool({
    execute: async (args) => {
        if (globalAskUserHandler) {
            // 🔥 等待 Promise 完成
            const answer = await globalAskUserHandler(args.question);
            return { status: "answered", answer };
        }
        // 降级方案
        return { status: "waiting_for_user" };
    }
});
```

### 2. React Hook 集成
```typescript
const { state, submit } = useAgentLoop(config, sessionId, {
    onAskUser: async (question) => {
        return new Promise((resolve) => {
            setPendingQuestion({ question, resolve });
        });
    }
});
```

### 3. 自动清理
```typescript
useEffect(() => {
    if (options?.onAskUser) {
        setAskUserHandler(options.onAskUser);
    }
    return () => clearAskUserHandler();
}, [options?.onAskUser]);
```

## 使用流程

```
┌─────────────────────────────────────────┐
│ 1. LLM 调用 ask_user                    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. 工具调用 globalAskUserHandler        │
│    返回 Promise (pending)                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. UI 显示黄色模态框                    │
│    输入框自动聚焦                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. 用户输入答案并按 Enter               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. Promise resolve                      │
│    工具返回答案                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 6. LLM 收到答案，继续执行               │
└─────────────────────────────────────────┘
```

## 颜色方案

| 元素 | 颜色 | 用途 |
|------|------|------|
| 边框 | `yellowBright` | 主要强调，吸引注意 |
| 标题背景 | `yellowBright` | 反色标题，最高优先级 |
| 标题文字 | `black` | 与黄色背景形成对比 |
| 问题文字 | `white` / `yellow` | 清晰可读 |
| 输入提示 | `cyanBright` | 表示用户操作区域 |
| 用户输入 | `cyan` | 与 Agent 输出区分 |
| 操作提示 | `dimColor` / `green` / `red` | 低优先级辅助信息 |

## 图标设计

| 图标 | 符号 | 用途 |
|------|------|------|
| `ask_user` | `?` | 表示询问/问题 |
| `user_reply` | `✓` | 表示用户已回复 |
| `arrow_right` | `→` | 连接问题和答案 |

## 兼容性

### 向后兼容
- 如果不设置 `onAskUser`，自动降级到原有的 Loop 检测方案
- 现有代码无需修改即可继续工作

### 渐进增强
- 设置 `onAskUser` 后立即启用新的实时交互
- 可以根据场景选择使用 Modal 或 Inline 版本

## 测试覆盖

- ✅ 全局回调机制测试
- ✅ Promise 阻塞测试
- ✅ 异步等待测试
- ✅ 错误处理测试
- ✅ 多次调用测试
- ✅ 集成测试

## 下一步优化

### 可能的增强
1. **超时机制** - 添加倒计时，避免无限等待
2. **历史建议** - 显示之前的答案供快速选择
3. **输入验证** - 实时验证用户输入格式
4. **多选/单选** - 支持选项式问答
5. **富文本** - 支持 Markdown 格式的问题

### 主题定制
```typescript
interface AskUserTheme {
    borderColor: string;
    titleBg: string;
    titleColor: string;
    questionColor: string;
    inputColor: string;
}
```

## 总结

通过全局回调 + Promise 机制，结合醒目的黄色 UI 设计，`ask_user` 工具现在能够：

✅ **真正阻塞等待** - 工具执行期间等待用户输入  
✅ **实时交互** - 自动弹出模态框，无需手动触发  
✅ **高度可见** - 黄色主题 + 双层边框，立即吸引注意  
✅ **清晰指引** - 明确的操作提示，降低用户困惑  
✅ **保持连贯** - 用户回复直接返回给 LLM，对话不中断  
✅ **向后兼容** - 可选启用，不影响现有代码  

这是一个完整的、生产就绪的实现方案！
