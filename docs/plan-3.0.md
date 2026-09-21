grid-editor 3.0 implementation plan
===================================

Companion to `docs/spec-3.0.md`. The spec says what 3.0 is; this says how it
gets built, in what order, and how each step proves itself.

One release, 3.0.0, cut at the end of phase 5. The five phases are internal
milestones: each merges to `master`, each leaves the plugin working and the
suite green, and each is revertable on its own.


Ground rules
------------

- **`dist` is committed, and the tests run against it.** Every PR ends with
  `npm run build` and commits `dist`. A conflict in `dist` is never resolved by
  hand: take either side, rebuild, commit.
- **Tests ship in the same PR as the code.** The harness in `test/` (real
  Chrome over the DevTools protocol, no npm dependencies) is the acceptance
  mechanism, and every phase adds its own suite file.
- **No English-only strings after phase 1.** Any PR that adds user-visible text
  adds the `t()` key, the English entry, the Spanish entry, and a row in
  `docs/locale-keys.md`. `test/locales.js` fails the build when source and
  catalogue disagree, or when a shipped locale is missing a key — so the
  Spanish file cannot drift behind by a phase.
- **No silent operations.** Any PR that adds an operation (add, delete, move,
  resize) fires its `before-*`/`after-*` pair per spec section 2.
- **Round-tripping is a hard requirement, phase by phase.** For every feature:
  `getHtml` output has no editor artifacts, and feeding it back into
  `gridEditor()` reproduces the same editing state.
- `eslint src` stays clean, per CONTRIBUTING.


Phase 0: make the ground firm (half a day)
------------------------------------------

Small, unglamorous, pays for itself immediately.

| # | Task | Files |
| --- | --- | --- |
| 0.1 | Turn `npm test` into a runner: `test/run.js` shares one Chrome and one server across suites, runs `test/*.js` in order, prints one summary, exits non-zero on any failure. `npm test -- resize` filters to one suite. | `test/run.js`, `package.json` |
| 0.2 | Vendor the non-editor test dependencies (jQuery, jQuery UI, Bootstrap CSS/JS, bootstrap-icons) under `test/vendor/`, and point the *new* test pages at them. The rich text suites keep loading editors from their CDNs and skip with a reason when offline. This is what makes CI possible at all. | `test/vendor/`, `test/fixtures/` |
| 0.3 | Fix the lint setup: `.eslintrc` names `babel-eslint` and pre-flat-config rule names, so `eslint src` does not run on a current eslint. Either pin a working version in devDependencies or port to a flat config. Decide, then make `npm run lint` exist. | `.eslintrc`, `package.json` |

Acceptance: `npm test` runs every suite in one Chrome; `npm run lint` passes;
the new fixtures work with the network switched off.


Phase 1: seams and plumbing (5–7 days)
--------------------------------------

The load-bearing phase. Everything later assumes the dispatch table, the event
bus and `t()` exist. No user-visible feature ships here, which is the point:
it is all seam, and it can be reviewed as such.

### 1.1 Method dispatch and instance handle

- Replace the chain of `if (arguments[0] == 'x')` comparisons with a dispatch
  table; unknown method names log once and return `this`.
- Add `init`, `deinit`, `reset`, `destroy`, `changeView`, `getView`,
  `createRow`, `createColumn`, `createElement`. (`createContainer`, `addTab`,
  `addAccordionItem` are registered as unimplemented in phase 1 and filled in
  phase 4.)
- A method called on an element with no instance is a no-op returning `this`,
  except `getHtml`, which returns the element's html as it does today.
- `remove` becomes a deprecated alias of `destroy` and warns once per instance.
- `element.data('grideditor')` becomes documented API: the methods plus
  `settings` (frozen copy) and `canvas`.
- `create*` accepts `appendTo`/`prependTo`/`insertAfter`/`insertBefore`, and
  when given one, places the node, fires the add events and runs `reset()`.

### 1.2 Event bus

- One `emit(name, payload)` internal: fires the specific event then the generic
  one on the canvas, then calls the matching `settings.callbacks` entry;
  `preventDefault()` on either event, or `false` from the callback, cancels.
- Payload built from one place so `kind`, `node`, `parent`, `canvas`,
  `breakpoint` and `source` are never assembled ad hoc.
- Re-entrancy guard: `reset()`, `init()` and `create*` called from inside a
  handler queue and run after the current operation finishes, so a handler
  cannot reset the canvas out from under the operation that called it.
- Wire the existing operations: toolbar add-row, row/column add tools, the two
  delete tools, and both sortables (`before-move` on `start`, `sortable('cancel')`
  on `stop` when canceled, `after-move` only on a real position change).
- `confirm_delete` (default `true`) replaces the hardcoded
  `window.confirm('Delete row?')`, using a localized string.

### 1.3 Locale plumbing

- `$.fn.gridEditor.locales`, `locales.en` inside the core file, `t(key, params)`
  with `{name}` interpolation, lookup order `locale_strings` → locale → `en` →
  the key itself, one console warning per missing key.
- Extract **every** hardcoded string: row and column tool titles, the delete
  confirms, the layout dropdown labels, the add-row button titles, the settings
  panel placeholders, the "editor not available" console errors.
- `setLocale(code)` re-renders the controls.
- **The Spanish locale, `src/js/locales/grideditor.es.js`** (spec 7.5). Not a
  demo file: it ships, and the coverage assertion holds it to every key in
  `locales.en`. Concretely:
  1. Freeze the English key set first — the locale file is written against
     `locales.en`, so extraction (above) has to be finished, not in progress.
  2. Seed the translations from the wording that already exists in production
     downstream; it covers the tool titles, the confirms and the layout labels,
     which is most of the catalogue.
  3. Translate what is left: the container, element, offset and resize strings
     do not exist downstream because those features do not.
  4. Check the strings *in place*, not in the file: a tooltip and a dropdown
     item have room for about the same text in Spanish as in English, and the
     add-row titles interpolate a layout (`Añadir fila {layout}`). Run the
     example page at `locale: 'es'` and look at it.
  5. Have a native speaker review before it ships (phase 5 re-reviews whatever
     phases 2 to 4 add).
- `example/locale.html`: an example page with a language dropdown calling
  `setLocale`, which doubles as the manual check for step 4 and as the demo for
  hosts.
- Grunt: a target that copies and minifies `src/js/locales/*.js` into
  `dist/locales/` individually, plus a watch entry. The existing
  `src/js/*.js` glob does not descend, so the main bundle stays clean —
  verify that in the build, don't assume it.
- `docs/locale-keys.md`, hand-written, plus the check in `test/locales.js` that
  greps `t()` calls out of `src` and diffs the key sets both ways.

### 1.4 Tests

`test/api.js`, `test/events.js`, `test/locales.js`, per spec section 10. The
existing `test/rte.js` must keep passing untouched — it is the regression net
for the content-area behaviour this phase moves around.

**Acceptance:** every method in spec 1.2 behaves as documented including the
no-instance guards; every existing operation emits its events with the
documented payload and ordering; canceling each `before-*` leaves the DOM
untouched; the UI has no string that is not a locale key; `locales.es`
translates every key in `locales.en` and the example page renders the whole UI
in Spanish without clipped or untranslated controls; `test/rte.js` still
green.

**Risks.** The re-entrancy queue is the subtle part — write its tests first.
The `+`/`-` width tools keep using today's size helpers until phase 2 replaces
them, so phase 1 must not leave two half-written sizing paths behind: touch
them only where the event plumbing requires it.


Phase 2: sizing — breakpoints, offsets and drag resize (7–10 days)
------------------------------------------------------------------

Every way a column gets its width, in one phase: the core that writes the
classes, the six tiers, the offsets, and the drag handle. Moved here from
phase 1 after review (spec section 13, decision 6) — resize, offsets and
breakpoints all write the same classes against the same 12-unit budget, so
splitting them across two phases meant writing the sizing core twice.

Also the riskiest CSS work, which is a second reason to have it alone in a
phase.

### 2.1 Sizing core

One place that owns size and offset classes, because resize (2.6), the `+`/`-`
tools, the offset tools (2.5) and `createColumn` all write them.

- `getSize(col, tier)`, `setSize(col, tier, n)`, `getOffset(col, tier)`,
  `setOffset(col, tier, n)`, `spare(row, tier)`, and one
  `clamp({ size, offset })` enforcing the 12-unit budget.
- Getters return `null` for a tier they were not asked about — no "return the
  first thing I found" fallback. That fallback is exactly what hides the offset
  bug described in spec 5.1.
- Tier-list driven, so 2.2 changes data and not logic.
- `stripPixelWidths(scope)` used by `getHtml` and after every resize.
- Land this first in the phase: 2.2 to 2.6 are all callers of it.

### 2.2 to 2.9

- **2.2** Replace `colClasses` with a breakpoint table (`key`, `colPrefix`,
  `offsetPrefix`, `min`, `preview`) covering `xs sm md lg xl xxl`, and derive
  everything from it.
- **2.3** `changeView('md')` and `getView()`; the dropdown built from
  `layout_modes`; `default_view` (`'all'`); numeric indexes accepted with a
  deprecation warning (0→`lg`, 1→`sm`, 2→`xs`).
- **2.4** `all` mode: tools, `createColumn` and resize write every tier at once.
- **2.5** Offset tools (increase/decrease indent, shift for the extreme) on the
  sizing core's clamp, and `valid_col_offsets`.
- **2.6** Drag resize: jQuery UI `resizable` on `.column`, east handle by
  default, `resize.handles` and `resizable_options` honoured. Live readout in
  the drawer showing the class it would land on; snap on stop via
  `round(width / rowWidth * 12)`, clamped through the sizing core.
  `resize.balance: 'next'` moves the delta into the following sibling, `false`
  leaves the row to wrap. `before-resize` cancelable (jQuery UI honours `false`
  from its start handler, so the drag never begins), `after-resize` suppressed
  for a no-op. Gesture separation: resize on the column edge, sort from the
  drawer.
- **2.7** LESS rewrite: `layoutMode()` and `disable-columns()` become
  list-driven instead of taking exactly four tier arguments, six preview
  widths, offsets visualized per mode, and the resize handle shown only under
  `.ge-editing`.
- **2.8** Make `addAllColClasses()` conservative: seed missing tiers only when
  the column has no explicit sizing at all, so output stays readable with six
  tiers instead of three.
- **2.9** `test/breakpoints.js`, `test/offsets.js` and `test/resize.js`, each
  parameterized over all six tiers plus `all`.

**Acceptance:** switching to each tier constrains the canvas and makes that
tier's classes effective; a size change in a per-tier view touches one prefix
and in `all` mode touches six; size plus offset never exceeds 12 and the tools
refuse rather than silently rewriting; a drag resizes to whole units, honours
the budget and leaves no pixel width or jQuery UI artifact in `getHtml`;
2.x numeric `changeView` still works.

**Risks.** There is no visual baseline, so CSS regressions hide easily.
Mitigate with computed-geometry assertions in the suite (column pixel widths at
a fixed canvas width per mode), not screenshots. The resizable/sortable gesture
split needs manual checking in a headful run (`HEADFUL=1`) as well as in the
suite. This phase is now the long one: if it has to be split for review, the
seam is 2.1 to 2.5 in one PR series and 2.6 to 2.7 in another, never the other
way round.


Phase 3: element level controls (3–4 days)
------------------------------------------

- **3.1** Detection: `elements.selector` (`[data-ge-element]`),
  `elements.enabled`, `elements.auto` (default `false`, treats content-area
  children as elements).
- **3.2** Drawer per element: move, delete, an info tool built from
  `data-ge-element`/`data-ge-label`, plus `element_tools`.
- **3.3** Sortable within and between content areas, drawer as handle.
- **3.4** Elements inside an active rich text editor get
  `contenteditable="false"` so the editor treats them as atomic; verified
  against real tinyMCE, not assumed.
- **3.5** `createElement(content, options)`, and the 4.4 pattern (host
  placeholder for an element with no visual output) documented with a working
  example page.
- **3.6** `test/elements.js`, and `test/rte.js` extended with a content area
  that holds both text and an element.

**Acceptance:** explicit marking required by default; `elements.auto` picks up
children; elements move between content areas and emit `kind: 'element'`; an
element inside a tinyMCE content area is not editable as text and survives
`getHtml` unchanged.

**Risks.** The rich text editors rewrite the DOM inside content areas. This is
where the tinyMCE integration's attribute-restoring behaviour (see the
`ge-rte-active` fix in 2.0.x) will bite again if elements rely on classes the
editor snapshots — keep element state in `data-ge-*` attributes, not classes.


Phase 4: containers (7–10 days)
-------------------------------

Built on one shared core, then three types in increasing order of risk.

- **4.1 Container core.** A type registry (`tabs`, `accordion`, `popup`), the
  container drawer, id generation (`ge-<type>-<counter>-<random>`, written into
  the markup so it survives `getHtml`), pane regions initialized as ordinary
  canvas regions, nesting, and per-type `getHtml` cleanup hooks.
  `createContainer` and the `container_tools` setting land here.
- **4.2 Tabs.** Bootstrap 5 tab markup, `addTab`, sortable tab strip with panes
  kept in strip order, inline label editing that does not trigger the Bootstrap
  toggle, `tab_tools`.
- **4.3 Accordion.** `addAccordionItem`, `stay_open`, all items forced open
  while editing with authored state in `data-ge-open`, items draggable **between**
  accordions with `data-bs-parent` rewritten on drop, `accordion_tools`.
- **4.4 Popup.** Modal markup plus in-container trigger; unfolded static
  rendering under `.ge-editing` with no `bootstrap.Modal` instantiated; the
  drawer's collapse/expand toggle; external `data-ge-popup-target` triggers
  owned by the host, with Bootstrap's attributes written at `getHtml` time;
  orphan repair and `grideditor:popup-orphan`; `trigger: false`.
- **4.5** One example page per type, plus one nested case (tabs inside an
  accordion body).
- **4.6** `test/containers.js`: create each type, nest a row and an element,
  reorder panes, move an accordion item between accordions, then round-trip.
  Plus the popup cases: external trigger opens the modal in the authored
  output, orphan re-pointed when unambiguous and marked when not.

**Acceptance:** each container type creates, edits, nests, reorders and
round-trips with no `ge-*` or `data-ge-*` leakage beyond the documented output
contract; Bootstrap's own JS drives the authored page and is never needed
during editing.

**Risks.** Bootstrap's tab/collapse/modal JS fighting the editor is the main
one — the mitigation throughout is that grid-editor never instantiates those
components while editing, and only writes their attributes into the output.
Second risk is `getHtml` fidelity with nesting: test two levels deep from the
first PR, not at the end.


Phase 5: docs and release (2–3 days)
------------------------------------

- README: the methods table, the new settings, a short events section linking
  to the reference, and the locale table (shipped locales, how to load one, how
  to contribute one).
- Native-speaker review of the Spanish strings added by phases 2 to 4
  (containers, elements, offsets, resize), in the running UI rather than in the
  file.
- `docs/events.md`: the event catalogue with payloads and cancelation
  semantics, extracted from spec section 2 so hosts read docs and not a spec.
- `docs/locale-keys.md` finalized; `UPGRADING.md` with a 2.x → 3.0 section
  (`remove` → `destroy`, layout mode indexes, six column classes, output
  changes); `CHANGELOG.md` under a `[3.0.0]` heading following the existing
  Keep-a-Changelog format.
- Version bump to 3.0.0 in `package.json` and `bower.json`; `npm run build`;
  full suite green; every example page opened once in a headful Chrome.
- Tag and publish.


Sequencing
----------

```
phase 0 ──► phase 1 ──► phase 2 ──► phase 5
                   └──► phase 3 ──┤
                   └──► phase 4 ──┘
```

- Phase 1 blocks everything: dispatch, events and `t()` are dependencies of
  every later phase.
- Phase 2 must not run concurrently with phase 1 — same functions — and it now
  owns all of the sizing work, so nothing else should touch size or offset
  classes while it is open.
- Phases 3 and 4 touch different code and can run in parallel with each other
  and with phase 2 if there is more than one pair of hands; both rebase onto
  phase 2's breakpoint table when it lands.
- Inside phase 4, keep the order: tabs teach the container core, accordion adds
  cross-container movement, popup is the one with real Bootstrap conflicts.

Rough effort, ideal engineer-days, ±50%: 0.5 + 5–7 + 7–10 + 3–4 + 7–10 + 2–3 ≈
**25–35 days**. Phases 2 and 4 are the two that move.


Risk register
-------------

| Risk | Where | Mitigation |
| --- | --- | --- |
| CSS regressions with six tiers | 2.5 | computed-geometry assertions per layout mode, not screenshots |
| Bootstrap JS vs editing mode | 4.3, 4.4 | never instantiate Bootstrap components while editing; write attributes at output time only |
| RTE rewriting element state | 3.4 | element state in `data-ge-*`, never in classes the editor snapshots |
| jQuery UI resize/sort gesture clash | 2.6 | separate handles (edge vs drawer), headful manual check each phase |
| Event handlers re-entering the editor | 1.2 | operation queue, tested first |
| `dist` merge conflicts | all | rebuild, never hand-merge |
| Suite needs the network | 0.2 | vendored deps for new fixtures; RTE suites skip offline with a reason |
| Scope creep from host requests | all | spec section 13 is the decision record; new asks get a decision entry or a later release |


Definition of done for 3.0.0
----------------------------

- [ ] Every spec section 1–8 feature implemented, with its suite in `test/`.
- [ ] `npm test` green, including `test/rte.js` and the locale catalogue check.
- [ ] `npm run lint` green.
- [ ] Round-trip verified for containers, elements, offsets and resize.
- [ ] No user-visible English string outside `locales.en`.
- [ ] `locales.es` complete against `locales.en`, asserted by `test/locales.js`,
      and reviewed by a native speaker in the running UI.
- [ ] Example page per container type, one per breakpoint story, one elements
      page, one locale-switch page, all opened in a headful Chrome before
      release.
- [ ] README, `docs/events.md`, `docs/locale-keys.md`, `UPGRADING.md`,
      `CHANGELOG.md` updated.
- [ ] `dist` rebuilt and committed; version 3.0.0 in `package.json` and
      `bower.json`.


Not in this plan
----------------

Per spec section 13: no interim 2.1.0, no downstream fork port (that is
separate work in its own repository), no hidden-element feature, no undo/redo,
no non-jQuery build.


First PR
--------

Phase 0 whole, plus 1.1. It is small, it is mechanical, it makes every
following PR easier to review, and it forces the test runner question to be
answered before there are six suites to retrofit.
