// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// The tab chip's title, enriched with a running indicator. The host falls
// back to the registry's captured title text when no title component is
// registered; registering here is what lets the chip show a live aggregate of
// the Session's subagent state.
import type {
  PropsLocale,
  PropsRuntime,
} from "@deepseek-ai/dsh-client-ui-slots";
import type {
  SessionListState,
  SessionProjectionSnapshot,
} from "@deepseek-ai/dsh-api-session-controller/client";
import type { SessionStatus } from "@deepseek-ai/dsh-client-ui-session/client";
// Type-only: declares the `sidebar.right.pane.tab.title` seat.
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
// Type-only: loads the `subagentCatalog` projection vocabulary.
import type {} from "@deepseek-ai/dsh-subagent/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import type { ReactNode } from "react";
import { NS } from "../locales.js";
import {
  hasRunningSubagent,
  subagentCatalogView,
} from "../subagent-catalog.js";

/** Everything the chip title receives: framework shares plus the plugin copy. */
export type SubagentsTabTitleProps =
  & PropsRuntime<"sidebar.right.pane.tab.title">
  & PropsLocale<typeof NS>;

/**
 * Selector hook over one snapshot source, the shape the standard Session kit
 * injects. Declared here for the same reason the tab body declares it: the
 * published ui-session declarations import their hook vocabulary from packages
 * a standalone checkout installs at the top level, where that package's own
 * directory cannot resolve them.
 */
type SnapshotSelectorHook<Snapshot> = <Selected>(
  selector: (snapshot: Snapshot) => Selected,
  equal?: (left: Selected, right: Selected) => boolean,
) => Selected;

/**
 * Render the tab label with a running dot while any child is running.
 * @param props - Session status hooks and the plugin translator.
 * @returns the running indicator followed by the tab's label.
 */
export function SubagentsTabTitle(props: SubagentsTabTitleProps): ReactNode {
  const { t, sessionId } = props;
  const useSessions: SnapshotSelectorHook<SessionListState> = props.useSessions;
  const useSessionStatus: SnapshotSelectorHook<
    ReadonlyMap<SessionId, SessionStatus>
  > = props.useSessionStatus;
  const snapshot: SessionProjectionSnapshot | undefined = useSessions(
    (state) => state.projectionsBySession[sessionId],
  );
  const summaries = useSessions((state) => state.byId);
  const statuses = useSessionStatus((state) => state);
  const view = subagentCatalogView<SessionId>(snapshot);
  const running = view.kind === "ready" &&
    hasRunningSubagent(view.entries, statuses, summaries);

  return (
    <>
      {running
        ? (
          <span
            className="dssb-tab-dot"
            role="img"
            aria-label={t("state.running")}
          />
        )
        : null}
      {t("tab.title")}
    </>
  );
}
