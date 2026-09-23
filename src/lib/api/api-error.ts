/**
 * Error thrown by browser API clients on a non-2xx response, carrying the
 * HTTP status and any per-field validation errors from the server's
 * `{ error, fieldErrors? }` body. `F` is the form's field-name union.
 */
export class ApiError<F extends string = string> extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<F, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<F, string[]>> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function readApiError<F extends string>(response: Response): Promise<ApiError<F>> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new ApiError<F>(
    body?.error ?? `Request failed (${response.status})`,
    response.status,
    (body?.fieldErrors ?? {}) as Partial<Record<F, string[]>>,
  );
}
