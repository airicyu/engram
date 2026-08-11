import { useI18n } from "../i18n/I18nProvider";
import { useStatus } from "../context/StatusContext";
import { lightLabel, lightState } from "../lib/types";
import type { SceneId } from "../lib/types";

const SCENES: SceneId[] = ["activities", "consolidate", "clarify", "seek", "memory"];

export function Topbar({
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
    <header className="topbar">
      <h1 className="brand">Engram</h1>
      <nav className="scenes" role="tablist" aria-label={t("nav.scenes")}>
        {SCENES.map((id) => {
          const on = scene === id;
          return (
            <button
              key={id}
              type="button"
              className={`scene-btn${on ? " is-active" : ""}`}
              role="tab"
              aria-selected={on}
              onClick={() => onScene(id)}
            >
              {t(`scene.${id}`)}
            </button>
          );
        })}
      </nav>
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
    </header>
  );
}
