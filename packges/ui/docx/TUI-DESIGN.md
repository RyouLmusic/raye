# TUI 设计方案：将 executeLoop 输出接入终端交互界面

## 1. 目标

将 `AgentLoop.executeLoop` 产生的所有 AI 输出（streaming 文本、推理过程、工具调用）实时展示在 TUI 中，并在每轮 Loop 结束后通过 TUI 接受用户的下一轮输入，维持持续的终端对话体验。

---

## 2. 现有架构分析

```
LoopInput
   │
   ▼
AgentLoop.loop()              ← 外层 ReAct 状态机
   │  PLANNING → EXECUTING → OBSERVING → COMPACTING → COMPLETED/FAILED
   │
   ▼
Processor.execute()           ← 内层 LLM 状态机
   │  CALLING → STREAMING → TOOL_EXECUTING → SUCCESS/ERROR
   │
   ▼
processFullStream()           ← StreamHandlers 回调系统
       reasoning.onDelta
       text.onDelta
       tool.onCall / onResult
       onFinish / onError
```

**关键约束：**

- `processFullStream` 已经用回调（`StreamHandlers`）暴露所有流式事件，是天然的 UI 接入点。  
- `executeLoop` 目前所有输出都走 `console.log`，没有结构化事件总线。  
- `LoopInput` 是整个循环的唯一外部输入，是最干净的扩展位置。  
- `AgentLoop.loop()` 返回 `Promise`，在 resolve 之前 TUI 需要保持渲染，resolve 之后等待用户下一次输入。

---

## 3. 核心设计：LoopObserver 接口（修订版）

### 3.0 设计问题诊断

一个完整的 Loop 迭代实际包含 **三次独立的 LLM 调用**，每次都有自己的 `processFullStream`：

```
PLANNING (iter=1)  → Processor.plan()    → processFullStream  [hardcoded console.log]
PLANNING (iter>1)  → Processor.reason()  → processFullStream  [hardcoded console.log]
EXECUTING          → Processor.execute() → processFullStream  [hardcoded console.log]
```

原始设计将所有流式回调打平在 `LoopObserver` 一级，存在两个根本缺陷：

1. **语义混淆**：`onTextDelta` 无法区分当前是 plan/reason/execute 哪个阶段在输出，TUI 无法差异化渲染。
2. **注入路径缺失**：`Processor.plan(messages)` 和 `Processor.reason(messages)` 的签名不接受 `StreamHandlers`，observer 的 streaming 回调根本无从注入，只能继续走 hardcoded `console.log`。

修订后的设计同时解决这两个问题。

### 3.1 为什么选择 Observer 而不是 EventEmitter 或 RxJS？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **LoopObserver 接口（本方案）** | 与现有 `StreamHandlers` 风格一致；无额外依赖；TypeScript 类型完善 | - |
| EventEmitter | Node.js 原生，松耦合 | 丢失类型安全；事件名字符串容易写错 |
| RxJS Observable | 强大的流操作符 | 引入重依赖；overkill |

### 3.2 修订后的 LoopObserver 接口定义

**核心思路**：`LoopObserver` 的流式回调段直接复用 `StreamHandlers` 类型，并按 processor 阶段分组。每个阶段对应一个独立的 `StreamHandlers`，可以在 TUI 侧差异化渲染。

在 `packges/core/src/session/type.ts` 追加：

```typescript
import type { StreamHandlers } from "@/session/stream-handler";

/**
 * Loop 事件观察者接口
 * TUI / CLI / 其他 UI 层实现此接口，注入到 LoopInput 中
 * 所有方法均为可选，按需实现
 */
export interface LoopObserver {
  // ── 外层状态机事件 ──────────────────────────────────────
  /** Loop 整体开始 */
  onLoopStart?: (sessionId: string) => void;
  /** 状态发生转换 */
  onStateChange?: (from: AgentLoopState, to: AgentLoopState, iteration: number) => void;
  /** 每轮迭代开始 */
  onIterationStart?: (iteration: number, maxIterations: number) => void;
  /** 每轮迭代结束 */
  onIterationEnd?: (iteration: number) => void;
  /** Loop 整体完成 */
  onLoopEnd?: (result: { success: boolean; iterations: number; error?: Error }) => void;
  /** 错误（带发生时的 Loop 状态） */
  onError?: (error: Error, state: AgentLoopState) => void;

  // ── 按 Processor 阶段分组的流式回调 ──────────────────────
  /**
   * 首轮全局规划（PLANNING iter=1）的流式回调
   * 对应 Processor.plan() → processFullStream
   * TUI 建议展示为「折叠的 Thinking 块」
   */
  planHandlers?: StreamHandlers;

  /**
   * 后续轮即时推理（PLANNING iter>1）的流式回调
   * 对应 Processor.reason() → processFullStream
   * TUI 建议展示为「折叠的 Thinking 块」（与 plan 相同样式）
   */
  reasonHandlers?: StreamHandlers;

  /**
   * 主执行阶段（EXECUTING）的流式回调
   * 对应 Processor.execute() → processFullStream
   * TUI 展示为「主回复区」，工具调用展示为独立 ToolCallLog 条目
   */
  executeHandlers?: StreamHandlers;
}
```

在 `LoopInput` 中增加可选字段：

```typescript
export type LoopInput = {
  // ... 原有字段不变 ...
  /** 可选的 UI 观察者，注入后 Loop 会在关键节点回调 */
  observer?: LoopObserver;
};
```

### 3.3 Planner / Reasoner 接口需同步修改

`plan()` 和 `reason()` 当前签名不接受 `StreamHandlers`，需要扩展：

```typescript
// packges/core/src/session/processor/planner.ts
export interface Planner {
  plan(
    messages: readonly ModelMessage[],
    handlers?: StreamHandlers   // 新增：允许外部注入回调
  ): Promise<StreamTextResult<ToolSet, never>>;
}

// packges/core/src/session/processor/reasoner.ts
export interface Reasoner {
  reason(
    messages: readonly ModelMessage[],
    handlers?: StreamHandlers   // 新增：允许外部注入回调
  ): Promise<StreamTextResult<ToolSet, never>>;
}
```

实现内部逻辑：`handlers` 有值时使用外部传入的 handlers，没有时降级到原有的 `console.log` handlers（保持后向兼容）：

```typescript
async function plan(
  messages: readonly ModelMessage[],
  handlers?: StreamHandlers
): Promise<StreamTextResult<ToolSet, never>> {
  const result = await streamTextWrapper({ agent: planAgent, messages: [...messages] });

  await processFullStream(result, {
    handlers: handlers ?? defaultPlanHandlers,  // fallback 保持现有 console.log 行为
  });

  return result;
}
```

同理，`Executor` 的 `ExecuteInput` 也需增加 `streamHandlers?: StreamHandlers`。

### 3.4 loop.ts 中的调用点

现在三处 LLM 调用都可以接收 observer 注入的 handlers：

```typescript
// ── PLANNING 状态 ──────────────────────────────────────
if (context.iteration === 1) {
  // 首轮：全局规划，注入 planHandlers
  await Processor.plan({
    messages: context.session.messages,
    handlers: input.observer?.planHandlers,
  });
} else {
  // 后续轮：即时推理，注入 reasonHandlers
  await Processor.reason({
    messages: context.session.messages,
    handlers: input.observer?.reasonHandlers,
  });
}

// ── EXECUTING 状态 ─────────────────────────────────────
const result = await Processor.execute({
  agent: input.agentConfig,
  messages: [...context.session.messages],
  maxRetries: input.agentConfig.max_retries ?? 3,
  streamHandlers: input.observer?.executeHandlers,
});
```

### 3.5 为什么 planHandlers / reasonHandlers 不能在 Processor 内部实现？

这是最核心的架构问题。表面上看，在 `planner.ts` 内部直接持有 UI 回调更简单，为什么要绕这么大一圈？

**根本原因：Processor 是无状态的 session-agnostic 执行单元，它不拥有也不应该拥有 session 上下文。**

#### 问题 1：并发 Session 会产生回调污染

`Processor` 是全局单例（`export const Processor = createProcessor()`）。如果把 UI 回调存在 Processor 实例内部：

```
Session A 的 Loop ─→ Processor.plan(...)  ┐
Session B 的 Loop ─→ Processor.plan(...)  ┘ 同一个 Processor 实例

Processor 内部持有的 handlers 属于哪个 Session？
→ 无法区分，Session A 的输出会出现在 Session B 的 TUI 里
```

而本方案中，handlers 作为 `PlanInput` 的字段随调用栈传入，每次调用完全隔离——Session A 的 `planHandlers` 和 Session B 的 `planHandlers` 是不同对象，不共享任何状态。

#### 问题 2：Observer 的生命周期属于 Loop 调用，不属于 Processor

一次 `AgentLoop.loop()` 调用代表一个独立的用户交互轮次，observer 在这次调用开始时由 TUI 创建，结束时销毁。Processor 是跨越多次调用复用的单例，它没有"一次 loop 调用"的生命周期概念，无法知道何时该注册/注销回调。

```
用户调用 AgentLoop.loop({ observer })
           ↓
    observer 生命周期开始
    Processor.plan({ handlers: observer.planHandlers })   ← handlers 跟随调用
    Processor.reason({ handlers: observer.reasonHandlers })
    Processor.execute({ streamHandlers: observer.executeHandlers })
    observer.onLoopEnd()
    observer 生命周期结束（可以被 GC 回收）
           ↑
    下次 loop() 调用会传入新的 observer
```

若 handlers 存在 Processor 内部，Processor 需要一个 `register/unregister` 机制来跟踪生命周期，等价于重新发明了一个残缺版的 EventEmitter，反而更复杂。

#### 问题 3：Session 管理边界

`SessionContext.run(session, fn)` 在 `loop.ts` 中建立了 session 的执行边界。Processor 通过 `SessionContext.current()` 读取当前 session，但它只读取不写入 UI 状态。

如果 Processor 持有 UI 回调，就隐式地把"UI 层知识"嵌入了"LLM 调用层"，破坏了分层边界：

```
loop.ts       ← 会话管理层（拥有 session + observer 生命周期）
processor/    ← LLM 执行层（无状态，仅执行 LLM 调用和工具调用）
stream-handler.ts ← 流处理层（解析流式事件，调用传入的回调）
```

**结论**：handlers 在 `loop.ts` 层组装并通过 input 下传，是唯一符合这三层职责划分的做法。

---

## 4. TUI 层设计

### 4.1 技术选型：ink（React for CLI）

| 库 | 适合场景 | 理由 |
|----|---------|------|
| **ink** | 组件化 TUI，实时更新 | 与 TypeScript 天然契合；组件模型与 React 一致；状态驱动渲染非常适合 streaming 场景；Bun 支持良好 |
| blessed | 传统 TUI，复杂布局 | API 较底层，维护成本高 |
| chalk + readline | 简单日志型 | 无法做布局管理和实时局部刷新 |

**选择 ink** 的核心原因：streaming 文本更新就是状态变化（`delta` → `setState` → 局部重渲染），这正是 React 模型的强项。

### 4.2 包目录结构

```
packges/ui/
├── package.json              # 依赖: ink, react, @core/session
├── src/
│   ├── tui.tsx               # 入口：启动 ink 渲染根组件
│   ├── app.tsx               # <App> 根组件，管理整体 UI 状态
│   ├── hooks/
│   │   ├── useAgentLoop.ts   # 核心 Hook：驱动 AgentLoop，暴露渲染状态
│   │   └── useInput.ts       # 处理用户键盘输入（ink useInput）
│   └── components/
│       ├── MessageList.tsx   # 历史消息列表（已完成的轮次）
│       ├── StreamingBlock.tsx # 当前正在 streaming 的文本（实时）
│       ├── ThinkingBlock.tsx  # 推理过程展示（可折叠）
│       ├── ToolCallLog.tsx    # 工具调用条目
│       ├── StatusBar.tsx      # 底部状态栏：当前 Loop 状态 + 迭代计数
│       └── PromptInput.tsx    # 用户输入框（Loop 结束后激活）
└── docx/
    └── TUI-DESIGN.md         # 本文档
```

### 4.3 UI 布局

```
┌──────────────────────────────────────────────┐
│ raye  ·  session: abc123  ·  iter: 3/10      │  ← StatusBar
├──────────────────────────────────────────────┤
│                                              │
│  [user] 请帮我分析这段代码                    │  ← MessageList
│                                              │
│  [thinking] ···▊                             │  ← ThinkingBlock (折叠)
│  [assistant] 好的，我来分析···▊              │  ← StreamingBlock
│                                              │
│  [tool] calculate({"expr":"1+1"})  ✓ 2      │  ← ToolCallLog
│                                              │
│  [assistant] 分析结果如下：···               │
│                                              │
├──────────────────────────────────────────────┤
│ > _                                          │  ← PromptInput（等待输入时激活）
└──────────────────────────────────────────────┘
```

### 4.4 核心 Hook：useAgentLoop

这是连接 core 和 UI 的关键层，职责：
1. 构建 `LoopObserver`，将三个阶段的 `StreamHandlers` 分别映射到不同 React state 字段
2. 暴露 `submit(message)` 方法供 `PromptInput` 调用
3. 暴露 `isRunning` 状态控制输入框是否可用

```typescript
// packges/ui/src/hooks/useAgentLoop.ts
import { useState, useCallback } from 'react';
import { AgentLoop } from '@raye/core';
import type { LoopObserver, AgentLoopState } from '@raye/core';

export interface TurnMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  // 仅 tool 角色使用
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  // 区分消息来源阶段（用于 TUI 差异化渲染）
  phase?: 'plan' | 'reason' | 'execute';
}

export interface AgentLoopUIState {
  /** 已完成的消息列表（含 user/assistant/tool，带 phase 标记） */
  messages: TurnMessage[];
  /**
   * 分阶段的实时流式文本（streaming 中）
   * plan/reason 阶段展示为折叠的 ThinkingBlock
   * execute 阶段展示为主回复区 StreamingBlock
   */
  streaming: {
    plan: string;
    reason: string;
    execute: string;
  };
  /** 当前 Loop 状态 */
  loopState: AgentLoopState | 'IDLE';
  /** 当前迭代次数 */
  iteration: number;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 错误信息 */
  error?: string;
}

export function useAgentLoop(agentConfig: AgentConfig, sessionId: string) {
  const [state, setState] = useState<AgentLoopUIState>({
    messages: [],
    streaming: { plan: '', reason: '', execute: '' },
    loopState: 'IDLE',
    iteration: 0,
    isRunning: false,
  });

  const buildObserver = useCallback((): LoopObserver => ({
    // ── Loop 级别事件 ──────────────────────────────────────
    onLoopStart: () =>
      setState(s => ({
        ...s,
        isRunning: true,
        streaming: { plan: '', reason: '', execute: '' },
      })),

    onStateChange: (_, to, iteration) =>
      setState(s => ({ ...s, loopState: to, iteration })),

    onLoopEnd: ({ success, error }) =>
      setState(s => ({
        ...s,
        isRunning: false,
        loopState: success ? 'COMPLETED' : 'FAILED',
        error: error?.message,
      })),

    onError: (error, loopState) =>
      setState(s => ({ ...s, error: `[${loopState}] ${error.message}` })),

    // ── 首轮全局规划阶段 → streaming.plan ─────────────────
    planHandlers: {
      reasoning: {
        onDelta: (text) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, plan: s.streaming.plan + text },
          })),
        onEnd: (fullText) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, plan: '' },
            // plan 阶段的推理结果作为一条「内部思考」消息归档
            messages: [...s.messages, { role: 'assistant', content: fullText, phase: 'plan' }],
          })),
      },
      text: {
        onDelta: (text) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, plan: s.streaming.plan + text },
          })),
        onEnd: (fullText) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, plan: '' },
            messages: [...s.messages, { role: 'assistant', content: fullText, phase: 'plan' }],
          })),
      },
    },

    // ── 后续轮即时推理阶段 → streaming.reason ──────────────
    reasonHandlers: {
      reasoning: {
        onDelta: (text) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, reason: s.streaming.reason + text },
          })),
        onEnd: (fullText) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, reason: '' },
            messages: [...s.messages, { role: 'assistant', content: fullText, phase: 'reason' }],
          })),
      },
      text: {
        onDelta: (text) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, reason: s.streaming.reason + text },
          })),
        onEnd: (fullText) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, reason: '' },
            messages: [...s.messages, { role: 'assistant', content: fullText, phase: 'reason' }],
          })),
      },
    },

    // ── 主执行阶段 → streaming.execute + 工具调用 ──────────
    executeHandlers: {
      text: {
        onDelta: (text) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, execute: s.streaming.execute + text },
          })),
        onEnd: (fullText) =>
          setState(s => ({
            ...s,
            streaming: { ...s.streaming, execute: '' },
            messages: [...s.messages, { role: 'assistant', content: fullText, phase: 'execute' }],
          })),
      },
      tool: {
        onCall: (id, name, args) =>
          setState(s => ({
            ...s,
            messages: [
              ...s.messages,
              { role: 'tool', content: '', toolName: name, toolArgs: args, phase: 'execute' },
            ],
          })),
        onResult: (id, name, result) =>
          setState(s => {
            const msgs = [...s.messages];
            const idx = msgs.findLastIndex(m => m.role === 'tool' && m.toolName === name);
            if (idx !== -1) msgs[idx] = { ...msgs[idx], toolResult: result };
            return { ...s, messages: msgs };
          }),
      },
    },
  }), []);

  const submit = useCallback(async (userMessage: string) => {
    setState(s => ({
      ...s,
      messages: [...s.messages, { role: 'user', content: userMessage }],
    }));

    await AgentLoop.loop({
      sessionId,
      agentConfig,
      message: { role: 'user', content: userMessage },
      observer: buildObserver(),
    });
  }, [sessionId, agentConfig, buildObserver]);

  return { state, submit };
}
```

### 4.5 根组件 App

三个阶段的流式文本对应三个不同的视觉区域：
- `plan` / `reason` → `ThinkingBlock`（折叠，标注阶段标签）  
- `execute` → `StreamingBlock`（主回复区）

```typescript
// packges/ui/src/app.tsx
import React from 'react';
import { Box } from 'ink';
import { useAgentLoop }   from './hooks/useAgentLoop';
import { MessageList }    from './components/MessageList';
import { StreamingBlock } from './components/StreamingBlock';
import { ThinkingBlock }  from './components/ThinkingBlock';
import { StatusBar }      from './components/StatusBar';
import { PromptInput }    from './components/PromptInput';

export function App({ agentConfig, sessionId }: AppProps) {
  const { state, submit } = useAgentLoop(agentConfig, sessionId);
  const { streaming } = state;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar loopState={state.loopState} iteration={state.iteration} sessionId={sessionId} />
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {/* 历史消息（含 phase 标记，由 MessageList 差异化渲染） */}
        <MessageList messages={state.messages} />
        {/* 实时流式区：plan/reason 相同样式，execute 独立样式 */}
        {streaming.plan    && <ThinkingBlock label="Planning" text={streaming.plan} />}
        {streaming.reason  && <ThinkingBlock label="Reasoning" text={streaming.reason} />}
        {streaming.execute && <StreamingBlock text={streaming.execute} />}
      </Box>
      <PromptInput
        disabled={state.isRunning}
        onSubmit={submit}
        error={state.error}
      />
    </Box>
  );
}
```

---

## 5. 数据流全景

```
用户在 PromptInput 输入并回车
          │
          ▼
  useAgentLoop.submit(message)
          │
          ├─ setState: messages += {role:'user', content}
          │
          ▼
  AgentLoop.loop({ ..., observer })                   ← core 层
          │
          ├─ observer.onLoopStart()                   → isRunning = true
          │
          ├─ [PLANNING, iter=1]
          │     observer.onStateChange()              → loopState = 'PLANNING'
          │     Processor.plan(msgs, planHandlers)
          │       planHandlers.text.onDelta()         → streaming.plan += delta
          │       planHandlers.text.onEnd()           → messages += {phase:'plan'}
          │                                             streaming.plan = ''
          │
          ├─ [EXECUTING]
          │     observer.onStateChange()              → loopState = 'EXECUTING'
          │     Processor.execute({ executeHandlers })
          │       executeHandlers.text.onDelta()      → streaming.execute += delta
          │       executeHandlers.tool.onCall()       → messages += tool entry
          │       executeHandlers.tool.onResult()     → update tool entry
          │       executeHandlers.text.onEnd()        → messages += {phase:'execute'}
          │                                             streaming.execute = ''
          │
          ├─ [OBSERVING] → [PLANNING iter>1 / COMPLETED]
          │
          ├─ [PLANNING, iter>1]
          │     Processor.reason(msgs, reasonHandlers)
          │       reasonHandlers.text.onDelta()       → streaming.reason += delta
          │       reasonHandlers.text.onEnd()         → messages += {phase:'reason'}
          │                                             streaming.reason = ''
          │     → [EXECUTING] 再次执行 ...
          │
          └─ observer.onLoopEnd()                     → isRunning = false
                    │
                    ▼
          PromptInput 重新激活，等待下一轮输入
```

---

## 6. 实现步骤

| 步骤 | 位置 | 内容 |
|------|------|------|
| 1 | `core/src/session/type.ts` | 添加 `LoopObserver` 接口（含 `planHandlers/reasonHandlers/executeHandlers`），`LoopInput` 增加 `observer?` |
| 2 | `core/src/session/processor/planner.ts` | `plan()` 签名增加可选 `handlers?: StreamHandlers`，内部使用 `handlers ?? defaultPlanHandlers` |
| 3 | `core/src/session/processor/reasoner.ts` | 同上，`reason()` 增加 `handlers?: StreamHandlers` |
| 4 | `core/src/session/processor/executor.ts` | `ExecuteInput` 增加 `streamHandlers?: StreamHandlers`，透传给 `processFullStream` |
| 5 | `core/src/session/processor/index.ts` | `Processor` 接口同步更新 `plan/reason` 签名 |
| 6 | `core/src/session/loop.ts` | PLANNING 状态传入 `observer?.planHandlers / reasonHandlers`；EXECUTING 传入 `observer?.executeHandlers`；状态转换处调用 `observer.onStateChange` 等 |
| 7 | `ui/package.json` | 添加依赖 `ink`, `react`, `@types/react` |
| 8 | `ui/src/hooks/useAgentLoop.ts` | 实现三阶段 `StreamHandlers` → `streaming.{plan,reason,execute}` state 桥接 |
| 9 | `ui/src/components/*` | 实现各 TUI 组件（`ThinkingBlock` 复用于 plan/reason，`StreamingBlock` 用于 execute） |
| 10 | `ui/src/app.tsx` + `ui/src/tui.tsx` | 组装根组件，启动 ink render |

---

## 7. 关键设计决策说明

### 7.1 为什么在 LoopInput 中注入 observer，而不是让 UI 直接包裹 loop？

直接拦截 `console.log` 或 monkey-patch 函数会破坏测试稳定性和类型安全。`LoopInput.observer` 是显式契约，允许 core 的测试继续用 `undefined` observer 跑，TUI 层只需注入实现。

### 7.2 为什么按 Processor 阶段（plan/reason/execute）分组，而不是按 reasoning/text 流类型分组？

不同阶段对用户的语义完全不同：
- `plan`：全局规划，用户可以理解为「AI 在分解任务」
- `reason`：局部推理，用户可以理解为「AI 在决定下一步」
- `execute`：主回复，是用户最关心的内容

如果只按流类型（`reasoning`/`text`）分组，TUI 无法区分当前是哪个语义阶段在输出，无法差异化展示。分阶段设计才能让 TUI 给用户正确的上下文提示。

### 7.3 为什么 `plan/reason` 阶段也需要单独的 StreamHandlers，而不是只在 EXECUTING 监听？

`planner.ts` 和 `reasoner.ts` 各自内部调用了独立的 `processFullStream`，目前硬编码了 `console.log` 回调。如果只改 `executor.ts`，plan/reason 阶段的 LLM 输出仍然只打到 terminal，TUI 完全看不到，用户感知断层。

### 7.4 为什么修改 `Planner.plan()` / `Reasoner.reason()` 签名而不是在外层包裹它们？

在 `loop.ts` 外层 monkey-patch 或 proxy 需要拦截 `processFullStream` 内部的对象引用，极其脆弱。直接扩展函数签名是最干净的方式，且新增参数为可选，完全后向兼容——不传 `handlers` 时降级到原有 `console.log` 行为，不影响现有测试。

### 7.5 为什么 `onTextEnd` 才把 assistant 消息推入 messages，而不是 `onTextDelta` 逐步追加？

`streaming.{plan,reason,execute}` 用于实时展示当前流式输出，`messages` 保存已完成消息的历史记录。两者分离使得「正在生成」和「已完成」在视觉上有明确区分，且避免频繁 setState 触发全量列表重渲染。

### 7.6 PromptInput 的 disabled 控制

`state.isRunning === true` 时输入框 disabled，保证用户不会在 Loop 执行中提交新消息导致并发混乱。Loop 结束后自动激活，体验上类似 Claude.ai 的交互模式。
