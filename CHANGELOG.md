# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]
### Changed
- **The all view writes one class.** A size or an offset set in the all view
  is written as the class with no breakpoint (`col-4`, `offset-2`), and the
  breakpoints' own sizes or offsets are taken off, as the utilities have done
  since 4.1. Up to 4.x it wrote all six breakpoints. The resize and indent
  payloads carry `cleared`, with what was taken off.
- Resize payloads' `from` and `to` can be `'equal'` or `'auto'`, and `source`
  can be `panel`.

### Added
- Equal and auto column sizes: Bootstrap's `col` and `col-auto`, at every
  breakpoint. The editor recognises them, previews them in each view, offers
  them in the add column picker and in `new_row_layouts`, `createRow` and
  `createColumn`, and the width tools turn them into a number starting from
  the width the column has. A column with only `col` used to be no column at
  all, and a `col-auto` one was given a `col-12` that overrode it.
- A *Width* field in each column's Responsive section, with every size.
- Columns per row: a *Columns per row* field in each row's panel writes
  `row-cols-{bp}-{1–6,auto}`. Columns with no size of their own share the
  line out and are left without a `col-12`; the preview, the budget and the
  tools settle row-cols against each column's own size as Bootstrap's css
  does, and the row says in a corner how many it puts per line. Layouts,
  `createRow` and `createColumn` take rows with row-cols, and `row_cols: false`
  takes the field away.
- The `sections` plugin: Bootstrap's `.container`, `.container-fluid` and
  `.container-{bp}` as sections on the canvas, grouping rows. Each gets a
  drawer with a width field, the toolbar a *Section* button, and the API
  `createSection`. Rows drag in and out of sections, sections drag along the
  canvas, and a breakpoint view gives each the max-width its container has
  there.
- Feature plugins can add blocks, regions and toolbar buttons (`blocks`,
  `regions`, `accepts`, `toolbar`), and the handle gains `rowFromLayout`.
- The `textalign` utility plugin: `text-{bp}-start`, `-center` and `-end` on
  rows, columns, elements and containers. With no class applying in a view, the
  preview shows what the node inherits from its parent or the host's css.
- The `float` utility plugin: `float-{bp}-start`, `-end` and `-none` on
  elements, with the text of the content area flowing round them.
- `ge.bareStyle(node, family, property)` on the plugin handle: a property's
  value with the family's classes out of the way, for previews whose "no
  class" is not a constant.

## [4.1.0] - 2026-09-22
### Added
- Utility plugins, a third kind beside containers and features:
  `$.fn.gridEditor.utilities`. A plugin declares families of Bootstrap's
  responsive utility classes and the editor reads them through the cascade,
  writes them per breakpoint (the all view writes the class with no infix and
  clears the rest), shows them in a folded *Responsive* section of the settings
  panel, and previews them in each breakpoint view. See docs/plugins.md.
- `getUtility` and `setUtility` methods, and the `utilities` setting for the
  plugins' options.
- `before-utility`, `after-utility` and `view-change` events. `view-change` is
  new for every host, not only for utility plugins.
- The plugin handle gains `kindOf`, `view`, `viewTiers`, `breakpoints`,
  `getUtility` and `setUtility`, and a utility plugin may add tools beside any
  drawer's gear and mark the canvas in `onRefresh`.
- The `visibility` utility plugin: hide a row, column, element or container at
  some breakpoints with `d-{bp}-none` and show it at others. An eye in each
  drawer toggles the view being edited with as few classes as that takes. A
  hidden node stays on the canvas, faded, and in the all view a badge says at
  which breakpoints it is hidden.
- The `order` utility plugin: a column's place in its row per breakpoint,
  with `order-{bp}-*`. Two arrows in each column drawer move it one place
  earlier or later in the view being edited without moving the markup, and
  take the classes off again once the row is back in the markup's order. A
  column ordered by class says so in a corner of the canvas.
- The `alignment` utility plugin: `justify-content-{bp}-*` and
  `align-items-{bp}-*` on rows, `align-self-{bp}-*` on columns, as fields in
  the settings panel.
- The `gutters` utility plugin: `g-{bp}-*`, `gx-{bp}-*` and `gy-{bp}-*` on
  rows. A row with gutter classes is drawn with its real gutters instead of the
  editor's frame, the preview settles `g` against `gx`/`gy` the way Bootstrap's
  css does, and choosing `g` takes that breakpoint's `gx` and `gy` off.
  `utilities.gutters.scale` follows a page that changed `$spacers`.
- The `spacing` utility plugin: padding and margin on rows, columns, elements
  and containers, `{p,m}{,x,y,t,b,s,e}-{bp}-*`. The panel has a padding and a
  margin group, each a side and a value, and the preview settles the fourteen
  families the way Bootstrap's css does. `utilities.spacing.values` and
  `.scale` narrow the steps and follow a changed `$spacers`.
- A utility plugin can build its own panel (`panel`, `ge.utilityField`,
  families with `panel: false`) and preview a node as a whole (`preview`).
- `example/utilities.html`.

## [4.0.0] - 2026-09-22
### Added
- Editing from a touchscreen. Sorting, resizing a column and carrying a toolbar
  button onto the canvas all work with a finger; a touch rests for
  `drag.touch_delay` before it moves anything, so the page can still be
  scrolled. `test/touch.js` holds every gesture to it, and none of them worked
  in 3.x.
- `dist/jquery.grideditor.bundle.min.js`: the editor with SortableJS inside it,
  for pages that would rather load one file than two. A page loads it or the
  pair, never both.
- A `drag` setting: `delay`, `touch_delay`, `threshold`, `animation` and
  `scroll`, named for the gesture rather than for the library underneath.
- A whole container can be dragged. Its move tool used to be a handle for a
  list that did not accept containers, so dragging one did nothing.

### Removed
- jQuery UI is no longer a dependency. A page loads jQuery, SortableJS and the
  editor, which comes to 81.6 kB gzip against 132.8 kB before: 51 kB less, 39%
  of the page.
- `sortable_options` and `resizable_options`. Both handed out the drag
  library's own options; `drag` and `resize` replace them, and passing either
  warns once naming the replacement.

### Changed
- Resizing a column and dragging a toolbar button onto the canvas are the
  editor's own pointer code, so jQuery UI is no longer used at all. A refused
  `before-resize` now stops the gesture before it starts instead of refusing
  every step of it, and the pointer is captured, so a fast drag that leaves the
  column behind keeps resizing it. `.ui-resizable-*` become `.ge-resize-*` and
  `.ge-resizing`; a palette button carries `.ge-palette-button`.
- Sorting is SortableJS instead of jQuery UI: rows, columns, blocks, tabs,
  accordion items and elements all move through it, with touch support that
  jQuery UI sortable never had. `.ui-sortable-helper` and
  `.ui-sortable-placeholder` become `.ge-drag-helper` and
  `.ge-drag-placeholder`.
- Every sortable list the editor makes, core's and a plugin's, goes through one
  internal seam that names the drag toolkit in one place. Groundwork for 4.0,
  which replaces jQuery UI with SortableJS.
- A plugin's `onSortable` hook receives that function instead of a jQuery UI
  options object, and describes a list rather than making one. See
  `UPGRADING.md`.
- Sortable groups are scoped to the editor instance, so two editors on one page
  no longer drag into each other.


## [3.2.1] - 2026-09-22
### Changed
- `example/containers.html` shows a card too: its own row, with two columns
  inside the card body, beside the tabs, the accordion and the popup.


## [3.2.0] - 2026-09-22
### Added
- A card container plugin, `dist/plugins/grideditor.card.js`: a bootstrap card
  whose body is an editable region, with an editable header and an optional
  footer. `header: false` leaves the title out, `footer` adds one.


## [3.1.0] - 2026-09-22
### Added
- A public API, dispatched from a table instead of a chain of string
  comparisons: `init`, `deinit`, `reset`, `destroy`, `changeView`, `getView`,
  `createRow`, `createColumn` and `createElement`, alongside the existing
  `getHtml`. `create*` methods return the node they made, everything else
  returns the jQuery set and chains.
- `create*` accepts `appendTo`, `prependTo`, `insertAfter` and `insertBefore`.
  Given one, grid-editor places the node and resets the canvas; given none,
  the node comes back detached for the host to place.
- `element.data('grideditor')` is documented API: the same methods, plus a
  frozen copy of `settings` and the `canvas`.
- `createContainer`, `addTab`, `addAccordionItem` and `setLocale` are
  registered but not implemented yet: calling one warns and returns `null`
  rather than doing nothing silently.
- Host callbacks. Every operation is announced twice: as a jQuery event on the
  canvas - the specific name, then the generic one - and as the matching
  `settings.callbacks` entry. `grideditor:before-add-row`,
  `-column`, `-element` and their `after-` counterparts, the generic
  `grideditor:before-add`/`after-add`, plus `before-delete`/`after-delete`,
  `before-move`/`after-move` and `before-resize`/`after-resize`. Every payload
  carries `kind`, `node`, `parent`, `canvas`, `breakpoint` and `source`
  (`tool`, `api` or `dragdrop`); a move adds `from`/`to` positions and a
  resize the sizes it moved between.
- Canceling. `preventDefault()` on either event, or `false` from the callback,
  cancels a `before-*`: nothing is inserted, deleted or resized, no `after-*`
  fires, and a canceled `create*` returns `null`. A canceled move is put back
  with jQuery UI's own `cancel`, since a drag cannot be refused once it has
  started.
- A re-entrancy queue: `init`, `reset` and the `create*` methods called from
  inside a handler run when the operation that called them has finished,
  instead of rebuilding the canvas underneath it.
- `callbacks`, `confirm_delete` and `sortable_options` settings.
- Translatable UI strings. Every user-visible string - the tool tooltips, the
  add-row buttons, the layout mode dropdown, the settings panel, the delete
  confirms and the "editor not available" console errors - now comes from
  `t(key)`, with `{name}` interpolation. Lookup order is `locale_strings`, the
  selected locale, English, then the key itself, which is shown and logged
  once rather than leaving an empty tooltip.
- `$.fn.gridEditor.locales`, with `locales.en` built into the main bundle as
  the fallback, and `$.fn.gridEditor.t(settings, key)` for editor
  integrations. `locale` and `locale_strings` settings, and a `setLocale`
  method that re-renders the controls.
- A Spanish locale, `dist/locales/grideditor.es.js`, built from
  `src/js/locales/grideditor.es.js`. It translates every key in `locales.en`,
  which `test/locales.js` asserts, so a change that adds a string adds its
  Spanish in the same commit.
- `docs/locale-keys.md`: the key catalogue, hand-written, with
  `test/locales.js` holding it to the source in both directions.
- `example/locale.html`: an example page with a language dropdown calling
  `setLocale`.
- The settings panel is on every drawer: a container, a tab, an accordion item
  and an element have the same id and class fields as a row and a column, with
  `container_classes`, `pane_classes` and `element_classes` for preset toggles.
- The settings panel on a row or a column has a css class field beside the id
  one, so classes can be set at all rather than only toggled from a list the
  host configured. It shows the host's own classes and leaves the grid's and
  the editor's alone, and an emptied id field takes the id away rather than
  leaving an empty one.
- The stylesheet is minified too: `dist/grideditor.min.css`, with a source map,
  built and watched alongside the readable one. The task existed and was never
  run.
- The build copies and minifies each `src/js/locales/*.js` into `dist/locales/`
  individually, with a watch target of its own. The main bundle is unchanged:
  the `src/js/*.js` glob does not descend.
- `ge-settings`, `ge-delete-row` and `ge-delete-column` classes on the tools
  that had none, so hosts and tests can find them without matching a tooltip
  that is now translated.
- All six Bootstrap 5 breakpoints, plus an `all` view that writes every one of
  them at once and is the new default. `changeView` takes a key (`xs`…`xxl` or
  `all`), `getView` returns it, `layout_modes` says which the dropdown offers
  and `default_view` says where the editor starts. The canvas gets
  `ge-layout-<key>`, which constrains it to that tier's width and makes that
  tier's classes the effective ones whatever the window is doing.
- Column offsets: two indent tools per column, `valid_col_offsets`, and
  `createColumn(size, { offset: n })`. Offsets are visualized in every layout
  mode, and shift-click takes a column to the row's edge or back to none.
- A sizing core that owns every size and offset class the editor reads or
  writes, with one 12 unit budget for all of them. Its getters answer for the
  tier they were asked about, and follow Bootstrap's own cascade downward when
  a tier says nothing, rather than returning the first value they happen to
  find.
- `before-indent` and `after-indent`, so the indent tools are not a silent
  operation. They carry the same payload as the resize pair, with `from` and
  `to` as offsets.
- `example/breakpoints.html`, showing the six tiers and the all view.
- Element level controls, the level below a column. A node inside a content
  area that the host marks with `data-ge-element` becomes an element: one
  movable, deletable thing rather than rich text. Each gets a drawer with
  move, an info tool named from `data-ge-element`/`data-ge-label`, the host's
  own `element_tools`, and delete. Elements sort within a content area and
  between content areas, and their events carry `kind: 'element'`.
- The `elements` setting: `selector` (default `[data-ge-element]`), `auto`
  (default `false`, treats every child of a content area as an element, for a
  page that configures no rich text editor) and `enabled` (default `'auto'`,
  which turns the feature on when the page has any elements).
- Elements inside a content area get `contenteditable="false"` while editing,
  so a rich text editor treats them as atomic rather than as text to rewrite.
  Checked against a real tinyMCE, not assumed.
- `example/elements.html`, including the pattern for an element with no visual
  output of its own: the host supplies a placeholder and its own tools, which
  is all spec 4.4 asks for.
- The element level controls are a plugin too,
  `dist/plugins/grideditor.elements.js`, registered under
  `$.fn.gridEditor.features`: a feature plugin hooks into the canvas rather
  than building a container type, and may contribute methods - `createElement`
  says so and returns null when the plugin is not loaded.
- Container plugins. Tabs, accordions and popups are not in the main bundle:
  each is a file under `dist/plugins/`, and loading it is what makes the type
  available, the way loading a locale file adds a language. A page takes the
  ones it offers, the toolbar shows a button per loaded plugin, and the
  `plugins` setting narrows that when a page loads more than it wants to show.
  A container in the markup whose plugin is not loaded is left alone and comes
  back out of `getHtml` untouched. `$.fn.gridEditor.containers` is the
  registry, and [docs/plugins.md](docs/plugins.md) is the contract: what a
  plugin returns, and the handle it gets to work through.
- Containers: tabs, accordions and popups. A container is marked with
  `data-ge-container` and holds panes, and every pane is an ordinary canvas
  region, so rows, columns, content areas and elements nest inside one exactly
  as they do at the top level. Containers nest too. Each gets a drawer with
  move, add pane, delete and the host's `container_tools`; panes get their own
  drawer, their own `tab_tools`/`accordion_tools`, and a label edited in place.
  The toolbar offers one button per type, listed in the `containers` setting.
- `createContainer(type, options)`, `addTab(container, options)` and
  `addAccordionItem(container, options)`, which complete the method table.
  Every container and pane operation goes through the add, delete and move
  events, with `kind` naming the type: `tabs`, `accordion`, `popup`, `tab`,
  `accordion-item`.
- Tabs: a sortable strip whose panes follow their tabs, so the output reads in
  tab order.
- Accordions: `stay_open`, items that open and close from their headers while
  editing - with the state kept in `data-ge-open`, so what is left open on the
  canvas is what the authored page opens with - and items that drag into any
  other accordion on the canvas, taking that accordion's `data-bs-parent` and
  its idea of whether several items may be open. The editor answers the click
  itself; Bootstrap's collapse is never asked to run over the canvas.
- Popups: a Bootstrap modal plus its trigger, rendered unfolded and static
  while editing so its body is an ordinary region - no backdrop, no focus trap,
  no `bootstrap.Modal` instantiated. The drawer folds it away. Any node the
  host marks with `data-ge-popup-target` is a trigger: grid-editor leaves the
  markup alone and writes Bootstrap's attributes onto it at `getHtml` time. A
  trigger whose popup is gone is re-pointed when exactly one popup is left in
  its column, and otherwise marked `.ge-popup-orphan` and reported through
  `grideditor:popup-orphan`. It is never deleted.
- `example/containers.html`, with all three types, a host trigger, two levels
  of nesting, and a button that opens the exported html as a real page with
  Bootstrap and no grid-editor.
- Resizing a column by dragging its edge. jQuery UI `resizable` on every
  column, east handle by default, with `resize.enabled`, `resize.handles`,
  `resize.balance` and `resizable_options` to steer it. The column follows the
  pointer in pixels, its drawer shows the class it would land on, and on drop
  the pixels are snapped to whole units with `round(width / rowWidth * 12)`,
  clamped by the same budget the tools obey. `resize.balance: 'next'` takes
  the units out of the following column so a full row stays full; `false`
  leaves the row to wrap. The resize handle is on the column's edge and the
  sort handle is the drawer, so the two gestures never share a pixel.
- A test runner, `test/run.js`, behind `npm test`. It shares one Chrome and one
  web server across every suite in `test/`, prints one summary and exits
  non-zero on any failure. `npm test -- rte` runs a single suite, and
  `node test/rte.js` still works on its own.
- Vendored test dependencies under `test/vendor` (jQuery, jQuery UI, Bootstrap
  and bootstrap-icons), and a base fixture page in `test/fixtures` that loads
  them, so the suite runs with the network switched off. The rich text editor
  suite keeps loading the editors from their CDNs and is skipped, with a
  reason, when there is no network.
- `npm run lint`, on a flat `eslint.config.js` for eslint 9, with eslint pinned
  in devDependencies. The old `.eslintrc` named `babel-eslint` and
  pre-flat-config rule names, so it had stopped running on a current eslint.

### Changed
- The example pages are named after what they show: the tinyMCE demo that was
  `example/index.html` is `example/basic.html`, and `example/index-autosave.html`
  is `example/autosave.html`. `example/index.html` is now an index of the demos,
  so opening `example/` lands on a list rather than on one of them.
- `$(el).gridEditor('remove')` returns the jQuery object instead of
  `undefined`, so it chains like the other methods.
- A method called on an element with no editor on it is a no-op that returns
  the set, instead of doing nothing in some cases and throwing in others.
  `getHtml` still reads the element's html.
- An unknown method name warns once and returns the set.
- The layout modes come from one table, which `changeView`, `getView`, the
  column classes and the mode dropdown all read. Clicking the dropdown now
  goes through `changeView`.

- Deleting asks in a Bootstrap modal rather than `window.confirm`: it is
  styled like the rest of the page, it is translated with everything else, and
  it does not block the page while it is up. The editor builds it outside the
  canvas, so it is never part of `getHtml`, and a page that loaded Bootstrap's
  css but not its javascript still gets asked by the browser.
- Deleting a row or a column goes through `before-delete`, then the question,
  then `after-delete` once the animation has finished. The host's handler runs
  first on purpose: a host that cancels to show its own dialog never wants the
  built-in confirm to have appeared already. `confirm_delete: false` skips the
  built-in one.
- `after-resize` fires once the column class has actually been written, rather
  than while jQuery UI is still animating the class swap.
- A drag that ends where it started is not reported as a move, and dragging a
  content area reports `kind: 'content'`.
- Adding a node brings the canvas up to date with `init()` rather than a full
  `deinit`/`init`, so inserting a row somewhere else no longer closes the rich
  text editor the user is typing in.

- The layout mode dropdown is built from the layout mode table rather than
  from a markup string, which also restores the closing tag the Tablet item
  had been missing.

- **BREAKING:** the layout mode classes on the canvas are `ge-layout-xs`
  through `ge-layout-xxl` and `ge-layout-all`, replacing `ge-layout-desktop`,
  `ge-layout-tablet` and `ge-layout-phone`.
- **BREAKING:** `addAllColClasses` is conservative now. A column that carries
  any size class is left exactly as authored, instead of being seeded with one
  class per tier; a column with no sizing at all gets a single `col-12`, which
  applies at every tier. With six tiers the old behaviour would have put six
  classes on every column.
- `toolbar_drag`, which makes the toolbar a palette: a button dragged onto the
  canvas creates its row or container where it is dropped, with a line showing
  where that will be and the canvas opening up so the gaps between rows are
  something a pointer can hit. A container dropped straight onto the canvas
  brings the row and column it needs; dropped into a column it goes straight
  in. `'auto'`, the default, follows `drag_handle: 'drawer'`.
- `drag_handle`, which says what a drag starts from: the move tool as before,
  or the whole tools drawer, in which case the move tool is not rendered at
  all. The other tools in a draggable drawer keep answering to a click, and a
  drag starting on one is not a move.
- Holding the add column tool offers the column widths instead of taking the
  default one: the sizes in `valid_col_sizes`, with the ones that no longer fit
  the row marked. It answers to a held finger as well as a hovering pointer,
  and the tooltip says so, because a gesture nobody can see is a gesture nobody
  finds. `add_column: { size, picker, delay }` configures it, and a click now
  adds a full width column rather than a three unit one.
- The add row tool in a column's drawer adds an empty row. It used to add one
  with two half width columns in it, which is a layout decision the tool has no
  business making: the new row's own drawer is where columns are added.
- The size a tool starts from is the one that applies at the tier being
  edited, following the cascade: in the all view that is the widest tier,
  which is what the unconstrained canvas is showing.
- Growing a column is refused when its indent leaves no room, rather than
  silently rewriting the indent. Growing an indent shrinks the column, because
  the indent is the thing the user just asked for.
- Size changes are written directly and animated by the stylesheet, rather
  than through jQuery UI's `switchClass`, so `after-resize` fires with the
  class already on the column.
- `getHtml` strips inline pixel widths, so a drag-resized column exports as
  its class and nothing else.
- The layout mode LESS is list-driven over the breakpoint table instead of
  taking exactly four tier arguments, and covers offsets as well as columns.
  A preview reproduces Bootstrap's cascade rather than showing one tier in
  isolation: a column carrying only `col-4` is four units wide in the `sm`
  preview too, and `col-sm-6` overrides it. The 2.x code switched every other
  tier off, which only worked because every column was seeded with a class per
  tier.

- A canceled `before-resize` on a drag is refused on every step of the drag
  rather than before it starts: jQuery UI's `resizable` ignores `false` from
  its start handler, unlike its `draggable`. Nothing is written either way.
- `getHtml` output no longer carries an empty `style` attribute where an
  inline width was stripped.

- Settings that are objects of grid-editor's own keys - `elements` and
  `resize` - are merged with their defaults rather than replaced, so naming
  one key no longer silently drops the others.
- The tinyMCE integration passes `promotion: false`, so the editor's "Upgrade"
  badge stays out of the menubar of an inline editor sitting in someone's
  page. A host that wants it passes `promotion: true` in its own config.
- The rich text editor integrations fire `ge-rte-ready` on the content area
  once their editor is up. An editor rewrites what is inside the content area
  as it takes over, which costs the element drawers in it; this is how they
  are put back.

- While editing, a Bootstrap toggle the editor needs to keep quiet is moved
  aside - `data-bs-toggle` becomes `data-ge-bs-toggle` - rather than fought
  with. Bootstrap binds its data-api handlers on the document in the capture
  phase, so a listener on the node itself cannot stop one.
- `wrapContent` no longer wraps the editor's own furniture. jQuery UI's resize
  handle was being treated as loose content and wrapped into a content area of
  its own on the next `init`, so a canvas collected an empty content area per
  column per reset. It also leaves containers alone, since a container sits in
  the column beside the content areas rather than inside one.
- The instance handle is in place before the first `init` runs, so a host
  handler that fires during initialization can already reach the editor.

- **BREAKING:** the `containers` setting is `plugins`, and it names the
  container plugins to use rather than a fixed list of built in types. It
  defaults to every plugin the page loaded.
- **BREAKING:** `row_classes` and `col_classes` default to `[]`. They used to
  default to a single `Example class` toggle, which shipped a placeholder into
  every host's interface.

### Deprecated
- `remove`, in favour of `destroy`, which does the same thing. `remove` still
  works and warns once per instance.

### Fixed
- Calling `deinit` twice threw from jQuery UI, which `reset` could reach now
  that both are public methods.

## [2.0.0] - 2026-09-21
### Changed
- **BREAKING:** Migrate from Bootstrap 4 to Bootstrap 5. The layout mode
  dropdown now uses `data-bs-toggle`, so consumers must load Bootstrap 5.
- **BREAKING:** Replace Font Awesome with Bootstrap Icons. Consumers must load
  bootstrap-icons instead of Font Awesome. The default `iconClass` for custom
  `row_tools` and `col_tools` is now `bi bi-wrench`.
  Based on work by [@vahidalvandi](https://github.com/vahidalvandi).
- **BREAKING:** The tinyMCE integration now targets tinyMCE 6 and no longer
  uses the `jquery.tinymce.js` plugin, which tinyMCE dropped after 5.x. Pages
  using `content_types: ['tinymce']` must load tinyMCE 6 and must stop loading
  the jQuery integration plugin. A `tinymce.config.oninit` callback still
  works, and `init_instance_callback` is now honoured too.

### Added
- Browser tests for the rich text editor integrations, run with `npm test`.
  They drive the example pages in a real Chrome over the DevTools protocol,
  against the real editors, since what breaks in these integrations only
  happens in a browser. They need node and Chrome, and nothing else: see
  BUILDING.md.
- `example/index-autosave.html`, demonstrating auto save to localStorage plus
  layout import/export, by [@Ka-Bar](https://github.com/Ka-Bar).
- Example dependencies updated to current releases: jQuery 4.0.0, jQuery UI
  1.14.2, Bootstrap 5.3.8, Bootstrap Icons 1.13.1, summernote 0.9.1,
  CKEditor 4.22.1 and TinyMCE 6.8.6. CKEditor stops short of the latest
  release on purpose: 4.22.1 is the last under the GPL/LGPL/MPL triple
  licence, as 4.23.0 and above are CKEditor 4 LTS under the commercial
  Extended Support Model. TinyMCE stops at 6.8.6 because it is the last MIT
  licensed release; 7.x is GPL-2.0-or-later and 8.x is commercial.

### Fixed
- Clear `ge-rte-active` after the rich text editor has been torn down rather
  than before. An inline editor may restore the class attribute it snapshotted
  when it was created, as tinyMCE does, which put the class straight back and
  made `initRTE` ignore every later click: no content area could be edited
  again after a single `getHtml()` or `remove()`. The tinyMCE integration now
  also cleans up after the late removal it can perform from
  `init_instance_callback`, which used to leave `active` behind and arm a
  pending-remove flag that destroyed the next editor created on that content
  area. This affected the pre-6 integration too.
- Guard the rich text editor lookup. A `content_types` entry with no matching
  registered editor, or an empty `content_types`, made `getHtml`, `remove`,
  add row and add column throw on an undefined editor. They now no-op for that
  content area, matching how `initRTE` already behaved.

## [1.0.8]
- Fix for moving rows in columns #117

## [1.0.3] - 2019-05-18
### Added
- Support for fontawesome 4 and 5

## [1.0.2] - 2019-05-18
### Added
- npm scripts for calling grunt

### Changed
- Migrate from glyphicon to fontawesome #98 by [@Nuranto](https://github.com/Nuranto)
- Wrap source_html content if neccessary. #101 by [@Nuranto](https://github.com/Nuranto)