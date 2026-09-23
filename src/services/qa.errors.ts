/**
 * Typed errors thrown by qa.service.ts; route handlers map `code` to an HTTP
 * status in src/lib/api/qa-responses.ts.
 */
export type QaErrorCode = "invalid_input" | "product_not_found" | "question_not_found" | "invalid_transition";

export class QaServiceError extends Error {
  readonly code: QaErrorCode;

  constructor(code: QaErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidQuestionInputError extends QaServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class QaProductNotFoundError extends QaServiceError {
  constructor() {
    super("product_not_found", "Product not found");
  }
}

export class QuestionNotFoundError extends QaServiceError {
  constructor() {
    super("question_not_found", "Question not found");
  }
}

export class InvalidQuestionTransitionError extends QaServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A question can't move from ${from} to ${to}`);
  }
}
