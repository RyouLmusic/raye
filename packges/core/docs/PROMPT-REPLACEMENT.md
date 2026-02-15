# Agent Prompt 占位符替换功能说明

## 功能概述

实现了 `loadAndGetAgent()` 函数中的 prompt 占位符自动替换功能。该功能允许在 `agent.json` 配置文件中使用占位符，这些占位符会在加载时被替换为对应的 prompt 文本内容。

## 实现细节

### 1. 占位符定义

在 `agent.json` 中，使用以下占位符格式：

```json
{
    "name": "agent",
    "prompt": "{AGENT_PROMPT}",
    ...
}
```

### 2. 支持的占位符

| 占位符 | 对应文件 | 用途 |
|--------|----------|------|
| `{PLAN_PROMPT}` | `src/agent/prompt/plan.txt` | 用于计划制定 agent |
| `{AGENT_PROMPT}` | `src/agent/prompt/agent.txt` | 用于通用执行 agent |
| `{SUMMARY_PROMPT}` | `src/agent/prompt/summary.txt` | 用于内容总结 agent |

### 3. 替换逻辑

```typescript
// 创建 prompt 占位符映射
const promptMap: Record<string, string> = {
    '{PLAN_PROMPT}': PLAN_PROMPT,
    '{AGENT_PROMPT}': AGENT_PROMPT,
    '{SUMMARY_PROMPT}': SUMMARY_PROMPT
};

// 将 agentConfig 中的 prompt 字段替换为对应的文本内容
for (const agent of agents) {
    if (agent.prompt) {
        let processedPrompt = agent.prompt;
        for (const [placeholder, content] of Object.entries(promptMap)) {
            processedPrompt = processedPrompt.replace(placeholder, content);
        }
        agent.prompt = processedPrompt;
    }
}
```

## 使用示例

### 配置文件 (agent.json)

```json
[
    {
        "name": "summary",
        "provider": "Kimi",
        "model": "moonshotai/Kimi-K2.5",
        "prompt": "{SUMMARY_PROMPT}",
        ...
    }
]
```

### Prompt 文件 (summary.txt)

```text
你是一个专业的内容总结专家。你的任务是将复杂的信息提炼为简洁、易懂的摘要。

总结原则：
1. 提取核心要点 - 聚焦最重要的信息
2. 保持客观性 - 不添加个人观点
3. 结构清晰 - 使用逻辑分层
4. 语言精炼 - 避免冗余表达
```

### 代码使用

```typescript
import { streamTextWrapper } from "@/session/stream-text-wrapper";
import { loadAndGetAgent } from "@/agent/agent.ts";

const agents = loadAndGetAgent();

// 使用带有自定义 prompt 的 agent
const result = await streamTextWrapper({
    agent: agents.summary,
    // system prompt 会从 agent.prompt 字段中读取（已替换占位符）
    system: agents.summary.prompt,
    messages: [
        { role: 'user', content: '请总结这段文字...' }
    ]
});
```

## 测试

### 运行 prompt 替换测试

```bash
cd packges/core/test
bun prompt-replacement.test.ts
```

测试会验证：
- ✅ 所有占位符是否被正确替换
- ✅ 替换后的内容是否符合预期
- ✅ 没有遗留未替换的占位符

### 运行实际应用示例

```bash
# 总结示例
bun agent-with-prompt.ts

# 计划制定示例
bun agent-with-prompt.ts plan

# 对比有无 system prompt 的差异
bun agent-with-prompt.ts compare
```

## Prompt 文件说明

### plan.txt - 计划制定助手
定义计划制定 agent 的角色和工作原则，包括：
- 目标分解
- 完成标准设定
- 风险考虑
- 时间安排

### agent.txt - 通用执行助手
定义通用 agent 的能力和工作原则，包括：
- 问题回答
- 计算执行
- 工具使用
- 清晰沟通

### summary.txt - 内容总结专家
定义总结 agent 的原则和格式要求，包括：
- 要点提取
- 客观性保持
- 结构清晰
- 语言精炼

## 优势

1. **配置分离**：prompt 内容单独存放在文本文件中，便于管理和版本控制
2. **模块化**：不同 agent 可以共享相同的 prompt 模板
3. **易于维护**：修改 prompt 只需编辑文本文件，无需修改 JSON 配置
4. **版本控制友好**：文本文件更适合 Git diff 和合并
5. **多语言支持**：可以轻松创建不同语言版本的 prompt 文件

## 扩展提示

如果需要添加新的 prompt 占位符：

1. 在 `src/agent/prompt/` 目录下创建新的 `.txt` 文件
2. 在 `agent.ts` 中导入该文件
3. 在 `promptMap` 对象中添加对应的映射
4. 在 `agent.json` 中使用新的占位符

例如，添加一个代码审查 prompt：

```typescript
// agent.ts
import CODE_REVIEW_PROMPT from "@/agent/prompt/code-review.txt";

const promptMap: Record<string, string> = {
    // ... 已有的映射
    '{CODE_REVIEW_PROMPT}': CODE_REVIEW_PROMPT
};
```

```json
// agent.json
{
    "name": "code-reviewer",
    "prompt": "{CODE_REVIEW_PROMPT}",
    ...
}
```

## 文件变更记录

### 修改的文件
- `src/agent/agent.ts` - 实现 prompt 占位符替换逻辑
- `src/agent/prompt/plant.txt` → `src/agent/prompt/plan.txt` - 修正文件名拼写

### 新增的文件
- `src/agent/prompt/plan.txt` - 计划制定 prompt
- `src/agent/prompt/agent.txt` - 通用助手 prompt
- `src/agent/prompt/summary.txt` - 总结专家 prompt
- `test/prompt-replacement.test.ts` - prompt 替换功能测试
- `test/agent-with-prompt.ts` - 使用示例和演示
- `docs/PROMPT-REPLACEMENT.md` - 本说明文档
