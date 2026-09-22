Upgrading from grid-editor `3.*` to `4.*`
=========================================

In progress; 4.0 is not released. What has landed so far:

* __A plugin's `onSortable` takes a function, not an options object.__ It used
  to receive the editor's shared jQuery UI options and call `.sortable()`
  itself; it now receives `sortable(lists, { draggable, group })` and describes
  the list instead. See [docs/plugins.md](docs/plugins.md). Nothing else in the
  plugin handle changed.

  ```javascript
  // 3.x
  onSortable: function(shared) {
      ge.canvas.find('.ge-content').sortable($.extend({
          items: '> .ge-element',
          connectWith: '.ge-canvas .ge-content',
      }, shared, ge.settings.sortable_options));
  }

  // 4.x
  onSortable: function(sortable) {
      sortable(ge.canvas.find('.ge-content'), {
          draggable: '> .ge-element',
          group: 'element',
      });
  }
  ```

* __`sortable_options` and `resizable_options` are gone.__ They existed to hand
  you the drag library's own options, and 4.0 stops promising there is one: the
  group names, the handle, the filter and the callbacks are the editor's, and
  overwriting them breaks the canvas rather than tuning it. What they were used
  for is now `drag` — `delay`, `touch_delay`, `threshold`, `animation`,
  `scroll` — and the `resize` block you already have. Passing either warns once
  and names the replacement.

* __Sorting is SortableJS, not jQuery UI.__ Load `Sortable.min.js` beside the
  editor. jQuery UI is still needed for resizing and the toolbar palette; that
  goes too before 4.0 is released. Classes you may have styled:

  | 3.x | 4.0 |
  | --- | --- |
  | `.ui-sortable-helper` | `.ge-drag-helper` |
  | `.ui-sortable-placeholder` | `.ge-drag-placeholder` |

* __A whole container can be dragged now.__ Its move tool was a handle for a
  list that did not accept containers, so in 3.x dragging one did nothing. It
  moves like a row does, and fires the same `before-move`/`after-move` with the
  container's kind.

* __Two editors on one page no longer drag into each other.__ Lists were
  connected by selector — `.ge-canvas .row` matches every canvas on the page —
  so a column could be dragged from one editor into another, carrying the first
  editor's furniture and firing its events in the wrong place. Lists are now
  connected per instance. If you were relying on that, you were relying on a
  bug.


Upgrading from grid-editor `2.*` to `3.*`
=========================================

Both are for bootstrap 5, and most of 3.x is additive: the settings you pass
today keep working, `getHtml` still returns your markup, and the rich text
editor integrations are unchanged. Four things do change.

* __Layout modes went from three to seven.__ `changeView` takes a breakpoint
  key now — `'xs'`, `'sm'`, `'md'`, `'lg'`, `'xl'`, `'xxl'` or `'all'` — and
  `getView` gives one back. The 2.x numeric indexes still work (`0` desktop,
  `1` tablet, `2` phone) and log a deprecation warning once. The dropdown has
  seven entries; pass `layout_modes: ['all', 'lg', 'sm', 'xs']` for something
  closer to the old feel.
* __The editor starts in the `all` view__, where a size or indent change is
  written to every breakpoint at once. Pass `default_view: 'lg'` for the old
  behaviour of editing one tier at a time.
* __The canvas layout classes are named after the breakpoints.__
  `ge-layout-desktop`, `ge-layout-tablet` and `ge-layout-phone` are now
  `ge-layout-lg`, `ge-layout-sm` and `ge-layout-xs`, with `ge-layout-md`,
  `-xl`, `-xxl` and `-all` alongside them. If you styled against those class
  names, rename them.
* __Columns are no longer seeded with a class per breakpoint.__ 2.x wrote
  `col-lg-*`, `col-sm-*` and `col-*` onto every column whether or not you
  asked; 3.x leaves a column that carries any size class exactly as authored,
  and gives a column with none a single `col-12`. Your existing markup is
  unaffected — it already has those classes — but new columns are leaner, and
  a column sized only for `lg` now renders as bootstrap renders it below `lg`.

* __Tabs, accordions, popups and the element level controls are plugin
  files.__ They are not in the main bundle: load
  `dist/plugins/grideditor.tabs.js` and its neighbours beside the editor for
  the ones your pages use. Nothing to change for a 2.x page, which had none of
  them; a page that wants them loads two files instead of one.

* __`row_classes` and `col_classes` are empty by default.__ 2.x shipped a
  single `Example class` toggle in every settings panel; if you were relying on
  it, pass the classes you actually want. The panel now has a css class field
  of its own, so a host needs the preset buttons only for the classes it wants
  one click away.

Deprecated, and still working:

* `remove` is now `destroy`. `remove` remains as an alias and warns once per
  instance.

New, and worth knowing about before you write glue code for it:

* `callbacks` and the `grideditor:*` events, so your application is told about
  every add, delete, move, resize and indent, and can cancel any of them. This
  replaces reaching into the editor's DOM to find out what happened. See
  [docs/events.md](/docs/events.md).
* `confirm_delete`, which replaces the hardcoded "Delete row?" confirm, and
  `locale`/`locale_strings`/`setLocale` for the interface language.
* Column offsets, drag resize, element level controls, and tabs, accordions
  and popups. All off unless you use them; the containers and elements are
  detected from `data-ge-container` and `data-ge-element`, which your existing
  markup does not have.

Upgrading from grid-editor `1.*` to `2.*`
=========================================

Grid-editor `1.*` is for bootstrap __4__, `2.*` for bootstrap __5__.

The grid classes grid-editor generates (`col-lg-*`, `col-sm-*`, `col-*`) are
valid in both bootstrap 4 and 5, so __no changes to your generated HTML are
needed__. What changes is what you load on the page:

* Load __bootstrap 5__ instead of bootstrap 4. The layout mode dropdown now
  uses `data-bs-toggle` instead of `data-toggle`, which only bootstrap 5
  understands.
* Load [bootstrap icons](https://icons.getbootstrap.com/) instead of font
  awesome. Every built-in tool icon moved from a `fa fa-*` class to its
  `bi bi-*` equivalent.
* If you pass custom `row_tools` or `col_tools`, their default `iconClass` is
  now `bi bi-wrench`. Any `iconClass` you pass explicitly as `fa fa-*` must be
  changed to a bootstrap icons class.
* If you use `content_types: ['tinymce']`, load __tinyMCE 6__ and stop loading
  the `jquery.tinymce.js` integration plugin. TinyMCE dropped that plugin after
  5.x, so the integration now calls `tinymce.init()` directly. A
  `tinymce.config.oninit` callback keeps working, and `init_instance_callback`
  is honoured as well.

Upgrading from grid-editor `0.*` to `1.*`
=========================================

Grid-editor `0.*` is for bootstrap __3__, `1.*` for bootstrap __4__.
Since the breakpoints for the gridsystem have changed from 3 to 4, all the HTML that was generated using grid-editor `0.*` must be adjusted.
Change all the classes in the HTML from `col-md` to `col-lg`. No other changes to the HTML are needed.
