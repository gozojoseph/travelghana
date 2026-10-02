import type { ApiErrorResponse, SessionUser } from "@travelghana/types";

/**
 * Browser API client (§40 secure API design): sends credentials, normalizes
 * the { error: { code, message } } contract into ApiClientError.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const err = (body as ApiErrorResponse | null)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? "Something went wrong",
      err?.details,
    );
  }

  return body as T;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<{ user: SessionUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: { email: string; password: string }) =>
    request<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: SessionUser }>("/auth/me"),

  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

export function validationIssues(err: unknown): ValidationIssue[] {
  if (err instanceof ApiClientError && err.details && typeof err.details === "object") {
    const issues = (err.details as { issues?: ValidationIssue[] }).issues;
    if (Array.isArray(issues)) return issues;
  }
  return [];
}
