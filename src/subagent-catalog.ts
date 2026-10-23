// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// Pure helpers behind the Subagents tab: what the catalog snapshot currently
// allows, how its rows are ordered, which status and label each row shows, and
// how old it is. Nothing here touches the harness or the DOM, so the host
// program can unit-test every rule against plain fixtures.
import type { SubagentSidebarKey } from "./locales.js";

/** Copy lookup the meta formatters call, bound to this plugin's namespace. */
export type SubagentTranslate = (
  key: SubagentSidebarKey,
  params?: Record<string, unknown>,
) => string;

/** Creation mode of one catalog row, as the parent Session records it. */
export type SubagentMode = "one-shot" | "continuable" | "external" | "unknown";

/** Modes that name a local child Session the browser can navigate to. */
export type AddressableMode = Exclude<SubagentMode, "external">;

/** The part of a catalog row this plugin reads. */
export interface SubagentCatalogEntryLike<Id extends string = string> {
  /** Child Session identity, also the row's tiebreaker. */
  readonly id: Id;
  /** Creation time used for the newest-first order and the relative age. */
  readonly createdAt: number;
  /** Creation mode; `external` rows own no local Session. */
  readonly mode: SubagentMode;
  /** Creation label, present on every continuable child. */
  readonly label?: string | undefined;
}

/** The part of one Session's projection snapshot this plugin reads. */
export interface SubagentCatalogSnapshotLike<Id extends string = string> {
  readonly state: "idle" | "loading" | "ready" | "migration-required" | "error";
  readonly values: {
    readonly subagentCatalog?:
      | readonly SubagentCatalogEntryLike<Id>[]
      | undefined;
  };
}

/** What the catalog currently allows the tab to show. */
export type SubagentCatalogView<Id extends string = string> =
  | { readonly kind: "loading" }
  | { readonly kind: "migration-required" }
  | { readonly kind: "error" }
  | {
    readonly kind: "ready";
    readonly entries: readonly SubagentCatalogEntryLike<Id>[];
  };

/** Status facts one card's state dot is derived from. */
export interface SubagentStatusFacts {
  /** Live status; `undefined` before any baseline or event establishes it. */
  readonly running?: boolean | undefined;
  /** Whether the latest closed turn completed normally, from `subagentTiming`. */
  readonly lastTurnCompleted?: boolean | undefined;
}

/** One of the four visual states a subagent card can be in. */
export type SubagentState = "running" | "idle" | "completed" | "failed";

/** Session summary fields the label, description and status fallbacks read. */
export interface SubagentSummaryLike {
  /** Durable Session title, generated from the child's own task prompt. */
  readonly title?: string | undefined;
  /** Human-facing label: durable title, project basename, then the child id. */
  readonly displayTitle?: string | undefined;
  readonly running?: boolean | undefined;
  /** Projection values carried by the same summary row. */
  readonly projectionValues?: SubagentProjectionValuesLike | undefined;
}

/** Duration facts folded into `subagentTiming`, as a card reads them. */
export interface SubagentTimingLike {
  /** Milliseconds accumulated across completed turns. */
  readonly settledMs?: number | undefined;
  /** The currently open turn, when one has not reached `turn/end`. */
  readonly active?:
    | {
      readonly since: number;
      readonly through: number;
    }
    | undefined;
}

/** Provider usage buckets the card's token total sums. */
export interface SubagentTokenUsageLike {
  readonly uncachedInputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly cacheReadTokens?: number | undefined;
  readonly cacheWriteTokens?: number | undefined;
}

/**
 * Projection values a card's description and stats line read.
 *
 * Declared structurally instead of importing the projection packages: they are
 * not dependencies of this plugin, and these optional shapes keep a summary
 * without those capabilities renderable.
 */
export interface SubagentProjectionValuesLike {
  readonly subagentTiming?: SubagentTimingLike | undefined;
  readonly tokenUsage?: SubagentTokenUsageLike | undefined;
  readonly sessionStats?: { readonly turns?: number | undefined } | undefined;
  /** Whole-log turn outline; its first entry carries the child's own task text. */
  readonly turnOutline?:
    | readonly { readonly prompt?: string | undefined }[]
    | undefined;
}

/** A duration split into the units a card prints. */
export type SubagentDurationParts =
  | { readonly unit: "subSecond" }
  | { readonly unit: "seconds"; readonly seconds: number }
  | {
    readonly unit: "minutes";
    readonly minutes: number;
    readonly seconds: number;
  }
  | { readonly unit: "hours"; readonly hours: number; readonly minutes: number }
  | { readonly unit: "days"; readonly days: number; readonly hours: number };

/** Fallback page size: first page and Load more step when the pane cannot be
 * measured. */
export const SUBAGENT_PAGE_SIZE = 6;

/** Height, in CSS pixels, kept clear below the card rows so the root's
 * insets, the panel gap and the Load more button always fit. */
export const SUBAGENT_PAGE_RESERVE = 80;

/** Measured layout facts the adaptive page-size estimate reads. */
export interface SubagentPageFit {
  /** Height of the tab's scrollable pane, in CSS pixels. */
  readonly paneHeight: number;
  /** Height of the tallest card currently laid out, in CSS pixels. */
  readonly cardHeight: number;
  /** Vertical gap between card rows, in CSS pixels. */
  readonly rowGap: number;
  /** Number of card columns the grid lays out. */
  readonly columns: number;
}

/** The slice of sorted rows the grid currently renders. */
export interface SubagentPage<Id extends string = string> {
  /** Newest-first rows to render. */
  readonly entries: readonly SubagentCatalogEntryLike<Id>[];
  /** Whether older rows remain behind the "Load more" button. */
  readonly hasMore: boolean;
}

/** A relative age split into a locale key and its count. */
export type RelativeAge =
  | { readonly unit: "now" }
  | { readonly unit: "minute" | "hour" | "day"; readonly count: number };

/**
 * Narrow one Session's projection snapshot to what the tab can render.
 *
 * `idle` and `loading` both mean "no cut yet" — the tab asks for one when it
 * opens, so both show the loading copy. `migration-required` is its own
 * terminal state: the Host cannot read the old Session format at all.
 * @param snapshot - the Session's projection snapshot, when the client holds one.
 * @returns the tab's view of the catalog.
 */
export function subagentCatalogView<Id extends string>(
  snapshot: SubagentCatalogSnapshotLike<Id> | undefined,
): SubagentCatalogView<Id> {
  if (snapshot === undefined) return { kind: "loading" };
  switch (snapshot.state) {
    case "ready":
      return { kind: "ready", entries: snapshot.values.subagentCatalog ?? [] };
    case "migration-required":
      return { kind: "migration-required" };
    case "error":
      return { kind: "error" };
    case "idle":
    case "loading":
      return { kind: "loading" };
    default:
      return { kind: "loading" };
  }
}

/**
 * Order rows newest first, so a newly spawned subagent is at the top.
 *
 * The identity tiebreak keeps the order stable for rows created in the same
 * millisecond; comparing code points, not locales, keeps every browser on the
 * same order.
 * @param entries - rows in catalog order.
 * @returns a new array in display order; the input is not mutated.
 */
export function sortSubagentEntries<Id extends string>(
  entries: readonly SubagentCatalogEntryLike<Id>[],
): SubagentCatalogEntryLike<Id>[] {
  return [...entries].sort((left, right) =>
    right.createdAt - left.createdAt ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}

/**
 * Slice the ordered rows to the window currently shown.
 *
 * The input is already in display order, so the window always holds the newest
 * rows. A count above the row total shows everything, which is what retires
 * the "Load more" button.
 * @param entries - newest-first rows.
 * @param visibleCount - how many rows the grid may render; defaults to one page.
 * @returns the visible slice and whether older rows remain.
 */
export function subagentPage<Id extends string>(
  entries: readonly SubagentCatalogEntryLike<Id>[],
  visibleCount: number = SUBAGENT_PAGE_SIZE,
): SubagentPage<Id> {
  const limit = Number.isFinite(visibleCount)
    ? Math.max(0, Math.trunc(visibleCount))
    : entries.length;
  return {
    entries: limit >= entries.length ? entries : entries.slice(0, limit),
    hasMore: limit < entries.length,
  };
}

/**
 * Count the window one "Load more" press asks for.
 *
 * The count never exceeds the row total, so the button disappears exactly when
 * the last row is shown. The step is the measured page size, and a step that is
 * not a positive number falls back to the fixed page size.
 * @param visibleCount - rows currently allowed by the grid.
 * @param total - rows currently in the catalog.
 * @param pageSize - rows the measured pane can add; defaults to one fixed page.
 * @returns the next window size, clamped to the total.
 */
export function nextSubagentPageCount(
  visibleCount: number,
  total: number,
  pageSize: number = SUBAGENT_PAGE_SIZE,
): number {
  const shown = Number.isFinite(visibleCount)
    ? Math.max(0, Math.trunc(visibleCount))
    : 0;
  const all = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  const step = Number.isFinite(pageSize) && pageSize >= 1
    ? Math.trunc(pageSize)
    : SUBAGENT_PAGE_SIZE;
  return Math.min(all, shown + step);
}

/**
 * Estimate how many cards fill the pane while leaving Load more room.
 *
 * A row costs one card height plus one row gap; the last row needs no trailing
 * gap, so the usable height plus one gap is divided by one row's cost. The
 * usable height is the pane minus {@link SUBAGENT_PAGE_RESERVE}, and the result
 * multiplies whole rows by whole columns. A fit whose pane, card height or
 * column count is missing, non-finite or zero cannot be measured, so the fixed
 * page size stands in; a measurable pane too short for one row still shows one
 * card rather than none.
 * @param fit - measured pane, card and grid facts, when layout is available.
 * @returns the number of cards to load, never less than one.
 */
export function estimateSubagentPageSize(
  fit: SubagentPageFit | undefined,
): number {
  if (fit === undefined) return SUBAGENT_PAGE_SIZE;
  const { cardHeight, columns, paneHeight, rowGap } = fit;
  if (
    !Number.isFinite(paneHeight) || paneHeight <= 0 ||
    !Number.isFinite(cardHeight) || cardHeight <= 0 ||
    !Number.isFinite(columns) || columns <= 0
  ) {
    return SUBAGENT_PAGE_SIZE;
  }
  const gap = Number.isFinite(rowGap) && rowGap > 0 ? rowGap : 0;
  const usable = paneHeight - SUBAGENT_PAGE_RESERVE;
  const rows = Math.floor((usable + gap) / (cardHeight + gap));
  // No whole row fits: keep one card on screen rather than none.
  return Math.max(1, rows * Math.max(1, Math.trunc(columns)));
}

/**
 * Derive the state dot from the live status and the timing projection.
 *
 * A running child always reads running: a previous failed turn must not paint
 * it failed while it works again. Once it stops, the last closed turn decides
 * between completed and failed; without one it is idle.
 * @param facts - status and timing facts, either possibly absent.
 * @returns the dot state.
 */
export function subagentState(facts: SubagentStatusFacts): SubagentState {
  if (facts.running === true) return "running";
  if (facts.lastTurnCompleted === true) return "completed";
  if (facts.lastTurnCompleted === false) return "failed";
  return "idle";
}

/**
 * Resolve the label a card shows.
 *
 * The catalog label is the durable creation name and wins; without one the
 * Session title, then its display title, then the child id keeps the card
 * named. Blank strings are treated as absent.
 * @param entry - catalog row whose label to read.
 * @param summary - the child Session's summary, when the client lists it.
 * @returns a non-empty display label.
 */
export function subagentLabel(
  entry: Pick<SubagentCatalogEntryLike, "id" | "label">,
  summary?: SubagentSummaryLike | undefined,
): string {
  const label = entry.label?.trim();
  if (label !== undefined && label !== "") return label;
  const title = summary?.title?.trim();
  if (title !== undefined && title !== "") return title;
  const displayTitle = summary?.displayTitle?.trim();
  if (displayTitle !== undefined && displayTitle !== "") return displayTitle;
  return entry.id;
}

/**
 * Resolve the description a card prints under its label.
 *
 * The best source is the child's own task text: the `turnOutline` projection
 * keeps a bounded preview of the first human prompt, i.e. the delegation the
 * subagent received. That preview is already cut at the source — the harness
 * caps it and appends an ellipsis — so the card never truncates it again in
 * CSS. When the projection has not landed, the child Session's durable title —
 * generated from the same prompt, and the field dsh's subagent menu shows as
 * its secondary line — stands in. The catalog entry itself only carries the
 * creation label, already shown as the card title.
 *
 * `displayTitle` is a label — durable title, project basename, then the raw
 * child id — so it only falls through when it adds information: a different,
 * non-id string. A result equal to the card label is suppressed, and a missing
 * one leaves the card shorter rather than printing filler.
 * @param entry - catalog row whose label sets the title line.
 * @param summary - the child Session's summary, when the client lists it.
 * @returns the description text, or `undefined` when none is available.
 */
export function subagentDescription(
  entry: Pick<SubagentCatalogEntryLike, "id" | "label">,
  summary?: SubagentSummaryLike | undefined,
): string | undefined {
  const label = subagentLabel(entry, summary);
  const prompt = firstPromptPreview(summary);
  if (prompt !== undefined && prompt !== label) return prompt;
  const title = summary?.title?.trim();
  if (title !== undefined && title !== "" && title !== label) return title;
  const displayTitle = summary?.displayTitle?.trim();
  if (
    displayTitle !== undefined && displayTitle !== "" &&
    displayTitle !== label && displayTitle !== entry.id
  ) {
    return displayTitle;
  }
  return undefined;
}

/** Bounded preview of the child's first turn prompt, when the fold has one. */
function firstPromptPreview(
  summary: SubagentSummaryLike | undefined,
): string | undefined {
  const prompt = summary?.projectionValues?.turnOutline?.[0]?.prompt?.trim();
  return prompt === undefined || prompt === "" ? undefined : prompt;
}

/**
 * Active duration of one subagent, in milliseconds.
 *
 * `subagentTiming` folds completed turns into `settledMs` and keeps the open
 * turn's interval separately. A live child extends that interval to `now`, so
 * the card keeps counting; once it stops, the last folded `through` bounds the
 * same interval, so the figure settles instead of drifting.
 * @param summary - the child Session's summary, when the client lists it.
 * @param running - live status; a stopped child uses the fold's own end.
 * @param now - current epoch milliseconds.
 * @returns the duration, or `undefined` without a timing projection.
 */
export function subagentDurationMs(
  summary: SubagentSummaryLike | undefined,
  running: boolean | undefined,
  now: number,
): number | undefined {
  const timing = summary?.projectionValues?.subagentTiming;
  if (timing === undefined) return undefined;
  const settled = finiteNonNegative(timing.settledMs);
  const active = timing.active;
  if (active === undefined) return settled;
  const end = running === true ? now : active.through;
  const open = Number.isFinite(active.since) && Number.isFinite(end)
    ? Math.max(0, end - active.since)
    : 0;
  return settled + open;
}

/**
 * Total provider tokens a card prints: the four disjoint usage buckets.
 * @param summary - the child Session's summary, when the client lists it.
 * @returns the total, or `undefined` without a usage projection.
 */
export function subagentTokens(
  summary: SubagentSummaryLike | undefined,
): number | undefined {
  const usage = summary?.projectionValues?.tokenUsage;
  if (usage === undefined) return undefined;
  return finiteNonNegative(usage.uncachedInputTokens) +
    finiteNonNegative(usage.outputTokens) +
    finiteNonNegative(usage.cacheReadTokens) +
    finiteNonNegative(usage.cacheWriteTokens);
}

/**
 * Whole-log turn count the meta line reads, if the child has run a turn.
 * @param summary - the child Session's summary, when the client lists it.
 * @returns the count, or `undefined` without stats or before the first turn.
 */
export function subagentTurnCount(
  summary: SubagentSummaryLike | undefined,
): number | undefined {
  const turns = summary?.projectionValues?.sessionStats?.turns;
  if (turns === undefined || !Number.isFinite(turns) || turns < 1) {
    return undefined;
  }
  return Math.trunc(turns);
}

/**
 * Split a duration into the two units a card prints.
 * @param ms - duration in milliseconds; negatives and NaN read as zero.
 * @returns the largest fitting unit pair.
 */
export function subagentDurationParts(ms: number): SubagentDurationParts {
  const totalSeconds = Math.floor(finiteNonNegative(ms) / 1_000);
  if (totalSeconds < 1) return { unit: "subSecond" };
  if (totalSeconds < 60) return { unit: "seconds", seconds: totalSeconds };
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return {
      unit: "minutes",
      minutes: totalMinutes,
      seconds: totalSeconds % 60,
    };
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return { unit: "hours", hours: totalHours, minutes: totalMinutes % 60 };
  }
  const totalDays = Math.floor(totalHours / 24);
  return { unit: "days", days: totalDays, hours: totalHours % 24 };
}

/**
 * Format a token total compactly for one muted meta item.
 * @param tokens - token total, rounded to whole tokens.
 * @returns a plain number, or a `K`/`M` figure.
 */
export function formatTokenCount(tokens: number): string {
  const total = finiteNonNegative(tokens);
  if (total < 1_000) return String(Math.round(total));
  if (total < 999_500) return `${scaledCount(total / 1_000)}K`;
  return `${scaledCount(total / 1_000_000)}M`;
}

/** One decimal below 100, whole numbers above, matching dsh's token badges. */
function scaledCount(value: number): string {
  return value >= 100
    ? String(Math.round(value))
    : String(Math.round(value * 10) / 10);
}

/** Clamp one optional numeric projection value into a usable count. */
function finiteNonNegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Split the time since creation into the unit a card prints.
 *
 * Minutes are the smallest unit: a just-created child reads "just now" until
 * a minute has passed, which avoids a flickering countdown on the first frame.
 * A future or non-finite timestamp degrades to "just now" instead of printing
 * a negative age.
 * @param createdAt - creation time in epoch milliseconds.
 * @param now - current time in epoch milliseconds.
 * @returns the relative age.
 */
export function relativeAge(createdAt: number, now: number): RelativeAge {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) {
    return { unit: "now" };
  }
  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < 60_000) return { unit: "now" };
  if (elapsed < 3_600_000) {
    return { unit: "minute", count: Math.floor(elapsed / 60_000) };
  }
  if (elapsed < 86_400_000) {
    return { unit: "hour", count: Math.floor(elapsed / 3_600_000) };
  }
  return { unit: "day", count: Math.floor(elapsed / 86_400_000) };
}

/** Independent facts, already formatted, that share one card's meta line. */
export interface SubagentMetaFacts {
  /** Muted marker naming an external execution, when the row is one. */
  readonly external?: string | undefined;
  /** Formatted active duration; absent without a timing projection. */
  readonly duration?: string | undefined;
  /** Formatted token total; absent until usage lands. */
  readonly tokens?: string | undefined;
  /** Formatted whole-log turn count; absent before the second turn, since one
   * turn is not printed. */
  readonly turns?: string | undefined;
  /** Formatted relative age, always the line's last item. */
  readonly age?: string | undefined;
}

/**
 * Join one card's metadata facts into its single muted line.
 *
 * The facts are independent, so an absent or empty one is skipped instead of
 * leaving an empty placeholder or a doubled separator. The age is one of the
 * facts, not a second row, so a child with no stats still reads its age on the
 * same line as every other card.
 * @param facts - the card's formatted metadata facts.
 * @returns the ` · `-joined line, or `undefined` when every fact is absent.
 */
export function subagentMetaLine(
  facts: SubagentMetaFacts,
): string | undefined {
  const items = [
    facts.external,
    facts.duration,
    facts.tokens,
    facts.turns,
    facts.age,
  ].filter((item): item is string => item !== undefined && item !== "");
  return items.length === 0 ? undefined : items.join(" · ");
}

/**
 * Format one card's complete muted metadata line.
 *
 * Duration, tokens and turns are independent projection facts and each is
 * omitted when it has no value rather than printed as a zero or an empty
 * placeholder. A single turn is omitted too: it says nothing beyond the card's
 * existence, while two or more turns are worth the width. The relative age
 * always closes the line, so the card has one meta row instead of a stats row
 * plus a separate age row.
 * @param t - namespace-bound translate.
 * @param summary - the child Session's summary, when the client lists it.
 * @param running - live status, used to keep an open turn's duration counting.
 * @param now - current epoch milliseconds.
 * @param createdAt - creation time used for the relative age.
 * @param external - muted external marker, when the row owns no local Session.
 * @returns the one-line metadata text, always ending with the age.
 */
export function subagentMetaLabel(
  t: SubagentTranslate,
  summary: SubagentSummaryLike | undefined,
  running: boolean | undefined,
  now: number,
  createdAt: number,
  external?: string | undefined,
): string {
  const durationMs = subagentDurationMs(summary, running, now);
  const tokens = subagentTokens(summary);
  const turns = subagentTurnCount(summary);
  const age = ageLabel(t, relativeAge(createdAt, now));
  const duration = durationMs !== undefined && durationMs > 0
    ? durationLabel(t, subagentDurationParts(durationMs))
    : undefined;
  const tokenTotal = tokens !== undefined && tokens > 0
    ? t("tokens.total", { value: formatTokenCount(tokens) })
    : undefined;
  const turnCount = turns !== undefined && turns > 1
    ? t("turns.other", { count: turns })
    : undefined;
  return subagentMetaLine({
    external,
    duration,
    tokens: tokenTotal,
    turns: turnCount,
    age,
  }) ?? age;
}

/**
 * Format one card's age through the active locale.
 * @param t - namespace-bound translate.
 * @param age - relative age of the card.
 * @returns the localized age text.
 */
function ageLabel(t: SubagentTranslate, age: RelativeAge): string {
  switch (age.unit) {
    case "now":
      return t("age.now");
    case "minute":
      return t("age.minute", { count: age.count });
    case "hour":
      return t("age.hour", { count: age.count });
    case "day":
      return t("age.day", { count: age.count });
  }
}

/**
 * Format one card's active duration through the active locale.
 * @param t - namespace-bound translate.
 * @param parts - duration split into its largest units.
 * @returns the localized duration text.
 */
function durationLabel(
  t: SubagentTranslate,
  parts: SubagentDurationParts,
): string {
  switch (parts.unit) {
    case "subSecond":
      return t("duration.subSecond");
    case "seconds":
      return t("duration.seconds", { seconds: parts.seconds });
    case "minutes":
      return t("duration.minutes", {
        minutes: parts.minutes,
        seconds: parts.seconds,
      });
    case "hours":
      return t("duration.hours", {
        hours: parts.hours,
        minutes: parts.minutes,
      });
    case "days":
      return t("duration.days", { days: parts.days, hours: parts.hours });
  }
}

/**
 * Whether the row owns a local Session the browser can open.
 * @param entry - catalog row to classify.
 * @returns false exactly for external executions.
 */
export function isAddressable(
  entry: Pick<SubagentCatalogEntryLike, "mode">,
): entry is { readonly mode: AddressableMode } {
  return entry.mode !== "external";
}

/** Durable parent/child address of one addressable catalog row. */
export type SubagentAddressLike<Id extends string = string> =
  | {
    readonly parentSessionId: Id;
    readonly childSessionId: Id;
    readonly mode: "one-shot";
  }
  | {
    readonly parentSessionId: Id;
    readonly childSessionId: Id;
    readonly mode: "continuable";
  }
  | {
    readonly parentSessionId: Id;
    readonly childSessionId: Id;
    readonly mode: "unknown";
  };

/**
 * Build the navigation address of one addressable row.
 * @param parentSessionId - Session the catalog belongs to.
 * @param childSessionId - row's child Session.
 * @param mode - addressable creation mode.
 * @returns the address `uiWorkspace.openSession` takes.
 */
export function subagentAddress<Id extends string>(
  parentSessionId: Id,
  childSessionId: Id,
  mode: AddressableMode,
): SubagentAddressLike<Id> {
  switch (mode) {
    case "one-shot":
      return { parentSessionId, childSessionId, mode };
    case "continuable":
      return { parentSessionId, childSessionId, mode };
    case "unknown":
      return { parentSessionId, childSessionId, mode: "unknown" };
  }
}
