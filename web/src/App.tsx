import { useState } from "react";
import { Topbar } from "./components/Topbar";
import { CaptureScene } from "./scenes/CaptureScene";
import { ConsolidateScene } from "./scenes/ConsolidateScene";
import { SeekScene } from "./scenes/SeekScene";
import { MemoryScene } from "./scenes/MemoryScene";
import type { SceneId } from "./lib/types";

export function App() {
  const [scene, setScene] = useState<SceneId>("capture");

  return (
    <>
      <div className="atmosphere" aria-hidden="true" />
      <div className="app">
        <Topbar scene={scene} onScene={setScene} />
        <main className={`stage${scene === "memory" ? " stage-locked" : ""}`}>
          {scene === "capture" ? <CaptureScene /> : null}
          {scene === "consolidate" ? <ConsolidateScene /> : null}
          {scene === "seek" ? <SeekScene /> : null}
          {scene === "memory" ? <MemoryScene /> : null}
        </main>
      </div>
    </>
  );
}
