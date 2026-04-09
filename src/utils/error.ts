import { type APICallError } from "ai";
import { isString, isObject } from "radash";

interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

export function parseError(err: unknown): string {
  let errorMessage: string = "Unknown Error";
  if (isString(err)) {
    errorMessage = err;
  } else if (err instanceof Error) {
    errorMessage = `[${err.name}]: ${err.message}`;
  } else if (isObject(err)) {
    const { error } = err as { error: APICallError };
    if (error.responseBody) {
      try {
        const response = JSON.parse(error.responseBody) as GeminiError;
        errorMessage = `[${response.error.status}]: ${response.error.message}`;
      } catch {
        errorMessage = `[${error.name}]: ${error.responseBody}`;
      }
    } else {
      errorMessage = `[${error.name}]: ${error.message}`;
    }
  }
  return errorMessage;
}
