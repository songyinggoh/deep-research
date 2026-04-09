/**
 * Unit tests: global UI state store (@/store/global)
 *
 * The global store manages modal/panel visibility flags (openSetting,
 * openHistory, openKnowledge) and the sidebar open state.  These are
 * simple boolean setters — we verify that each setter correctly toggles
 * its corresponding slice of state.
 *
 * The store uses zustand `persist` with localStorage.  jsdom provides a
 * localStorage stub, so no additional mocking is required.
 */

import { useGlobalStore } from "@/store/global";

// Reset the store to its default initial state before each test to prevent
// inter-test contamination.
beforeEach(() => {
  useGlobalStore.setState({
    openSetting: false,
    openHistory: false,
    openKnowledge: false,
    sidebarOpen: true,
  });
});

describe("useGlobalStore — initial state", () => {
  it("has openSetting false by default", () => {
    expect(useGlobalStore.getState().openSetting).toBe(false);
  });

  it("has openHistory false by default", () => {
    expect(useGlobalStore.getState().openHistory).toBe(false);
  });

  it("has openKnowledge false by default", () => {
    expect(useGlobalStore.getState().openKnowledge).toBe(false);
  });

  it("has sidebarOpen true by default", () => {
    expect(useGlobalStore.getState().sidebarOpen).toBe(true);
  });
});

describe("useGlobalStore — setOpenSetting", () => {
  it("sets openSetting to true", () => {
    useGlobalStore.getState().setOpenSetting(true);
    expect(useGlobalStore.getState().openSetting).toBe(true);
  });

  it("sets openSetting back to false", () => {
    useGlobalStore.getState().setOpenSetting(true);
    useGlobalStore.getState().setOpenSetting(false);
    expect(useGlobalStore.getState().openSetting).toBe(false);
  });

  it("does not affect other state slices", () => {
    useGlobalStore.getState().setOpenSetting(true);
    expect(useGlobalStore.getState().openHistory).toBe(false);
    expect(useGlobalStore.getState().openKnowledge).toBe(false);
    expect(useGlobalStore.getState().sidebarOpen).toBe(true);
  });
});

describe("useGlobalStore — setOpenHistory", () => {
  it("sets openHistory to true", () => {
    useGlobalStore.getState().setOpenHistory(true);
    expect(useGlobalStore.getState().openHistory).toBe(true);
  });

  it("sets openHistory back to false", () => {
    useGlobalStore.getState().setOpenHistory(true);
    useGlobalStore.getState().setOpenHistory(false);
    expect(useGlobalStore.getState().openHistory).toBe(false);
  });
});

describe("useGlobalStore — setOpenKnowledge", () => {
  it("sets openKnowledge to true", () => {
    useGlobalStore.getState().setOpenKnowledge(true);
    expect(useGlobalStore.getState().openKnowledge).toBe(true);
  });

  it("sets openKnowledge back to false", () => {
    useGlobalStore.getState().setOpenKnowledge(true);
    useGlobalStore.getState().setOpenKnowledge(false);
    expect(useGlobalStore.getState().openKnowledge).toBe(false);
  });
});

describe("useGlobalStore — setSidebarOpen", () => {
  it("closes the sidebar", () => {
    useGlobalStore.getState().setSidebarOpen(false);
    expect(useGlobalStore.getState().sidebarOpen).toBe(false);
  });

  it("re-opens the sidebar", () => {
    useGlobalStore.getState().setSidebarOpen(false);
    useGlobalStore.getState().setSidebarOpen(true);
    expect(useGlobalStore.getState().sidebarOpen).toBe(true);
  });

  it("does not affect modal states when toggling sidebar", () => {
    useGlobalStore.getState().setSidebarOpen(false);
    expect(useGlobalStore.getState().openSetting).toBe(false);
    expect(useGlobalStore.getState().openHistory).toBe(false);
  });
});
