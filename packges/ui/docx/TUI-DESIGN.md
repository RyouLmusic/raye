# TUI 设计方案：将 AgentLoop 输出接入终端交互界面

> **文档版本**：v2（2026-02）  
> **状态**：与当前实现对齐 — 所有章节均反映已落地的代码，不含待议 TODO

---

## 1. 目标

将 `AgentLoop.loop` 产生的所有 AI 输出（streaming 文本、推理过程、工具调用）实时展示在 TUI 中，  
并在每轮 Loop 结束后通过 TUI 接受用户的下一轮输入，维持持续的终端对话体验。

---

## 2. 现有架构

```
LoopInput（含 observer? + message + agentConfig + maxIterations ...）
   │
   ▼
AgentLoop.loop()              ← 外层 ReAct 状态机
   │  INIT → PLANNING → EXECUTING → OBSERVING → COMPACTING → COMPLETED/FAILED
   │
   ├─ [PLANNING, iter=1]  → Processor.plan(PlanInput)      → processFullStream
   ├─ [PLANNING, iter>1]  → Processor.reason(ReasonInput)  → processFullStream
   └─ [EXECUTING]         → Processor.execute(ExecuteInput) → processFullStream
                                    ↓
                          processResutlToSession()   ← 将 ProcessorStepResult 写入 Session
```

**关键约束**

| 约束点 | 说明 |
|--------|------|
| `StreamHandlers` | `processFullStream` 的唯一 UI 接入点，包含 `reasoning / text / tool / step / onError / onFinish` 六个子处理器 |
| `LoopObserver` | TUI 注入到 `LoopInput.observer`，按阶段分组（`planHandlers / reasonHandlers / executeHandlers`） + Loop 级别事件 |
| `Processor` 是无状态单例 | handlers 必须随调用栈传入，不能存在 Processor 内部（见 §3.3） |
| `processResutlToSession` | Processor 返回 `ProcessorStepResult`，由 `loop.ts` 负责写入 Session；两者职责界清 |
| `SessionContext` | `loop.ts` 建立 Session 执行边界，Processor 通过 `SessionContext.current()` 只读访问 |

---

## 3. 核心设计：LoopObserver 接口（已实现）

### 3.1 为什么选择 Observer 而不是 EventEmitter 或 RxJS？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **LoopObserver（本方案）** | 与 `StreamHandlers` 风格一致；无额外依赖；TypeScript 类型完善 | — |
| EventEmitter | Node.js 原生，松耦合 | 丢失类型安全；事件名字符串易出错 |
| RxJS Observable | 强大流操作符 | 重依赖；overkill |

### 3.2 LoopObserver 接口（`core/src/session/type.ts`）

```typescript
export interface LoopObserver {
  // ── 外层状态机生命周期 ────────────────────────────────
  /** Loop 整体开始（session 已就绪，首条消息已写入） */
  onLoopStart?: (sessionId: string) => void;
  /** 外层状态机发生状态转换 */
  onStateChange?: (from: AgentLoopState, to: AgentLoopState, iteration: number) => void;
  /** 每轮迭代开始（iteration 从 1 计数） */
  onIterationStart?: (iteration: number, maxIterations: number) => void;
  /** 每轮迭代结束 */
  onIterationEnd?: (iteration: number) => void;
  /** Loop 整体结束（成功或失败） */
  onLoopEnd?: (result: { success: boolean; iterations: number; error?: Error }) => void;
  /** 任意阶段发生错误 */
  onError?: (error: Error, state: AgentLoopState) => void;

  // ── 按 Processor 阶段分组的流式回调 ─────────────────
  /** 首轮全局规划（PLANNING iter=1）→ TUI 渲染为折叠 ThinkingBlock */
  planHandlers?: StreamHandlers;
  /** 后续轮即时推理（PLANNING iter>1）→ TUI 渲染为折叠 ThinkingBlock */
  reasonHandlers?: StreamHandlers;
  /** 主执行阶段（EXECUTING）→ TUI 渲染为主回复区 + ToolCallLog */
  executeHandlers?: StreamHandlers;
}
```

`LoopInput` 中增加可选字段（已实现）：

```typescript
export type LoopInput = z.infer<typeof loopInput> & {
  observer?: LoopObserver;
};
// loopInput schema 包含：sessionId / agentConfig / message / maxIterations / compactThreshold / maxTokens
```

### 3.3 Processor 输入类型（已实现）

三个阶段的输入类型均已在 `type.ts` 定义，`handlers` 为可选字段：

```typescript
// PlanInput — 首轮全局规划
export type PlanInput = z.infer<typeof planInput> & {
  handlers?: StreamHandlers;  // 未提供时降级到 defaultPlanHandlers
};

// ReasonInput — 后续轮即时推理
export type ReasonInput = z.infer<typeof reasonInput> & {
  handlers?: StreamHandlers;  // 未提供时降级到 defaultReasonHandlers
};

// ExecuteInput — 主执行阶段
export interface ExecuteInput {
  agent: AgentConfig;
  messages: ModelMessage[];
  tools?: ToolSet;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  maxRetries?: number;
  timeout?: number;
  abortSignal?: AbortSignal;
  streamHandlers?: StreamHandlers;  // 未提供时降级到 defaultExecuteHandlers
}
```

**降级保障**：`handlers` 未注入时，各 Processor 内部使用 `defaultXxxHandlers`（console.log 输出），保持后向兼容，不影响现有测试。

### 3.4 Planner 接口签名（已实现）

`Planner.plan(input: PlanInput)` 接受 **单个对象参数**（而非两个独立参数）：

```typescript
export interface Planner {
  plan(input: PlanInput): Promise<ProcessorStepResult>;
}
```

内部通过 `mergedHandlers` 拦截 `onFinish` 来捕获完整输出，同时透传给外部的 `onFinish`：

```typescript
const baseHandlers = handlers ?? defaultPlanHandlers;
const mergedHandlers: StreamHandlers = {
  ...baseHandlers,
  onFinish: async (result) => {
    captured = { ...result };
    await baseHandlers.onFinish?.(result);  // 透传，支持 TUI 展示 usage 统计
  },
};
await processFullStream(streamResult, { handlers: mergedHandlers });
```

### 3.5 loop.ts 中的 observer 注入点（已实现）

```typescript
// PLANNING iter=1：注入 planHandlers
const planResult = await Processor.plan({
  messages: [...context.session.messages],
  handlers: input.observer?.planHandlers,
});
processResutlToSession(planResult);   // 写入 Session

// PLANNING iter>1：注入 reasonHandlers
const reasonResult = await Processor.reason({
  messages: [...context.session.messages],
  handlers: input.observer?.reasonHandlers,
});
processResutlToSession(reasonResult);

// EXECUTING：注入 executeHandlers
const executeResult = await Processor.execute({
  agent: input.agentConfig,
  messages: [...context.session.messages],
  maxRetries: input.agentConfig.max_retries ?? 3,
  timeout: input.agentConfig.timeout,
  streamHandlers: input.observer?.executeHandlers,
});
processResutlToSession(executeResult);

// 状态转换时通知 observer
input.observer?.onStateChange?.(prevState, newState, context.iteration);
input.observer?.onIterationStart?.(context.iteration, context.maxIterations);
input.observer?.onIterationEnd?.(context.iteration);
input.observer?.onLoopStart?.(input.sessionId);
input.observer?.onLoopEnd?.({ success, iterations, error });
```

### 3.6 为什么 handlers 不能存在 Processor 内部？

**三个根本原因：**

**① 并发 Session 会产生回调污染**  
`Processor` 是全局单例。若 Session A 和 B 并发运行，Processor 内持有的 handlers 无法区分归属，输出会互相串台。  
本方案 handlers 随调用栈传入，Session A/B 的 handlers 各自独立，完全隔离。

**② Observer 生命周期属于 Loop 调用，不属于 Processor**  
`observer` 在 `AgentLoop.loop()` 调用开始时创建，结束时销毁。Processor 是跨调用复用的单例，没有"单次 loop 调用"的生命周期感知能力，无法管理注册/注销。

**③ 分层边界**

```
loop.ts       ← 会话管理层（拥有 session + observer 生命周期）
processor/    ← LLM 执行层（无状态，仅执行 LLM 调用和工具调用）
stream-handler.ts ← 流处理层（解析流式事件，调用传入的回调）
```

将 handlers 存在 Processor 内等于把"UI 层知识"嵌入"LLM 调用层"，破坏分层边界。

---

## 4. StreamHandlers 接口全貌

`StreamHandlers`（`core/src/session/stream-handler.ts`）包含六个子处理器：

```typescript
export interface StreamHandlers {
  reasoning?: {
    onStart?: () => void | Promise<void>;
    onDelta?: (text: string) => void | Promise<void>;
    onEnd?: (fullReasoningText: string) => void | Promise<void>;
  };
  text?: {
    onStart?: () => void | Promise<void>;
    onDelta?: (text: string) => void | Promise<void>;
    onEnd?: (fullText: string) => void | Promise<void>;
  };
  tool?: {
    onCall?: (toolId: string, toolName: string, args: any) => void | Promise<void>;
    onResult?: (toolId: string, toolName: string, result: any) => void | Promise<void>;
  };
  step?: {
    onStart?: (stepNumber: number) => void | Promise<void>;
    onEnd?: (stepNumber: number) => void | Promise<void>;
  };
  onError?: (error: unknown) => void | Promise<void>;
  onFinish?: (result: {
    text: string;
    reasoning: string;
    finishReason: string;
    usage?: any;
  }) => void | Promise<void>;
}
```

> **注意**：`step` 处理器对应 SDK 的多步骤执行（`start-step` / `finish-step` chunks）；`onFinish` 在流结束后由 `processFullStream` 调用，可用于展示 token 用量统计。TUI 的 `planHandlers / reasonHandlers` 目前不需要 `step` 和 `onFinish`，但 `executeHandlers` 可选接入 `onFinish` 以展示每轮执行的 token 消耗。

---

## 5. TUI 层设计（已实现）

### 5.1 技术选型：ink（React for CLI）

| 库 | 适合场景 | 理由 |
|----|---------|------|
| **ink** | 组件化 TUI，实时更新 | 与 TypeScript 天然契合；组件模型与 React 一致；状态驱动渲染非常适合 streaming；Bun 支持良好 |
| blessed | 传统 TUI，复杂布局 | API 底层，维护成本高 |
| chalk + readline | 简单日志型 | 无法做布局管理和局部刷新 |

**选择 ink 的核心原因**：streaming 文本更新就是状态变化（`delta` → `setState` → 局部重渲染），这正是 React 模型的强项。

### 5.2 包目录结构（已落地）

```
packges/ui/
├── package.json              # 依赖: ink, react, @types/react
├── index.ts                  # 包入口
├── src/
│   ├── tui.tsx               # 入口：startTUI() + CLI argv 解析
│   ├── app.tsx               # <App> 根组件，组合所有 TUI 子组件
│   ├── hooks/
│   │   └── useAgentLoop.ts   # 核心 Hook：驱动 AgentLoop，暴露渲染状态
│   └── components/
│       ├── MessageList.tsx   # 历史消息列表（已完成轮次）
│       ├── StreamingBlock.tsx # 当前 execute 阶段 streaming 文本（实时）
│       ├── ThinkingBlock.tsx  # 推理过程展示（plan/reason，可折叠）
│       ├── ToolCallLog.tsx    # 工具调用条目（name / args / result）
│       ├── StatusBar.tsx      # 顶部状态栏：Loop 状态 + 迭代计数
│       └── PromptInput.tsx    # 底部用户输入框（Loop 执行时 disabled）
└── docx/
    └── TUI-DESIGN.md
```

### 5.3 UI 布局

```
┌──────────────────────────────────────────────────────────┐
│ raye  ·  session: abc123  ·  EXECUTING  ·  iter: 3/10    │  ← StatusBar
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [user]  请帮我分析这段代码                               │  ← MessageList
│                                                          │
│  [plan]  ▸ 已折叠 (Planning)                             │  ←  ThinkingBlock
│  [tool]  read_file("src/main.ts")  ✓ 1024 bytes         │  ← ToolCallLog
│                                                          │
│  [assistant]  分析结果如下：···                           │  ← MessageList（已完成）
│                                                          │
│  [reasoning]  思考中···▊                                  │  ← ThinkingBlock（streaming）
│  [assistant]  好的，我来···▊                              │  ← StreamingBlock（streaming）
│                                                          │
├──────────────────────────────────────────────────────────┤
│ > _                                                      │  ← PromptInput（Loop 结束后激活）
└──────────────────────────────────────────────────────────┘
```

### 5.4 核心 Hook：useAgentLoop（已实现）

职责：构建 `LoopObserver`，桥接 core 事件与 React state。

**关键实现细节（相比设计草稿的改进）：**

| 改进点 | 说明 |
|--------|------|
| `useRef` 缓存 streaming 文本 | `streamingRef.current` 在 `onDelta` 闭包中直接操作，避免拿到旧 state；`setState` 只用 ref 的最新值更新 UI |
| `TurnMessage.id` | 每条消息有唯一 `id`（`msg-1`, `msg-2`, ...），供 React key 和工具结果匹配使用 |
| `TurnMessage.toolCallId` | 工具调用专属字段，`onResult` 通过 `toolCallId` 精确定位对应的 tool 消息（而非 `toolName`），避免同名工具并发时匹配错误 |
| `maxIterations` 暴露到 state | `onIterationStart` 同步更新 `state.maxIterations`，StatusBar 可动态展示 `iter 3/10` |
| `loopState: "IDLE"` | 初始状态，区别于 Loop 运行中的真实状态机值 |
| `error` 在 `submit` 的 catch 兜底 | `AgentLoop.loop` 抛出的非 observer 异常也能展示到 PromptInput |

```typescript
// packges/ui/src/hooks/useAgentLoop.ts（核心结构）
export interface TurnMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  phase?: 'plan' | 'reason' | 'execute';
  // 工具调用专属
  toolCallId?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
}

export interface AgentLoopUIState {
  messages: TurnMessage[];
  streaming: { plan: string; reason: string; execute: string };
  loopState: AgentLoopState | 'IDLE';
  iteration: number;
  maxIterations: number;
  isRunning: boolean;
  error?: string;
}

export function useAgentLoop(agentConfig: AgentConfig, sessionId: string) {
  const [state, setState] = useState<AgentLoopUIState>(INITIAL_STATE);
  // ⚠️ 关键：用 ref 缓冲 streaming 文本，避免 onDelta 闭包拿到旧 state
  const streamingRef = useRef({ plan: '', reason: '', execute: '' });

  const buildObserver = useCallback((): LoopObserver => {
    streamingRef.current = { plan: '', reason: '', execute: '' };
    return {
      // Loop 级别 + planHandlers + reasonHandlers + executeHandlers
      // （详见完整实现）
    };
  }, []);  // 无依赖，buildObserver 引用稳定

  const submit = useCallback(async (userMessage: string) => {
    setState(s => ({ ...s, messages: [...s.messages, { id: nextId(), role: 'user', content: userMessage }] }));
    try {
      await AgentLoop.loop({ sessionId, agentConfig, message: userMsg, observer: buildObserver() });
    } catch (err) {
      // 兜底：捕获 observer 外部的顶层异常
      setState(s => ({ ...s, isRunning: false, error: String(err) }));
    }
  }, [sessionId, agentConfig, buildObserver]);

  return { state, submit };
}
```

### 5.5 工具调用匹配：toolCallId 优于 toolName

```typescript
// executeHandlers.tool.onResult
onResult: (_id, name, result) => {
  setState(s => {
    const msgs = [...s.messages];
    // 通过 toolCallId 精确匹配，非 toolName（避免同名工具并发时错误覆盖）
    const idx = msgs.findLastIndex(m => m.role === 'tool' && m.toolCallId === _id);
    if (idx !== -1) {
      msgs[idx] = { ...msgs[idx]!, toolResult: result, content: JSON.stringify(result) };
    }
    return { ...s, messages: msgs };
  });
},
```

### 5.6 根组件 App（已实现）

```typescript
// packges/ui/src/app.tsx
export function App({ agentConfig, sessionId }: AppProps) {
  const { state, submit } = useAgentLoop(agentConfig, sessionId);
  const { streaming, messages, loopState, iteration, maxIterations, isRunning, error } = state;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar loopState={loopState} iteration={iteration} maxIterations={maxIterations} sessionId={sessionId} />
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <MessageList messages={messages} />
        {streaming.plan   && <ThinkingBlock label="Planning" text={streaming.plan} />}
        {streaming.reason && <ThinkingBlock label="Reasoning" text={streaming.reason} />}
        {streaming.execute && <StreamingBlock text={streaming.execute} />}
      </Box>
      <PromptInput disabled={isRunning} onSubmit={submit} error={error} />
    </Box>
  );
}
```

### 5.7 TUI 入口（已实现）

```typescript
// packges/ui/src/tui.tsx
export function startTUI(options?: { sessionId?: string }) {
  const sessionId = options?.sessionId ?? `session-${Date.now()}`;
  const agents = loadAndGetAgent();
  const agentConfig = agents.agent!;
  const { waitUntilExit } = render(<App agentConfig={agentConfig} sessionId={sessionId} />);
  return waitUntilExit();
}

// CLI 直接运行：bun packges/ui/src/tui.tsx [sessionId]
const sessionId = process.argv[2];
startTUI({ sessionId }).then(() => process.exit(0)).catch(() => process.exit(1));
```

---

## 6. 数据流全景

```
用户在 PromptInput 输入并回车
          │
          ▼
  useAgentLoop.submit(message)
          │
          ├─ setState: messages += { role:'user', content }
          │
          ▼
  AgentLoop.loop({ ..., observer })                   ← core 层
          │
          ├─ observer.onLoopStart()                   → isRunning = true
          │
          ├─ [PLANNING, iter=1]
          │     observer.onStateChange() / onIterationStart()
          │     Processor.plan({ msgs, handlers: planHandlers })
          │       planHandlers.reasoning.onDelta()    → streamingRef.plan += delta → setState
          │       planHandlers.reasoning.onEnd()      → messages += { phase:'plan' }, streaming.plan = ''
          │       planHandlers.text.onDelta/onEnd()   → 同上
          │     processResutlToSession(planResult)    → 写入 Session
          │
          ├─ [EXECUTING]
          │     observer.onStateChange()
          │     Processor.execute({ executeHandlers })
          │       executeHandlers.text.onDelta()      → streamingRef.execute += delta → setState
          │       executeHandlers.tool.onCall()       → messages += { role:'tool', toolCallId }
          │       executeHandlers.tool.onResult()     → 通过 toolCallId 更新 tool 条目
          │       executeHandlers.text.onEnd()        → messages += { phase:'execute' }
          │     observer.onIterationEnd()
          │     processResutlToSession(executeResult)
          │
          ├─ [OBSERVING] → makeDecision → [PLANNING iter>1 / COMPLETED / COMPACT]
          │
          ├─ [PLANNING, iter>1]
          │     Processor.reason({ msgs, handlers: reasonHandlers })
          │       reasonHandlers.text/reasoning.onDelta/onEnd → streaming.reason
          │     → [EXECUTING] 再次执行 ...
          │
          └─ observer.onLoopEnd()                     → isRunning = false, loopState → COMPLETED/FAILED
                    │
                    ▼
          PromptInput 重新激活，等待下一轮输入
```

---

## 7. 实现步骤（当前完成情况）

| 步骤 | 位置 | 内容 | 状态 |
|------|------|------|------|
| 1 | `core/src/session/type.ts` | `LoopObserver`、`PlanInput`、`ReasonInput`、`ExecuteInput` 含 `handlers?` | ✅ 已完成 |
| 2 | `core/src/session/processor/planner.ts` | `plan(PlanInput)` 注入 `handlers`，`mergedHandlers` 捕获 + 透传 `onFinish` | ✅ 已完成 |
| 3 | `core/src/session/processor/reasoner.ts` | `reason(ReasonInput)` 同上 | ✅ 已完成 |
| 4 | `core/src/session/processor/executor.ts` | `ExecuteInput.streamHandlers` 透传给 `processFullStream` | ✅ 已完成 |
| 5 | `core/src/session/processor/index.ts` | `Processor` 接口聚合 `plan / reason / execute` | ✅ 已完成 |
| 6 | `core/src/session/loop.ts` | PLANNING/EXECUTING 传入 `observer?.xxxHandlers`；状态转换处回调 observer | ✅ 已完成 |
| 7 | `ui/package.json` | 添加依赖 `ink`, `react`, `@types/react` | ✅ 已完成 |
| 8 | `ui/src/hooks/useAgentLoop.ts` | `useRef` 缓存 streaming；三阶段 handlers；`toolCallId` 精确匹配 | ✅ 已完成 |
| 9 | `ui/src/components/*` | `ThinkingBlock / StreamingBlock / ToolCallLog / MessageList / StatusBar / PromptInput` | ✅ 已完成 |
| 10 | `ui/src/app.tsx` + `ui/src/tui.tsx` | 组装根组件；`startTUI()` + CLI argv 解析 | ✅ 已完成 |

---

## 8. 关键设计决策

### 8.1 为什么在 LoopInput 注入 observer，而不是让 UI 直接包裹 loop？

直接拦截 `console.log` 或 monkey-patch 函数会破坏测试稳定性和类型安全。  
`LoopInput.observer` 是显式契约，core 层测试用 `undefined` observer 跑，TUI 层只需注入实现，两者解耦。

### 8.2 为什么按 Processor 阶段分组，而不是按 reasoning/text 流类型分组？

不同阶段对用户语义完全不同：
- **plan**：全局规划 → 「AI 在分解任务」
- **reason**：局部推理 → 「AI 在决定下一步」
- **execute**：主回复 → 用户最关心的内容

如果只按流类型（`reasoning` / `text`）分组，TUI 无法差异化渲染三个阶段的内容。

### 8.3 为什么用 streamingRef 而不是直接 setState？

`onDelta` 回调在异步流中被频繁调用，每次调用时 React state 闭包捕获的是创建 observer 时的快照值，  
直接用 `s.streaming.plan + text` 会导致 delta 内容互相覆盖。  
`useRef` 跳出闭包，保证每次追加都是最新的累积值：

```typescript
// ✅ 正确：通过 ref 累积
streamingRef.current.plan += text;
setState(s => ({ ...s, streaming: { ...s.streaming, plan: streamingRef.current.plan } }));

// ❌ 错误：直接用 state 追加（闭包陷阱）
setState(s => ({ ...s, streaming: { ...s.streaming, plan: s.streaming.plan + text } }));
```

### 8.4 为什么 onTextEnd 才归档消息，而不是 onTextDelta 逐步追加？

`streaming.{plan,reason,execute}` 用于实时展示当前流式输出，  
`messages` 保存已完成消息的历史记录。两者分离使得「正在生成」和「已完成」在视觉上有明确区分，  
且避免频繁 setState 触发全量列表重渲染（仅 StreamingBlock 局部刷新）。

### 8.5 PromptInput 的 disabled 控制

`isRunning === true` 时输入框 disabled，保证用户不会在 Loop 执行中提交新消息导致并发混乱。  
Loop 结束后自动激活，体验类似 Claude.ai 的交互模式。

### 8.6 processResutlToSession 的职责边界

`Processor.plan/reason/execute` 返回 `ProcessorStepResult`，包含：
- `text` / `reasoning`：LLM 完整文本输出
- `finishReason` / `usage`：执行元数据
- `message`：已组装好的 `ModelMessage`，可直接调用 `SessionOps.addMessage`
- `toolCalls` / `toolResults`（execute 专属）

由 `loop.ts` 中的 `processResutlToSession()` 负责将结果写入 `context.session`，  
Processor 自身不直接操作 Session，分层职责清晰。

---

## 9. 待优化方向

| 项目 | 描述 | 优先级 |
|------|------|--------|
| ThinkingBlock 折叠交互 | 目前 plan/reason 阶段 ThinkingBlock 展开/折叠靠是否有 streaming 内容决定；已完成的 thinking 消息在 MessageList 中可考虑支持按键折叠 | 中 |
| token 用量展示 | `executeHandlers.onFinish` 已可获取 usage 数据，可在 StatusBar 或独立区域渲染 token 消耗 | 低 |
| ToolCallLog 多步展示 | 同一 execute 轮次多个工具调用按序展示；目前已通过 `toolCallId` 精确匹配，可进一步做折叠和展开 | 中 |
| COMPACTING 阶段可视化 | 当前 COMPACTING 状态转换已通过 `onStateChange` 通知，StatusBar 可添加「压缩中」提示 | 低 |
| AbortController | 向 `ExecuteInput.abortSignal` 注入用户可控的中断信号，允许 TUI 在 Loop 执行中响应 Ctrl+C | 高 |
