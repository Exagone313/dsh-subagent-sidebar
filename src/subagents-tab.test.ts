// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
// Environment-free client modules are imported here as data: the host program
// has no DOM, so the tab definition must not touch one.
import {
  SUBAGENTS_TAB_ID,
  SUBAGENTS_TAB_KIND,
  subagentsTabDefinition,
} from "./client/subagents-tab.js";

const t = ((key: string) => key) as unknown as Parameters<
  typeof subagentsTabDefinition
>[0];

test("the tab is a uniquely identified page type kept mounted", () => {
  const definition = subagentsTabDefinition(t);

  assert.equal(definition.id, "@exagone313/dsh-subagent-sidebar#subagents");
  assert.equal(definition.id, SUBAGENTS_TAB_ID);
  assert.equal(definition.kind, "subagents");
  assert.equal(definition.kind, SUBAGENTS_TAB_KIND);
  assert.equal(definition.multiple, false);
  assert.equal(definition.keepMounted, true);
  // A page type recognizes no resource address; it is opened through its guide.
  assert.equal(definition.patterns, undefined);
});

test("the guide entry is what puts the tab in the new-tab list", () => {
  const definition = subagentsTabDefinition(t);
  const guide = definition.guide ?? [];

  assert.equal(guide.length, 1);
  assert.equal(guide[0]?.id, "subagents");
  assert.equal(typeof guide[0]?.order, "number");
  // Both titles are thunks so a language switch needs no re-registration.
  assert.equal(typeof guide[0]?.title, "function");
  assert.equal(guide[0]?.title(), "guide.title");
  assert.equal(typeof guide[0]?.description, "function");
  assert.equal(guide[0]?.description?.(), "guide.description");
  assert.equal(definition.title(""), "tab.title");
});
