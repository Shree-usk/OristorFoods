export type ContactEnquiryErrorCode = "not_found";

export class ContactEnquiryError extends Error {
  code: ContactEnquiryErrorCode;
  constructor(code: ContactEnquiryErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class ContactEnquiryNotFoundError extends ContactEnquiryError {
  constructor() {
    super("not_found", "Enquiry not found.");
  }
}
