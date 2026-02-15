// 工具函数示例
export function formatDate(date: Date): string {
    return date.toISOString();
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
