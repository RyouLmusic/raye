/**
 * 工具注册表
 * 提供工具的注册、管理和查询功能
 */
import { calculate } from "@/tools/caculate.js";
import { finish_task, ask_user } from "@/tools/control.js";
import { spawn_agent } from "@/tools/task_tool.js";
import { web_search } from "@/tools/search.js";
import type { Tool, ToolSet } from "ai";


/**
 * 动态工具注册表（可变）
 */
class ToolRegistry {
    private tools: Map<string, Tool> = new Map();
    private locked: boolean = false;

    constructor() {
        // 初始化默认工具
        this.registerDefaults();
    }

    /**
     * 注册默认工具
     */
    private registerDefaults() {
        this.tools.set("calculate", calculate);
        this.tools.set("finish_task", finish_task);
        this.tools.set("ask_user", ask_user);
        this.tools.set("spawn_agent", spawn_agent);
        this.tools.set("web_search", web_search);
        // 添加更多默认工具...
    }

    /**
     * 注册单个工具
     */
    register(name: string, tool: Tool): void {
        if (this.locked) {
            throw new Error("Tool registry is locked. Cannot register new tools.");
        }

        if (this.tools.has(name)) {
            console.warn(`Tool "${name}" already exists. Overwriting...`);
        }

        this.tools.set(name, tool);
        console.log(`✓ Tool "${name}" registered successfully`);
    }

    /**
     * 批量注册工具
     */
    registerBatch(tools: Record<string, Tool>): void {
        for (const [name, tool] of Object.entries(tools)) {
            this.register(name, tool);
        }
    }

    /**
     * 取消注册工具
     */
    unregister(name: string): boolean {
        if (this.locked) {
            throw new Error("Tool registry is locked. Cannot unregister tools.");
        }

        const deleted = this.tools.delete(name);
        if (deleted) {
            console.log(`✓ Tool "${name}" unregistered`);
        } else {
            console.warn(`Tool "${name}" not found in registry`);
        }
        return deleted;
    }

    /**
     * 获取单个工具
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * 检查工具是否存在
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * 获取所有工具名称
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * 获取所有工具
     */
    getAll(): Record<string, Tool> {
        return Object.fromEntries(this.tools);
    }

    /**
     * 根据名称数组获取工具集
     */
    getByNames(names: string[]): ToolSet {
        const tools: ToolSet = {};

        for (const name of names) {
            const tool = this.tools.get(name);
            if (tool) {
                tools[name] = tool;
            } else {
                console.warn(
                    `Tool "${name}" not found in registry. Available tools: ${this.getToolNames().join(', ')}`
                );
            }
        }

        return tools;
    }

    /**
     * 清空所有工具（除了默认工具）
     */
    reset(): void {
        if (this.locked) {
            throw new Error("Tool registry is locked. Cannot reset.");
        }

        this.tools.clear();
        this.registerDefaults();
        console.log("Tool registry reset to defaults");
    }

    /**
     * 锁定注册表，防止修改
     */
    lock(): void {
        this.locked = true;
        console.log("Tool registry locked");
    }

    /**
     * 解锁注册表
     */
    unlock(): void {
        this.locked = false;
        console.log("Tool registry unlocked");
    }

    /**
     * 获取注册表统计信息
     */
    getStats(): {
        totalTools: number;
        toolNames: string[];
        isLocked: boolean;
    } {
        return {
            totalTools: this.tools.size,
            toolNames: this.getToolNames(),
            isLocked: this.locked
        };
    }
}

/**
 * 全局工具注册表实例
 */
export const toolRegistry = new ToolRegistry();

/**
 * 工具名称类型（动态生成）
 * 注意：这会在运行时根据注册表内容变化
 */
export type ToolName = string;

/**
 * 静态工具注册表（用于类型推断）
 * 保持向后兼容
 */
export const staticToolRegistry = {
    calculate,
    web_search,
    // 添加更多静态工具...
} as const;

/**
 * 静态工具名称类型
 */
export type StaticToolName = keyof typeof staticToolRegistry;

/**
 * 验证工具名称是否有效
 */
export function isValidToolName(name: string): boolean {
    return toolRegistry.has(name);
}

/**
 * 根据工具名称数组获取工具对象
 */
export function getToolsByNames(toolNames: string[]): ToolSet {
    return toolRegistry.getByNames(toolNames);
}

/**
 * 动态注册工具的辅助函数
 */
export function registerTool(name: string, tool: any): void {
    toolRegistry.register(name, tool);
}

/**
 * 批量注册工具
 */
export function registerTools(tools: Record<string, any>): void {
    toolRegistry.registerBatch(tools);
}

/**
 * 取消注册工具
 */
export function unregisterTool(name: string): boolean {
    return toolRegistry.unregister(name);
}

/**
 * 获取所有已注册的工具名称
 */
export function getRegisteredToolNames(): string[] {
    return toolRegistry.getToolNames();
}

/**
 * 获取注册表统计信息
 */
export function getToolRegistryStats() {
    return toolRegistry.getStats();
}
