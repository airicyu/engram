/** Quality checks for higher-chain rollup writer output. */

/** Reject empty / lower-layer dump / mock-label / unsectioned summaries. */
export function assertFusedRollupSummary(level: string, text: string): void {
  const t = text.trim();
  if (!t) {
    throw new Error(`${level} writer returned empty summary`);
  }

  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const idBulletRe = /^[-*]\s*\d{4}(-W\d{2}|-\d{2}(-\d{2})?)\b/;
  const idBullets = lines.filter((l) => idBulletRe.test(l));
  if (idBullets.length >= 3) {
    throw new Error(
      `${level} writer looks like a lower-id dump (${idBullets.length} id bullets)`,
    );
  }

  if (/\bsummary\s*\(mock\)\s*for\b/i.test(t)) {
    throw new Error(`${level} writer must not emit mock dump labels`);
  }

  // Nested rollup dump headers pasted through
  if (/(?:week|month|year)\s+summary\s*\(mock\)\s*for/i.test(t)) {
    throw new Error(`${level} writer must not paste nested mock summaries`);
  }

  if (/^##\s*Current\b/m.test(t) || /^##\s*History\b/m.test(t)) {
    throw new Error(`${level} writer must not include Current/History headers`);
  }

  const sectionTitles = lines.filter((l) => /^##\s+\S+/.test(l) && !/^##\s*Current\b/i.test(l));
  if (sectionTitles.length < 1) {
    throw new Error(`${level} writer must include at least one ## section title`);
  }

  // Body must start with a section title — reject agent process narration preamble.
  if (!/^##\s+\S/.test(t)) {
    throw new Error(
      `${level} writer must start with a ## section (got process preamble?)`,
    );
  }
}