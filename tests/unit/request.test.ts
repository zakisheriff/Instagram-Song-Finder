import { describe, expect, it, vi } from "vitest";
import { parseRetryAfter, request } from "@/lib/http/request";
import { fakeFetch, json, noSleep } from "./helpers/fake-fetch";

const URL_A = "https://api.example.test/thing";

describe("request", () => {
  it("returns successful responses without retrying", async () => {
    const { fetchImpl, calls } = fakeFetch({ [URL_A]: () => json({ ok: 1 }) });
    const response = await request(URL_A, { fetchImpl, sleep: noSleep });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("retries 5xx responses with exponential backoff, then succeeds", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const { fetchImpl, calls } = fakeFetch({
      [URL_A]: [() => new Response(null, { status: 503 }), () => new Response(null, { status: 502 }), () => json({})],
    });
    const response = await request(URL_A, { fetchImpl, sleep });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([200, 400]);
  });

  it("gives up after the retry budget with PROVIDER_UNAVAILABLE", async () => {
    const { fetchImpl, calls } = fakeFetch({ [URL_A]: () => new Response(null, { status: 500 }) });
    await expect(request(URL_A, { fetchImpl, sleep: noSleep, retries: 2 })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(calls).toHaveLength(3);
  });

  it("does not retry 4xx responses", async () => {
    const { fetchImpl, calls } = fakeFetch({ [URL_A]: () => new Response(null, { status: 404 }) });
    const response = await request(URL_A, { fetchImpl, sleep: noSleep });
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("surfaces a long upstream rate limit instead of waiting", async () => {
    const { fetchImpl, calls } = fakeFetch({
      [URL_A]: () => new Response(null, { status: 429, headers: { "retry-after": "30" } }),
    });
    await expect(request(URL_A, { fetchImpl, sleep: noSleep })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 30,
    });
    expect(calls).toHaveLength(1);
  });

  it("waits out a one-second rate limit once", async () => {
    const { fetchImpl, calls } = fakeFetch({
      [URL_A]: [
        () => new Response(null, { status: 429, headers: { "retry-after": "1" } }),
        () => json({}),
      ],
    });
    const response = await request(URL_A, { fetchImpl, sleep: noSleep });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("maps network failures to PROVIDER_UNAVAILABLE", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(request(URL_A, { fetchImpl, sleep: noSleep, retries: 1 })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps a per-attempt timeout to PROVIDER_TIMEOUT", async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    await expect(
      request(URL_A, { fetchImpl, sleep: noSleep, retries: 0, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("stops immediately when the caller cancels", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    ) as unknown as typeof fetch;
    const pending = request(URL_A, { fetchImpl, sleep: noSleep, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("parseRetryAfter", () => {
  it("reads whole seconds and ignores other formats", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("1.2")).toBe(2);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
  });
});
