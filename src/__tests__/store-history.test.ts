/**
 * @jest-environment node
 */

/**
 * Unit tests: history store (@/store/history)
 *
 * The history store manages saved research sessions.  It exposes save/load/
 * update/remove/clearAll actions.  The store persists through localforage
 * (IndexedDB), which is mocked here so that tests stay in-memory.
 *
 * We test the in-memory state transitions only — storage I/O is out of scope.
 */

// Mock localforage before any imports that pull in @/utils/storage
jest.mock("localforage", () => {
  const store: Record<string, unknown> = {};
  return {
    createInstance: () => ({
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: unknown) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
    }),
  };
});

// Mock nanoid to avoid ESM issues with nanoid v5's browser/node entry points
jest.mock("nanoid", () => ({
  customAlphabet: () => {
    let counter = 0;
    return () => `test-id-${++counter}`;
  },
}));

import { useHistoryStore } from "@/store/history";
import type { TaskStore } from "@/store/task";

// Build a minimal TaskStore fixture that satisfies the type
function makeTaskStore(overrides: Partial<TaskStore> = {}): TaskStore {
  return {
    id: "test-id",
    question: "What is AI?",
    resources: [],
    query: "artificial intelligence overview",
    questions: "",
    feedback: "",
    reportPlan: "Intro, Body, Conclusion",
    suggestion: "",
    tasks: [],
    requirement: "",
    title: "AI Overview",
    finalReport: "This is the final report content.",
    sources: [],
    images: [],
    knowledgeGraph: "",
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store to empty history before each test
  useHistoryStore.setState({ history: [] });
});

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

describe("useHistoryStore — save", () => {
  it("returns a non-empty id when title and finalReport are present", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("adds the entry to the history list", () => {
    useHistoryStore.getState().save(makeTaskStore());
    expect(useHistoryStore.getState().history.length).toBe(1);
  });

  it("prepends new entries so the latest appears first", () => {
    useHistoryStore.getState().save(makeTaskStore({ title: "First" }));
    useHistoryStore.getState().save(makeTaskStore({ title: "Second" }));
    const history = useHistoryStore.getState().history;
    expect(history[0].title).toBe("Second");
    expect(history[1].title).toBe("First");
  });

  it("returns empty string when title is missing", () => {
    const id = useHistoryStore.getState().save(makeTaskStore({ title: "" }));
    expect(id).toBe("");
    expect(useHistoryStore.getState().history.length).toBe(0);
  });

  it("returns empty string when finalReport is missing", () => {
    const id = useHistoryStore.getState().save(makeTaskStore({ finalReport: "" }));
    expect(id).toBe("");
  });

  it("attaches a createdAt timestamp", () => {
    const before = Date.now();
    useHistoryStore.getState().save(makeTaskStore());
    const after = Date.now();
    const entry = useHistoryStore.getState().history[0];
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(entry.createdAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

describe("useHistoryStore — load", () => {
  it("returns the matching entry by id", () => {
    const id = useHistoryStore.getState().save(makeTaskStore({ title: "My Research" }));
    const loaded = useHistoryStore.getState().load(id);
    expect(loaded).toBeDefined();
    expect(loaded!.title).toBe("My Research");
  });

  it("returns undefined for an unknown id", () => {
    const result = useHistoryStore.getState().load("nonexistent-id");
    expect(result).toBeUndefined();
  });

  it("returns a deep clone — mutations do not affect the store", () => {
    const id = useHistoryStore.getState().save(makeTaskStore({ title: "Original" }));
    const loaded = useHistoryStore.getState().load(id) as TaskStore;
    loaded.title = "Mutated";
    // Re-load should still have the original title
    const reloaded = useHistoryStore.getState().load(id);
    expect(reloaded!.title).toBe("Original");
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("useHistoryStore — update", () => {
  it("updates the matching entry in place", () => {
    const id = useHistoryStore.getState().save(makeTaskStore({ title: "Old Title" }));
    useHistoryStore.getState().update(id, makeTaskStore({ id, title: "New Title" }));
    const entry = useHistoryStore.getState().history.find((h) => h.id === id);
    expect(entry!.title).toBe("New Title");
  });

  it("sets updatedAt after an update", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    const before = Date.now();
    useHistoryStore.getState().update(id, makeTaskStore({ id }));
    const after = Date.now();
    const entry = useHistoryStore.getState().history.find((h) => h.id === id);
    expect(entry!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(entry!.updatedAt).toBeLessThanOrEqual(after);
  });

  it("returns true on success", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    const result = useHistoryStore.getState().update(id, makeTaskStore({ id }));
    expect(result).toBe(true);
  });

  it("does not change the length of history after update", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    useHistoryStore.getState().update(id, makeTaskStore({ id }));
    expect(useHistoryStore.getState().history.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("useHistoryStore — remove", () => {
  it("removes the entry with the given id", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    useHistoryStore.getState().remove(id);
    expect(useHistoryStore.getState().history.length).toBe(0);
  });

  it("only removes the targeted entry when multiple exist", () => {
    const id1 = useHistoryStore.getState().save(makeTaskStore({ title: "A" }));
    const id2 = useHistoryStore.getState().save(makeTaskStore({ title: "B" }));
    useHistoryStore.getState().remove(id1);
    const history = useHistoryStore.getState().history;
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(id2);
  });

  it("returns true", () => {
    const id = useHistoryStore.getState().save(makeTaskStore());
    expect(useHistoryStore.getState().remove(id)).toBe(true);
  });

  it("does not throw when removing a non-existent id", () => {
    expect(() => useHistoryStore.getState().remove("ghost-id")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe("useHistoryStore — clearAll", () => {
  it("empties the history list", () => {
    useHistoryStore.getState().save(makeTaskStore({ title: "A" }));
    useHistoryStore.getState().save(makeTaskStore({ title: "B" }));
    useHistoryStore.getState().clearAll();
    expect(useHistoryStore.getState().history).toEqual([]);
  });

  it("is safe to call on an already-empty store", () => {
    expect(() => useHistoryStore.getState().clearAll()).not.toThrow();
    expect(useHistoryStore.getState().history).toEqual([]);
  });
});
