import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import {
  bearerToken,
  calculateCostMicrousd,
  createApiKey,
  currentBudgetPeriod,
  dollarsToMicrousd,
  hashApiKey,
  microusdToDollars,
  parseJsonMap,
  resolveModel,
} from "./core";
import { dashboardHtml } from "./dashboard";
import type { Bindings, GatewayUser, TokenUsage } from "./types";

type Variables = { user: GatewayUser };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function apiError(message: string, status = 400, type = "invalid_request_error") {
  return {
    body: { error: { message, type, code: null } },
    status: status as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502,
  };
}

app.use("*", async (c, next) => {
  const middleware = cors({
    origin: c.env.ALLOWED_ORIGIN || "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    maxAge: 86400,
  });
  return middleware(c, next);
});

app.get("/", (c) =>
  c.html(dashboardHtml, 200, {
    "Content-Security-Policy":
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "lumen-ai-gateway" }));

const requireAdmin: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    const error = apiError("Invalid administrator token", 401, "authentication_error");
    return c.json(error.body, error.status);
  }
  await next();
};

app.use("/admin/*", requireAdmin);

app.get("/admin/users", async (c) => {
  const period = currentBudgetPeriod();
  await c.env.DB.prepare(
    "UPDATE users SET spent_microusd = 0, budget_period = ? WHERE budget_period <> ?",
  )
    .bind(period, period)
    .run();
  const result = await c.env.DB.prepare(
    "SELECT id, name, key_prefix, monthly_budget_microusd, spent_microusd, active, created_at FROM users ORDER BY created_at DESC",
  ).all<Omit<GatewayUser, "key_hash" | "budget_period">>();
  return c.json({
    users: result.results.map((user) => ({
      id: user.id,
      name: user.name,
      key_prefix: user.key_prefix,
      monthly_budget_usd: microusdToDollars(user.monthly_budget_microusd),
      spent_usd: microusdToDollars(user.spent_microusd),
      active: Boolean(user.active),
      created_at: user.created_at,
    })),
  });
});

app.post("/admin/users", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    const error = apiError("name must contain 1 to 80 characters");
    return c.json(error.body, error.status);
  }

  let budget: number;
  try {
    budget = dollarsToMicrousd(body?.monthly_budget_usd);
  } catch (cause) {
    const error = apiError(cause instanceof Error ? cause.message : "Invalid budget");
    return c.json(error.body, error.status);
  }

  const id = crypto.randomUUID();
  const apiKey = createApiKey();
  const keyHash = await hashApiKey(apiKey);
  await c.env.DB.prepare(
    `INSERT INTO users
      (id, name, key_hash, key_prefix, monthly_budget_microusd, budget_period)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, name, keyHash, apiKey.slice(0, 12), budget, currentBudgetPeriod())
    .run();
  return c.json(
    {
      id,
      name,
      api_key: apiKey,
      monthly_budget_usd: microusdToDollars(budget),
      warning: "This API key is shown only once.",
    },
    201,
  );
});

app.patch("/admin/users/:id", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) {
    const error = apiError("Expected a JSON body");
    return c.json(error.body, error.status);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (typeof body.active === "boolean") {
    updates.push("active = ?");
    values.push(body.active ? 1 : 0);
  }
  if (body.monthly_budget_usd !== undefined) {
    try {
      updates.push("monthly_budget_microusd = ?");
      values.push(dollarsToMicrousd(body.monthly_budget_usd));
    } catch (cause) {
      const error = apiError(cause instanceof Error ? cause.message : "Invalid budget");
      return c.json(error.body, error.status);
    }
  }
  if (!updates.length) {
    const error = apiError("Provide active or monthly_budget_usd");
    return c.json(error.body, error.status);
  }
  values.push(c.req.param("id"));
  const result = await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();
  if (!result.meta.changes) {
    const error = apiError("User not found", 404);
    return c.json(error.body, error.status);
  }
  return c.json({ ok: true });
});

app.get("/admin/usage", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 100, 1), 500);
  const result = await c.env.DB.prepare(
    `SELECT usage_events.id, users.name AS user_name, usage_events.model,
      prompt_tokens, completion_tokens, cost_microusd, status, usage_events.created_at
     FROM usage_events JOIN users ON users.id = usage_events.user_id
     ORDER BY usage_events.created_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return c.json({
    events: result.results.map((event) => ({
      ...event,
      cost_usd: microusdToDollars(Number(event.cost_microusd)),
      cost_microusd: undefined,
    })),
  });
});

app.use("/v1/*", async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) {
    const error = apiError("Missing API key", 401, "authentication_error");
    return c.json(error.body, error.status);
  }
  const hash = await hashApiKey(token);
  const period = currentBudgetPeriod();
  await c.env.DB.prepare(
    "UPDATE users SET spent_microusd = 0, budget_period = ? WHERE key_hash = ? AND budget_period <> ?",
  )
    .bind(period, hash, period)
    .run();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE key_hash = ?")
    .bind(hash)
    .first<GatewayUser>();
  if (!user || !user.active) {
    const error = apiError("Invalid or disabled API key", 401, "authentication_error");
    return c.json(error.body, error.status);
  }
  if (
    user.monthly_budget_microusd > 0 &&
    user.spent_microusd >= user.monthly_budget_microusd
  ) {
    const error = apiError("Monthly budget exhausted", 429, "insufficient_quota");
    return c.json(error.body, error.status);
  }
  c.set("user", user);
  await next();
});

app.get("/v1/models", (c) => {
  const routes = parseJsonMap<string>(c.env.MODEL_ROUTES_JSON);
  const models = new Set([c.env.DEFAULT_MODEL, ...Object.keys(routes)]);
  return c.json({
    object: "list",
    data: [...models].filter(Boolean).map((id) => ({
      id,
      object: "model",
      created: 0,
      owned_by: "gateway",
    })),
  });
});

async function recordUsage(
  env: Bindings,
  userId: string,
  model: string,
  usage: TokenUsage,
  status: number,
) {
  const cost = calculateCostMicrousd(model, usage, env.MODEL_PRICING_JSON);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO usage_events
        (id, user_id, model, prompt_tokens, completion_tokens, cost_microusd, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      userId,
      model,
      usage.prompt_tokens,
      usage.completion_tokens,
      cost,
      status,
    ),
    env.DB.prepare("UPDATE users SET spent_microusd = spent_microusd + ? WHERE id = ?").bind(
      cost,
      userId,
    ),
  ]);
}

app.post("/v1/chat/completions", async (c) => {
  if (!c.env.UPSTREAM_API_KEY) {
    const error = apiError("Gateway has no upstream API key configured", 500);
    return c.json(error.body, error.status);
  }
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    const error = apiError("messages must be an array");
    return c.json(error.body, error.status);
  }

  const model = resolveModel(body.model, c.env.DEFAULT_MODEL, c.env.MODEL_ROUTES_JSON);
  if (!model) {
    const error = apiError("Requested model is not enabled by this gateway", 403);
    return c.json(error.body, error.status);
  }
  const stream = body.stream === true;
  const upstreamBody: Record<string, unknown> = { ...body, model };
  if (stream) {
    upstreamBody.stream_options = {
      ...(typeof body.stream_options === "object" ? body.stream_options : {}),
      include_usage: true,
    };
  }
  const baseUrl = c.env.UPSTREAM_BASE_URL.replace(/\/+$/, "");
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.UPSTREAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
  }).catch(() => null);
  if (!upstream) {
    const error = apiError("Could not reach the upstream model provider", 502);
    return c.json(error.body, error.status);
  }

  const user = c.get("user");
  if (!stream || !upstream.ok || !upstream.body) {
    const text = await upstream.text();
    let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0 };
    try {
      const parsed = JSON.parse(text) as { usage?: Partial<TokenUsage> };
      usage = {
        prompt_tokens: Number(parsed.usage?.prompt_tokens) || 0,
        completion_tokens: Number(parsed.usage?.completion_tokens) || 0,
      };
    } catch {
      // Preserve non-JSON upstream errors without inventing usage.
    }
    c.executionCtx.waitUntil(recordUsage(c.env, user.id, model, usage, upstream.status));
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0 };
  const tracker = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as { usage?: Partial<TokenUsage> };
          if (parsed.usage) {
            usage = {
              prompt_tokens: Number(parsed.usage.prompt_tokens) || 0,
              completion_tokens: Number(parsed.usage.completion_tokens) || 0,
            };
          }
        } catch {
          // Ignore incomplete or provider-specific SSE records.
        }
      }
    },
    flush() {
      c.executionCtx.waitUntil(recordUsage(c.env, user.id, model, usage, upstream.status));
    },
  });
  const headers = new Headers(upstream.headers);
  headers.delete("Content-Length");
  headers.set("Cache-Control", "no-store");
  return new Response(upstream.body.pipeThrough(tracker), {
    status: upstream.status,
    headers,
  });
});

app.notFound((c) => {
  const error = apiError("Route not found", 404);
  return c.json(error.body, error.status);
});

app.onError((error, c) => {
  console.error(error);
  const response = apiError("Internal gateway error", 500);
  return c.json(response.body, response.status);
});

export default app;
