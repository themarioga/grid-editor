grid-editor 3.0 specification
=============================

Status: proposal, not implemented. The version number is a suggestion: the
feature set is mostly additive, but the layout modes, the `remove` method and
the markup grid-editor is willing to own all change, so it belongs in a major
release.

Scope
-----

Eight features, driven by what host applications have had to fork grid-editor
to get:

1. A public API host applications can drive (init, destroy, reset, change
   view, create rows and columns).
2. Host callbacks fired before and after adding, deleting and moving.
3. Containers that hold nested content: tabs, accordions and popups, with API
   to create them.
4. Element level controls, below the column level.
5. Column offsets.
6. Every Bootstrap 5 breakpoint, not just three.
7. Translatable UI strings through locale files, with English and Spanish
   shipped.
8. Resizing a column by dragging its edge — added after review (section 13,
   decision 6) and specified in 5.2.

Non-goals for 3.0: replacing the rich text editor layer, undo/redo history,
persistence, and a non-jQuery build. Hidden elements — elements with no visual
output that still need a handle — are deliberately left out; 4.4 documents the
pattern hosts should use instead.

Where this comes from
---------------------

Most of this exists already, badly, in downstream forks. The reference case —
*the reference fork* below — is a production fork of 0.2.6 maintained by a team
building a page designer on top of grid-editor. It added: a method dispatch for
`init`/`deinit`/`reset`/`changeView`/`createRow`/`createColumn`/`createTab`,
host callbacks in place of `window.confirm`, tabs, element level tools, column
offsets, a fourth breakpoint plus an "all breakpoints at once" mode, and a
hand-translated UI in a second language. It also had to delete grid-editor's
own settings panel and its inline rich text wiring to get there. Every one of
those is a fork because grid-editor has no seam for it. The point of 3.0 is to
make those seams, so the next integration is configuration rather than a
fork.

Current state, for reference
----------------------------

- Methods: `getHtml` and `remove`, dispatched by string comparison at the top
  of `$.fn.gridEditor`.
- Instance handle: `baseElem.data('grideditor')` exposes `init`, `deinit` and
  `remove` only, and is not documented as public.
- Breakpoints: `colClasses = ['col-lg-', 'col-sm-', 'col-']`, three layout
  modes (`ge-layout-desktop`, `ge-layout-tablet`, `ge-layout-phone`) generated
  by the `layoutMode()` mixin in `src/less/grideditor.less`.
- Tools: `createTool(drawer, title, className, iconClass, handlers)` with
  hardcoded English titles; hosts can append their own through `row_tools` and
  `col_tools`.
- Deletion: `window.confirm('Delete row?')`, English, not interceptable.
- Sortable: two jQuery UI sortables (columns within rows, rows and content
  within the canvas and columns), with no notification to the host.
- No offsets, no containers, no element level anything, no i18n.


1. Public API
-------------

### 1.1 Dispatch

The string-method form stays, and gains a guard the current code lacks: a
method called on an element with no instance is a no-op that returns `this`,
except for `getHtml`, which keeps returning the element's html.

```javascript
$('#myGrid').gridEditor(options);              // initialize
$('#myGrid').gridEditor('method', arg1, arg2); // call a method
```

Method names are camelCase. Settings keys stay snake_case, as they are today.

### 1.2 Methods

| Method | Arguments | Returns | Notes |
| --- | --- | --- | --- |
| `getHtml` | — | `String` | Unchanged: deinit, read, init. |
| `init` | — | `this` | Re-run the editing pass over the canvas. Idempotent: safe to call after the host injects markup. |
| `deinit` | — | `this` | Strip editing artifacts, leave the markup. |
| `reset` | — | `this` | `deinit()` then `init()`. |
| `destroy` | — | `this` | Today's `remove`: deinit, drop the controls, unbind, clear the instance data. |
| `remove` | — | `this` | Deprecated alias of `destroy`. Logs one deprecation warning per instance. |
| `changeView` | `breakpoint` | `this` | `'xs'`…`'xxl'` or `'all'`. Also accepts a mode index for 2.x callers. |
| `getView` | — | `String` | The active breakpoint key. |
| `createRow` | `layout?` | `jQuery` | A detached row. `layout` is an array of column sizes, e.g. `[6, 6]`; omitted means an empty row. |
| `createColumn` | `size`, `options?` | `jQuery` | A detached column. `options`: `{ offset, content }`. |
| `createContainer` | `type`, `options?` | `jQuery` | `type` is `'tabs'`, `'accordion'` or `'popup'`. See section 3. |
| `addTab` | `container`, `options?` | `jQuery` | Appends a pane to a tabs container, returns the pane. |
| `addAccordionItem` | `container`, `options?` | `jQuery` | Appends an item, returns its body. |
| `createElement` | `content`, `options?` | `jQuery` | Wraps host markup as a grid-editor element (section 4). |
| `setLocale` | `code` | `this` | Swap language at runtime; re-renders the controls. |

`create*` and `add*` return the created jQuery object rather than `this`, so
they do not chain. That is deliberate — the host needs the node — and is the
only break from jQuery plugin convention. Created nodes are **detached** and
carry no tool drawers: the host places them and calls `reset()`, or passes a
parent in `options` (see below) and grid-editor calls `reset()` itself.

```javascript
// Host-driven insertion
var row = $('#myGrid').gridEditor('createRow', [8, 4]);
row.appendTo('#myGrid');
$('#myGrid').gridEditor('reset');

// Or let grid-editor place it
$('#myGrid').gridEditor('createRow', [8, 4], { appendTo: '#myGrid' });
```

`options.appendTo`, `options.prependTo`, `options.insertAfter` and
`options.insertBefore` are accepted by every `create*`/`add*` method. When one
is given, grid-editor places the node, fires the add events (section 2) and
runs `reset()`.

### 1.3 Instance handle

`element.data('grideditor')` becomes documented API, exposing the same names as
the string methods plus `settings` (read-only copy) and `canvas`. Hosts that
call many methods in a row should use it to avoid re-dispatching:

```javascript
var ge = $('#myGrid').data('grideditor');
ge.createRow([12], { appendTo: ge.canvas });
```


2. Host callbacks
-----------------

### 2.1 Two delivery mechanisms, one source

Every notification is delivered twice: as a jQuery event triggered on the
canvas, and as a settings callback. The event is primary — several listeners,
namespacing, `off()` — and the callback is for hosts that configure the plugin
once from server-side or generated code and cannot easily bind.

```javascript
// events
$('#myGrid').on('grideditor:before-add-row', function(e, payload) {
    if (payload.parent.hasClass('locked')) { e.preventDefault(); }
});

// settings callbacks
$('#myGrid').gridEditor({
    callbacks: {
        before_add_row: function(payload) { return !payload.parent.hasClass('locked'); },
        after_move: function(payload) { console.log(payload.from, payload.to); },
    },
});
```

Callbacks receive the payload only. Returning `false` from a `before_*`
callback cancels, equivalent to `preventDefault()`.

### 2.2 Event catalogue

Each operation fires a specific event and then a generic one. Listeners that
care about everything bind the generic name and switch on `payload.kind`.

| Specific | Generic | Cancelable | Fires |
| --- | --- | --- | --- |
| `grideditor:before-add-row` | `grideditor:before-add` | yes | before a row is inserted |
| `grideditor:after-add-row` | `grideditor:after-add` | no | after insertion, after `reset()` |
| `grideditor:before-add-column` | `grideditor:before-add` | yes | before a column is inserted |
| `grideditor:after-add-column` | `grideditor:after-add` | no | after insertion |
| `grideditor:before-add-container` | `grideditor:before-add` | yes | tabs, accordion or popup; `payload.kind` says which |
| `grideditor:after-add-container` | `grideditor:after-add` | no | |
| `grideditor:before-add-element` | `grideditor:before-add` | yes | section 4 |
| `grideditor:after-add-element` | `grideditor:after-add` | no | |
| `grideditor:before-delete` | — | yes | before any node is removed, whatever its kind |
| `grideditor:after-delete` | — | no | after removal completes, animation included |
| `grideditor:before-move` | — | yes | on drag start (see 2.4) |
| `grideditor:after-move` | — | no | on drop, only if the node actually changed position |
| `grideditor:before-resize` | — | yes | before a column size change, from a tool or a drag (5.2) |
| `grideditor:after-resize` | — | no | after the class is written, only if the size actually changed |
| `grideditor:popup-orphan` | — | no | on `init`, once per trigger whose `data-ge-popup-target` points at a popup that no longer exists and cannot be re-pointed unambiguously (3.4) |

Settings callback keys are the event names with `grideditor:` dropped and
dashes turned into underscores: `before_add_row`, `after_move`,
`before_delete`.

### 2.3 Payload

```javascript
{
    kind: 'row',          // row | column | tabs | accordion | popup | tab | accordion-item | element
    node: jQuery,         // the node added, deleted or moved
    parent: jQuery,       // where it is going, or coming from on delete
    canvas: jQuery,
    breakpoint: 'lg',     // active view at the time
    source: 'tool',       // tool | api | dragdrop
    // move only:
    from: { parent: jQuery, index: 2 },
    to:   { parent: jQuery, index: 0 },
    // container children only:
    container: jQuery,
}
```

`source` matters: a host that calls `createRow(...)` from its own palette and
also listens for `after-add-row` needs to tell its own insertions from a user
clicking the toolbar.

### 2.4 Cancelation, and what it can honestly do

- **Add**: canceling means nothing is inserted and no `after-*` fires. For
  `create*` calls the method returns `null` when canceled, so a host can tell.
- **Delete**: canceling leaves the node alone. This is how a host replaces the
  built-in confirm with its own modal: cancel the event, show the dialog, and
  call `destroyNode` (or just `node.remove(); ge.reset()`) if the user agrees.
- **Move**: jQuery UI cannot refuse a drag once it has started. So
  `before-move` fires from the sortable `start` handler, and canceling it marks
  the drag: on `stop`, grid-editor calls `sortable('cancel')`, the item returns
  to where it came from, and no `after-move` fires. The drag is visible and
  then reverts; it is not prevented outright. Hosts that want to forbid a drop
  target entirely should keep using jQuery UI's own `connectWith`/`items`
  through `sortable_options` (new setting, section 8).

`after-move` is suppressed when the drop leaves the node in the same parent at
the same index, so a click-drag that goes nowhere is not reported as a move.

### 2.5 Ordering

1. `before-*` (specific, then generic) — either may cancel
2. the DOM change
3. `reset()`, so drawers and sortables exist for the new markup
4. `after-*` (specific, then generic)

`after-*` handlers therefore see a fully initialized canvas. Re-entrancy is
guarded: calling `reset()`, `init()` or a `create*` method from inside an event
handler defers to after the current operation finishes rather than nesting.

### 2.6 The built-in confirm becomes a setting

`confirm_delete: true` by default, using the localized string. Set it to
`false` and grid-editor deletes without asking, which is what a host that
handles `before-delete` itself wants.


3. Containers: tabs, accordions, popups
---------------------------------------

### 3.1 Common contract

A container is a node inside a `.column` that holds one or more **panes**, each
of which is an ordinary grid-editor canvas region: rows, columns, content
areas and elements nest inside exactly as they do at the top level.

```html
<div class="ge-container ge-container-tabs" data-ge-container="tabs"> … </div>
```

- `.ge-container` plus `.ge-container-<type>`, and `data-ge-container="<type>"`
  as the machine-readable marker. Detection is by the data attribute, never by
  the Bootstrap classes, so a host restyling the markup does not break the
  editor.
- Each container gets a tools drawer: move, delete, settings, add pane, plus
  whatever the host adds through the new `container_tools` setting. Pane-level
  tools come from `tab_tools` and `accordion_tools`.
- Generated ids are `ge-<type>-<counter>-<random>` and are stable across a
  `reset()`. Bootstrap's toggles need ids and the host's markup must survive
  `getHtml`, so ids are written into the markup, not held in jQuery data.
- Containers may nest. A tabs container inside an accordion body is legal;
  grid-editor does not police depth, but the demo pages should show two levels
  at most.

### 3.2 Tabs

Bootstrap 5 tab markup, with the editor's own classes alongside:

```html
<div class="ge-container ge-container-tabs" data-ge-container="tabs">
  <ul class="nav nav-tabs" role="tablist">
    <li class="nav-item ge-tab" role="presentation">
      <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#ge-tab-1-a3f"
              type="button" role="tab" aria-controls="ge-tab-1-a3f" aria-selected="true">Tab 1</button>
    </li>
  </ul>
  <div class="tab-content">
    <div class="tab-pane fade show active" id="ge-tab-1-a3f" role="tabpanel" tabindex="0">
      <div class="row"><div class="col-12 column"><div class="ge-content"></div></div></div>
    </div>
  </div>
</div>
```

- `$el.gridEditor('createContainer', 'tabs', { tabs: 2, labels: ['One', 'Two'] })`
- `$el.gridEditor('addTab', container, { label: 'Third', activate: true })`
- The tab strip is sortable (`items: '> .ge-tab'`), and reordering fires the
  move events with `kind: 'tab'`. Panes follow their tab: the container keeps
  `.tab-content` children in the same order as the strip after a move, so
  `getHtml` output reads in tab order.
- Renaming a tab is an inline edit on the button label, guarded so the
  Bootstrap toggle does not fire while editing.

### 3.3 Accordion

```html
<div class="ge-container ge-container-accordion" data-ge-container="accordion">
  <div class="accordion" id="ge-accordion-1-b71">
    <div class="accordion-item ge-accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button" type="button" data-bs-toggle="collapse"
                data-bs-target="#ge-acc-item-1-c92" aria-expanded="true">Item 1</button>
      </h2>
      <div id="ge-acc-item-1-c92" class="accordion-collapse collapse show"
           data-bs-parent="#ge-accordion-1-b71">
        <div class="accordion-body">
          <div class="row"><div class="col-12 column"><div class="ge-content"></div></div></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

- `createContainer('accordion', { items: 2, labels: [...], stay_open: false })`.
  `stay_open: true` omits `data-bs-parent`, Bootstrap's way of allowing several
  open items.
- `addAccordionItem(container, { label, open })` returns the `.accordion-body`.
- While editing, all items are forced open (`.ge-editing .accordion-collapse {
  display: block; }`) so every pane is reachable. `getHtml` restores the
  authored open/closed state, which is tracked in `data-ge-open` on the item.
- Items are sortable, and may be dragged into **any other accordion** in the
  canvas, not just reordered within their own (decision, section 13).
  `data-bs-parent` is rewritten on drop so a moved item collapses against the
  accordion it landed in, and the `stay_open` state of the destination wins.

### 3.4 Popup

A popup is a Bootstrap modal plus its trigger. Both live in the canvas, because
both are content the user has to be able to edit.

```html
<div class="ge-container ge-container-popup" data-ge-container="popup" data-ge-popup-id="ge-popup-1-d04">
  <button type="button" class="btn btn-primary ge-popup-trigger"
          data-bs-toggle="modal" data-bs-target="#ge-popup-1-d04">Open</button>
  <div class="modal fade" id="ge-popup-1-d04" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Title</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="row"><div class="col-12 column"><div class="ge-content"></div></div></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

- `createContainer('popup', { title, trigger_label, size })`, `size` mapping to
  `modal-sm`/`modal-lg`/`modal-xl`.
- **External triggers are supported, and the host owns them** (decision,
  section 13). Any node in the canvas carrying
  `data-ge-popup-target="<popup id>"` is treated as a trigger for that popup:
  grid-editor leaves the node's markup alone, and on `getHtml` writes
  Bootstrap's `data-bs-toggle="modal"` and `data-bs-target` onto it so the
  authored page opens the modal without host JavaScript. The in-container
  button is still created by default; pass `trigger: false` to omit it and rely
  on external triggers only.
- Because an id can go stale (a popup deleted, a trigger copied between
  pages), grid-editor repairs what it can and reports the rest: on `init` it
  re-points a trigger whose target is missing if exactly one popup remains in
  the same column, otherwise it marks the trigger `.ge-popup-orphan` (an
  editing-only class, styled as a warning) and fires
  `grideditor:popup-orphan` with the trigger and the missing id. It never
  deletes a host's node.
- **Editing mode renders the modal unfolded, in place**: while the canvas has
  `.ge-editing`, the `.modal` is shown as a static block (`display: block;
  position: static;` with the backdrop suppressed) so its body is a normal
  editable region. Bootstrap's JS is never asked to open it during editing, so
  no focus trap, no scroll lock, no backdrop to fight with.
- The popup's tools drawer gets a "collapse/expand" toggle so a long page of
  unfolded modals stays workable. Collapsed state is editor-only and is not
  written to the output.
- `getHtml` emits the markup above with the editing classes and inline styles
  gone, i.e. a closed modal that Bootstrap opens from the trigger. Grid-editor
  never instantiates `bootstrap.Modal` itself.

### 3.5 Drag and drop rules

- Containers move like any other content: they are `items` of the column-level
  sortable, with `kind` reported per container type.
- Tab panes move only within their own tabs container.
- Accordion items move between accordions as well as within one.
- Rows, columns and elements move freely into and out of container panes,
  because a pane is a normal region.

### 3.6 getHtml must be clean

Non-negotiable, and testable: for every container type, `getHtml` output
contains no `ge-*` class, no `data-ge-*` attribute except the ones documented
as part of the output contract (`data-ge-popup-id` and nothing else), no tool
drawers, no editor inline styles, no `contenteditable`, and Bootstrap's own
attributes intact. Feeding that output back into `gridEditor()` must reproduce
the same editing state — round-tripping is the acceptance test.


4. Element level controls
-------------------------

### 4.1 What an element is

An element is a node inside a `.ge-content` that grid-editor treats as an
atomic, movable, deletable thing instead of as rich text. Hosts mark them:

```html
<div class="ge-content">
  <div class="ge-element" data-ge-element="image">…host markup…</div>
  <div class="ge-element" data-ge-element="form">…</div>
</div>
```

- Detection: `elements.selector`, default `[data-ge-element]`. The class is
  added by grid-editor. **Explicit marking is the only default**: nothing
  becomes an element because of where it sits (decision, section 13).
- `elements.auto`, default `false`, additionally treats the direct children of
  a content area as elements. It is the one-setting answer for a page that
  configures no rich text editor and injects its own markup, and it is opt-in
  so the meaning of a content area never changes because of an unrelated
  setting.
- `elements.enabled` (default `true` when the selector matches anything)
  switches the whole feature off for pages that only want rich text.
- Element level controls and the rich text editor coexist in one content area:
  the RTE is initialized on the content area as today, and elements inside it
  are marked `contenteditable="false"` while editing so the editor treats them
  as atomic. Pages that only ever place elements can set
  `content_types: []` and get no editor at all.

### 4.2 Controls

Each element gets a drawer with move, delete, an info tool whose tooltip is
built from `data-ge-element` plus any `data-ge-label`, and the host's own
`element_tools` entries (same shape as `row_tools`). Deletion goes through
`before-delete`/`after-delete` with `kind: 'element'`.

### 4.3 Moving

Elements are sortable within and between content areas:
`items: '> .ge-element'`, `connectWith: '.ge-canvas .ge-content'`. The drawer
is the handle. Move events carry `kind: 'element'` and the from/to content
areas.

### 4.4 Elements with no visual output

Some hosts need a handle for something that renders nothing on the page: a
tracking tag, a server-side include, a navigation rule. Core does **not** get a
dedicated feature for this in 3.0 (decision, section 13). The supported pattern
is the ordinary one:

```javascript
// The host injects its own visible placeholder and marks it as an element
var handle = $('#myGrid').gridEditor('createElement',
    '<span class="my-app-tag-placeholder">Analytics tag</span>',
    { type: 'analytics-tag', appendTo: contentArea }
);
```

with the host's edit action supplied through `element_tools`. Everything
element level — the drawer, move, delete, the events — already applies, and the
placeholder is the host's markup to style and to strip in its own save step.
If several hosts end up writing the same placeholder, that is the argument for
promoting it in a later release.

### 4.5 API

`createElement(content, options)` wraps host markup, sets `data-ge-element` from
`options.type`, and places it if given `appendTo` and friends. The host stays
the owner of what is inside; grid-editor only adds and removes its own wrapper
class and drawer.


5. Column sizing
----------------

Offsets and drag resizing are one subject: both write the same size and offset
classes, and both have to respect the same 12-unit budget, so they share one
internal sizing core rather than two sets of helpers.

### 5.1 Offsets

Bootstrap 5 offset classes, one per breakpoint: `offset-*`, `offset-sm-*`,
`offset-md-*`, `offset-lg-*`, `offset-xl-*`, `offset-xxl-*`.

- New setting `valid_col_offsets`, default `[0, 1, …, 11]`, mirroring
  `valid_col_sizes`.
- Two tools per column, "increase indent" and "decrease indent", shift-click
  for the extreme, sitting next to the existing width tools.
- Internals mirror the size helpers: `getOffsetSize(col, offsetClass)`,
  `getOffsetSizes(col)`, `setOffsetSize(col, offsetClass, size)`, and
  `MAX_COL_OFFSET = 11`.
- **Clamping**: size plus offset may never exceed 12 for the breakpoint being
  edited. Growing the offset shrinks the column if it has to; growing the
  column is refused (not silently clamped) when the offset leaves no room, so
  the user sees the tool do nothing rather than watch their offset change. The
  existing "hold shift for max" path uses the row's spare space, offsets
  included.
- `createColumn(size, { offset: 2 })` writes the offset for the active
  breakpoint, or all breakpoints in `all` mode.
- Offsets are visualized in every layout mode, which means the LESS needs
  offset rules per mode alongside the existing column rules.

The reference fork got this wrong in a way worth avoiding: its indent tools
call the size helper with an offset class name, and the helper's "no match,
return the first size found" fallback hides it. New helpers must return `null` for a class
they were not asked about, and callers must handle `null`.

### 5.2 Resize by dragging

The `+`/`-` tools stay, and are the accessible path; dragging is added as the
direct one.

- jQuery UI `resizable` on every `.column`, east handle only by default
  (`resize.handles`, so a right-to-left page can ask for `'w'`).
  `resizable_options` is merged into the widget for hosts that need more,
  mirroring `sortable_options` and the equivalent pass-through the reference
  fork already needed.
- While dragging, the column follows the pointer in pixels and the drawer shows
  the column class it would land on (`col-lg-7`), so the user sees units, not
  pixels. On stop the pixel width is snapped to the nearest whole unit:
  `round(width / rowWidth * 12)`, clamped to `valid_col_sizes`.
- The same 12-unit budget as 5.1: the snapped size plus the column's offset for
  the active breakpoint may not exceed 12, and the drag stops at that edge
  rather than silently rewriting the offset.
- `resize.balance`, default `'next'`: the following sibling absorbs the delta so
  a full row stays full, which is what dragging a divider between two columns
  looks like it should do. `false` resizes only the dragged column and lets the
  row wrap.
- Which classes get written follows the active view exactly as the tools do:
  one breakpoint in a per-tier view, every breakpoint in `all` mode.
- Events: `grideditor:before-resize` (cancelable) and
  `grideditor:after-resize`, payload `{ node, from: 7, to: 8, breakpoint,
  source: 'dragdrop' | 'tool' }`. Unlike a move, a canceled resize is aborted
  outright — jQuery UI's `resizable` honours `false` from its start handler —
  so nothing visibly happens. `after-resize` is suppressed when the snapped
  size equals the old one, so a two-pixel drag is not reported as a resize.
- Resizing and sorting share the column: the resize handle sits on the column
  edge and the sort handle is the drawer, so neither steals the other's
  gesture. The handle is hidden outside `.ge-editing`, and is not part of
  `getHtml` output.


6. Bootstrap 5 breakpoints
--------------------------

### 6.1 The six tiers plus "all"

| Key | Column prefix | Offset prefix | Bootstrap min-width | Canvas preview width | Locale key |
| --- | --- | --- | --- | --- | --- |
| `xs` | `col-` | `offset-` | 0 | 400px | `view.xs` |
| `sm` | `col-sm-` | `offset-sm-` | 576px | 576px | `view.sm` |
| `md` | `col-md-` | `offset-md-` | 768px | 768px | `view.md` |
| `lg` | `col-lg-` | `offset-lg-` | 992px | 992px | `view.lg` |
| `xl` | `col-xl-` | `offset-xl-` | 1200px | 1200px | `view.xl` |
| `xxl` | `col-xxl-` | `offset-xxl-` | 1400px | none | `view.xxl` |
| `all` | every prefix | every prefix | — | none | `view.all` |

`all` is the default view, and the important one: size and offset changes made
in it are written to **every** breakpoint at once, which is what someone
laying out a page that does not need per-device tuning actually wants. The
per-breakpoint views then override single tiers. (The reference fork found this
and
encoded it as `curColClassIndex === -1`; here it is a named mode.)

- `layout_modes` setting lists which keys appear in the toolbar dropdown,
  default all seven, so a host can offer three and keep the old feel.
- `default_view` setting, default `'all'`.
- Canvas preview: `.ge-canvas.ge-layout-<key>` constrains `max-width` to the
  preview width and makes that tier's column classes the effective ones, the
  job the `layoutMode()` mixin does today for three tiers. The mixin needs to
  take the full tier list; `disable-columns` currently takes exactly four
  arguments and has to become list-driven.
- `addAllColClasses()` currently seeds every column with a class per tier. With
  six tiers that is six classes on every column, so it should seed only the
  tiers that are missing *and* only when the column has no explicit sizing at
  all, to keep the output readable.

### 6.2 Migration from 2.x

Three modes become seven, and `col-lg-`/`col-sm-`/`col-` stop being the only
prefixes grid-editor writes. `changeView` accepts the old numeric index
(0 = desktop → `lg`, 1 = tablet → `sm`, 2 = phone → `xs`) so 2.x callers keep
working, with a deprecation warning.


7. Localization
---------------

### 7.1 Registry and settings

```javascript
$.fn.gridEditor.locales = {};   // code -> { key: string }
$.fn.gridEditor.locales.en = { … };  // built into the core file, the fallback
```

- `locale: 'en'` selects a registered locale.
- `locale_strings: {}` overrides individual keys without a locale file, for
  one-off wording.
- Lookup order: `locale_strings` → `locales[locale]` → `locales.en` → the key
  itself. A missing key is a visible key, never an empty tooltip, and logs once
  in the console.
- `setLocale(code)` swaps language at runtime and re-renders the controls.

### 7.2 Locale files

One file per language, in `src/js/locales/`, built to `dist/locales/`:

```javascript
/* src/js/locales/grideditor.es.js */
(function($) {
    $.fn.gridEditor.locales.es = {
        'tool.move': 'Mover',
        'tool.settings': 'Configuración',
        'tool.delete_row': 'Borrar fila',
        'tool.add_column': 'Añadir columna',
        'tool.indent_increase': 'Aumentar sangría',
        'confirm.delete_row': '¿Seguro que quieres borrar esta fila?',
        'view.all': 'Todos los tamaños',
        'container.add_tab': 'Añadir pestaña',
        'row.add': 'Añadir fila {layout}',
    };
})(jQuery);
```

```html
<script src="dist/jquery.grideditor.min.js"></script>
<script src="dist/locales/grideditor.es.js"></script>
<script>$('#myGrid').gridEditor({ locale: 'es' });</script>
```

Interpolation is `{name}` placeholders filled from an object:
`t('row.add', { layout: '6-6' })`. No pluralization rules; a string that needs
plurals gets two keys.

### 7.3 String keys

Every user-visible string moves behind `t(key)`: the tool titles in
`createRowControls`, `createColControls`, the new container, pane and element
drawers, the delete confirms, the layout dropdown labels, the add-row button
titles, the id/class inputs in the settings panel, and the "editor not loaded"
console errors. Keys are namespaced by area: `tool.*`, `confirm.*`, `view.*`,
`container.*`, `element.*`, `row.*`, `column.*`, `error.*`. The full catalogue
lives in `docs/locale-keys.md`, generated from the source so it cannot drift.

### 7.4 Build

`src/js/*.js` is concatenated into the main bundle by `Gruntfile.js`; the glob
does not descend, so `src/js/locales/*.js` stays out of it. Add a grunt target
that copies and minifies each locale file to `dist/locales/` individually, plus
a `locales` watch target. English lives in the core bundle so a page that loads
no locale file still has a complete UI.

### 7.5 Locales shipped with grid-editor

Two, and the distinction between them matters:

- **English** is not a locale file. `locales.en` lives inside the core bundle
  and is the fallback every lookup ends at, so a page that loads no locale file
  still has a complete UI. Removing a key from it is a breaking change.
- **Spanish** ships as `dist/locales/grideditor.es.js`, built from
  `src/js/locales/grideditor.es.js`, and is maintained in this repository
  rather than left to hosts. It exists for two reasons: a second language is
  the only way to prove the mechanism end to end — a pseudo-locale proves
  nothing about wording that has to fit in a tooltip or a dropdown — and the
  wording already exists in production downstream, so it is cheap to seed.

Both are held to the same standard: **complete key coverage**. `es` translating
every key in `locales.en` is asserted by `test/locales.js` (section 10), so a
phase that adds a tool adds its Spanish string in the same PR, not later. That
rule applies to the two shipped locales only; a contributed locale may be
partial.

Translations are seeded from the existing production wording where it exists,
and reviewed by a native speaker before release — machine-translated UI text in
a shipped locale is worse than no locale at all, because it silently teaches
hosts the wrong terms for `row`, `column` and `offset`.

### 7.6 Contributing another language

1. Copy `src/js/locales/grideditor.es.js`, change the code and the strings.
2. `npm run build`, which emits `dist/locales/grideditor.<code>.js`.
3. Load the file after the plugin and pass `locale`.
4. To have it shipped with grid-editor rather than kept in your own project,
   open a PR adding the file, a row in the README's locale table, and — if you
   can commit to keeping it complete — its code to the coverage assertion in
   `test/locales.js`.

A locale file that omits keys is valid: the missing ones fall back to English.


8. Settings reference
---------------------

New:

| Setting | Default | Purpose |
| --- | --- | --- |
| `callbacks` | `{}` | Map of `before_*`/`after_*` functions (section 2). |
| `confirm_delete` | `true` | Use the built-in confirm before deleting. |
| `container_tools` | `[]` | Host tools on container drawers. |
| `tab_tools` | `[]` | Host tools on tab drawers. |
| `accordion_tools` | `[]` | Host tools on accordion item drawers. |
| `element_tools` | `[]` | Host tools on element drawers. |
| `elements` | `{ enabled: 'auto', selector: '[data-ge-element]', auto: false }` | Element level controls. `auto` treats content-area children as elements. |
| `containers` | `['tabs', 'accordion', 'popup']` | Which container buttons the toolbar offers. |
| `valid_col_offsets` | `[0…11]` | Offsets the tools cycle through. |
| `resize` | `{ enabled: true, handles: 'e', balance: 'next' }` | Column resize by dragging (5.2). |
| `resizable_options` | `{}` | Merged into every jQuery UI resizable. |
| `layout_modes` | `['all','xs','sm','md','lg','xl','xxl']` | Dropdown entries. |
| `default_view` | `'all'` | View on init. |
| `locale` | `'en'` | Locale code. |
| `locale_strings` | `{}` | Per-key overrides. |
| `sortable_options` | `{}` | Merged into every jQuery UI sortable, for hosts that need `cancel`, `tolerance`, custom `connectWith`. |

Unchanged: `new_row_layouts`, `row_classes`, `col_classes`, `row_tools`,
`col_tools`, `custom_filter`, `content_types`, `valid_col_sizes`,
`source_textarea`, and the per-editor `ckeditor`/`summernote`/`tinymce` config
objects.


9. Markup contract
------------------

What a host may rely on, and what grid-editor promises not to change without a
major version:

- Structural: `.row`, `.column`, `.ge-content`.
- Containers: `[data-ge-container="tabs|accordion|popup"]`, `.ge-tab`,
  `.ge-accordion-item`, `.ge-popup-trigger`, `data-ge-popup-id`,
  `data-ge-popup-target` (host-authored, and preserved in the output),
  `data-ge-open` on accordion items.
- Elements: `[data-ge-element]`.
- Editor-only, never in `getHtml` output: `.ge-editing`, `.ge-canvas`,
  `.ge-tools-drawer`, `.ge-details`, `.ge-rte-active`, `.ge-layout-*`,
  `.ge-element`, `.ge-popup-orphan`, `.active`, jQuery UI's own
  `.ui-resizable*`/`.ui-sortable*` classes and handles, and any inline style
  either the editor or jQuery UI sets — including the pixel `width` a resize
  leaves behind, which must be stripped once the class is written.


10. Testing
-----------

The browser suite added in `test/` is the acceptance harness: real Chrome over
the DevTools protocol, no npm dependencies, `npm test`. Extend it with one file
per feature area, sharing `test/cdp.js` and `test/server.js`:

- `test/api.js` — every method, including the no-instance guards, the return
  types, `destroy` leaving no drawers or listeners, and `remove` warning once.
- `test/events.js` — each event fires exactly once per operation, in the
  documented order, with a payload of the documented shape; canceling each
  `before_*` leaves the DOM untouched; a canceled move reverts; a no-op drag
  fires no `after-move`; settings callbacks and events both fire.
- `test/containers.js` — create each container type, nest a row and an element
  inside, reorder panes, then round-trip: `getHtml` output has no editor
  leftovers and re-initializes to the same state. Plus the decided cases: an
  accordion item dragged into a second accordion collapses against its new
  parent; an external `data-ge-popup-target` trigger gets Bootstrap's
  attributes in the output and actually opens the modal in the authored page; a
  trigger whose popup was deleted is re-pointed when unambiguous and marked
  `.ge-popup-orphan` when not.
- `test/offsets.js` — the clamping rules, per breakpoint and in `all` mode.
- `test/resize.js` — a drag of N pixels lands on the expected column class;
  the 12-unit budget stops the drag instead of rewriting the offset;
  `balance: 'next'` moves the sibling and `false` does not; a canceled
  `before-resize` changes nothing; a sub-unit drag fires no `after-resize`; no
  pixel width or jQuery UI artifact survives `getHtml`.
- `test/breakpoints.js` — `changeView` for each tier, `all` writing every
  prefix, the numeric back-compat path.
- `test/locales.js` — a stub locale swaps the tool tooltips, missing keys fall
  back to English, `setLocale` re-renders, the `t()` keys in `src` match
  `docs/locale-keys.md` in both directions, and the shipped `es` locale
  translates every key in `locales.en`.
- `test/elements.js` — explicit marking is required by default, `elements.auto`
  picks up content-area children, and a host placeholder for an element with no
  visual output moves and deletes like any other element.

New example pages under `example/` double as manual test pages: one per
container type and one showing all six breakpoints.


11. Delivery
------------

One release: 3.0.0, cut when phase 5 lands (section 13). The phases are
internal milestones, each one merged to `master` green and independently
revertable, not published versions.

1. **Seams.** Method dispatch, instance handle, event plumbing (including the
   resize pair, ahead of the feature that fires it), locale plumbing with
   English extracted into `locales.en` and the Spanish locale file written
   against it. No user-visible feature, which makes it reviewable as pure
   seam.
2. **Sizing.** One internal sizing core that owns reading and writing size and
   offset classes and the 12-unit budget, then the six tiers, `all` mode, the
   offset tools, drag resize (5.2) and the LESS rewrite on top of it. Every
   caller that writes a width lives here, so the core is written once.
3. **Element level controls.** Marking, `elements.auto`, drawers, sortable,
   events.
4. **Containers.** Tabs, then accordion, then popup, each with its example page
   and round-trip test.
5. **Docs and release.** README options, methods and the locale table, an
   events reference, the locale key catalogue and its check, a native-speaker
   review of the Spanish strings phases 2 to 4 added, UPGRADING for 2.x hosts,
   CHANGELOG, and the 3.0.0 version bump.

12. Compatibility
-----------------

Breaking:

- `remove` is deprecated in favour of `destroy` (alias kept for 3.x).
- Layout modes go from three to seven, and the dropdown indexes change.
  `changeView` takes keys; numeric indexes are mapped with a warning.
- Columns may carry six size classes instead of three after
  `addAllColClasses`.
- `getHtml` output gains container and element markup for pages that use them.

Not breaking: every existing setting, the RTE registry
(`$.fn.gridEditor.RTEs`), `.row`/`.column`/`.ge-content`, and the CSS class
names in use today.


13. Decisions
-------------

The four questions this spec opened were answered on 2026-09-21. Recorded here
because each one is a commitment the sections above now depend on.

1. **Popup triggers: both, and the host owns the external one.** Grid-editor
   creates the in-container button, and treats any node carrying
   `data-ge-popup-target` as a trigger too, writing Bootstrap's attributes onto
   it at `getHtml` time. It never generates or deletes that node. Chosen
   because page designers reference popups from arbitrary elements — the
   reference fork points at them from navigation elements — so an editor that
   only supports its own button forces host glue. Cost: stale ids, handled by
   the repair and `.ge-popup-orphan` rules in 3.4.
2. **Accordion items move between accordions.** The `data-bs-parent` rewrite
   was already required for moves inside one accordion, so allowing the
   cross-container case is nearly free, and it keeps container panes consistent
   with rows and columns, which already move anywhere.
3. **Elements with no visual output stay out of 3.0.** `createElement` plus
   `element_tools` and a host-supplied placeholder covers it (4.4), and the
   reference fork's dropdown markup is too application-specific to own
   upstream.
   Revisit if a second host writes the same placeholder.
4. **Element detection stays explicit, with `elements.auto` as opt-in.**
   Existing pages keep their behaviour, and a no-editor host turns on one
   setting. Rejected the alternative of inferring elements from an empty
   `content_types`, because that makes the meaning of a content area depend on
   an unrelated setting.

A second round of review answered four more:

5. **One release, 3.0.0.** No interim 2.1.0 for the seams. Hosts get one
   migration story, and nothing is promised as stable mid-flight. The phases in
   section 11 stay as internal milestones.
6. **Column resize by dragging is in, and lands with the rest of the sizing
   work.** Specified in 5.2. It was first slated for phase 1; on review it
   moved to phase 2, together with the sizing core, because resize, offsets
   and the six breakpoints all write the same classes against the same 12-unit
   budget. Phase 1 keeps only the seam it needs — the `before-resize` and
   `after-resize` events — so the feature has somewhere to report to when it
   arrives.
7. **The locale key catalogue is hand-written and test-checked.**
   `docs/locale-keys.md` stays prose a reviewer can read, and `test/locales.js`
   greps `t()` calls out of `src` and fails when doc and code disagree. No
   generator, no build step.
8. **Porting any downstream fork onto 3.0 is out of scope here.** 3.0 proves
   itself with the example pages and the browser suite. Whether a fork adopts
   3.0, and what it needs in order to, is separate work in its own
   repository.
