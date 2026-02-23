# ask_user 工具文档索引

## 📚 文档导航

### 快速开始
- **[ASK-USER-QUICK-START.md](./ASK-USER-QUICK-START.md)** - 一分钟集成指南，快速上手

### 设计文档
- **[ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md)** - UI 设计理念、颜色方案、组件层次
- **[ASK-USER-SIMPLIFIED.md](./ASK-USER-SIMPLIFIED.md)** - 简化版 UI 设计说明
- **[ASK-USER-VISUAL-DEMO.md](./ASK-USER-VISUAL-DEMO.md)** - 视觉效果演示、场景示例

### 技术文档
- **[ASK-USER-DIRECT-UI.md](../../core/docs/ASK-USER-DIRECT-UI.md)** - 技术实现细节、工作流程、API 说明
- **[ASK-USER-TOOL.md](../../core/docs/ASK-USER-TOOL.md)** - 原有方案说明、两种方案对比

### 总结文档
- **[ASK-USER-SUMMARY.md](./ASK-USER-SUMMARY.md)** - 完整功能总结、文件清单、技术亮点

## 🎯 按需求查找

### 我想快速集成
→ [ASK-USER-QUICK-START.md](./ASK-USER-QUICK-START.md)

### 我想了解设计理念
→ [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md)

### 我想看视觉效果
→ [ASK-USER-VISUAL-DEMO.md](./ASK-USER-VISUAL-DEMO.md)

### 我想了解技术实现
→ [ASK-USER-DIRECT-UI.md](../../core/docs/ASK-USER-DIRECT-UI.md)

### 我想对比两种方案
→ [ASK-USER-TOOL.md](../../core/docs/ASK-USER-TOOL.md)

### 我想看完整总结
→ [ASK-USER-SUMMARY.md](./ASK-USER-SUMMARY.md)

## 📁 代码文件

### 核心实现
```
packges/core/src/tools/control.ts          - ask_user 工具 + 全局回调
packges/ui/src/hooks/useAgentLoop.ts       - React Hook 集成
```

### UI 组件
```
packges/ui/src/components/AskUserModal.tsx - 模态框组件
packges/ui/src/components/ToolCallLog.tsx  - 工具调用日志
packges/ui/src/components/Icon.tsx         - 图标组件
packges/ui/src/app.tsx                     - 主应用集成
```

### 示例和测试
```
packges/ui/src/examples/AskUserExample.tsx - 完整使用示例
packges/core/test/ask-user-direct.test.ts  - 单元测试
```

## 🔍 按角色查找

### 前端开发者
1. [ASK-USER-QUICK-START.md](./ASK-USER-QUICK-START.md) - 快速集成
2. [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md) - UI 设计
3. `packges/ui/src/components/AskUserModal.tsx` - 组件代码

### 后端开发者
1. [ASK-USER-DIRECT-UI.md](../../core/docs/ASK-USER-DIRECT-UI.md) - 技术实现
2. `packges/core/src/tools/control.ts` - 工具代码
3. `packges/core/test/ask-user-direct.test.ts` - 测试代码

### UI/UX 设计师
1. [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md) - 设计理念
2. [ASK-USER-VISUAL-DEMO.md](./ASK-USER-VISUAL-DEMO.md) - 视觉效果

### 产品经理
1. [ASK-USER-SUMMARY.md](./ASK-USER-SUMMARY.md) - 功能总结
2. [ASK-USER-VISUAL-DEMO.md](./ASK-USER-VISUAL-DEMO.md) - 场景演示

## 📊 文档结构

```
packges/
├── core/
│   ├── src/tools/
│   │   └── control.ts                    ← 核心实现
│   ├── docs/
│   │   ├── ASK-USER-TOOL.md              ← 原有方案
│   │   └── ASK-USER-DIRECT-UI.md         ← 新方案技术文档
│   └── test/
│       └── ask-user-direct.test.ts       ← 测试
└── ui/
    ├── src/
    │   ├── components/
    │   │   ├── AskUserModal.tsx          ← 模态框组件
    │   │   ├── ToolCallLog.tsx           ← 日志组件
    │   │   └── Icon.tsx                  ← 图标组件
    │   ├── hooks/
    │   │   └── useAgentLoop.ts           ← Hook 集成
    │   ├── examples/
    │   │   └── AskUserExample.tsx        ← 使用示例
    │   └── app.tsx                       ← 主应用
    └── docx/
        ├── ASK-USER-INDEX.md             ← 本文档
        ├── ASK-USER-QUICK-START.md       ← 快速开始
        ├── ASK-USER-UI-DESIGN.md         ← UI 设计
        ├── ASK-USER-VISUAL-DEMO.md       ← 视觉演示
        └── ASK-USER-SUMMARY.md           ← 功能总结
```

## 🚀 推荐阅读顺序

### 新手入门
1. [ASK-USER-QUICK-START.md](./ASK-USER-QUICK-START.md) - 了解基本用法
2. [ASK-USER-VISUAL-DEMO.md](./ASK-USER-VISUAL-DEMO.md) - 看看效果
3. `packges/ui/src/examples/AskUserExample.tsx` - 运行示例

### 深入理解
1. [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md) - 理解设计
2. [ASK-USER-DIRECT-UI.md](../../core/docs/ASK-USER-DIRECT-UI.md) - 理解实现
3. [ASK-USER-SUMMARY.md](./ASK-USER-SUMMARY.md) - 全面总结

### 高级定制
1. `packges/core/src/tools/control.ts` - 修改工具逻辑
2. `packges/ui/src/components/AskUserModal.tsx` - 定制 UI
3. `packges/core/test/ask-user-direct.test.ts` - 添加测试

## 💡 常见问题

### Q: 如何快速集成？
A: 参见 [ASK-USER-QUICK-START.md](./ASK-USER-QUICK-START.md)

### Q: 如何定制样式？
A: 参见 [ASK-USER-UI-DESIGN.md](./ASK-USER-UI-DESIGN.md) 的"主题定制"部分

### Q: 如何处理超时？
A: 参见 [ASK-USER-DIRECT-UI.md](../../core/docs/ASK-USER-DIRECT-UI.md) 的"注意事项"部分

### Q: 两种方案有什么区别？
A: 参见 [ASK-USER-TOOL.md](../../core/docs/ASK-USER-TOOL.md) 的对比表格

### Q: 如何测试功能？
A: 运行 `packges/core/test/ask-user-direct.test.ts`

## 📝 更新日志

### 2024-XX-XX - 初始版本
- ✅ 实现全局回调机制
- ✅ 创建 AskUserModal 组件
- ✅ 集成到主应用
- ✅ 编写完整文档
- ✅ 添加测试用例

## 🤝 贡献指南

如果你想改进 `ask_user` 工具：

1. **修改代码** - 在 `packges/core/src/tools/control.ts` 或 UI 组件中
2. **添加测试** - 在 `packges/core/test/ask-user-direct.test.ts` 中
3. **更新文档** - 在相应的 `.md` 文件中
4. **运行测试** - 确保所有测试通过

## 📧 反馈

如有问题或建议，请：
- 查看相关文档
- 运行示例代码
- 检查测试用例
- 提交 Issue 或 PR

---

**快速链接：**
- [快速开始](./ASK-USER-QUICK-START.md)
- [UI 设计](./ASK-USER-UI-DESIGN.md)
- [视觉演示](./ASK-USER-VISUAL-DEMO.md)
- [技术实现](../../core/docs/ASK-USER-DIRECT-UI.md)
- [功能总结](./ASK-USER-SUMMARY.md)
