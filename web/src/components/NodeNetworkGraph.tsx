import { useEffect, useMemo, useRef } from "react";
import type { NodeGraphEdge, NodeIndex } from "../lib/api";

type SimNode = {
  id: string;
  preview?: string;
  display_score?: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
};

const WIDTH = 640;
const HEIGHT = 420;

function radiusFor(score: number | null | undefined): number {
  const t = score == null ? 1 : Math.min(100, Math.max(1, score));
  return 7 + (t / 100) * 16;
}

function edgeStroke(level: number): string {
  const t = Math.min(10, Math.max(1, level)) / 10;
  const alpha = 0.18 + t * 0.72;
  return `rgba(47, 74, 95, ${alpha})`;
}

export function NodeNetworkGraph({
  nodes,
  edges,
  filter,
  searchMode,
  selectedId,
  onSelect,
}: {
  nodes: NodeIndex[];
  edges: NodeGraphEdge[];
  filter: string;
  searchMode: "title" | "title_summary";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<SimNode[]>([]);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    kind: "pan" | "node";
    id?: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const hitRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<string | null>(selectedId);

  const hits = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return new Set(nodes.map((n) => n.node));
    return new Set(
      nodes
        .filter((n) => {
          if (n.node.toLowerCase().includes(q)) return true;
          if (searchMode === "title_summary" && (n.preview || "").toLowerCase().includes(q)) {
            return true;
          }
          return false;
        })
        .map((n) => n.node),
    );
  }, [filter, nodes, searchMode]);

  hitRef.current = hits;
  selectedRef.current = selectedId;

  useEffect(() => {
    const prev = new Map(simRef.current.map((n) => [n.id, n]));
    const n = nodes.length || 1;
    simRef.current = nodes.map((node, i) => {
      const old = prev.get(node.node);
      if (old) {
        return {
          ...old,
          preview: node.preview,
          display_score: node.display_score,
        };
      }
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const r = Math.min(WIDTH, HEIGHT) * 0.28;
      return {
        id: node.node,
        preview: node.preview,
        display_score: node.display_score,
        x: WIDTH / 2 + Math.cos(angle) * r,
        y: HEIGHT / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        pinned: false,
      };
    });
  }, [nodes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { k, x, y } = transformRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nk = Math.min(4, Math.max(0.35, k * factor));
      const rect = svg.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const sy = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      const wx = (sx - x) / k;
      const wy = (sy - y) / k;
      transformRef.current = { k: nk, x: sx - wx * nk, y: sy - wy * nk };
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let raf = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const sim = simRef.current;
      const kRep = 2200;
      const kSpring = 0.012;
      const rest = 90;
      const damp = 0.82;

      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const a = sim[i]!;
          const b = sim[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          const f = kRep / (dist * dist);
          dx /= dist;
          dy /= dist;
          if (!a.pinned) {
            a.vx -= dx * f;
            a.vy -= dy * f;
          }
          if (!b.pinned) {
            b.vx += dx * f;
            b.vy += dy * f;
          }
        }
      }

      for (const e of edges) {
        const a = sim.find((n) => n.id === e.a);
        const b = sim.find((n) => n.id === e.b);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const stretch = dist - rest;
        dx = (dx / dist) * stretch * kSpring;
        dy = (dy / dist) * stretch * kSpring;
        if (!a.pinned) {
          a.vx += dx;
          a.vy += dy;
        }
        if (!b.pinned) {
          b.vx -= dx;
          b.vy -= dy;
        }
      }

      for (const node of sim) {
        if (node.pinned) continue;
        node.vx += (WIDTH / 2 - node.x) * 0.004;
        node.vy += (HEIGHT / 2 - node.y) * 0.004;
        node.vx *= damp;
        node.vy *= damp;
        node.x += node.vx;
        node.y += node.vy;
      }

      const { k, x, y } = transformRef.current;
      const hit = hitRef.current;
      const filtering = filter.trim().length > 0;
      const selected = selectedRef.current;

      const edgeEls = svg.querySelectorAll<SVGLineElement>("line.node-graph-edge");
      edgeEls.forEach((line) => {
        const a = sim.find((n) => n.id === line.dataset.a);
        const b = sim.find((n) => n.id === line.dataset.b);
        if (!a || !b) return;
        line.setAttribute("x1", String(a.x));
        line.setAttribute("y1", String(a.y));
        line.setAttribute("x2", String(b.x));
        line.setAttribute("y2", String(b.y));
      });

      const gNodes = svg.querySelectorAll<SVGGElement>("g.node-graph-node");
      gNodes.forEach((g) => {
        const id = g.dataset.id;
        const node = sim.find((n) => n.id === id);
        if (!node) return;
        g.setAttribute("transform", `translate(${node.x} ${node.y})`);
        const dim = filtering && id != null && !hit.has(id);
        g.classList.toggle("is-dim", dim);
        g.classList.toggle("is-selected", id === selected);
      });

      const world = svg.querySelector<SVGGElement>("g.node-graph-world");
      if (world) world.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [edges, filter]);

  const clientToWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const { k, x, y } = transformRef.current;
    const sx = ((clientX - rect.left) / rect.width) * WIDTH;
    const sy = ((clientY - rect.top) / rect.height) * HEIGHT;
    return { x: (sx - x) / k, y: (sy - y) / k };
  };

  return (
    <svg
      ref={svgRef}
      className="node-graph-svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Node network"
      onPointerDown={(e) => {
        const target = e.target as SVGElement;
        const g = target.closest("g.node-graph-node") as SVGGElement | null;
        if (g?.dataset.id) {
          const id = g.dataset.id;
          const node = simRef.current.find((n) => n.id === id);
          if (!node) return;
          node.pinned = true;
          dragRef.current = { kind: "node", id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y };
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          return;
        }
        const { x, y } = transformRef.current;
        dragRef.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: x, oy: y };
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        if (d.kind === "pan") {
          const rect = svgRef.current!.getBoundingClientRect();
          const dx = ((e.clientX - d.sx) / rect.width) * WIDTH;
          const dy = ((e.clientY - d.sy) / rect.height) * HEIGHT;
          transformRef.current = { ...transformRef.current, x: d.ox + dx, y: d.oy + dy };
          return;
        }
        const node = simRef.current.find((n) => n.id === d.id);
        if (!node) return;
        const w = clientToWorld(e.clientX, e.clientY);
        node.x = w.x;
        node.y = w.y;
        node.vx = 0;
        node.vy = 0;
      }}
      onPointerUp={(e) => {
        const d = dragRef.current;
        if (d?.kind === "node" && d.id) {
          const node = simRef.current.find((n) => n.id === d.id);
          if (node) node.pinned = false;
          const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
          if (moved < 6) onSelect(d.id);
        }
        dragRef.current = null;
      }}
    >
      <g className="node-graph-world">
        {edges.map((e) => (
          <line
            key={`${e.a}|${e.b}`}
            className="node-graph-edge"
            data-a={e.a}
            data-b={e.b}
            stroke={edgeStroke(e.level)}
            strokeWidth={1 + e.level * 0.15}
          />
        ))}
        {nodes.map((n) => {
          const r = radiusFor(n.display_score ?? null);
          return (
            <g key={n.node} className="node-graph-node" data-id={n.node}>
              <circle r={r} />
              <text y={r + 11} textAnchor="middle">
                {n.node}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
