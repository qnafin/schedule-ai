import type { AgentRole } from './config';

/**
 * Состояние диалогов:
 * - sessions: responseId для previous_response_id, ключ по модели
 * - activeAgent: кто сейчас ведёт диалог (router не вызывается, пока активен)
 */
export class AgentState {
  private readonly sessions = new Map<string, string>();
  private readonly activeAgents = new Map<string, AgentRole>();

  getActive(sessionId: string): AgentRole | undefined {
    return this.activeAgents.get(sessionId);
  }

  setActive(sessionId: string, role: AgentRole): void {
    this.activeAgents.set(sessionId, role);
  }

  clearActive(sessionId: string): void {
    this.activeAgents.delete(sessionId);
  }

  getSession(sessionId: string, model: string): string | undefined {
    return this.sessions.get(this.key(sessionId, model));
  }

  setSession(sessionId: string, model: string, responseId: string): void {
    this.sessions.set(this.key(sessionId, model), responseId);
  }

  clearSession(sessionId: string, model: string): void {
    this.sessions.delete(this.key(sessionId, model));
  }

  /** Сброс всех сессий и активного агента для пользователя. */
  reset(sessionId: string): void {
    const prefix = `${sessionId}:`;
    for (const key of this.sessions.keys()) {
      if (key.startsWith(prefix)) this.sessions.delete(key);
    }
    this.activeAgents.delete(sessionId);
  }

  private key(sessionId: string, model: string): string {
    return `${sessionId}:${model}`;
  }
}