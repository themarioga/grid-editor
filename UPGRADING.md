Upgrading from grid-editor `2.*` to `3.*`
=========================================

Both are for bootstrap 5, and most of 3.0 is additive: the settings you pass
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
  asked; 3.0 leaves a column that carries any size class exactly as authored,
  and gives a column with none a single `col-12`. Your existing markup is
  unaffected — it already has those classes — but new columns are leaner, and
  a column sized only for `lg` now renders as bootstrap renders it below `lg`.

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
