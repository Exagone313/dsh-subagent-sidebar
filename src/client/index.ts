// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// Browser half of the subagent sidebar bundle: one right-Sidebar page type that
// lists the current Session's subagents. Registration follows the public
// two-stage path only: the type into `ctx.sidebarRightTabs`, the body into the
// keyed `sidebar.right.pane.tab` seat under the definition's id.
import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-session-controller/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-session/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
import type { UiWorkspace } from "@deepseek-ai/dsh-client-ui-workspace/client";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import { en, NS, zh } from "../locales.js";
import { subagentAddress } from "../subagent-catalog.js";
import { SubagentsTab, type SubagentsTabInjected } from "./SubagentsTab.js";
import { SUBAGENTS_TAB_ID, subagentsTabDefinition } from "./subagents-tab.js";
import { installSubagentSidebarStyles } from "./styles.js";

/** Required services: the slot seat, copy, its own page type, catalog, and navigation. */
export const inject = [
  "slots",
  "locale",
  "sidebarRightTabs",
  "sessions",
  "uiWorkspace",
];

/**
 * Client plugin body.
 * @param ctx - client root carrying Slots, locale, the right Sidebar registry,
 * the Session catalog, and workspace navigation.
 */
export function apply(ctx: ClientContext): void {
  // Capture the services this plugin calls later; a thunk or event handler can
  // run after a reload, when reading `ctx` again would fail.
  const locale = ctx.locale;
  const sessions = ctx.sessions;
  const uiWorkspace: UiWorkspace = ctx.uiWorkspace;
  const t = locale.bind(NS);

  installSubagentSidebarStyles(ctx);
  ctx.effect(
    () => locale.register(NS, { en, zh }),
    "subagent-sidebar: dictionaries",
  );
  ctx.effect(
    () => ctx.sidebarRightTabs.register(subagentsTabDefinition(t)),
    "subagent-sidebar: tab type",
  );
  ctx.slots.inject(
    "sidebar.right.pane.tab",
    () =>
      ctx.slots.register(
        {
          name: "sidebar.right.pane.tab",
          key: SUBAGENTS_TAB_ID,
          locale: NS,
          inject: (sessionId: SessionId): SubagentsTabInjected => ({
            refreshProjections: () => {
              void sessions.refreshProjections(sessionId);
            },
            openSubagent: (childSessionId, mode) => {
              uiWorkspace.openSession(
                subagentAddress(sessionId, childSessionId, mode),
              );
            },
          }),
        },
        SubagentsTab,
      ),
  );
}
