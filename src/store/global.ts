import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GlobalStore {
  openSetting: boolean;
  openHistory: boolean;
  openKnowledge: boolean;
  sidebarOpen: boolean;
}

interface GlobalActions {
  setOpenSetting: (visible: boolean) => void;
  setOpenHistory: (visible: boolean) => void;
  setOpenKnowledge: (visible: boolean) => void;
  setSidebarOpen: (visible: boolean) => void;
}

export const useGlobalStore = create(
  persist<GlobalStore & GlobalActions>(
    (set) => ({
      openSetting: false,
      openHistory: false,
      openKnowledge: false,
      sidebarOpen: true,
      setOpenSetting: (visible) => set({ openSetting: visible }),
      setOpenHistory: (visible) => set({ openHistory: visible }),
      setOpenKnowledge: (visible) => set({ openKnowledge: visible }),
      setSidebarOpen: (visible) => set({ sidebarOpen: visible }),
    }),
    {
      name: "globalStore",
      // Only persist sidebarOpen; transient modal states should reset on reload
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
      } as GlobalStore & GlobalActions),
    }
  )
);
