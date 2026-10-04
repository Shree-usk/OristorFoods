export type SupportAssistantErrorCode = "conversation_not_found";

export class SupportAssistantError extends Error {
  constructor(
    message: string,
    public readonly code: SupportAssistantErrorCode,
  ) {
    super(message);
    this.name = "SupportAssistantError";
  }
}

export class SupportAssistantConversationNotFoundError extends SupportAssistantError {
  constructor() {
    super("Conversation not found.", "conversation_not_found");
  }
}
