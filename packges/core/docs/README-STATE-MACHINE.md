# Agent Loop 状态机系统

## 📋 概述

本系统实现了一个基于**双层状态机**的 Agent 执行框架，用于处理 AI Agent 的复杂交互流程。

### 架构设计

```
┌─────────────────────────────────────────────┐
│         外层: Agent ReAct Loop              │
│   (Reasoning + Acting 推理-行动循环)         │
│                                             │
│  INIT → PLANNING → EXECUTING → OBSERVING   │
│           ↑            ↓          ↓         │
│           └──── COMPACTING ←──────┘         │
│                     ↓                       │
│              COMPLETED/FAILED               │
└─────────────────────────────────────────────┘
                     │
                     ↓ (在 EXECUTING 状态进入)
┌─────────────────────────────────────────────┐
│         内层: Process Loop                  │
│    (LLM调用、重试、流式处理)                  │
│                                             │
│  IDLE → CALLING → STREAMING → TOOL_EXEC    │
│           ↓           ↓           ↓         │
│         RETRYING ←────┴───────────┘         │
│           ↓                                 │
│      SUCCESS/ERROR                          │
└─────────────────────────────────────────────┘
```

## 📁 文件结构

```
packges/core/src/session/
├── type.ts              # 类型定义和状态机枚举
├── loop.ts              # 外层 Agent ReAct 循环实现
├── processor.ts         # 内层 Process 循环实现
└── compressor.ts        # 上下文压缩器（待实现）

packges/core/docs/
├── STATE-MACHINE.md                    # 完整的状态机设计文档
└── STATE-MACHINE-QUICK-REFERENCE.md    # 状态机速查表

packges/core/test/
└── agent-loop.test.ts   # 状态机测试示例
```

## 🎯 核心功能

### 外层循环 (Agent ReAct Loop)

**职责**: 实现 AI Agent 的推理-行动循环

**核心状态**:
- 🟦 **INIT**: 初始化会话
- 🟩 **PLANNING**: 规划下一步行动 (Reasoning)
- 🟨 **EXECUTING**: 执行 LLM 调用 (Acting)
- 🟧 **OBSERVING**: 观察结果并决策
- 🟪 **COMPACTING**: 压缩上下文
- ✅ **COMPLETED**: 任务完成
- ❌ **FAILED**: 任务失败

**关键特性**:
- ✨ 自动迭代控制（最大迭代次数）
- ✨ 智能上下文压缩（避免 token 溢出）
- ✨ 灵活的决策机制（继续/压缩/停止）
- ✨ 完整的错误处理

### 内层循环 (Process Loop)

**职责**: 处理 LLM API 调用的技术细节

**核心状态**:
- 🟦 **IDLE**: 空闲等待
- 🟩 **CALLING**: 发起 API 调用
- 🟨 **STREAMING**: 处理流式输出
- 🟪 **TOOL_EXECUTING**: 执行工具调用
- 🔄 **RETRYING**: 重试
- ✅ **SUCCESS**: 执行成功
- ❌ **ERROR**: 执行失败

**关键特性**:
- ✨ 智能错误重试（指数退避策略）
- ✨ 流式输出处理
- ✨ 工具调用支持
- ✨ 超时控制

## 🚀 快速开始

### 基本使用

```typescript
import { AgentLoop } from "@/session/loop";

// 运行 Agent 循环
const result = await AgentLoop.loop({
    sessionId: "my-session",
    agentConfig: {
        name: "my-agent",
        model: "gpt-4",
        provider: "openai",
        base_url: "https://api.openai.com/v1",
        api_key: "your-api-key",
        // ... 其他配置
    },
    initialMessages: [
        { role: "user", content: "帮我分析这段代码" }
    ],
    maxIterations: 10,
    compactThreshold: 20,
});

// 检查结果
if (result.success) {
    console.log("完成！迭代次数:", result.iterations);
    console.log("最终消息:", result.messages);
} else {
    console.error("失败:", result.error);
}
```

### 带工具调用

```typescript
const result = await AgentLoop.loop({
    // ... 其他配置
    agentConfig: {
        // ... 其他配置
        tools: ["calculator", "web_search", "file_reader"],
    },
});
```

## 📊 状态转换示例

### 典型的成功流程

```
1. INIT
   ↓
2. PLANNING (迭代 1/10)
   ↓
3. EXECUTING → [内层循环: CALLING → STREAMING → TOOL_EXECUTING → SUCCESS]
   ↓
4. OBSERVING → decision: continue (检测到工具调用)
   ↓
5. PLANNING (迭代 2/10)
   ↓
6. EXECUTING → [内层循环: CALLING → STREAMING → SUCCESS]
   ↓
7. OBSERVING → decision: stop (无工具调用)
   ↓
8. COMPLETED ✅
```

### 带压缩的流程

```
1. INIT (20条初始消息)
   ↓
2. PLANNING → 检测到消息数 >= 20
   ↓
3. COMPACTING → 压缩到 14 条消息
   ↓
4. PLANNING
   ↓
5. EXECUTING → ...
```

### 重试流程

```
EXECUTING
   ↓
[内层] CALLING → 网络错误
   ↓
[内层] RETRYING (1/3) → 等待 1s
   ↓
[内层] CALLING → 超时
   ↓
[内层] RETRYING (2/3) → 等待 2s
   ↓
[内层] CALLING → 成功
   ↓
[内层] STREAMING → SUCCESS
   ↓
OBSERVING
```

## 🔧 配置参数

### 外层循环配置

```typescript
interface LoopInput {
    sessionId: string;              // 会话 ID
    agentConfig: AgentConfig;       // Agent 配置
    initialMessages: Message[];     // 初始消息
    maxIterations: number;          // 最大迭代次数 (默认: 10)
    compactThreshold: number;       // 压缩阈值 (默认: 20)
    maxTokens?: number;             // 最大 token 数
}
```

### 内层循环配置

```typescript
interface ExecuteInput {
    agent: AgentConfig;             // Agent 配置
    messages: Message[];            // 消息列表
    tools?: ToolSet;                // 工具集
    maxRetries: number;             // 最大重试次数 (默认: 3)
    timeout?: number;               // 超时时间（毫秒）
}
```

## 📚 详细文档

- [完整状态机设计文档](./docs/STATE-MACHINE.md) - 详细的状态转换、数据流、错误处理
- [状态机速查表](./docs/STATE-MACHINE-QUICK-REFERENCE.md) - 快速查找状态转换和配置

## 🧪 测试

运行测试示例:

```bash
cd packges/core
bun test/agent-loop.test.ts
```

测试用例包括:
- ✅ 基本的 ReAct 循环
- ✅ 带工具调用的循环
- ✅ 上下文压缩
- ✅ 最大迭代次数限制

## 🎨 关键设计决策

### 1. 为什么用双层状态机？

- **职责分离**: 外层关注业务逻辑（推理-行动），内层关注技术问题（网络、重试）
- **可维护性**: 每层独立演进，互不干扰
- **可测试性**: 可以单独测试每层逻辑

### 2. 为什么用显式状态机？

- **清晰性**: 状态转换一目了然
- **可调试性**: 容易追踪状态转换过程
- **可扩展性**: 添加新状态很简单

### 3. 重试策略

- **指数退避**: 1s → 2s → 4s → 8s (最大 10s)
- **智能判断**: 只重试可恢复的错误（网络、超时、限流）
- **有限次数**: 默认最多 3 次，避免无限重试

### 4. 压缩策略

- **触发条件**: 消息数量或 token 数超过阈值
- **保留重要信息**: 系统消息 + 最近的消息
- **可扩展**: 支持多种压缩算法（截断、摘要、提取）

## 🔍 监控和调试

### 日志级别

每个状态转换都有详细日志:

```
[AgentLoop] 状态: PLANNING, 迭代: 1/10
[Process] 状态: CALLING, 重试: 0/3
```

### 建议监控的指标

- 平均迭代次数
- 重试次数分布
- 压缩触发频率
- 工具调用成功率
- API 调用耗时

## 🛠️ 待实现功能

- [ ] 完善上下文压缩器 (compressor.ts)
- [ ] 实现真实的流式处理（替换模拟代码）
- [ ] 添加工具注册和执行逻辑
- [ ] 支持多种压缩策略
- [ ] 添加性能监控和指标收集
- [ ] 支持断点续传（会话恢复）

## 📝 示例场景

### 场景 1: 代码分析 Agent

```typescript
// 用户: "帮我分析这段代码并找出潜在问题"
// 
// 迭代 1: LLM 理解需求 → 调用 code_analyzer 工具
// 迭代 2: 收到分析结果 → 调用 search_docs 工具查找最佳实践
// 迭代 3: 综合信息 → 生成最终报告 → 完成
```

### 场景 2: 数据处理 Agent

```typescript
// 用户: "从数据库读取数据，计算统计信息，并生成图表"
//
// 迭代 1: LLM 规划步骤 → 调用 database_query 工具
// 迭代 2: 收到数据 → 调用 calculator 工具计算统计
// 迭代 3: 收到统计 → 调用 chart_generator 工具生成图表
// 迭代 4: 整理结果 → 完成
```

### 场景 3: 长对话场景

```typescript
// 用户进行了 15 轮对话，消息数达到 35 条
//
// 检测到超过阈值 (20) → 触发 COMPACTING
// 压缩后保留: 系统消息 + 最近 14 条消息
// 继续对话...
```

## 📄 许可

MIT License

---

**作者**: Raye AI Team  
**更新时间**: 2026-02-17
