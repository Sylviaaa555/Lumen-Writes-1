import type { ModelPrice, TokenUsage } from "./types";

export function currentBudgetPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function parseJsonMap<T>(value: string | undefined): Record<string, T> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

export function resolveModel(
  requested: unknown,
  defaultModel: string,
  routesJson: string,
): string {
  const routes = parseJsonMap<string>(routesJson);
  const selected =
    typeof requested === "string" && requested.trim() ? requested.trim() : defaultModel;
  return routes[selected] || selected;
}

export function calculateCostMicrousd(
  model: string,
  usage: TokenUsage,
  pricingJson: string,
): number {
  const prices = parseJsonMap<ModelPrice>(pricingJson);
  const price = prices[model];
  if (!price) return 0;
  const input = Number.isFinite(price.input) ? price.input : 0;
  const output = Number.isFinite(price.output) ? price.output : 0;
  return Math.max(
    0,
    Math.round(usage.prompt_tokens * input + usage.completion_tokens * output),
  );
}

export function dollarsToMicrousd(value: unknown): number {
  const dollars = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new Error("monthly_budget_usd must be a non-negative number");
  }
  return Math.round(dollars * 1_000_000);
}

export function microusdToDollars(value: number): number {
  return Number((value / 1_000_000).toFixed(6));
}

export async function hashApiKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `lgw_${value}`;
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}
