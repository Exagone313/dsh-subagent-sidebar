// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// The tab's stylesheet, injected once for the plugin's lifetime. The pane
// prescribes no padding, so the root brings the sidebar's own insets and scroll
// container, and every colour comes from a `--dsw-alias-*` token so light and
// dark themes both apply. Class names are prefixed to stay clear of the host.
import type { Context as ClientContext } from "@deepseek-ai/cordis";

/** Every class this plugin renders; the single source for CSS and TSX. */
export const SUBAGENT_SIDEBAR_CLASS = "dssb-root";

/** The stylesheet text appended to the document head while the plugin is loaded. */
export const SUBAGENT_SIDEBAR_STYLES = `
.dssb-root {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
}

.dssb-notice {
  margin: 0;
  padding: 20px 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.dssb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 28px 16px;
  text-align: center;
}

.dssb-empty-title {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.dssb-empty-description {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

/* Equal-width grid tracks: auto-fill keeps the tracks of a short last row at
   full width instead of letting the row's single card stretch across the
   pane, and stretch makes every card fill its row and column. The track
   minimum is capped at the pane width so a narrow sidebar still fits. */
.dssb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  align-items: stretch;
  gap: 14px;
}

.dssb-card {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: min(260px, 100%);
  /* The card's floor is its usual content: a title line, a one-line
     description and the meta line, plus a few pixels of slack. The grid's
     stretch makes every card in a row as tall as the tallest one, so a
     two-line description grows its row instead of every card reserving room
     for it, and spare height stays below the meta rather than mid-card. */
  min-height: 112px;
  max-width: 100%;
  margin: 0;
  padding: 16px 18px;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.dssb-card:hover {
  border-color: var(--dsw-alias-border-l4);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dssb-card:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}

/* External executions own no local Session: the card stays readable but
   non-clickable, and its dashed outline says so. */
.dssb-card-static {
  color: var(--dsw-alias-label-secondary);
  border-style: dashed;
  cursor: default;
}

.dssb-card-static:hover {
  border-color: var(--dsw-alias-border-l3);
  background: var(--dsw-alias-bg-layer-1);
}

.dssb-card-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  min-width: 0;
}

/* The title takes the card's width and wraps to at most two lines, so a long
   creation label is readable instead of being clipped to one short line. */
.dssb-card-label {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.35;
  overflow-wrap: break-word;
  hyphens: none;
  -webkit-hyphens: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* No line clamp and no ellipsis: the description wraps across the card's full
   width and breaks only when a word genuinely does not fit. The source text is
   bounded already (the harness caps a prompt preview at 50 characters), and
   the grid row takes its height from the tallest card, so the card grows
   instead of hiding text behind a truncation it did not need. */
.dssb-card-description {
  display: block;
  margin-top: 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: break-word;
  hyphens: none;
  -webkit-hyphens: none;
}

/* One muted line carries every metadata fact, including the age. It follows
   the description directly — no auto margin — so a card's spare height (its
   minimum, or a taller neighbour in the same row) ends up below the meta
   rather than as a hole in the middle. */
.dssb-meta {
  display: block;
  padding-top: 10px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dssb-load-more {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 9px 12px;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  border: 0.5px dashed var(--dsw-alias-border-l3);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.dssb-load-more:hover {
  border-color: var(--dsw-alias-border-l4);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dssb-load-more:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}

/* State dots use the same aliases as dsh's own state indicators: business blue
   while the child works, success green once its latest turn completed, and the
   neutral idle step for both a child that never ran and one whose last turn
   failed. dsh's own catalog treats a stopped child as inactive, so failure
   stays neutral here too rather than repainting the card red. */
.dssb-dot {
  flex: none;
  width: 9px;
  height: 9px;
  /* Centre the dot on the title's first line rather than its top edge. */
  margin-top: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}

.dssb-dot[data-state="running"] {
  background: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
  animation: dssb-pulse 1.8s ease-in-out infinite;
}

.dssb-dot[data-state="completed"] {
  background: var(--dsw-alias-state-success-primary);
}

.dssb-dot[data-state="failed"] {
  background: var(--dsw-alias-state-idle-primary);
}

@keyframes dssb-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dssb-dot[data-state="running"] {
    animation: none;
  }
}
`;

/**
 * Inject the tab stylesheet for the owning plugin lifetime.
 * @param ctx - client root whose effect owns the style tag.
 */
export function installSubagentSidebarStyles(ctx: ClientContext): void {
  if (typeof document === "undefined") return;
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "@exagone313/dsh-subagent-sidebar";
    tag.textContent = SUBAGENT_SIDEBAR_STYLES;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, "subagent-sidebar: styles");
}
