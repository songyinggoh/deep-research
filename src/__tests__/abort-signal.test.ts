/**
 * Unit tests: AbortController / halt signal propagation
 *
 * The `halt()` function in useDeepResearch replaces the shared AbortController
 * so that the next research run gets a fresh signal.  These tests verify the
 * mechanics of that pattern in isolation — critical for Ollama because local
 * inference can run for minutes and users regularly need to cancel.
 *
 * We also verify that:
 * - An aborted signal causes async generators to stop iteration
 * - The p-limit queue is cleared on abort (preventing queued tasks from
 *   starting after the user halts)
 * - Error handling correctly swallows AbortError and propagates other errors
 */

import Plimit from "p-limit";

// ---------------------------------------------------------------------------
// Helpers mirroring the abort logic inside useDeepResearch
// ---------------------------------------------------------------------------

/** Minimal stand-in for the abort controller ref pattern used in the hook */
class HaltController {
  private ref: AbortController = new AbortController();

  halt() {
    this.ref.abort();
    this.ref = new AbortController();
  }

  getSignal() {
    return this.ref.signal;
  }
}

/** Mimics the handleError guard in useDeepResearch */
function handleError(error: unknown): string | null {
  if (error instanceof Error && error.name === "AbortError") return null;
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Abort controller lifecycle
// ---------------------------------------------------------------------------

describe("HaltController — abort signal lifecycle", () => {
  it("provides an initially non-aborted signal", () => {
    const ctrl = new HaltController();
    expect(ctrl.getSignal().aborted).toBe(false);
  });

  it("aborts the current signal when halt() is called", () => {
    const ctrl = new HaltController();
    const signalBefore = ctrl.getSignal();
    ctrl.halt();
    expect(signalBefore.aborted).toBe(true);
  });

  it("provides a fresh non-aborted signal after halt()", () => {
    const ctrl = new HaltController();
    ctrl.halt();
    expect(ctrl.getSignal().aborted).toBe(false);
  });

  it("allows halt() to be called multiple times safely", () => {
    const ctrl = new HaltController();
    expect(() => {
      ctrl.halt();
      ctrl.halt();
      ctrl.halt();
    }).not.toThrow();
    expect(ctrl.getSignal().aborted).toBe(false);
  });

  it("different calls to getSignal() return the same signal object until halt()", () => {
    const ctrl = new HaltController();
    const s1 = ctrl.getSignal();
    const s2 = ctrl.getSignal();
    expect(s1).toBe(s2);

    ctrl.halt();
    const s3 = ctrl.getSignal();
    expect(s3).not.toBe(s1);
  });
});

// ---------------------------------------------------------------------------
// handleError — AbortError swallowing
// ---------------------------------------------------------------------------

describe("handleError — AbortError swallowing", () => {
  it("returns null (silently ignores) for AbortError", () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    expect(handleError(abortError)).toBeNull();
  });

  it("returns the message for a regular Error", () => {
    const err = new Error("Connection refused");
    expect(handleError(err)).toBe("Connection refused");
  });

  it("returns the message for an Ollama-style connection error", () => {
    const err = new Error("fetch failed: ECONNREFUSED 127.0.0.1:11434");
    expect(handleError(err)).toContain("ECONNREFUSED");
  });

  it("handles plain string errors", () => {
    expect(handleError("Something went wrong")).toBe("Something went wrong");
  });

  it("handles null/undefined gracefully", () => {
    // The real handleError wouldn't receive these but guard anyway
    expect(handleError(null)).toBe("null");
    expect(handleError(undefined)).toBe("undefined");
  });
});

// ---------------------------------------------------------------------------
// Abort signal propagation through an async generator (stream simulation)
// ---------------------------------------------------------------------------

/**
 * Simulates a streaming response from Ollama.
 * Yields tokens one by one, checking the abort signal between each.
 */
async function* simulateOllamaStream(
  tokens: string[],
  signal: AbortSignal
): AsyncGenerator<{ type: "text-delta"; textDelta: string }> {
  for (const token of tokens) {
    if (signal.aborted) {
      throw Object.assign(new Error("The operation was aborted."), {
        name: "AbortError",
      });
    }
    yield { type: "text-delta" as const, textDelta: token };
    // Yield control so abort can propagate in real async code
    await Promise.resolve();
  }
}

describe("Abort signal propagation through streaming", () => {
  it("receives all tokens when signal is not aborted", async () => {
    const ctrl = new AbortController();
    const tokens = ["Hello", " ", "world"];
    const received: string[] = [];

    for await (const part of simulateOllamaStream(tokens, ctrl.signal)) {
      received.push(part.textDelta);
    }

    expect(received).toEqual(tokens);
  });

  it("stops mid-stream when signal is aborted and throws AbortError", async () => {
    const ctrl = new AbortController();
    const tokens = ["Token1", "Token2", "Token3", "Token4", "Token5"];
    const received: string[] = [];
    let caughtError: Error | null = null;

    // Abort after receiving the second token
    let count = 0;
    try {
      for await (const part of simulateOllamaStream(tokens, ctrl.signal)) {
        received.push(part.textDelta);
        count++;
        if (count === 2) {
          ctrl.abort();
        }
      }
    } catch (err) {
      if (err instanceof Error) caughtError = err;
    }

    // Only the first two tokens should have been collected
    expect(received.length).toBeLessThanOrEqual(3); // up to 3 depending on timing
    expect(caughtError?.name).toBe("AbortError");
  });

  it("handleError swallows the AbortError thrown by the stream", async () => {
    const ctrl = new AbortController();
    ctrl.abort(); // Pre-abort

    let errorResult: string | null = "not-set";
    try {
      for await (const _ of simulateOllamaStream(["token"], ctrl.signal)) {
        // should not reach here
      }
    } catch (err) {
      errorResult = handleError(err);
    }

    expect(errorResult).toBeNull(); // AbortError was swallowed
  });
});

// ---------------------------------------------------------------------------
// p-limit queue clearance on abort
// ---------------------------------------------------------------------------

describe("p-limit queue clearance on abort signal", () => {
  it("clears pending tasks from the queue when abort fires", async () => {
    const ctrl = new AbortController();
    const plimit = Plimit(1); // concurrency 1 so tasks queue up

    const executionOrder: number[] = [];

    // Register queue clear on abort — mirrors the pattern in useDeepResearch
    ctrl.signal.addEventListener("abort", () => plimit.clearQueue(), { once: true });

    // Task 1 will run immediately (occupies the single slot)
    const task1 = plimit(async () => {
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push(1);
    });

    // Tasks 2–4 are queued because slot is full
    const task2 = plimit(async () => { executionOrder.push(2); });
    const task3 = plimit(async () => { executionOrder.push(3); });
    const task4 = plimit(async () => { executionOrder.push(4); });

    // Abort immediately — should clear tasks 2-4 from queue
    ctrl.abort();

    // Wait for task1 to finish (it was already running)
    await task1;

    // Tasks 2-4 should have been rejected/cleared
    await expect(task2).rejects.toBeDefined();
    await expect(task3).rejects.toBeDefined();
    await expect(task4).rejects.toBeDefined();

    // Only task 1 ran
    expect(executionOrder).toEqual([1]);
  });

  it("plimit.clearQueue() rejects all pending promises", async () => {
    const plimit = Plimit(1);

    // Keep the slot occupied
    let resolveFirst!: () => void;
    const blocker = plimit(
      () =>
        new Promise<void>((r) => {
          resolveFirst = r;
        })
    );

    const queued = plimit(() => Promise.resolve("ran"));

    // Clear the queue before the slot frees up
    plimit.clearQueue();

    // Release the first task
    resolveFirst();
    await blocker;

    // Queued task should have been rejected
    await expect(queued).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Concurrent request behaviour — Ollama processes one request at a time
// ---------------------------------------------------------------------------

describe("Parallel search limiting for Ollama (parallelSearch = 1)", () => {
  it("runs tasks sequentially when concurrency is 1", async () => {
    const plimit = Plimit(1);
    const order: string[] = [];
    const delays = [30, 10, 20]; // milliseconds

    await Promise.all(
      delays.map((delay, i) =>
        plimit(async () => {
          await new Promise((r) => setTimeout(r, delay));
          order.push(`task-${i}`);
        })
      )
    );

    // With concurrency 1, tasks execute in submission order regardless of delay
    expect(order).toEqual(["task-0", "task-1", "task-2"]);
  });

  it("runs tasks in parallel when concurrency > 1", async () => {
    const plimit = Plimit(3);
    const startTimes: number[] = [];

    await Promise.all(
      [0, 1, 2].map((i) =>
        plimit(async () => {
          startTimes.push(Date.now());
          await new Promise((r) => setTimeout(r, 20));
        })
      )
    );

    // All three should have started at nearly the same time
    const spread = Math.max(...startTimes) - Math.min(...startTimes);
    expect(spread).toBeLessThan(15); // all started within 15 ms of each other
  });
});
