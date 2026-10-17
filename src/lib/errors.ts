/**
 * Small typed error helpers. API routes and server actions translate these into
 * safe user-facing responses. Internal details are never leaked to users.
 */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Some fields are invalid.",
    fieldErrors?: Record<string, string[]>,
  ) {
    super(400, "VALIDATION_ERROR", message, fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state.") {
    super(409, "CONFLICT", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Convert any thrown value into a safe JSON-serialisable shape. */
export function toErrorResponse(error: unknown): {
  status: number;
  body: { code: string; message: string; fieldErrors?: Record<string, string[]> };
} {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    };
  }
  // Never surface internal error details to the client.
  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  };
}
