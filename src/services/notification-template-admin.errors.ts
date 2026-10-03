export class NotificationTemplateNotFoundError extends Error {
  constructor() {
    super("Notification template not found.");
    this.name = "NotificationTemplateNotFoundError";
  }
}
