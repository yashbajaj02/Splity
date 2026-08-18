import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "SP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getCleanErrorMessage(error: any): string {
  if (!error) return "An unexpected error occurred.";
  const msg = typeof error === "string" ? error : error.message || String(error);
  const technicalKeywords = [
    "PostgrestError",
    "duplicate key",
    "violates unique constraint",
    "JSON",
    "SQL",
    "{",
    "}",
    "TypeError",
    "undefined",
    "null",
    "NaN",
    "Failed to fetch",
  ];
  const isTechnical = technicalKeywords.some((keyword) => msg.includes(keyword));

  if (isTechnical) {
    return "An unexpected error occurred. Please try again.";
  }
  return msg;
}
