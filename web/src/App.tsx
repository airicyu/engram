import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ActivitiesScene, type EventsFeed } from "./scenes/ActivitiesScene";
import { ClarifyScene } from "./scenes/ClarifyScene";
import { SeekScene } from "./scenes/SeekScene";
import { MemoryScene } from "./scenes/MemoryScene";
import type { SceneId } from "./lib/types";
import {
  type MemoryHash,
  memoryHashEqual,
  parseHash,
  serializeHash,
  writeHash,
} from "./lib/hashRoute";

function routeFromLocation() {
  return parseHash(location.hash);
}

function feedFromScene(scene: SceneId): EventsFeed {
  if (scene === "consolidate") return "consolidate";
  if (scene === "dream_reports") return "dream_reports";
  return "recent";
}

function sceneFromFeed(feed: EventsFeed): SceneId {
  if (feed === "consolidate") return "consolidate";
  if (feed === "dream_reports") return "dream_reports";
  return "activities";
}

export function App() {
  const initial = routeFromLocation();
  const [scene, setScene] = useState<SceneId>(initial.scene);
  const [memoryRoute, setMemoryRoute] = useState<MemoryHash>(
    initial.scene === "memory" ? initial.memory : { mode: "chain" },
  );
  const [dreamReportId, setDreamReportId] = useState<string | undefined>(
    initial.scene === "dream_reports" ? initial.dream_run_id : undefined,
  );

  useEffect(() => {
    const syncFromLocation = () => {
      const route = routeFromLocation();
      setScene(route.scene);
      if (route.scene === "memory") {
        setMemoryRoute((prev) =>
          memoryHashEqual(prev, route.memory) ? prev : route.memory,
        );
      }
      if (route.scene === "dream_reports") {
        setDreamReportId(route.dream_run_id);
      }
    };
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, []);

  const onScene = useCallback((next: SceneId) => {
    setScene(next);
    if (next === "memory") {
      const mem: MemoryHash = { mode: "chain" };
      setMemoryRoute(mem);
      writeHash(serializeHash({ scene: "memory", memory: mem }), "push");
    } else if (next === "dream_reports") {
      writeHash(serializeHash({ scene: "dream_reports" }), "push");
      setDreamReportId(undefined);
    } else {
      writeHash(serializeHash({ scene: next }), "push");
    }
  }, []);

  const onDreamReportIdChange = useCallback((id: string | undefined, mode: "push" | "replace") => {
    setDreamReportId(id);
    writeHash(
      serializeHash(id ? { scene: "dream_reports", dream_run_id: id } : { scene: "dream_reports" }),
      mode,
    );
  }, []);

  const onMemoryRouteChange = useCallback(
    (next: MemoryHash, historyMode: "push" | "replace") => {
      setMemoryRoute((prev) => (memoryHashEqual(prev, next) ? prev : next));
      writeHash(serializeHash({ scene: "memory", memory: next }), historyMode);
    },
    [],
  );

  const eventsOpen =
    scene === "activities" || scene === "consolidate" || scene === "dream_reports";

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="app">
        <Sidebar scene={scene} onScene={onScene} />
        <main
          className={`stage${scene === "memory" || scene === "clarify" || scene === "seek" ? " stage-locked" : ""}`}
        >
          {eventsOpen ? (
            <ActivitiesScene
              feed={feedFromScene(scene)}
              onFeedChange={(feed) => onScene(sceneFromFeed(feed))}
              dreamReportId={dreamReportId}
              onDreamReportIdChange={onDreamReportIdChange}
            />
          ) : null}
          {scene === "clarify" ? <ClarifyScene /> : null}
          {scene === "seek" ? <SeekScene /> : null}
          {scene === "memory" ? (
            <MemoryScene route={memoryRoute} onRouteChange={onMemoryRouteChange} />
          ) : null}
        </main>
      </div>
    </>
  );
}
