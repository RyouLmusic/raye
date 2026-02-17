import type { ModelMessage } from "ai";
import { z } from "zod";
import type { AgentConfig } from "@/agent/type";
import type { LoopInput } from "@/session/type";
export class Session {
    private messages: ModelMessage[] = [];
    private sessionId: string;
    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    public addMessage(message: ModelMessage) {
        this.messages.push(message);
    }
    
    public getMessages(): ModelMessage[] {
        return this.messages;
    }

    public addMessages(messages: ModelMessage[]) {
        this.messages.push(...messages);
    }
}