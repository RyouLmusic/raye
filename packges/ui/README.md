# UI Package

Terminal User Interface (TUI) for the Raye Agent framework.

## Features

- 🎨 **Minimalist Design** - Clean, distraction-free terminal interface
- 📊 **Real-time Streaming** - Live display of agent reasoning and execution
- 🔧 **Tool Call Visualization** - Clear logging of tool invocations and results
- ⚡ **Interactive Input** - Real-time user interaction with `ask_user` tool
- 🎯 **Status Tracking** - Visual feedback on agent state and progress

## Installation

```bash
bun install
```

## Usage

```bash
bun run index.ts
```

## Key Components

### AskUserModal
Interactive modal for real-time user input when the agent calls `ask_user` tool.

**Features:**
- 🟡 Prominent yellow theme for high visibility
- 📦 Double-border design for visual hierarchy
- ⌨️ Auto-focused input field
- 💡 Clear operation hints

**Quick Start:**
```typescript
import { useAgentLoop } from "./hooks/useAgentLoop";
import { AskUserModal } from "./components/AskUserModal";

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

**Visual Effect:**
```
╔═══════════════════════════════════════════╗
║  ⚠️  AGENT 正在询问                       ║
╠═══════════════════════════════════════════╣
║ ╭─────────────────────────────────────╮  ║
║ │ 您想要生成哪种报告？                │  ║
║ ╰─────────────────────────────────────╯  ║
║ 您的回答:                                ║
║ ▶ [输入框]________________________       ║
╚═══════════════════════════════════════════╝
```

### Other Components
- **MessageList** - Display conversation history
- **StreamingBlock** - Show real-time agent output
- **ThinkingBlock** - Display agent reasoning process
- **ToolCallLog** - Visualize tool invocations
- **StatusBar** - Show agent state and iteration count
- **PromptInput** - User input interface

## Documentation

### ask_user Tool
- 📖 [Quick Start Guide](./docx/ASK-USER-QUICK-START.md) - Get started in 1 minute
- 🎨 [UI Design](./docx/ASK-USER-UI-DESIGN.md) - Design philosophy and color scheme
- 👁️ [Visual Demo](./docx/ASK-USER-VISUAL-DEMO.md) - See it in action
- 📚 [Documentation Index](./docx/ASK-USER-INDEX.md) - Complete documentation guide

### General
- 🎯 [TUI Design](./docx/TUI-DESIGN.md) - Overall design principles
- 🎨 [TUI Aesthetics](./docx/TUI-AESTHETICS.md) - Visual style guide

## Project Info

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
