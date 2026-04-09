"use client";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SquarePen, Trash2, Search, X } from "lucide-react";
import dayjs from "dayjs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/Internal/Button";
import { useTaskStore } from "@/store/task";
import { useHistoryStore, type ResearchHistory } from "@/store/history";

function groupByDate(
  items: ResearchHistory[],
  labels: [string, string, string, string]
) {
  const now = dayjs();
  const groups: { label: string; items: ResearchHistory[] }[] = [
    { label: labels[0], items: [] },
    { label: labels[1], items: [] },
    { label: labels[2], items: [] },
    { label: labels[3], items: [] },
  ];
  for (const item of items) {
    const d = dayjs(item.updatedAt ?? item.createdAt);
    if (d.isSame(now, "day")) {
      groups[0].items.push(item);
    } else if (d.isSame(now.subtract(1, "day"), "day")) {
      groups[1].items.push(item);
    } else if (d.isAfter(now.subtract(7, "day"))) {
      groups[2].items.push(item);
    } else {
      groups[3].items.push(item);
    }
  }
  return groups.filter((g) => g.items.length > 0);
}

function Sidebar() {
  const { t } = useTranslation();
  const { id: activeId, backup, reset, restore } = useTaskStore();
  const { history, load, update, remove } = useHistoryStore();
  const [query, setQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return history;
    const q = query.toLowerCase();
    return history.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.question?.toLowerCase().includes(q)
    );
  }, [history, query]);

  const groups = useMemo(
    () =>
      groupByDate(filtered, [
        t("sidebar.today"),
        t("sidebar.yesterday"),
        t("sidebar.previous7days"),
        t("sidebar.older"),
      ]),
    [filtered, t]
  );

  function loadSession(id: string) {
    if (id === activeId) return;
    const data = load(id);
    if (data) {
      if (activeId) update(activeId, backup());
      reset();
      restore(data);
    }
  }

  function newResearch() {
    if (activeId) update(activeId, backup());
    reset();
  }

  function deleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (id === activeId) {
      update(activeId, backup());
    }
    remove(id);
    if (id === activeId) reset();
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Research */}
      <div className="px-3 pt-2 pb-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-9 text-sm font-medium"
          onClick={newResearch}
        >
          <SquarePen className="h-4 w-4 shrink-0" />
          <span>{t("sidebar.newResearch")}</span>
        </Button>
      </div>

      {/* Search */}
      {history.length > 5 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              className="w-full rounded-md border bg-transparent pl-8 pr-7 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder={t("sidebar.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Session list */}
      <ScrollArea className="flex-1 px-2">
        {groups.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            {t("history.noHistory")}
          </p>
        ) : (
          <div className="space-y-4 pb-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative flex items-center rounded-md px-2 py-2 cursor-pointer text-sm transition-colors ${
                        item.id === activeId
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => loadSession(item.id)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <span className="flex-1 truncate pr-6 leading-snug">
                        {item.title || item.question}
                      </span>
                      {hoveredId === item.id && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => deleteSession(e, item.id)}
                          title={t("history.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default Sidebar;
