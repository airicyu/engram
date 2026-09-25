/** Parse optional activity_score from node markdown YAML frontmatter (0–100). */

export function parseActivityScoreFromMarkdown(md: string): number | null {
  const m = String(md).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];
  const line = fm.match(/^activity_score:\s*(\d+)\s*$/m);
  if (!line) return null;
  const n = Number(line[1]);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, Math.trunc(n)));
  return clamped;
}

export function mergeActivityScoreIntoMarkdown(md: string, score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.trunc(score)));
  const src = String(md);
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    let fm = fmMatch[1];
    const body = fmMatch[2];
    if (/^activity_score:\s*\d+\s*$/m.test(fm)) {
      fm = fm.replace(/^activity_score:\s*\d+\s*$/m, `activity_score: ${clamped}`);
    } else {
      fm = fm.trimEnd() + `\nactivity_score: ${clamped}\n`;
    }
    return `---\n${fm}---\n${body}`;
  }
  return `---\nactivity_score: ${clamped}\n---\n${src}`;
}

/** Engram sidecar: score.yaml with `score:` or `activity_score:` */
export function parseActivityScoreFromYaml(text: string): number | null {
  const t = String(text);
  const line =
    t.match(/^score:\s*(\d+)\s*$/m) || t.match(/^activity_score:\s*(\d+)\s*$/m);
  if (!line) return null;
  const n = Number(line[1]);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}
