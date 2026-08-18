import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ActivitiesScene } from "./scenes/ActivitiesScene";
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

export function App() {
  const initial = routeFromLocation();
  const [scene, setScene] = useState<SceneId>(initial.scene);
  const [memoryRoute, setMemoryRoute] = useState<MemoryHash>(
    initial.scene === "memory" ? initial.memory : { mode: "chain" },
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
    } else {
      writeHash(serializeHash({ scene: next }), "push");
    }
  }, []);

  const onMemoryRouteChange = useCallback(
    (next: MemoryHash, historyMode: "push" | "replace") => {
      setMemoryRoute((prev) => (memoryHashEqual(prev, next) ? prev : next));
      writeHash(serializeHash({ scene: "memory", memory: next }), historyMode);
    },
    [],
  );

  const eventsOpen = scene === "activities" || scene === "consolidate";

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="app">
        <Sidebar scene={scene} onScene={onScene} />
        <main className={`stage${scene === "memory" || scene === "clarify" ? " stage-locked" : ""}`}>
          {eventsOpen ? (
            <ActivitiesScene
              feed={scene === "consolidate" ? "consolidate" : "recent"}
              onFeedChange={(feed) =>
                onScene(feed === "consolidate" ? "consolidate" : "activities")
              }
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
