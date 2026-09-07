export interface Bindings {
  DB: D1Database;
  ADMIN_TOKEN: string;
  UPSTREAM_API_KEY: string;
  UPSTREAM_BASE_URL: string;
  DEFAULT_MODEL: string;
  ALLOWED_ORIGIN: string;
  MODEL_ROUTES_JSON: string;
  MODEL_PRICING_JSON: string;
}

export interface GatewayUser {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  monthly_budget_microusd: number;
  spent_microusd: number;
  budget_period: string;
  active: number;
  created_at: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface ModelPrice {
  input: number;
  output: number;
}
