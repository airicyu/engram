import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { lightLabel, lightState } from "../lib/types";
import type { SceneId } from "../lib/types";

type NavId = "events" | "seek" | "clarify" | "memory";

const NAV: { id: NavId; scene: SceneId; labelKey: string }[] = [
  { id: "events", scene: "activities", labelKey: "nav.events" },
  { id: "seek", scene: "seek", labelKey: "nav.search" },
  { id: "clarify", scene: "clarify", labelKey: "nav.inbox" },
  { id: "memory", scene: "memory", labelKey: "nav.memory" },
];

function navSelected(nav: NavId, scene: SceneId): boolean {
  if (nav === "events") return scene === "activities" || scene === "consolidate";
  return scene === nav;
}

export function Sidebar({
  scene,
  onScene,
}: {
  scene: SceneId;
  onScene: (s: SceneId) => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const { status } = useStatus();
  const key = lightState(status);
  const label = status ? lightLabel(status, t) || t("status.offline") : t("status.offline");
  const title = status
    ? t("status.tooltip", {
        lock: status.lock ? t("status.value.true") : t("status.value.false"),
        l1: status.l1_empty ? t("status.value.empty") : t("status.value.present"),
      })
    : t("status.unreachable_title");

  return (
    <aside className="sidebar">
      <h1 className="brand">Engram</h1>
      <nav className="sidebar-nav" aria-label={t("nav.scenes")}>
        {NAV.map((item) => {
          const on = navSelected(item.id, scene);
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${on ? " is-active" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={() => onScene(item.scene)}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="locale-switch" role="group" aria-label={t("locale.switch")}>
          <button
            type="button"
            className={`locale-btn${locale === "zh-Hant" ? " is-active" : ""}`}
            aria-pressed={locale === "zh-Hant"}
            onClick={() => setLocale("zh-Hant")}
          >
            {t("locale.zh")}
          </button>
          <button
            type="button"
            className={`locale-btn${locale === "en" ? " is-active" : ""}`}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            {t("locale.en")}
          </button>
        </div>
        <div className="status-light" title={title}>
          <span className="status-dot" data-state={key} />
          <span className="status-label">{label || "…"}</span>
        </div>
      </div>
    </aside>
  );
}
