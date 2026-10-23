// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateSubagentPageSize,
  formatTokenCount,
  isAddressable,
  nextSubagentPageCount,
  relativeAge,
  sortSubagentEntries,
  SUBAGENT_PAGE_RESERVE,
  SUBAGENT_PAGE_SIZE,
  subagentAddress,
  type SubagentCatalogEntryLike,
  type SubagentCatalogSnapshotLike,
  subagentCatalogView,
  subagentDescription,
  subagentDurationMs,
  subagentDurationParts,
  subagentLabel,
  subagentMetaLabel,
  subagentMetaLine,
  subagentPage,
  type SubagentPageFit,
  subagentState,
  subagentTokens,
  type SubagentTranslate,
  subagentTurnCount,
} from "./subagent-catalog.js";
import { en } from "./locales.js";

/** The English dictionary with its `{placeholder}` slots filled in. */
const translate: SubagentTranslate = (key, params = {}) =>
  en[key].replace(
    /\{(\w+)\}/g,
    (_match, name: string) => String(params[name] ?? `{${name}}`),
  );

type Entry = SubagentCatalogEntryLike<"child-a" | "child-b" | "child-c">;

function entry(
  id: Entry["id"],
  createdAt: number,
  mode: Entry["mode"] = "continuable",
  label?: string,
): Entry {
  return { id, createdAt, mode, ...label === undefined ? {} : { label } };
}

/** Newest-first fixture for the paging rules, independent of the label type. */
function pagedEntries(count: number): SubagentCatalogEntryLike[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `child-${String(index).padStart(2, "0")}`,
    createdAt: 1_000 - index,
    mode: "one-shot" as const,
  }));
}

test("entries are ordered newest first and ties break on id", () => {
  const entries: Entry[] = [
    entry("child-a", 1_000),
    entry("child-c", 3_000),
    entry("child-b", 3_000),
  ];
  const sorted = sortSubagentEntries(entries);

  assert.deepEqual(sorted.map((item) => item.id), [
    "child-b",
    "child-c",
    "child-a",
  ]);
  // The input keeps its catalog order: the projection is not rewritten.
  assert.deepEqual(entries.map((item) => item.id), [
    "child-a",
    "child-c",
    "child-b",
  ]);
  assert.deepEqual(sortSubagentEntries([]), []);
});

test("a Session without a projection cut is loading, not empty", () => {
  assert.deepEqual(subagentCatalogView(undefined), { kind: "loading" });
  assert.deepEqual(
    subagentCatalogView({ state: "idle", values: {} }),
    { kind: "loading" },
  );
  assert.deepEqual(
    subagentCatalogView({ state: "loading", values: {} }),
    { kind: "loading" },
  );
});

test("migration-required and error snapshots are their own states", () => {
  assert.deepEqual(
    subagentCatalogView({ state: "migration-required", values: {} }),
    { kind: "migration-required" },
  );
  assert.deepEqual(
    subagentCatalogView({ state: "error", values: {} }),
    { kind: "error" },
  );
});

test("a ready snapshot exposes its catalog, missing one as empty", () => {
  const entries = [entry("child-a", 1)];
  const ready: SubagentCatalogSnapshotLike<Entry["id"]> = {
    state: "ready",
    values: { subagentCatalog: entries },
  };
  assert.deepEqual(subagentCatalogView(ready), { kind: "ready", entries });
  assert.deepEqual(
    subagentCatalogView({ state: "ready", values: {} }),
    { kind: "ready", entries: [] },
  );
});

test("a running child reads running even after a failed turn", () => {
  assert.equal(
    subagentState({ running: true, lastTurnCompleted: false }),
    "running",
  );
  assert.equal(subagentState({ running: true }), "running");
});

test("a stopped child reads completed, failed or idle from its last turn", () => {
  assert.equal(
    subagentState({ running: false, lastTurnCompleted: true }),
    "completed",
  );
  assert.equal(
    subagentState({ running: false, lastTurnCompleted: false }),
    "failed",
  );
  assert.equal(subagentState({ running: false }), "idle");
  assert.equal(subagentState({}), "idle");
  // Without a live baseline the timing projection still decides.
  assert.equal(subagentState({ lastTurnCompleted: true }), "completed");
  assert.equal(subagentState({ lastTurnCompleted: false }), "failed");
});

test("the catalog label wins, then the Session title, then the child id", () => {
  const child = entry("child-a", 1, "continuable", "  worker  ");
  assert.equal(subagentLabel(child, { title: "Session title" }), "worker");
  assert.equal(
    subagentLabel(entry("child-a", 1), { title: "Session title" }),
    "Session title",
  );
  assert.equal(
    subagentLabel(entry("child-a", 1), { displayTitle: "Display title" }),
    "Display title",
  );
  assert.equal(subagentLabel(entry("child-a", 1)), "child-a");
  // Blank labels and titles are absent, not empty labels.
  assert.equal(
    subagentLabel(entry("child-a", 1, "one-shot", "   "), {
      title: "  ",
      displayTitle: "Session title",
    }),
    "Session title",
  );
});

test("the card description prefers the task text, then the Session title", () => {
  const child = entry("child-a", 1, "continuable", "worker");
  // The child's own first prompt preview is the most direct description.
  assert.equal(
    subagentDescription(child, {
      title: "Generated title",
      projectionValues: { turnOutline: [{ prompt: "  Audit paging  " }] },
    }),
    "Audit paging",
  );
  // A blank preview falls through to the durable title generated from it.
  assert.equal(
    subagentDescription(child, {
      title: "Generated title",
      projectionValues: { turnOutline: [{ prompt: "  " }] },
    }),
    "Generated title",
  );
  assert.equal(
    subagentDescription(child, { title: "  Audit paging  " }),
    "Audit paging",
  );
  // displayTitle is a label, so it only stands in when it adds information.
  assert.equal(
    subagentDescription(child, { title: " ", displayTitle: "Paged cards" }),
    "Paged cards",
  );
  // Repeating the label or falling back to the raw id is not a description.
  assert.equal(subagentDescription(child, { title: "worker" }), undefined);
  assert.equal(
    subagentDescription(child, {
      projectionValues: { turnOutline: [{ prompt: "worker" }] },
    }),
    undefined,
  );
  assert.equal(
    subagentDescription(child, { displayTitle: "worker" }),
    undefined,
  );
  assert.equal(
    subagentDescription(child, { displayTitle: "child-a" }),
    undefined,
  );
  // No summary means no description, never an empty placeholder.
  assert.equal(subagentDescription(child), undefined);
});

test("the first page shows the newest rows and keeps older ones behind Load more", () => {
  const entries = pagedEntries(14);
  assert.equal(SUBAGENT_PAGE_SIZE, 6);
  const first = subagentPage(entries);
  assert.deepEqual(
    first.entries.map((item) => item.id),
    entries.slice(0, SUBAGENT_PAGE_SIZE).map((item) => item.id),
  );
  assert.equal(first.hasMore, true);
  // A catalog shorter than one page is shown whole and needs no button.
  const short = subagentPage(pagedEntries(3));
  assert.equal(short.entries.length, 3);
  assert.equal(short.hasMore, false);
});

test("one Load more press reveals the next batch of older rows", () => {
  const entries = pagedEntries(14);
  const nextCount = nextSubagentPageCount(SUBAGENT_PAGE_SIZE, entries.length);
  assert.equal(nextCount, 12);
  const next = subagentPage(entries, nextCount);
  assert.deepEqual(
    next.entries.map((item) => item.id),
    entries.slice(0, 12).map((item) => item.id),
  );
  assert.equal(next.hasMore, true);
});

test("the window stops at the catalog total and retires Load more", () => {
  const entries = pagedEntries(14);
  const finalCount = nextSubagentPageCount(12, entries.length);
  assert.equal(finalCount, 14);
  const final = subagentPage(entries, finalCount);
  assert.deepEqual(
    final.entries.map((item) => item.id),
    entries.map((item) => item.id),
  );
  assert.equal(final.hasMore, false);
  // Asking for more than exists clamps to the total.
  assert.deepEqual(
    subagentPage(entries, 100).entries.map((item) => item.id),
    entries.map((item) => item.id),
  );
  assert.equal(subagentPage(entries, 100).hasMore, false);
  assert.equal(nextSubagentPageCount(100, 14), 14);
});

test("the page-size estimate counts the card rows the pane can hold", () => {
  const fit: SubagentPageFit = {
    paneHeight: 1_000,
    cardHeight: 168,
    rowGap: 14,
    columns: 2,
  };
  const usable = fit.paneHeight - SUBAGENT_PAGE_RESERVE;
  const rows = Math.floor(
    (usable + fit.rowGap) / (fit.cardHeight + fit.rowGap),
  );
  assert.ok(rows > 1, "the fixture spans several rows");
  assert.equal(estimateSubagentPageSize(fit), rows * fit.columns);
  // Exactly two rows fit in this pane; one pixel less and only one does.
  const twoRows = SUBAGENT_PAGE_RESERVE + 168 * 2 + 14;
  assert.equal(
    estimateSubagentPageSize({
      paneHeight: twoRows,
      cardHeight: 168,
      rowGap: 14,
      columns: 1,
    }),
    2,
  );
  assert.equal(
    estimateSubagentPageSize({
      paneHeight: twoRows - 1,
      cardHeight: 168,
      rowGap: 14,
      columns: 1,
    }),
    1,
  );
});

test("the page-size estimate clamps a short pane to one card", () => {
  assert.equal(
    estimateSubagentPageSize({
      paneHeight: 40,
      cardHeight: 168,
      rowGap: 14,
      columns: 3,
    }),
    1,
  );
});

test("the page-size estimate falls back when layout cannot be measured", () => {
  assert.equal(estimateSubagentPageSize(undefined), SUBAGENT_PAGE_SIZE);
  const unmeasurable: readonly SubagentPageFit[] = [
    { paneHeight: 0, cardHeight: 168, rowGap: 14, columns: 2 },
    { paneHeight: 800, cardHeight: 0, rowGap: 14, columns: 2 },
    { paneHeight: 800, cardHeight: 168, rowGap: 14, columns: 0 },
    { paneHeight: Number.NaN, cardHeight: 168, rowGap: 14, columns: 2 },
    {
      paneHeight: 800,
      cardHeight: Number.POSITIVE_INFINITY,
      rowGap: 14,
      columns: 2,
    },
  ];
  for (const fit of unmeasurable) {
    assert.equal(estimateSubagentPageSize(fit), SUBAGENT_PAGE_SIZE);
  }
});

test("Load more adds the measured page size and clamps to the catalog total", () => {
  assert.equal(nextSubagentPageCount(4, 20, 5), 9);
  assert.equal(nextSubagentPageCount(18, 20, 5), 20);
  // A step that is not a positive number uses the fixed fallback.
  assert.equal(nextSubagentPageCount(4, 20, 0), 4 + SUBAGENT_PAGE_SIZE);
  assert.equal(
    nextSubagentPageCount(4, 20, Number.NaN),
    4 + SUBAGENT_PAGE_SIZE,
  );
});

test("duration keeps an open turn counting and settles when it closes", () => {
  const summary = {
    projectionValues: {
      subagentTiming: {
        settledMs: 5_000,
        active: { since: 10_000, through: 12_000 },
      },
    },
  };
  assert.equal(subagentDurationMs(summary, true, 15_000), 10_000);
  assert.equal(subagentDurationMs(summary, false, 15_000), 7_000);
  assert.equal(
    subagentDurationMs(
      { projectionValues: { subagentTiming: { settledMs: 5_000 } } },
      true,
      15_000,
    ),
    5_000,
  );
  assert.equal(subagentDurationMs({}, true, 15_000), undefined);
});

test("duration formatting picks the largest fitting units", () => {
  assert.deepEqual(subagentDurationParts(0), { unit: "subSecond" });
  assert.deepEqual(subagentDurationParts(12_400), {
    unit: "seconds",
    seconds: 12,
  });
  assert.deepEqual(subagentDurationParts(65_000), {
    unit: "minutes",
    minutes: 1,
    seconds: 5,
  });
  assert.deepEqual(subagentDurationParts(3_725_000), {
    unit: "hours",
    hours: 1,
    minutes: 2,
  });
  assert.deepEqual(subagentDurationParts(90_000_000), {
    unit: "days",
    days: 1,
    hours: 1,
  });
});

test("token totals sum the four buckets and turns omit an empty log", () => {
  const usage = {
    uncachedInputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 3,
    cacheWriteTokens: 4,
  };
  assert.equal(
    subagentTokens({ projectionValues: { tokenUsage: usage } }),
    127,
  );
  assert.equal(subagentTokens({}), undefined);
  assert.equal(
    subagentTurnCount({ projectionValues: { sessionStats: { turns: 3 } } }),
    3,
  );
  assert.equal(
    subagentTurnCount({ projectionValues: { sessionStats: { turns: 0 } } }),
    undefined,
  );
  assert.equal(subagentTurnCount({}), undefined);
  assert.equal(formatTokenCount(940), "940");
  assert.equal(formatTokenCount(1_240), "1.2K");
  assert.equal(formatTokenCount(1_240_000), "1.2M");
});

test("ages switch unit at a minute, an hour and a day", () => {
  const now = 10 * 86_400_000;
  assert.deepEqual(relativeAge(now - 59_000, now), { unit: "now" });
  assert.deepEqual(relativeAge(now, now), { unit: "now" });
  assert.deepEqual(relativeAge(now - 60_000, now), {
    unit: "minute",
    count: 1,
  });
  assert.deepEqual(relativeAge(now - 59 * 60_000, now), {
    unit: "minute",
    count: 59,
  });
  assert.deepEqual(relativeAge(now - 3_600_000, now), {
    unit: "hour",
    count: 1,
  });
  assert.deepEqual(relativeAge(now - 86_400_000, now), {
    unit: "day",
    count: 1,
  });
  // A clock that lags behind the creation time, or a corrupt timestamp, never
  // prints a negative or NaN age.
  assert.deepEqual(relativeAge(now + 5_000, now), { unit: "now" });
  assert.deepEqual(relativeAge(Number.NaN, now), { unit: "now" });
  assert.deepEqual(relativeAge(now, Number.NaN), { unit: "now" });
});

test("the single meta line carries the age after the stats", () => {
  const now = 10 * 86_400_000;
  const full = {
    projectionValues: {
      subagentTiming: { settledMs: 62_000 },
      tokenUsage: {
        uncachedInputTokens: 1_000,
        outputTokens: 200,
        cacheReadTokens: 30,
        cacheWriteTokens: 10,
      },
      sessionStats: { turns: 2 },
    },
  };

  assert.equal(
    subagentMetaLabel(translate, full, false, now, now - 5 * 60_000),
    "1m 2s · 1.2K tok · 2 turns · 5m ago",
  );
  // Duration, tokens and turns are independent facts: an absent one is
  // omitted, and the age still closes the same single line. One turn says
  // nothing, so it is dropped even when other facts share the line.
  assert.equal(
    subagentMetaLabel(
      translate,
      {
        projectionValues: {
          subagentTiming: { settledMs: 62_000 },
          sessionStats: { turns: 1 },
        },
      },
      false,
      now,
      now,
    ),
    "1m 2s · just now",
  );
  assert.equal(
    subagentMetaLabel(translate, {}, undefined, now, now),
    "just now",
  );
  // An external execution keeps its muted marker on that same line.
  assert.equal(
    subagentMetaLabel(translate, {}, undefined, now, now, "External"),
    "External · just now",
  );
});

test("the meta line skips empty facts instead of leaving separators", () => {
  assert.equal(subagentMetaLine({ age: "just now" }), "just now");
  assert.equal(
    subagentMetaLine({ external: "", duration: "3s", age: "1m ago" }),
    "3s · 1m ago",
  );
  assert.equal(subagentMetaLine({}), undefined);
});

test("external executions are not addressable", () => {
  assert.equal(isAddressable(entry("child-a", 1, "external")), false);
  for (const mode of ["one-shot", "continuable", "unknown"] as const) {
    assert.equal(isAddressable(entry("child-a", 1, mode)), true);
  }
});

test("addresses carry the parent, the child and the durable mode", () => {
  assert.deepEqual(subagentAddress("parent", "child", "one-shot"), {
    parentSessionId: "parent",
    childSessionId: "child",
    mode: "one-shot",
  });
  assert.deepEqual(subagentAddress("parent", "child", "continuable"), {
    parentSessionId: "parent",
    childSessionId: "child",
    mode: "continuable",
  });
  assert.deepEqual(subagentAddress("parent", "child", "unknown"), {
    parentSessionId: "parent",
    childSessionId: "child",
    mode: "unknown",
  });
});
