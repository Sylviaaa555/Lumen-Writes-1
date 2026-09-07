import { describe, expect, it } from "vitest";
import {
  bearerToken,
  calculateCostMicrousd,
  currentBudgetPeriod,
  dollarsToMicrousd,
  hashApiKey,
  microusdToDollars,
  parseJsonMap,
  resolveModel,
} from "../src/core";

describe("gateway core", () => {
  it("resolves aliases while rejecting unconfigured model names", () => {
    const routes = JSON.stringify({ economy: "provider-small" });
    expect(resolveModel("economy", "default", routes)).toBe("provider-small");
    expect(resolveModel("provider-large", "default", routes)).toBeNull();
    expect(resolveModel("default", "default", routes)).toBe("default");
    expect(resolveModel(undefined, "default", routes)).toBe("default");
  });

  it("calculates microdollar cost from per-million-token prices", () => {
    const pricing = JSON.stringify({
      "provider-small": { input: 0.15, output: 0.6 },
    });
    expect(
      calculateCostMicrousd(
        "provider-small",
        { prompt_tokens: 1_000_000, completion_tokens: 500_000 },
        pricing,
      ),
    ).toBe(450_000);
    expect(
      calculateCostMicrousd(
        "unpriced",
        { prompt_tokens: 100, completion_tokens: 100 },
        pricing,
      ),
    ).toBe(0);
  });

  it("converts budgets without floating point database values", () => {
    expect(dollarsToMicrousd(2.5)).toBe(2_500_000);
    expect(microusdToDollars(2_500_000)).toBe(2.5);
    expect(() => dollarsToMicrousd(-1)).toThrow();
  });

  it("handles auth tokens, periods, and invalid configuration", async () => {
    expect(bearerToken("Bearer secret")).toBe("secret");
    expect(bearerToken("Basic secret")).toBeNull();
    expect(currentBudgetPeriod(new Date("2026-09-07T00:00:00Z"))).toBe("2026-09");
    expect(parseJsonMap("{broken")).toEqual({});
    expect(await hashApiKey("same")).toBe(await hashApiKey("same"));
    expect(await hashApiKey("same")).not.toBe(await hashApiKey("different"));
  });
});
