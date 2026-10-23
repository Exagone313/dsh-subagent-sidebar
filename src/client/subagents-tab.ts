// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// The Subagents tab type's identity and its two static faces: the registry
// definition (stage one) and the guide entry the right sidebar's new-tab list
// offers. The body registers under SUBAGENTS_TAB_ID, the id the type is
// registered with, while `openTab` would name SUBAGENTS_TAB_KIND. Both live
// here so the two halves cannot drift.
import type { TranslateNS } from "@deepseek-ai/dsh-client-locale/client";
import type { SidebarRightTabDefinition } from "@deepseek-ai/dsh-client-ui-sidebar-right/client";
import { NS } from "../locales.js";

/** Implementation id the body registers under; unique across tab types. */
export const SUBAGENTS_TAB_ID = "@exagone313/dsh-subagent-sidebar#subagents";

/** Page kind this plugin owns; a page type recognizes no resource address. */
export const SUBAGENTS_TAB_KIND = "subagents";

/**
 * The Subagents tab type's registry definition.
 *
 * A page type: it recognizes no resource address because it always shows the
 * Session it lives in, and is opened from its guide entry. One page per pane,
 * kept mounted through hiding so a toggle back is instant.
 * @param t - namespace-bound translate, read fresh on every title call.
 * @returns the definition to register.
 */
export function subagentsTabDefinition(
  t: TranslateNS<typeof NS>,
): SidebarRightTabDefinition {
  return {
    id: SUBAGENTS_TAB_ID,
    kind: SUBAGENTS_TAB_KIND,
    multiple: false,
    keepMounted: true,
    title: () => t("tab.title"),
    // Without this entry the type would never appear in the new-tab list.
    guide: [
      {
        id: "subagents",
        order: 40,
        title: () => t("guide.title"),
        description: () => t("guide.description"),
      },
    ],
  };
}
