# 文件工具完整指南

## 📁 工具概览

所有文件工具都在 `file_tool.ts` 中统一管理，共 13 个工具：

### 基础操作 (1-8)
1. **fs_create** - 创建文件或目录
2. **fs_read** - 读取文件
3. **fs_write** - 写入文件
4. **fs_delete** - 删除文件或目录
5. **fs_move** - 移动/重命名
6. **fs_list** - 列出目录内容
7. **fs_search** - 搜索文件名或内容
8. **fs_replace** - 查找替换

### 高级操作 (9-13)
9. **fs_stat** - 获取文件信息（字数统计等）
10. **fs_copy** - 复制文件或目录
11. **fs_batch_read** - 批量读取文件
12. **fs_glob** - Glob 模式匹配
13. **fs_tree** - 生成目录树

---

## 📖 工具详解

### 基础文件工具

#### 1. fs_create - 创建文件或目录
```typescript
// 创建文件
{ filePath: "chapter-01.md", content: "# 第一章" }

// 创建目录
{ filePath: "chapters/", onlyDir: true }
```

#### 2. fs_read - 读取文件
```typescript
{ filePath: "outline.md", encoding: "utf8" }
```

#### 3. fs_write - 写入文件
```typescript
// 覆盖模式
{ filePath: "draft.md", content: "新内容", mode: "overwrite" }

// 追加模式
{ filePath: "log.txt", content: "新日志\n", mode: "append" }
```

#### 4. fs_delete - 删除文件或目录
```typescript
{ targetPath: "old-draft.md" }
```

#### 5. fs_move - 移动/重命名
```typescript
{ sourcePath: "draft.md", destPath: "chapters/chapter-01.md" }
```

#### 6. fs_list - 列出目录内容
```typescript
// 非递归
{ dirPath: "chapters/", recursive: false }

// 递归列出所有文件
{ dirPath: "project/", recursive: true }
```

#### 7. fs_search - 搜索文件名或内容
```typescript
// 按文件名搜索
{ rootDir: "chapters/", pattern: "chapter", searchType: "name" }

// 按内容搜索
{ rootDir: "chapters/", pattern: "主角", searchType: "content" }
```

#### 8. fs_replace - 查找替换
```typescript
{ 
  filePath: "chapter-01.md", 
  search: "旧名字", 
  replace: "新名字",
  replaceAll: true 
}
```

---

### 高级文件工具 (`file_tool_advanced.ts`)

#### 1. fs_stat - 获取文件信息
```typescript
{ targetPath: "chapter-01.md", analyzeText: true }

// 返回：
// - 文件大小、创建/修改时间
// - 行数、字数、字符数（文本文件）
```

**用途**：
- 写作进度追踪（字数统计）
- 版本管理（修改时间）
- 项目分析（文件大小）

#### 2. fs_copy - 复制文件或目录
```typescript
// 备份章节
{ sourcePath: "chapter-01.md", destPath: "backups/chapter-01-v1.md" }

// 复制整个目录
{ sourcePath: "chapters/", destPath: "backups/chapters-2024/", overwrite: false }
```

**用途**：
- 版本备份
- 模板复制
- 项目快照

#### 3. fs_batch_read - 批量读取文件
```typescript
{ 
  filePaths: [
    "chapters/chapter-01.md",
    "chapters/chapter-02.md",
    "chapters/chapter-03.md"
  ],
  encoding: "utf8",
  continueOnError: true
}
```

**用途**：
- 分析整本小说
- 生成完整文档
- 内容聚合

#### 4. fs_glob - Glob 模式匹配
```typescript
// 匹配所有 Markdown 文件
{ rootDir: "project/", pattern: "*.md" }

// 匹配所有章节
{ rootDir: "project/", pattern: "chapters/**/*.md" }

// 匹配特定命名模式
{ rootDir: "project/", pattern: "chapter-[0-9]*.md" }
```

**用途**：
- 批量操作文件
- 项目文件筛选
- 自动化处理

#### 5. fs_tree - 生成目录树
```typescript
{ 
  rootDir: "my-novel/",
  maxDepth: 3,
  showSize: true,
  excludePatterns: ["node_modules", ".git"]
}

// 返回：
// my-novel/
// ├── README.md (2.5KB)
// ├── outline.md (1.2KB)
// ├── chapters/
// │   ├── chapter-01.md (5.3KB)
// │   └── chapter-02.md (4.8KB)
// └── characters/
//     └── protagonist.json (856B)
```

**用途**：
- 生成项目文档
- README 自动生成
- 项目结构可视化

---

## 🎯 文档自动编写场景

### 场景 1：小说项目管理

```typescript
// 1. 创建项目结构
fs_create({ filePath: "my-novel/", onlyDir: true })
fs_create({ filePath: "my-novel/chapters/", onlyDir: true })
fs_create({ filePath: "my-novel/characters/", onlyDir: true })

// 2. 创建大纲
fs_create({ 
  filePath: "my-novel/outline.md", 
  content: "# 故事大纲\n\n## 第一幕\n..." 
})

// 3. 批量创建章节
for (let i = 1; i <= 10; i++) {
  fs_create({ 
    filePath: `my-novel/chapters/chapter-${i.toString().padStart(2, '0')}.md`,
    content: `# 第 ${i} 章\n\n`
  })
}

// 4. 统计写作进度
const chapters = await fs_glob({ 
  rootDir: "my-novel/chapters/", 
  pattern: "*.md" 
})

const stats = await Promise.all(
  chapters.matches.map(path => fs_stat({ targetPath: path }))
)

const totalWords = stats.reduce((sum, stat) => sum + (stat.words || 0), 0)
console.log(`总字数：${totalWords}`)

// 5. 生成项目文档
const tree = await fs_tree({ 
  rootDir: "my-novel/",
  showSize: true 
})

fs_write({ 
  filePath: "my-novel/README.md",
  content: `# 我的小说项目\n\n## 项目结构\n\`\`\`\n${tree.tree}\n\`\`\``
})
```

### 场景 2：代码项目文档生成

```typescript
// 1. 收集所有源文件
const sourceFiles = await fs_glob({ 
  rootDir: "src/", 
  pattern: "**/*.ts" 
})

// 2. 批量读取文件
const contents = await fs_batch_read({ 
  filePaths: sourceFiles.matches 
})

// 3. 分析代码（提取函数、类等）
// ... AI 分析代码结构 ...

// 4. 生成 API 文档
fs_write({ 
  filePath: "docs/API.md",
  content: generatedApiDocs
})

// 5. 生成项目结构图
const tree = await fs_tree({ 
  rootDir: ".",
  excludePatterns: ["node_modules", "dist", ".git"]
})

fs_write({ 
  filePath: "docs/STRUCTURE.md",
  content: `# 项目结构\n\n\`\`\`\n${tree.tree}\n\`\`\``
})
```

### 场景 3：版本管理与备份

```typescript
// 1. 创建备份目录
const timestamp = new Date().toISOString().replace(/:/g, '-')
const backupDir = `backups/backup-${timestamp}/`

fs_create({ filePath: backupDir, onlyDir: true })

// 2. 复制整个项目
fs_copy({ 
  sourcePath: "my-novel/",
  destPath: backupDir + "my-novel/"
})

// 3. 生成备份说明
const stats = await fs_stat({ targetPath: "my-novel/" })
fs_write({ 
  filePath: backupDir + "README.md",
  content: `# 备份信息\n\n- 时间：${timestamp}\n- 大小：${stats.size} 字节\n`
})
```

### 场景 4：内容分析与报告

```typescript
// 1. 读取所有章节
const chapters = await fs_glob({ 
  rootDir: "chapters/", 
  pattern: "chapter-*.md" 
})

const contents = await fs_batch_read({ 
  filePaths: chapters.matches 
})

// 2. 统计分析
const analysis = contents.files.map(file => {
  const stat = await fs_stat({ targetPath: file.path })
  return {
    chapter: file.path,
    words: stat.words,
    lines: stat.lines,
    modified: stat.modified
  }
})

// 3. 生成报告
const report = `# 写作进度报告\n\n` +
  `总章节数：${analysis.length}\n` +
  `总字数：${analysis.reduce((sum, a) => sum + a.words, 0)}\n\n` +
  `## 各章节详情\n\n` +
  analysis.map(a => `- ${a.chapter}: ${a.words} 字`).join('\n')

fs_write({ 
  filePath: "reports/progress.md",
  content: report
})
```

---

## 💡 最佳实践

### 1. 错误处理
所有工具都返回 `{ success: boolean }` 结构，始终检查返回值：

```typescript
const result = await fs_read({ filePath: "file.md" })
if (result.success) {
  console.log(result.content)
} else {
  console.error(result.message)
}
```

### 2. 批量操作优化
使用 `fs_batch_read` 和 `fs_glob` 组合，而不是循环调用 `fs_read`：

```typescript
// ❌ 不推荐
for (const file of files) {
  const content = await fs_read({ filePath: file })
}

// ✅ 推荐
const contents = await fs_batch_read({ filePaths: files })
```

### 3. 备份策略
重要操作前先备份：

```typescript
// 修改前备份
await fs_copy({ 
  sourcePath: "important.md", 
  destPath: "important.md.backup" 
})

// 执行修改
await fs_replace({ 
  filePath: "important.md", 
  search: "old", 
  replace: "new" 
})
```

### 4. 目录结构规划
使用 `fs_tree` 生成并维护项目结构文档：

```typescript
// 定期更新项目结构文档
const tree = await fs_tree({ rootDir: "." })
await fs_write({ 
  filePath: "docs/STRUCTURE.md",
  content: `\`\`\`\n${tree.tree}\n\`\`\``
})
```

---

## 📊 工具对比

| 工具 | 用途 | 适用场景 |
|------|------|----------|
| `fs_read` | 读取单个文件 | 查看特定文件内容 |
| `fs_batch_read` | 批量读取 | 分析整个项目 |
| `fs_search` | 内容搜索 | 查找特定文本 |
| `fs_glob` | 模式匹配 | 筛选特定类型文件 |
| `fs_stat` | 文件信息 | 统计字数、追踪进度 |
| `fs_tree` | 目录树 | 生成项目文档 |
| `fs_copy` | 复制 | 备份、版本管理 |

---

## 🚀 下一步

这些工具为文档自动编写提供了完整的基础设施。基于这些工具，可以构建：

1. **Novel Writing Skill** - 小说写作助手
2. **Code Documentation Skill** - 代码文档生成器
3. **Project Manager Skill** - 项目管理工具
4. **Backup Manager Skill** - 自动备份系统

所有高级功能都可以通过组合这些基础工具实现！
