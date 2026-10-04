export type RecipeAssistantErrorCode = "conversation_not_found";

export class RecipeAssistantError extends Error {
  constructor(
    message: string,
    public readonly code: RecipeAssistantErrorCode,
  ) {
    super(message);
    this.name = "RecipeAssistantError";
  }
}

export class RecipeAssistantConversationNotFoundError extends RecipeAssistantError {
  constructor() {
    super("Conversation not found.", "conversation_not_found");
  }
}
