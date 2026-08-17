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

function NavIcon({ id }: { id: NavId }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "sidebar-icon",
  };
  if (id === "events") {
    return (
      <svg {...common}>
        <path d="M12 19h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  if (id === "seek") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16.2 16.2 4.3 4.3" />
      </svg>
    );
  }
  if (id === "clarify") {
    return (
      <svg {...common}>
        <path d="M4 7h16v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6.5" cy="12" r="2.25" />
      <circle cx="17.5" cy="6.5" r="2.25" />
      <circle cx="17.5" cy="17.5" r="2.25" />
      <path d="M8.4 10.8 15.4 7.6" />
      <path d="M8.4 13.2 15.4 16.4" />
    </svg>
  );
}

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
              <NavIcon id={item.id} />
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
