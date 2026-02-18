# Session 架构使用示例

## 📚 架构概览

```typescript
// 1. Session（纯数据）
interface Session {
    readonly sessionId: string;
    readonly messages: readonly ModelMessage[];
    readonly metadata: SessionMetadata;
}

// 2. SessionOps（纯函数）
namespace SessionOps {
    create(), addMessage(), compress(), etc.
}

// 3. SessionManager（复杂逻辑）
class SessionManager {
    getOrCreate(), update(), save(), etc.
}

// 4. SessionContext（上下文访问）
class SessionContext {
    run(), current(), tryGetCurrent()
}
```

---

## 🚀 基本使用

### 示例 1: 创建和操作 Session

```typescript
import { SessionOps } from "@/session/seesion";

// 创建新 Session（不可变）
let session = SessionOps.create("session-001", "my-agent");

// 添加消息（返回新 Session）
session = SessionOps.addMessage(session, {
    role: "user",
    content: "你好"
});

session = SessionOps.addMessage(session, {
    role: "assistant",
    content: "你好！有什么可以帮助你的吗？"
});

// 获取消息
console.log(session.messages);  // readonly array

// 压缩消息
session = SessionOps.compressMessages(session, 10);

// 序列化
const json = SessionOps.toJSON(session);

// 反序列化
const loaded = SessionOps.fromJSON(json);
```

### 示例 2: 使用 SessionManager

```typescript
import { SessionManager, MemorySessionStorage } from "@/session/seesion";

// 创建 Manager（使用内存存储）
const manager = new SessionManager(new MemorySessionStorage());

// 获取或创建 Session
const session = await manager.getOrCreate("session-001", "my-agent", "user-123");

// 更新 Session
await manager.update("session-001", (s) => 
    SessionOps.addMessage(s, {
        role: "user",
        content: "新消息"
    })
);

// 获取 Session
const retrieved = await manager.get("session-001");

// 检查是否存在
const exists = await manager.exists("session-001");

// 删除 Session
await manager.delete("session-001");
```

---

## 🔄 在 Agent Loop 中使用

### 示例 3: 基本的 Agent Loop

```typescript
import { AgentLoop } from "@/session/loop";
import { SessionManager } from "@/session/seesion";

const manager = new SessionManager();

// 方式 1: 让 Loop 自动创建 Session
const result = await AgentLoop.loop({
    sessionId: "session-001",
    agentConfig: {
        name: "my-agent",
        model: "gpt-4",
        // ... 其他配置
    },
    initialMessages: [
        { role: "user", content: "帮我分析代码" }
    ],
    maxIterations: 10,
    compactThreshold: 20,
}, manager);

if (result.success) {
    console.log("完成！");
    console.log("Session:", result.session);
    console.log("消息数:", result.messages.length);
}
```

### 示例 4: 续传对话（使用已有 Session）

```typescript
import { AgentLoop } from "@/session/loop";
import { SessionManager, SessionOps } from "@/session/seesion";

const manager = new SessionManager();

// 第一次对话
let result = await AgentLoop.loop({
    sessionId: "session-001",
    agentConfig: { /* ... */ },
    initialMessages: [
        { role: "user", content: "第一个问题" }
    ],
}, manager);

// 保存 Session
let session = result.session!;

// ===== 过了一段时间 =====

// 用户继续对话
session = SessionOps.addMessage(session, {
    role: "user",
    content: "继续上次的话题"
});

// 第二次对话（使用已有 Session）
result = await AgentLoop.loop({
    sessionId: "session-001",
    agentConfig: { /* ... */ },
    session,  // ← 传入已有 Session
}, manager);

console.log("总消息数:", result.session!.messages.length);
console.log("总迭代次数:", result.session!.metadata.totalIterations);
```

---

## 🎯 使用 SessionContext（线程本地存储）

### 示例 5: 在工具函数中访问当前 Session

```typescript
import { SessionContext, getCurrentSession } from "@/session/seesion";

// 工具函数：可以在任何地方访问当前 Session
function logCurrentSession() {
    try {
        const session = getCurrentSession();
        console.log("当前 Session ID:", session.sessionId);
        console.log("消息数:", session.messages.length);
    } catch (error) {
        console.log("不在 Session 上下文中");
    }
}

// 在 Session 上下文中运行
const session = SessionOps.create("session-001", "my-agent");

await SessionContext.run(session, async () => {
    // 在这个 async 函数内，任何地方都可以访问 session
    logCurrentSession();  // ✅ 可以访问
    
    await someAsyncOperation();
    logCurrentSession();  // ✅ 仍然可以访问
});

logCurrentSession();  // ❌ 抛出错误：不在上下文中
```

### 示例 6: 在嵌套调用中访问 Session

```typescript
import { SessionContext, getCurrentSession } from "@/session/seesion";

async function processMessage(content: string) {
    // 自动获取当前 Session
    const session = getCurrentSession();
    
    console.log(`Processing message in session: ${session.sessionId}`);
    console.log(`Current message count: ${session.messages.length}`);
    
    // 可以调用其他函数，它们也能访问同一个 Session
    await analyzeContent(content);
}

async function analyzeContent(content: string) {
    // 这里也能访问到同一个 Session
    const session = getCurrentSession();
    console.log(`Analyzing in session: ${session.sessionId}`);
}

// 使用
const session = SessionOps.create("session-001", "my-agent");

await SessionContext.run(session, async () => {
    await processMessage("Hello");  // ✅ 可以访问 session
    await processMessage("World");  // ✅ 可以访问 session
});
```

### 示例 7: Agent Loop 自动设置上下文

```typescript
import { AgentLoop } from "@/session/loop";
import { getCurrentSession } from "@/session/seesion";

// Agent Loop 内部会自动调用 SessionContext.run()
const result = await AgentLoop.loop({
    sessionId: "session-001",
    agentConfig: { /* ... */ },
    initialMessages: [{ role: "user", content: "Hello" }],
});

// 在 Loop 执行期间，所有异步调用都能访问 Session
// 例如在 Processor.execute() 中：
async function someInternalFunction() {
    const session = getCurrentSession();  // ✅ 自动获取
    console.log("当前消息数:", session.messages.length);
}
```

---

## 💾 持久化示例

### 示例 8: 实现自定义存储

```typescript
import { SessionStorage, Session, SessionOps } from "@/session/seesion";
import fs from "fs/promises";

// 实现文件系统存储
class FileSystemStorage implements SessionStorage {
    private baseDir: string;
    
    constructor(baseDir: string) {
        this.baseDir = baseDir;
    }
    
    async save(session: Session): Promise<void> {
        const filePath = `${this.baseDir}/${session.sessionId}.json`;
        await fs.writeFile(filePath, SessionOps.toJSON(session));
    }
    
    async load(sessionId: string): Promise<Session | null> {
        try {
            const filePath = `${this.baseDir}/${sessionId}.json`;
            const json = await fs.readFile(filePath, "utf-8");
            return SessionOps.fromJSON(json);
        } catch {
            return null;
        }
    }
    
    async delete(sessionId: string): Promise<void> {
        const filePath = `${this.baseDir}/${sessionId}.json`;
        await fs.unlink(filePath);
    }
    
    async exists(sessionId: string): Promise<boolean> {
        try {
            const filePath = `${this.baseDir}/${sessionId}.json`;
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// 使用自定义存储
const storage = new FileSystemStorage("./sessions");
const manager = new SessionManager(storage);
```

### 示例 9: 实现数据库存储

```typescript
import { SessionStorage, Session, SessionOps } from "@/session/seesion";

// 实现 Redis 存储
class RedisStorage implements SessionStorage {
    private redis: RedisClient;
    
    constructor(redis: RedisClient) {
        this.redis = redis;
    }
    
    async save(session: Session): Promise<void> {
        await this.redis.set(
            `session:${session.sessionId}`,
            SessionOps.toJSON(session),
            { EX: 86400 }  // 24小时过期
        );
    }
    
    async load(sessionId: string): Promise<Session | null> {
        const json = await this.redis.get(`session:${sessionId}`);
        return json ? SessionOps.fromJSON(json) : null;
    }
    
    async delete(sessionId: string): Promise<void> {
        await this.redis.del(`session:${sessionId}`);
    }
    
    async exists(sessionId: string): Promise<boolean> {
        return await this.redis.exists(`session:${sessionId}`) === 1;
    }
}
```

---

## 🧪 测试示例

### 示例 10: 测试 Session 操作

```typescript
import { SessionOps } from "@/session/seesion";
import { describe, it, expect } from "bun:test";

describe("SessionOps", () => {
    it("should create session", () => {
        const session = SessionOps.create("s1", "agent1");
        
        expect(session.sessionId).toBe("s1");
        expect(session.agentId).toBe("agent1");
        expect(session.messages).toEqual([]);
    });
    
    it("should add message immutably", () => {
        const s1 = SessionOps.create("s1", "agent1");
        const s2 = SessionOps.addMessage(s1, { role: "user", content: "hi" });
        
        // 不可变：原对象未改变
        expect(s1.messages.length).toBe(0);
        expect(s2.messages.length).toBe(1);
    });
    
    it("should compress messages", () => {
        let session = SessionOps.create("s1", "agent1");
        
        // 添加 20 条消息
        for (let i = 0; i < 20; i++) {
            session = SessionOps.addMessage(session, {
                role: "user",
                content: `msg ${i}`
            });
        }
        
        expect(session.messages.length).toBe(20);
        
        // 压缩到 10 条
        session = SessionOps.compressMessages(session, 10);
        expect(session.messages.length).toBe(10);
    });
});
```

---

## 🎨 高级用法

### 示例 11: 实现时间旅行（Undo/Redo）

```typescript
import { SessionOps, Session } from "@/session/seesion";

class SessionHistory {
    private history: Session[] = [];
    private currentIndex = -1;
    
    add(session: Session) {
        // 移除当前位置之后的历史
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // 添加新状态
        this.history.push(session);
        this.currentIndex++;
    }
    
    undo(): Session | null {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return null;
    }
    
    redo(): Session | null {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        }
        return null;
    }
    
    current(): Session | null {
        return this.currentIndex >= 0 ? this.history[this.currentIndex] : null;
    }
}

// 使用
const history = new SessionHistory();
let session = SessionOps.create("s1", "agent1");
history.add(session);

session = SessionOps.addMessage(session, { role: "user", content: "msg1" });
history.add(session);

session = SessionOps.addMessage(session, { role: "user", content: "msg2" });
history.add(session);

// Undo
session = history.undo()!;
console.log(session.messages.length);  // 1

// Redo
session = history.redo()!;
console.log(session.messages.length);  // 2
```

### 示例 12: 实现 Session 分支

```typescript
import { SessionOps, Session } from "@/session/seesion";

interface SessionBranch {
    id: string;
    parent?: string;
    session: Session;
}

class SessionTree {
    private branches = new Map<string, SessionBranch>();
    
    createBranch(branchId: string, fromSession: Session, parentBranchId?: string) {
        this.branches.set(branchId, {
            id: branchId,
            parent: parentBranchId,
            session: fromSession,
        });
    }
    
    updateBranch(branchId: string, updater: (s: Session) => Session) {
        const branch = this.branches.get(branchId);
        if (!branch) throw new Error(`Branch not found: ${branchId}`);
        
        branch.session = updater(branch.session);
    }
    
    getBranch(branchId: string): Session | null {
        return this.branches.get(branchId)?.session || null;
    }
}

// 使用：探索不同的对话分支
const tree = new SessionTree();
const baseSession = SessionOps.create("s1", "agent1");

// 主分支
tree.createBranch("main", baseSession);
tree.updateBranch("main", s => 
    SessionOps.addMessage(s, { role: "user", content: "选项 A" })
);

// 创建另一个分支（探索不同选择）
tree.createBranch("alternative", baseSession, "main");
tree.updateBranch("alternative", s =>
    SessionOps.addMessage(s, { role: "user", content: "选项 B" })
);
```

---

## 📝 最佳实践总结

### ✅ DO（推荐）

```typescript
// ✅ 使用纯函数操作 Session
session = SessionOps.addMessage(session, message);

// ✅ 使用 SessionManager 管理持久化
await manager.save(session);

// ✅ 使用 SessionContext 访问当前 Session
const current = getCurrentSession();

// ✅ 保持 Session 不可变
const newSession = { ...session, messages: [...session.messages, msg] };
```

### ❌ DON'T（不推荐）

```typescript
// ❌ 直接修改 Session（违反不可变性）
session.messages.push(message);  // 编译错误：readonly

// ❌ 绕过类型系统修改
(session.messages as any).push(message);

// ❌ 在没有上下文时调用 getCurrentSession()
const session = getCurrentSession();  // 可能抛出错误

// ❌ 忘记保存 Session
session = SessionOps.addMessage(session, msg);
// 忘记调用 manager.save(session)
```

---

## 🎯 总结

新架构的优势：

1. **不可变性** ✅：所有操作返回新对象，安全
2. **易序列化** ✅：纯数据结构，直接 JSON
3. **易测试** ✅：纯函数，输入输出明确
4. **方便访问** ✅：SessionContext 提供全局访问
5. **职责清晰** ✅：数据、操作、管理分离
6. **类型安全** ✅：TypeScript 完全支持
