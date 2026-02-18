/**
 * Session 架构演示
 * 
 * 演示如何使用新的 Session 架构
 */

import { SessionOps, SessionManager, SessionContext, getCurrentSession } from "@/session/seesion";

// ============================================================
// 演示 1: 基本的 Session 操作（不可变）
// ============================================================

function demo1_BasicOperations() {
    console.log("\n========== 演示 1: 基本操作 ==========\n");
    
    // 创建 Session
    let session = SessionOps.create("demo-001", "demo-agent", "user-123");
    console.log("创建 Session:", session.sessionId);
    console.log("消息数:", session.messages.length);
    
    // 添加消息（不可变 - 返回新对象）
    const oldSession = session;
    session = SessionOps.addMessage(session, {
        role: "user",
        content: "你好"
    });
    
    console.log("\n添加消息后:");
    console.log("新 Session 消息数:", session.messages.length);
    console.log("旧 Session 消息数:", oldSession.messages.length);  // 不变！
    console.log("是同一个对象?", session === oldSession);  // false
    
    // 添加多条消息
    session = SessionOps.addMessages(session, [
        { role: "assistant", content: "你好！有什么可以帮助你的吗？" },
        { role: "user", content: "今天天气怎么样？" },
    ]);
    
    console.log("\n添加多条消息后:");
    console.log("消息数:", session.messages.length);
    
    // 序列化
    const json = SessionOps.toJSON(session);
    console.log("\n序列化长度:", json.length);
    
    // 反序列化
    const loaded = SessionOps.fromJSON(json);
    console.log("反序列化后的 sessionId:", loaded.sessionId);
    console.log("消息数:", loaded.messages.length);
}

// ============================================================
// 演示 2: 使用 SessionManager 管理多个 Session
// ============================================================

async function demo2_SessionManager() {
    console.log("\n========== 演示 2: SessionManager ==========\n");
    
    const manager = new SessionManager();
    
    // 获取或创建 Session
    const session1 = await manager.getOrCreate("session-001", "agent-1", "user-1");
    console.log("创建 Session 1:", session1.sessionId);
    
    // 更新 Session
    await manager.update("session-001", (s) => 
        SessionOps.addMessage(s, {
            role: "user",
            content: "第一条消息"
        })
    );
    console.log("更新 Session 1");
    
    // 再次获取（应该从缓存）
    const retrieved = await manager.get("session-001");
    console.log("从缓存获取 Session 1, 消息数:", retrieved?.messages.length);
    
    // 创建第二个 Session
    const session2 = await manager.getOrCreate("session-002", "agent-1", "user-2");
    console.log("创建 Session 2:", session2.sessionId);
    
    // 检查存在
    const exists1 = await manager.exists("session-001");
    const exists3 = await manager.exists("session-003");
    console.log("\nSession 1 存在?", exists1);
    console.log("Session 3 存在?", exists3);
    
    // 删除 Session
    await manager.delete("session-002");
    console.log("\n删除 Session 2");
    console.log("Session 2 存在?", await manager.exists("session-002"));
}

// ============================================================
// 演示 3: 使用 SessionContext 访问当前 Session
// ============================================================

async function demo3_SessionContext() {
    console.log("\n========== 演示 3: SessionContext ==========\n");
    
    // 创建 Session
    let session = SessionOps.create("context-demo", "demo-agent");
    session = SessionOps.addMessage(session, {
        role: "user",
        content: "测试上下文"
    });
    
    // 在函数外部访问（应该失败）
    try {
        getCurrentSession();
        console.log("❌ 不应该成功");
    } catch (error) {
        console.log("✅ 在上下文外访问失败（预期）");
    }
    
    // 在上下文中运行
    await SessionContext.run(session, async () => {
        console.log("\n进入 Session 上下文:");
        
        // 现在可以访问了
        const current = getCurrentSession();
        console.log("✅ 获取当前 Session:", current.sessionId);
        console.log("   消息数:", current.messages.length);
        
        // 调用其他函数，它们也能访问
        await nestedFunction1();
        await nestedFunction2();
    });
    
    console.log("\n退出 Session 上下文");
    
    // 退出上下文后又不能访问了
    try {
        getCurrentSession();
        console.log("❌ 不应该成功");
    } catch (error) {
        console.log("✅ 退出上下文后访问失败（预期）");
    }
}

// 嵌套函数：也能访问当前 Session
async function nestedFunction1() {
    const session = getCurrentSession();
    console.log("   在 nestedFunction1 中访问:", session.sessionId);
}

async function nestedFunction2() {
    const session = getCurrentSession();
    console.log("   在 nestedFunction2 中访问:", session.sessionId);
}

// ============================================================
// 演示 4: Session 压缩
// ============================================================

function demo4_Compression() {
    console.log("\n========== 演示 4: 消息压缩 ==========\n");
    
    // 创建 Session 并添加大量消息
    let session = SessionOps.create("compress-demo", "demo-agent");
    
    console.log("添加 30 条消息...");
    for (let i = 0; i < 30; i++) {
        session = SessionOps.addMessage(session, {
            role: i % 2 === 0 ? "user" : "assistant",
            content: `消息 ${i + 1}`
        });
    }
    
    console.log("压缩前消息数:", session.messages.length);
    
    // 压缩到 10 条
    session = SessionOps.compressMessages(session, 10);
    
    console.log("压缩后消息数:", session.messages.length);
    console.log("压缩时间:", session.metadata.lastCompactionAt);
}

// ============================================================
// 演示 5: 不可变性的好处 - 时间旅行
// ============================================================

function demo5_TimeTravel() {
    console.log("\n========== 演示 5: 时间旅行（Undo/Redo）==========\n");
    
    const history: typeof session[] = [];
    
    // 初始状态
    let session = SessionOps.create("time-travel", "demo-agent");
    history.push(session);
    console.log("初始状态，消息数:", session.messages.length);
    
    // 步骤 1
    session = SessionOps.addMessage(session, {
        role: "user",
        content: "消息 1"
    });
    history.push(session);
    console.log("步骤 1，消息数:", session.messages.length);
    
    // 步骤 2
    session = SessionOps.addMessage(session, {
        role: "assistant",
        content: "回复 1"
    });
    history.push(session);
    console.log("步骤 2，消息数:", session.messages.length);
    
    // 步骤 3
    session = SessionOps.addMessage(session, {
        role: "user",
        content: "消息 2"
    });
    history.push(session);
    console.log("步骤 3，消息数:", session.messages.length);
    
    // Undo x2（回到步骤 1）
    console.log("\n执行 Undo x2...");
    session = history[1]!;  // 回到步骤 1
    console.log("Undo 后消息数:", session.messages.length);
    console.log("最后消息:", session.messages[session.messages.length - 1]?.content);
    
    // Redo（前进到步骤 2）
    console.log("\n执行 Redo...");
    session = history[2]!;
    console.log("Redo 后消息数:", session.messages.length);
}

// ============================================================
// 演示 6: 元数据管理
// ============================================================

function demo6_Metadata() {
    console.log("\n========== 演示 6: 元数据管理 ==========\n");
    
    let session = SessionOps.create("metadata-demo", "demo-agent");
    
    console.log("初始元数据:");
    console.log("  创建时间:", session.metadata.createdAt);
    console.log("  更新时间:", session.metadata.updatedAt);
    console.log("  总迭代次数:", session.metadata.totalIterations);
    console.log("  总 Token 数:", session.metadata.totalTokens);
    
    // 增加迭代次数
    session = SessionOps.incrementIterations(session, 5);
    console.log("\n增加 5 次迭代后:");
    console.log("  总迭代次数:", session.metadata.totalIterations);
    
    // 增加 token 使用
    session = SessionOps.addTokens(session, 1000);
    console.log("\n增加 1000 tokens 后:");
    console.log("  总 Token 数:", session.metadata.totalTokens);
    
    // 压缩（会更新 lastCompactionAt）
    session = SessionOps.compressMessages(session, 5);
    console.log("\n压缩后:");
    console.log("  上次压缩时间:", session.metadata.lastCompactionAt);
}

// ============================================================
// 运行所有演示
// ============================================================

async function runAllDemos() {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     Session 架构演示                         ║");
    console.log("╚══════════════════════════════════════════════╝");
    
    demo1_BasicOperations();
    await demo2_SessionManager();
    await demo3_SessionContext();
    demo4_Compression();
    demo5_TimeTravel();
    demo6_Metadata();
    
    console.log("\n");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     所有演示完成！                           ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log("\n");
    
    console.log("✨ 新架构的优势:");
    console.log("  ✅ 不可变性 - 安全、可预测");
    console.log("  ✅ 纯函数 - 易测试、易调试");
    console.log("  ✅ 序列化 - 直接 JSON");
    console.log("  ✅ 上下文访问 - 方便全局访问");
    console.log("  ✅ 时间旅行 - 支持 Undo/Redo");
    console.log("  ✅ 职责清晰 - 数据、操作、管理分离\n");
}

// 运行
if (import.meta.main) {
    runAllDemos().catch(console.error);
}

export { runAllDemos };
