import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BackendError } from "../types/auth";

/**
 * Merges TailwindCSS class names cleanly without style conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a structured `BackendError` from an unknown Tauri IPC error object.
 */
export function parseBackendError(err: unknown): BackendError {
  if (typeof err === "object" && err !== null) {
    const record = err as Record<string, unknown>;
    if (
      typeof record.errorKey === "string" &&
      typeof record.message === "string"
    ) {
      return {
        errorKey: record.errorKey,
        message: record.message,
      };
    }
  }
  if (typeof err === "string") {
    return {
      errorKey: "errors.unexpectedError",
      message: err,
    };
  }
  if (err instanceof Error) {
    return {
      errorKey: "errors.unexpectedError",
      message: err.message,
    };
  }
  return {
    errorKey: "errors.unexpectedError",
    message: String(err),
  };
}

/**
 * Extracts the hostname from a URI string for display in the cipher list.
 */
export function extractHostname(rawUri?: string | null): string | null {
  if (!rawUri) return null;
  try {
    const withProtocol =
      rawUri.startsWith("http://") || rawUri.startsWith("https://")
        ? rawUri
        : `https://${rawUri}`;
    const url = new URL(withProtocol);
    return url.hostname;
  } catch {
    return rawUri;
  }
}

/**
 * Resolves the Bitwarden/Vaultwarden icon service URL for a given login URI and server base URL.
 */
export function getFaviconUrl(
  rawUri?: string | null,
  serverUrl?: string | null
): string | null {
  const hostname = extractHostname(rawUri)?.toLowerCase().trim();
  if (!hostname || !hostname.includes(".") || hostname === "localhost") {
    return null;
  }
  // Skip IPv4 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const base = (serverUrl ?? "").toLowerCase().replace(/\/+$/, "");
  if (!base || base.includes("bitwarden.com")) {
    return `https://icons.bitwarden.net/${encodeURIComponent(hostname)}/icon.png`;
  }
  if (base.includes("bitwarden.eu")) {
    return `https://icons.bitwarden.eu/${encodeURIComponent(hostname)}/icon.png`;
  }
  return `${(serverUrl ?? "").replace(/\/+$/, "")}/icons/${encodeURIComponent(hostname)}/icon.png`;
}

/**
 * Formats a credit card number with spaces every 4 digits, or masks all but the last 4 digits.
 */
export function formatCardNumber(
  num?: string | null,
  masked = true
): string {
  if (!num) return "";
  const digits = num.replace(/\s+/g, "");
  if (!masked) {
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }
  if (digits.length <= 4) return digits;
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}
