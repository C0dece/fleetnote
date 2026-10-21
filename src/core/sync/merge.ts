/** Построчное трёхстороннее слияние: база → локальная версия + версия из облака. */

export interface MergeResult {
  text: string;
  /** true — правки пересеклись, слить без потерь нельзя. */
  conflicted: boolean;
}

interface Hunk {
  start: number;
  end: number;
  lines: string[];
}

/** Слишком большие файлы не сливаем построчно: O(n²) память не стоит того. */
const MAX_LINES = 5000;

export function merge3(base: string, local: string, remote: string): MergeResult {
  if (local === remote) return { text: local, conflicted: false };
  if (base === local) return { text: remote, conflicted: false };
  if (base === remote) return { text: local, conflicted: false };

  const baseLines = base.split("\n");
  const localLines = local.split("\n");
  const remoteLines = remote.split("\n");
  if (Math.max(baseLines.length, localLines.length, remoteLines.length) > MAX_LINES) {
    return { text: local, conflicted: true };
  }

  const localHunks = diffHunks(baseLines, localLines);
  const remoteHunks = diffHunks(baseLines, remoteLines);

  const out: string[] = [];
  let cursor = 0;
  let conflicted = false;
  let li = 0;
  let ri = 0;

  while (li < localHunks.length || ri < remoteHunks.length) {
    const next = pickNext(localHunks[li], remoteHunks[ri]);
    if (next === "local") {
      const hunk = localHunks[li++];
      out.push(...baseLines.slice(cursor, hunk.start), ...hunk.lines);
      cursor = hunk.end;
      continue;
    }
    if (next === "remote") {
      const hunk = remoteHunks[ri++];
      out.push(...baseLines.slice(cursor, hunk.start), ...hunk.lines);
      cursor = hunk.end;
      continue;
    }
    // Оба изменили один и тот же участок.
    const a = localHunks[li++];
    const b = remoteHunks[ri++];
    const start = Math.min(a.start, b.start);
    const end = Math.max(a.end, b.end);
    out.push(...baseLines.slice(cursor, start));
    if (sameLines(a.lines, b.lines)) {
      out.push(...a.lines);
    } else {
      conflicted = true;
      out.push(...a.lines);
    }
    cursor = end;
  }
  out.push(...baseLines.slice(cursor));
  return { text: out.join("\n"), conflicted };
}

function pickNext(local: Hunk | undefined, remote: Hunk | undefined): "local" | "remote" | "both" {
  if (local && !remote) return "local";
  if (remote && !local) return "remote";
  if (!local || !remote) return "both";
  if (local.end <= remote.start) return "local";
  if (remote.end <= local.start) return "remote";
  return "both";
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Участки, в которых `next` отличается от `base`, в координатах base. */
export function diffHunks(base: string[], next: string[]): Hunk[] {
  const table = lcsTable(base, next);
  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  let pending: Hunk | null = null;

  while (i < base.length || j < next.length) {
    if (i < base.length && j < next.length && base[i] === next[j]) {
      if (pending) {
        hunks.push(pending);
        pending = null;
      }
      i++;
      j++;
      continue;
    }
    const down = i < base.length ? table[i + 1][j] : -1;
    const right = j < next.length ? table[i][j + 1] : -1;
    pending ??= { start: i, end: i, lines: [] };
    if (right >= down) {
      pending.lines.push(next[j]);
      j++;
    } else {
      i++;
      pending.end = i;
    }
  }
  if (pending) hunks.push(pending);
  return hunks;
}

function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}
