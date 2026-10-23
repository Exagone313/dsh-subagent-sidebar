// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// The Subagents tab body. It lives in its own Session through the slot's
// session scope: the catalog comes from that Session's projection snapshot, and
// the tab asks for a fresh cut when it opens. Cards are ordered newest first so
// a newly spawned subagent appears at the top.
import type {
  InjectFace,
  PropsLocale,
  PropsRuntime,
} from "@deepseek-ai/dsh-client-ui-slots";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  SessionListState,
  SessionProjectionSnapshot,
} from "@deepseek-ai/dsh-api-session-controller/client";
import type { SessionStatus } from "@deepseek-ai/dsh-client-ui-session/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
// Type-only: loads the subagent projection vocabulary (`subagentCatalog` and
// `subagentTiming`) that a Session summary's projection values carry.
import type {} from "@deepseek-ai/dsh-subagent/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import {
  type AddressableMode,
  estimateSubagentPageSize,
  isAddressable,
  nextSubagentPageCount,
  sortSubagentEntries,
  SUBAGENT_PAGE_SIZE,
  subagentCatalogView,
  subagentDescription,
  subagentLabel,
  subagentMetaLabel,
  subagentPage,
  type SubagentPageFit,
  type SubagentState,
  subagentState,
} from "../subagent-catalog.js";
import { NS, type SubagentSidebarKey } from "../locales.js";

/** Business face the registrant adds to the tab body's props. */
export interface SubagentsTabInjected {
  /** Ask the Session Controller for a fresh projection cut of this Session. */
  readonly refreshProjections: () => void;
  /** Select a local child Session as the main view. */
  readonly openSubagent: (
    childSessionId: SessionId,
    mode: AddressableMode,
  ) => void;
}

/** Everything the tab body receives: framework shares plus the injected face. */
export type SubagentsTabProps =
  & PropsRuntime<"sidebar.right.pane.tab">
  & PropsLocale<typeof NS>
  & InjectFace<SubagentsTabInjected>;

/** Copy key of each visual state. */
const STATE_KEYS: Record<SubagentState, SubagentSidebarKey> = {
  running: "state.running",
  idle: "state.idle",
  completed: "state.completed",
  failed: "state.failed",
};

/** How often a running card's duration and relative age advance. */
const RUNNING_TICK_MS = 1_000;

/**
 * Selector hook over one snapshot source, the shape the standard Session kit
 * injects. Declared here because the published ui-session declarations import
 * their hook vocabulary from packages a standalone checkout installs at the
 * top level, where that package's own directory cannot resolve them.
 */
type SnapshotSelectorHook<Snapshot> = <Selected>(
  selector: (snapshot: Snapshot) => Selected,
  equal?: (left: Selected, right: Selected) => boolean,
) => Selected;

/**
 * Advance the clock once a second while a running card is on screen.
 *
 * The duration and relative age read this clock, so an open turn's elapsed
 * time moves every second instead of waiting for a projection push. A hidden
 * tab installs no interval at all, and a visible tab with no running card only
 * re-reads the clock when it becomes visible or running changes, so an idle
 * tab does not re-render on a tick.
 * @param visible - whether the tab is on screen.
 * @param running - whether at least one shown card is running.
 * @returns the current epoch milliseconds, repainted on each tick while running.
 */
function useNow(visible: boolean, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, RUNNING_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [visible, running]);
  return now;
}

/**
 * Read the layout facts the adaptive page-size estimate needs.
 *
 * The card height is the tallest card currently laid out, so one row with a
 * long description cannot make the estimate optimistic. The browser resolves
 * the computed grid columns to used track sizes; a hidden layout leaves no
 * parsed track, which makes the estimate fall back instead of guessing columns.
 * @param pane - the tab's scroll container, when it is rendered.
 * @param grid - the card grid, when at least one card is rendered.
 * @returns the measured fit, or `undefined` when either element is absent.
 */
function measurePageFit(
  pane: HTMLDivElement | null,
  grid: HTMLDivElement | null,
): SubagentPageFit | undefined {
  if (pane === null || grid === null) return undefined;
  const cards = Array.from(grid.children);
  if (cards.length === 0) return undefined;
  const styles = getComputedStyle(grid);
  const rowGap = Number.parseFloat(styles.rowGap);
  const columns = styles.gridTemplateColumns
    .split(/\s+/u)
    .filter((track) => /^\d+(?:\.\d+)?px$/u.test(track))
    .length;
  return {
    paneHeight: pane.clientHeight,
    cardHeight: Math.max(
      ...cards.map((card) => card.getBoundingClientRect().height),
    ),
    rowGap: Number.isFinite(rowGap) ? rowGap : 0,
    columns,
  };
}

/**
 * Measure the pane and estimate how many cards it fits without hiding Load
 * more.
 * @param pane - the tab's scroll container, when it is rendered.
 * @param grid - the card grid, when at least one card is rendered.
 * @returns the page size, or the fixed fallback when layout is unavailable.
 */
function measurePageSize(
  pane: HTMLDivElement | null,
  grid: HTMLDivElement | null,
): number {
  return estimateSubagentPageSize(measurePageFit(pane, grid));
}

/** One card's presentation, resolved before it renders. */
interface SubagentCardProps {
  readonly label: string;
  /** Description under the label, wrapped to the card's full width; absent
   * when none exists. */
  readonly description?: string | undefined;
  /** The single muted metadata line: external marker, stats and age. */
  readonly meta: string;
  readonly stateLabel: string;
  readonly state: SubagentState;
  /** Opens the child Session; absent for external executions. */
  readonly onOpen?: (() => void) | undefined;
}

/**
 * Draw one card: name, optional description, one muted metadata line and the
 * state dot. Cards carry no tooltip: their visible text is the affordance.
 * @param props - resolved presentation and the optional open action.
 * @returns a button for addressable rows and a static card otherwise.
 */
function SubagentCard(props: SubagentCardProps): ReactNode {
  const content = (
    <>
      <span className="dssb-card-head">
        <span
          className="dssb-dot"
          data-state={props.state}
          role="img"
          aria-label={props.stateLabel}
        />
        <span className="dssb-card-label">{props.label}</span>
      </span>
      {props.description === undefined
        ? null
        : <span className="dssb-card-description">{props.description}</span>}
      <span className="dssb-meta">{props.meta}</span>
    </>
  );
  if (props.onOpen === undefined) {
    // External executions own no local Session, so their card is a plain
    // static surface rather than a button that would do nothing.
    return (
      <div
        className="dssb-card dssb-card-static"
        data-state={props.state}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="dssb-card"
      data-state={props.state}
      onClick={props.onOpen}
    >
      {content}
    </button>
  );
}

/**
 * Render the Subagents page.
 * @param props - Session scope, translator, catalog hooks, and the injected
 * refresh and navigation actions.
 * @returns the tab body.
 */
export function SubagentsTab(props: SubagentsTabProps): ReactNode {
  const { sessionId, t, refreshProjections } = props;
  const { tab } = props.useTabInfo();
  const visible = tab.visible;
  const useSessions: SnapshotSelectorHook<SessionListState> = props.useSessions;
  const useSessionStatus: SnapshotSelectorHook<
    ReadonlyMap<SessionId, SessionStatus>
  > = props.useSessionStatus;
  const snapshot: SessionProjectionSnapshot | undefined = useSessions((
    state,
  ) => state.projectionsBySession[sessionId]);
  const summaries = useSessions((state) => state.byId);
  const statuses = useSessionStatus((state) => state);
  // The grid starts with the newest page; "Load more" widens the window. The
  // counter resets with the Session and whenever the page is reopened.
  const [visibleCount, setVisibleCount] = useState(SUBAGENT_PAGE_SIZE);
  const paneRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const view = subagentCatalogView<SessionId>(snapshot);
  const entries = view.kind === "ready"
    ? sortSubagentEntries(view.entries)
    : [];
  const hasCards = entries.length > 0;

  // The first page is measured from the pane rather than assumed, once cards
  // exist to give a real row height; a hidden page or a missing layout falls
  // back to the fixed size. `hasCards` re-runs the measurement when a loading
  // cut turns into cards, but not on Load more or on a newly spawned child.
  useLayoutEffect(() => {
    if (!visible) {
      setVisibleCount(SUBAGENT_PAGE_SIZE);
      return;
    }
    setVisibleCount(measurePageSize(paneRef.current, gridRef.current));
  }, [sessionId, visible, hasCards]);

  // `keepMounted` keeps a visited page alive through hiding, so mounting alone
  // is not every open. Refresh whenever the page becomes visible (the open that
  // mounts it, a reveal from another tab, and a return to this Session).
  useEffect(() => {
    if (visible) refreshProjections();
  }, [sessionId, visible]);

  const page = subagentPage(entries, visibleCount);
  // Only the cards on screen matter: a running child behind "Load more" must
  // not keep the ticker alive. The status map is live, with the summary's
  // running flag as the fallback until a status frame arrives.
  const shownRunning = page.entries.some((item) =>
    (statuses.get(item.id)?.running ?? summaries[item.id]?.running) === true
  );
  const now = useNow(visible, shownRunning);

  if (view.kind === "loading") {
    return (
      <div className="dssb-root" data-subagent-sidebar="">
        <p className="dssb-notice">{t("loading")}</p>
      </div>
    );
  }
  if (view.kind === "migration-required") {
    return (
      <div className="dssb-root" data-subagent-sidebar="">
        <p className="dssb-notice">{t("migrationRequired")}</p>
      </div>
    );
  }
  if (view.kind === "error") {
    return (
      <div className="dssb-root" data-subagent-sidebar="">
        <p className="dssb-notice">{t("loadError")}</p>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="dssb-root" data-subagent-sidebar="">
        <div className="dssb-empty">
          <span className="dssb-empty-title">{t("empty.title")}</span>
          <span className="dssb-empty-description">
            {t("empty.description")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dssb-root" ref={paneRef} data-subagent-sidebar="">
      <div
        className="dssb-grid"
        ref={gridRef}
        role="group"
        aria-label={t("aria.list")}
      >
        {page.entries.map((item) => {
          const summary = summaries[item.id];
          // The status map is live; the summary's running flag is the fallback
          // until a status frame arrives for this child.
          const running = statuses.get(item.id)?.running ?? summary?.running;
          const state = subagentState({
            running,
            lastTurnCompleted: summary?.projectionValues?.subagentTiming
              ?.lastTurnCompleted,
          });
          const label = subagentLabel(item, summary);
          const addressable = isAddressable(item);
          return (
            <SubagentCard
              key={item.id}
              label={label}
              description={subagentDescription(item, summary)}
              meta={subagentMetaLabel(
                t,
                summary,
                running,
                now,
                item.createdAt,
                addressable ? undefined : t("mode.external"),
              )}
              stateLabel={t(STATE_KEYS[state])}
              state={state}
              onOpen={addressable
                ? () => {
                  props.openSubagent(item.id, item.mode);
                }
                : undefined}
            />
          );
        })}
      </div>
      {page.hasMore
        ? (
          <button
            type="button"
            className="dssb-load-more"
            onClick={() => {
              // Re-measure now: the pane may have been resized since the page
              // was first estimated, and Load more adds that whole page.
              setVisibleCount(
                nextSubagentPageCount(
                  visibleCount,
                  entries.length,
                  measurePageSize(paneRef.current, gridRef.current),
                ),
              );
            }}
          >
            {t("loadMore")}
          </button>
        )
        : null}
    </div>
  );
}
