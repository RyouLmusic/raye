# RAYE TUI 视觉体验与设计规范 (Aesthetics & UX Design)

> **目标**：打造一个符合现代 LLM Agent 使用习惯、清晰解构内部复杂流转、兼具极简代码美学的终端用户界面 (TUI)。设计灵感参考 Cursor、Ghostty 等极客风 CLI 工具。

---

## 1. 设计哲学与核心原则

- **极简与专业 (Minimal & Professional)**：摒弃可爱的 Emoji 和气泡聊天风格。采用严谨的缩进、排版编排和纯文本/符号/SVG 组合，营造冷峻的极客氛围。
- **清晰分离内容与过程 (Signal over Noise)**：用户最关心的是 **“最终的回答或修改”**。把冗长的思考过程 (Thinking) 和工具调用 (Tool Call) 视觉弱化，把核心的回答视觉强化。
- **空间呼吸感 (Dynamic Breathing)**：避免终端因为密集的日志而变得让人难以呼吸。通过恰当的 `Padding`、颜色反差和折叠机制营造轻量感。
- **动效即反馈 (Animation as Feedback)**：Agent 的循环往往是缓慢的，如果无动效用户会以为卡死。细微的加载动画能极大缓解等待焦虑。

---

## 2. 角色与色彩系统 (Color & Typography)

采用低饱和且高对比的颜色策略，完全移除 Emoji，使用标准字符或支持的 SVG 图标（如 Nerd Fonts 符号或自定义终端绘图）：

| 角色 / 组件 | 色彩分配 (Ink Color) | 图标/标识 (无 Emoji) | 视觉层级 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **USER (用户)** | `cyanBright` (青亮色) | `>` 或 `[USER]` | **高** | 代表主动指令，醒目、清晰，带一定的主导感。 |
| **ASSISTANT (AI 回复)** | `whiteBright` (纯白) | `RAYE` 或 `•` | **最高** | 主干阅读内容，字重最高。不可带有任何 Dim (暗化)。 |
| **SYSTEM (状态栏)** | 反相 (`bgCyan.black`) | - | **中** | 作为顶部与底部的锚点边界，分割视觉。 |
| **PLANNING / REASONING** | `gray` 或 `dim` (暗灰) | `+` (展开) / `-` (折叠) | **最低** | 位于暗处。动态变化时可见，完成后只留痕迹。 |
| **TOOL CALL (工具调用)** | `yellow` / `cyan` | `◇` (执行) / `◆` (完成) | **低** | 工具条目需要微弱的高亮，但只占一行。 |
| **ERROR (错误)** | `redBright` (亮红) | `!` 或 `[ERROR]` | **高** | 仅在失败时作为最高层级的侵入式警告。 |

---

## 3. 终端 SVG 图标策略

在纯终端环境（非浏览器）中，传统的 XML 格式 `<svg>` 无法直接渲染。为了实现“使用 SVG”的视觉效果并保持代码的极简风，我们采用以下策略：

1. **终端特有光栅化 (Kitty/iTerm2 Graphics Protcol)**：如果当前终端支持图像协议，可以将 SVG 转换为 base64 图像序列输出。
2. **Nerd Fonts 符号 / 终端矢量字符 (推荐)**：使用标准化的矢量字符（如 Nerd Fonts 提供的 `nf-oct-*`, `nf-md-*`），它们本质上是预渲染的面状图标（如 󰠲, 󰢚, , ），在支持的终端中显示效果极其接近 SVG 图标，且完全符合极简代码风。
3. **Ink/React 封装组件**：创建一个 `<Icon name="tool" />` 组件来抽象图标。

### 图标映射对照表（Nerd Fonts 示例）
- **工具调用**：`` (nf-oct-tools) 或 `󰢚` (nf-md-hammer_wrench)
- **思考中**：`󰔟` (nf-md-timer_sand)
- **文件读取**：`󰈙` (nf-md-file_document_outline)
- **成功/完成**：`✓` (标准字符) 或 `` (nf-oct-check)
- **用户提示符**：`❯` 或 `` (nf-fa-chevron_right)

---

## 4. 组件级视觉规范与排版 (Component Specs)

### 4.1 StatusBar (全局状态栏)
常驻在终端最顶部，横跨全宽。应该有极强的应用边界感。
- **设计**：`bgCyan` 取反色的黑色文字，或者强对比的深色背景。
- **包含内容**：项目名 (RAYE) 〉Session ID 〉当前大状态 (EXECUTING/PLANNING) 〉轮次 (Iter: 2/10)。
- **样式参考**：
  ```
  ██ RAYE ┃ Session: d2a9-x8 ┃ 状态: EXECUTING ┃ 循环: 2/10 ████████████
  ```

### 4.2 MessageList (历史消息区) & 极简对话流
摒弃气泡感（如高亮的背景色或大段缩进），采用类似常规终端输出的平铺视图，靠左侧的修饰符和颜色区分：
- **用户输入**：
  ```
  ❯ 请帮我分析这段代码的性能瓶颈
  ```
- **AI 最终回复**：
  ```
  RAYE: 根据分析，这段代码的主要瓶颈在于...
  ```

### 4.3 ThinkingBlock (思考过程区块)
由于 Reasoning 的长度可能是几十行甚至上百行，必须有极好的收束感，样式极简，带有机械感。
- **Streaming (运行态)**：左侧使用简单的虚线或点阵对齐。
  ```
  [Planning] ⠋ 
  : 1. 这段代码主要负责渲染...
  : 2. 我需要调用读文件工具...
  ```
- **Collapsed (归档折叠态)**：任务一旦进入执行或者下一轮，思考过程瞬间坍缩，变成系统极其低调的痕迹。
  ```
  + Planning (152 chars)
  ```

### 4.4 ToolCallLog (工具调用脚印)
让用户感觉 AI 像是一个有真实双手的助手，在后台“操作”系统。
- **执行中**：黄色高亮，带参数。
  `◇ read_file (path: "src/main.ts")`
- **已完成**：绿色或低调的青色。
  `◆ read_file [1.2KB]`
- **出错**：
  `! read_file [Error: file not found]`

### 4.5 PromptInput (命令终端输入区)
常驻最底部。
- **未激活 (Loop 运行中)**：整个输入框淡化 (`dimColor=true`)，显示 `[ Agent working... ]`。
- **已激活**：呈现闪烁的光标 `❯ _`，等待新的会话输入。

---

## 5. 基于现有架构的实现路径 (Implementation Guide)

### 5.1 核心改造：使用 `<Static>` 解决终端撕裂问题 🚨
目前架构中 `MessageList.tsx` 被渲染在一个固定高度 `Box` 中。如果是大量的输出，React 的全图重绘会导致终端闪烁甚至性能下降。
**改良方案**：利用 Ink 提供的 `<Static>` 组件来输出历史消息。
- **原理**：`<Static>` 会脱离 React 实时渲染管线，直接将其子元素“烫印”在屏幕上方滚动出视野。
- **代码重构**：
  ```tsx
  import { Static } from "ink";
  export function MessageList({ messages }: MessageListProps) {
      return (
          <Static items={messages}>
              {(msg) => <MessageItem key={msg.id} msg={msg} />}
          </Static>
      );
  }
  ```
- 将 `App.tsx` 的布局改为不受固定高度束缚，保留最底部的 `StreamingBlock` 和 `PromptInput` 作为动态活动区。

### 5.2 引入 `ink-spinner` 和代码高亮
```bash
bun add ink-spinner cli-highlight
```
- **微动效**：在 `ThinkingBlock` 中使用 spinner 替代原有的文字提示。
- **代码高亮**：接入 `cli-highlight` 让 `StreamingBlock` 内的 markdown 代码块自带终端色彩解析。

### 5.3 Icon 组件封装示例
为了满足对图标的严格控制（无 Emoji、矢量化）：
```tsx
import { Text } from "ink";

const icons = {
    user: "❯",
    ai: "RAYE",
    tool_pending: "◇",
    tool_done: "◆",
    error: "!",
    expand: "+",
};

export const Icon = ({ name, color }) => (
    <Text color={color}>{icons[name] || "•"}</Text>
);
```

---

## 6. 总结

新的极简专业设计方案：
1. **彻底戒断 Emoji**：使用高冷的点 `·`、加号 `+`、菱形 `◇` 或 Nerd Font 矢量字符，打造冷静的命令行工作流体验。
2. **去气泡化排版**：用严格的文本垂直对齐、`Color` 和前缀标识（如 `❯` 和 `RAYE:`）来分隔对话阵营，而非大色块的背景。
3. **架构适配**：全面接入 `<Static>`，它完美契合新设计里要求的“历史记录默默上推”的机械打字机风格，终端表现坚如磐石。
