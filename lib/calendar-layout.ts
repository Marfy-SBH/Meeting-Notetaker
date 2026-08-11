export interface LayoutInput {
  id: string;
  start: Date;
  end: Date;
}

export interface LayoutResult extends LayoutInput {
  col: number;
  colCount: number;
}

// Greedy column packing for overlapping events within a single day —
// good enough for a meetings calendar where true overlaps are rare.
export function layoutDayEvents(events: LayoutInput[]): LayoutResult[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const columnEnds: number[] = [];
  const placed: { event: LayoutInput; col: number }[] = [];

  for (const event of sorted) {
    let col = columnEnds.findIndex((end) => end <= event.start.getTime());
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(event.end.getTime());
    } else {
      columnEnds[col] = event.end.getTime();
    }
    placed.push({ event, col });
  }

  const colCount = columnEnds.length || 1;
  return placed.map(({ event, col }) => ({ ...event, col, colCount }));
}
