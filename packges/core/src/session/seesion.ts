import type { ModelMessage } from "ai";
import { AsyncLocalStorage } from "async_hooks";
import type { Session, SessionMetadata } from "@/session/type";

// ============================================================
// Session 操作（纯函数，不可变）
// ============================================================

/**
 * Session 操作命名空间
 * 
 * 提供纯函数来操作 Session，每个操作都返回新的 Session 对象（不可变）
 */
export namespace SessionOps {
    /**
     * 创建新 Session
     */
    export function create(sessionId: string, agentId: string, userId?: string): Session {
        return {
            sessionId,
            userId,
            agentId,
            messages: [],
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                totalIterations: 0,
                totalTokens: 0,
            },
        };
    }

    /**
     * 添加单条消息（返回新 Session）
     */
    export function addMessage(session: Session, message: ModelMessage): Session {
        return {
            ...session,
            messages: [...session.messages, message],
            metadata: {
                ...session.metadata,
                updatedAt: new Date(),
            },
        };
    }

    /**
     * 添加多条消息（返回新 Session）
     */
    export function addMessages(session: Session, messages: readonly ModelMessage[]): Session {
        if (messages.length === 0) return session;
        
        return {
            ...session,
            messages: [...session.messages, ...messages],
            metadata: {
                ...session.metadata,
                updatedAt: new Date(),
            },
        };
    }

    /**
     * 压缩消息（保留系统消息和最近的消息）
     */
    export function compressMessages(session: Session, keepCount: number): Session {
        const systemMessages = session.messages.filter(m => m.role === "system");
        const nonSystemMessages = session.messages.filter(m => m.role !== "system");
        const recentMessages = nonSystemMessages.slice(-keepCount);

        return {
            ...session,
            messages: [...systemMessages, ...recentMessages],
            metadata: {
                ...session.metadata,
                updatedAt: new Date(),
                lastCompactionAt: new Date(),
            },
        };
    }

    /**
     * 更新元数据
     */
    export function updateMetadata(
        session: Session,
        updates: Partial<Omit<SessionMetadata, 'createdAt' | 'updatedAt'>>
    ): Session {
        return {
            ...session,
            metadata: {
                ...session.metadata,
                ...updates,
                updatedAt: new Date(),
            },
        };
    }

    /**
     * 增加迭代计数
     */
    export function incrementIterations(session: Session, count: number = 1): Session {
        return updateMetadata(session, {
            totalIterations: session.metadata.totalIterations + count,
        });
    }

    /**
     * 增加 token 计数
     */
    export function addTokens(session: Session, tokens: number): Session {
        return updateMetadata(session, {
            totalTokens: session.metadata.totalTokens + tokens,
        });
    }

    /**
     * 获取最近的 N 条消息
     */
    export function getRecentMessages(session: Session, count: number): readonly ModelMessage[] {
        return session.messages.slice(-count);
    }

    /**
     * 序列化为 JSON
     */
    export function toJSON(session: Session): string {
        return JSON.stringify(session);
    }

    /**
     * 从 JSON 反序列化
     */
    export function fromJSON(json: string): Session {
        const data = JSON.parse(json);
        return {
            ...data,
            metadata: {
                ...data.metadata,
                createdAt: new Date(data.metadata.createdAt),
                updatedAt: new Date(data.metadata.updatedAt),
                lastCompactionAt: data.metadata.lastCompactionAt 
                    ? new Date(data.metadata.lastCompactionAt) 
                    : undefined,
            },
        };
    }
}

// ============================================================
// Session 持久化（如果需要）
// ============================================================

/**
 * Session 存储接口
 */
export interface SessionStorage {
    save(session: Session): Promise<void>;
    load(sessionId: string): Promise<Session | null>;
    delete(sessionId: string): Promise<void>;
    exists(sessionId: string): Promise<boolean>;
}

/**
 * 内存存储实现（用于开发/测试）
 */
export class MemorySessionStorage implements SessionStorage {
    private store = new Map<string, string>();

    async save(session: Session): Promise<void> {
        this.store.set(session.sessionId, SessionOps.toJSON(session));
    }

    async load(sessionId: string): Promise<Session | null> {
        const json = this.store.get(sessionId);
        return json ? SessionOps.fromJSON(json) : null;
    }

    async delete(sessionId: string): Promise<void> {
        this.store.delete(sessionId);
    }

    async exists(sessionId: string): Promise<boolean> {
        return this.store.has(sessionId);
    }

    clear(): void {
        this.store.clear();
    }
}

// ============================================================
// Session Manager（管理多个 Session 的生命周期）
// ============================================================

/**
 * Session 管理器（使用 class 封装复杂逻辑）
 * 
 * 职责：
 * - Session 的创建、获取、更新
 * - 缓存管理
 * - 持久化管理
 * - 批量操作
 */
export class SessionManager {
    private cache = new Map<string, Session>();
    private storage: SessionStorage;

    constructor(storage?: SessionStorage) {
        this.storage = storage || new MemorySessionStorage();
    }

    /**
     * 获取或创建 Session
     */
    async getOrCreate(sessionId: string, agentId: string, userId?: string): Promise<Session> {
        // 1. 先从缓存查找
        if (this.cache.has(sessionId)) {
            return this.cache.get(sessionId)!;
        }

        // 2. 从存储加载
        let session = await this.storage.load(sessionId);

        // 3. 不存在则创建新的
        if (!session) {
            session = SessionOps.create(sessionId, agentId, userId);
            await this.storage.save(session);
        }

        // 4. 放入缓存
        this.cache.set(sessionId, session);
        return session;
    }

    /**
     * 获取 Session（不自动创建）
     */
    async get(sessionId: string): Promise<Session | null> {
        // 先查缓存
        if (this.cache.has(sessionId)) {
            return this.cache.get(sessionId)!;
        }

        // 从存储加载
        const session = await this.storage.load(sessionId);
        if (session) {
            this.cache.set(sessionId, session);
        }
        return session;
    }

    /**
     * 更新 Session
     * 
     * @param sessionId - Session ID
     * @param updater - 更新函数，接收当前 Session，返回新 Session
     */
    async update(sessionId: string, updater: (session: Session) => Session): Promise<Session> {
        const session = await this.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const updated = updater(session);
        this.cache.set(sessionId, updated);
        await this.storage.save(updated);
        return updated;
    }

    /**
     * 保存 Session
     */
    async save(session: Session): Promise<void> {
        this.cache.set(session.sessionId, session);
        await this.storage.save(session);
    }

    /**
     * 删除 Session
     */
    async delete(sessionId: string): Promise<void> {
        this.cache.delete(sessionId);
        await this.storage.delete(sessionId);
    }

    /**
     * 检查 Session 是否存在
     */
    async exists(sessionId: string): Promise<boolean> {
        if (this.cache.has(sessionId)) {
            return true;
        }
        return await this.storage.exists(sessionId);
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 批量清理过期 Session（示例）
     */
    async cleanup(olderThanDays: number): Promise<number> {
        // 这里可以实现清理逻辑
        // 例如：删除超过 N 天未更新的 Session
        // 需要存储支持列出所有 Session
        return 0;
    }
}

// ============================================================
// Session Context（类似线程本地存储，方便访问当前 Session）
// ============================================================

/**
 * Session 上下文
 * 
 * 使用 AsyncLocalStorage 实现类似线程本地存储的功能
 * 可以在任何异步调用链中访问当前 Session
 */
export class SessionContext {
    private static storage = new AsyncLocalStorage<Session>();

    /**
     * 在指定 Session 上下文中运行函数
     */
    static async run<T>(session: Session, fn: () => Promise<T>): Promise<T> {
        return this.storage.run(session, fn);
    }

    /**
     * 获取当前 Session
     * 
     * @throws 如果不在 Session 上下文中，抛出错误
     */
    static current(): Session {
        const session = this.storage.getStore();
        if (!session) {
            throw new Error("No active session context. Use SessionContext.run() to create one.");
        }
        return session;
    }

    /**
     * 尝试获取当前 Session（不抛出错误）
     */
    static tryGetCurrent(): Session | undefined {
        return this.storage.getStore();
    }

    /**
     * 检查是否在 Session 上下文中
     */
    static hasContext(): boolean {
        return this.storage.getStore() !== undefined;
    }

    /**
     * 更新当前 Session（返回新的 Session）
     * 
     * 注意：这不会自动更新上层的引用，需要手动传递
     */
    static update(updater: (session: Session) => Session): Session {
        const current = this.current();
        return updater(current);
    }
}

// ============================================================
// 便捷导出
// ============================================================

/**
 * 默认的全局 SessionManager 实例
 */
export const defaultSessionManager = new SessionManager();

/**
 * 快速获取当前 Session（从上下文中）
 */
export function getCurrentSession(): Session {
    return SessionContext.current();
}

/**
 * 尝试获取当前 Session
 */
export function tryGetCurrentSession(): Session | undefined {
    return SessionContext.tryGetCurrent();
}