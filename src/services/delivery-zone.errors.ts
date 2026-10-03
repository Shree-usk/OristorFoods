export type DeliveryZoneErrorCode = "city_conflict" | "zone_not_found" | "override_not_found" | "override_validation";

export class DeliveryZoneError extends Error {
  constructor(
    message: string,
    public readonly code: DeliveryZoneErrorCode,
  ) {
    super(message);
    this.name = "DeliveryZoneError";
  }
}

export class DeliveryZoneCityConflictError extends DeliveryZoneError {
  constructor(city: string, conflictingZoneName: string) {
    super(`"${city}" is already covered by the active zone "${conflictingZoneName}".`, "city_conflict");
  }
}

export class DeliveryZoneNotFoundError extends DeliveryZoneError {
  constructor() {
    super("Delivery zone not found.", "zone_not_found");
  }
}

export class DeliveryOverrideNotFoundError extends DeliveryZoneError {
  constructor() {
    super("Delivery rate override not found.", "override_not_found");
  }
}

export class DeliveryOverrideValidationError extends DeliveryZoneError {
  constructor(message: string) {
    super(message, "override_validation");
  }
}
