export type AddressErrorCode = "not_found" | "forbidden" | "limit_exceeded";

export class AddressServiceError extends Error {
  constructor(
    public readonly code: AddressErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AddressServiceError";
  }
}

export class AddressNotFoundError extends AddressServiceError {
  constructor() {
    super("not_found", "Address not found.");
  }
}

export class AddressForbiddenError extends AddressServiceError {
  constructor() {
    super("forbidden", "You do not have access to this address.");
  }
}

export class AddressLimitExceededError extends AddressServiceError {
  constructor(public readonly limit: number) {
    super("limit_exceeded", `You can save up to ${limit} addresses. Delete one before adding another.`);
  }
}
