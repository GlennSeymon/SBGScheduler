import { isAxiosError } from 'axios';

interface RuleViolation {
  rule: string;
  message: string;
}

interface ApiErrorResponse {
  error: string;
  violations?: RuleViolation[];
}

// The assign/reschedule endpoints return this shape on 4xx — a plain { error } message, or
// { error, violations } when the rule engine rejects the request (see rule-engine.ts).
export function getApiErrorResponse(error: unknown): ApiErrorResponse | undefined {
  return isAxiosError<ApiErrorResponse>(error) ? error.response?.data : undefined;
}

// A single-line summary suitable for a Snackbar — the inline dialog Alert shows the full
// per-violation breakdown when there is one.
export function getErrorMessage(error: unknown): string {
  const response = getApiErrorResponse(error);
  if (response?.violations && response.violations.length > 0) {
    return response.violations.map((violation) => violation.message).join('; ');
  }
  return response?.error ?? 'Something went wrong';
}
