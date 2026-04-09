"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";

const Header = dynamic(() => import("@/components/Internal/Header"));
const Topic = dynamic(() => import("@/components/Research/Topic"));
const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });

const Setting = dynamic(() => import("@/components/Setting"), {
  ssr: false,
});
const WorkflowProgress = dynamic(
  () => import("@/components/Research/WorkflowProgress"),
  { ssr: false }
);
const Feedback = dynamic(() => import("@/components/Research/Feedback"), {
  ssr: false,
});
const SearchResult = dynamic(
  () => import("@/components/Research/SearchResult"),
  { ssr: false }
);
const FinalReport = dynamic(
  () => import("@/components/Research/FinalReport"),
  { ssr: false }
);
const History = dynamic(() => import("@/components/History"), {
  ssr: false,
});
const Knowledge = dynamic(() => import("@/components/Knowledge"), {
  ssr: false,
});

function Home() {
  const { t } = useTranslation();
  const {
    openSetting,
    setOpenSetting,
    openHistory,
    setOpenHistory,
    openKnowledge,
    setOpenKnowledge,
    sidebarOpen,
  } = useGlobalStore();

  const { theme } = useSettingStore();
  const { setTheme } = useTheme();

  useEffect(() => {
    const settingStore = useSettingStore.getState();
    setTheme(settingStore.theme);
  }, [theme, setTheme]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`print:hidden shrink-0 border-r bg-muted/30 transition-all duration-300 overflow-hidden ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        {sidebarOpen && (
          <div className="h-full w-64">
            <Sidebar />
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-screen-lg mx-auto px-4">
          <Header />
          <main>
            <WorkflowProgress />
            <Topic />
            <Feedback />
            <SearchResult />
            <FinalReport />
          </main>
          <footer className="my-4 text-center text-sm text-gray-600 print:hidden">
            <a href="https://github.com/u14app/" target="_blank" rel="noopener noreferrer">
              {t("copyright", {
                name: "U14App",
              })}
            </a>
          </footer>
        </div>
      </div>

      {/* Modals */}
      <aside className="print:hidden">
        <Setting open={openSetting} onClose={() => setOpenSetting(false)} />
        <History open={openHistory} onClose={() => setOpenHistory(false)} />
        <Knowledge
          open={openKnowledge}
          onClose={() => setOpenKnowledge(false)}
        />
      </aside>
    </div>
  );
}

export default Home;
