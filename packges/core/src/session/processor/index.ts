import { createCompressor } from "@/session/processor/compressor";
import { createExecutor } from "@/session/processor/executor";
import { createPlanner } from "@/session/processor/planner";

export interface Processor {
    execute: ReturnType<typeof createExecutor>["execute"];
    plan: ReturnType<typeof createPlanner>["plan"];
    compress: ReturnType<typeof createCompressor>["compress"];
}

export function createProcessor(): Processor {
    const executor = createExecutor();
    const planner = createPlanner();
    const compressor = createCompressor();

    return {
        execute: executor.execute,
        plan: planner.plan,
        compress: compressor.compress,
    };
}

export const Processor = createProcessor();

export type { ExecuteInput, ExecuteResult } from "@/session/processor/executor";