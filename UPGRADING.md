Upgrading from grid-editor `7.x` to `8.0`
=========================================

8.0 takes out what kept pages, plugins and options of earlier versions
working. Nothing it removes warns: an option that is gone is ignored like any
option the editor does not know. The jQuery adapter stays, and so does the
conversion of markup 5.x saved. `8.0.0-beta.2` is the first beta published
(`8.0.0-beta.1` never was); install it with
`npm install @themarioga/grid-editor@next`.

* __The spacing, textalign, visibility and float plugins are gone.__ Load
  `grideditor.style.js`, which has carried them since 7.3, and name it in the
  `plugins` setting: `'spacing'`, `'textalign'`, `'visibility'` and `'float'`
  there are plugins that are not loaded now, and only get the usual warning.
* __`utilities.spacing` and `utilities.visibility` are not read.__ They are
  `style.spacing` and `style.visibility`.
* __`replaces` on a plugin's factory does nothing.__ A plugin that stood in
  for another is loaded beside it, like any two plugins.
* __`changeView`, `getUtility` and `setUtility` take a view key only.__ The
  numeric indexes of 2.x - `0`, `1`, `2` for desktop, tablet and phone - are
  views that do not exist: `changeView(0)` warns that there is no such
  layout mode and does nothing. Pass `'lg'`, `'sm'` or `'xs'`.
* __`sortable_options` and `resizable_options` are ignored__, without the
  warning 4.0 gave: use `drag` and `resize`.
* __`tinymce.config.oninit` is passed to tinyMCE as it is__, without the
  warning 7.0 gave: use `init_instance_callback`.
* __`ckeditor.config.on.instanceReady` is not called.__ It was CKEditor 4's,
  and 7.x called it itself; `on` goes to CKEditor 5 as it is, which does not
  know it. A function in `config.extraPlugins` is CKEditor 5's way: it is
  called with the editor as the editor starts.
* __The adapter has no `$.fn.gridEditor.containers`, `.features`,
  `.utilities` or `.texts`.__ A plugin written for 6.x that registers there
  throws as it loads, where 7.x warned and left it out. Port it: see
  "Port a plugin written for 6.x" below.
* __Gone from the locales:__ `warning.setting_removed`,
  `warning.oninit_removed` and `warning.plugin_6x`. A locale of your own
  can drop them.

What `8.0.0-beta.2` adds to that:

* __The `visibility` utility is `display`.__ It edits every `d-{bp}-*`
  value now, not only hidden and shown: `setUtility(node, 'display', 'none',
  'md')`, and `before-utility` and `after-utility` say `family: 'display'`.
  `'visibility'` is a family no plugin declares, and gets the usual warning.
  The eye and `style.visibility.drawer` are as they were.
* __A row's `justify-content-*` and `align-items-*` are the style plugin's.__
  They are in its Flex section, on rows and on anything made flex, and the
  alignment plugin keeps `align-self-*` only. A page that loads alignment
  without style has no field for them: load `grideditor.style.js`.
* __Locale keys:__ `utility.visibility` and `utility.visibility_shown` are
  gone, and `utility.display` is new; `utility.justify_content` and
  `utility.align_items` come with the style plugin now. The Flex section and
  sticky bring keys of their own, listed in
  [docs/locale-keys.md](docs/locale-keys.md).

Upgrading from grid-editor `7.2` to `7.3`
=========================================

Nothing breaks. The spacing, textalign, visibility and float plugins are now
part of the **style plugin**, and deprecated on their own: they go in 8.0.
A page that loads them keeps working as it did, with a warning in the
console.

* __Load the style plugin instead of the four.__ It edits the same classes
  per breakpoint, in its Spacing, Text, Display and Position sections rather
  than in *Responsive*, and adds inline css and Bootstrap's classes as
  chips.

  ```html
  <script src="dist/plugins/grideditor.style.min.js"></script>
  ```

  As a module, `import '@themarioga/grid-editor/plugins/style'`. Loaded
  beside it, the old files stand down.
* __Name it in the `plugins` setting__, if the page names its plugins:
  `plugins: ['style', …]` instead of `'spacing'`, `'textalign'`,
  `'visibility'` or `'float'`. An old name still asks for the style plugin,
  with a warning, until 8.0.
* __Move the options.__ `utilities: { spacing: … }` is
  `style: { spacing: … }`, and `utilities: { visibility: … }` is
  `style: { visibility: … }`. The old ones are still read, with a warning,
  until 8.0.
* __Tests or code that look for the fields__ in the Responsive section find
  them in the Style accordion now: `[data-ge-style-section="spacing"]` and
  the others.

Upgrading from grid-editor `7.1` to `7.2`
=========================================

Only for a page that uses the CKEditor plugin: **the CKEditor integration is
CKEditor 5**. It breaks such a page, and it is a minor all the same, because
it is a change in a plugin, not in the core.

CKEditor 4.22.1, the last open source CKEditor 4, has known cross-site
scripting vulnerabilities and gets no more fixes; every CKEditor 4 after it is
commercial. A page that does not use CKEditor has nothing to change. Markup
saved with a CKEditor text loads as it is: the content type is still
`ckeditor`.

* __Load CKEditor 5 instead of CKEditor 4.__ Its browser build, and its
  stylesheet:

  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ckeditor5@48.5.2/dist/browser/ckeditor5.css">
  <script src="https://cdn.jsdelivr.net/npm/ckeditor5@48.5.2/dist/browser/ckeditor5.umd.js"></script>
  ```

  With CKEditor 4 on the page, the plugin says CKEditor 5 is not available.
* __Pass a `licenseKey`.__ CKEditor 5 does not start without one: `'GPL'`
  accepts its GPL-2.0-or-later licence, or pass your commercial key.

  ```javascript
  new GridEditor('#myGrid', {
      content_types: ['ckeditor'],
      ckeditor: { config: { licenseKey: 'GPL' } },
  });
  ```
* __Rewrite the rest of `ckeditor.config` for CKEditor 5.__ It is what
  `InlineEditor.create` takes, and CKEditor 4's options mean nothing to it:
  `toolbar` has another shape, `extraPlugins`, `removePlugins` and
  `allowedContent` are gone, and `plugins` lists every plugin. grid-editor
  gives it a set of plugins and a toolbar when the config has none; see the
  README. `on.instanceReady` is still called, with the editor as `this` and
  as `evt.editor`.
* __Markup no plugin knows is dropped__ as the editor opens, as CKEditor 4's
  content filter did: add `GeneralHtmlSupport` to keep classes and elements.

Upgrading from grid-editor `6.*` to `7.*`
=========================================

One change makes it a major: **grid-editor is plain DOM**. It does not need
jQuery, its API is a `GridEditor` class, its events are DOM events, and what
it hands out - to a page and to a plugin - are elements. Markup 6.x saved
loads as it is, and `getHtml` and `getPlainHtml` give what 6.x gave for it.

* __A page written for 6.x can keep its code.__ Load jQuery 4 and the adapter
  after the editor, and the 7.x plugins after that:

  ```html
  <script src="jquery.min.js"></script>
  <script src="grid-editor/dist/grideditor.min.js"></script>
  <script src="grid-editor/dist/grideditor.jquery.min.js"></script>
  <script src="grid-editor/dist/plugins/grideditor.tabs.min.js"></script>
  ```

  `$(el).gridEditor(...)`, `$(el).gridEditor('method', ...)`, jQuery listeners
  on `grideditor:*` with `(event, payload)`, `$(el).data('grideditor')`, and
  the callbacks, `custom_filter` and the host tools' handlers all work as they
  did, with jQuery objects where 6.x had them. The adapter supports jQuery 4.

* __Or move to the native API__, and drop jQuery:

  | 6.x | 7.0 |
  | --- | --- |
  | `$('#g').gridEditor(options)` | `var ge = new GridEditor('#g', options)`, or `GridEditor.create('#g', options)` |
  | `$('#g').gridEditor('getHtml')` | `ge.getHtml()`, and so for every method |
  | `$('#g').data('grideditor')` | `GridEditor.get('#g')` |
  | `$('#g').on('grideditor:after-move', function(e, payload) { … })` | `ge.canvas.addEventListener('grideditor:after-move', function(e) { var payload = e.detail; … })` |
  | `payload.node.hasClass('locked')` | `payload.node.classList.contains('locked')`: the payload's nodes are elements |
  | `createRow(...)` returns a jQuery object | returns the element, or `null` |
  | `{ appendTo: $('#col') }` | `{ appendTo: document.querySelector('#col') }`, or `{ appendTo: '#col' }` |
  | `custom_filter` gets `$(canvas)` | gets the canvas element |
  | a host tool's handler gets a jQuery event | gets the DOM event, with `this` the tool |
  | `$.fn.gridEditor.locales`, `$.fn.gridEditor.t` | `GridEditor.locales`, `GridEditor.t` |

  The methods that do something - `init`, `reset`, `changeView`, `destroy`
  and the rest - return the editor, to chain. A method called after
  `destroy()` does nothing and warns once; `getHtml` still reads the element.

* __The files are named for the editor, not for jQuery.__

  | 6.x | 7.0 |
  | --- | --- |
  | `dist/jquery.grideditor.js`, `.min.js` | `dist/grideditor.js`, `.min.js` |
  | `dist/jquery.grideditor.bundle.min.js` | `dist/grideditor.bundle.min.js` |
  | — | `dist/grideditor.esm.js`, and `dist/plugins/*.esm.js`, `dist/locales/*.esm.js` |
  | — | `dist/grideditor.jquery.js`, the adapter |
  | — | `dist/grideditor.d.ts`, the public API's types |

  The plugins and the locales keep their names. `package.json`'s `main` is
  `dist/grideditor.js`, and `module`, `exports` and `types` point at the rest.

* __In an app built with a bundler__, import it:

  ```javascript
  import GridEditor from '@themarioga/grid-editor';
  import '@themarioga/grid-editor/plugins/tabs';   // registers as it is imported
  import Sortable from 'sortablejs';
  import * as bootstrap from 'bootstrap';

  GridEditor.Sortable = Sortable;     // there is no window.Sortable in a module app
  GridEditor.bootstrap = bootstrap;   // nor a window.bootstrap; only its Modal is used
  ```

  A page loads the classic script or the module build, never both: each is an
  editor of its own, with its own plugins. Loaded twice, the classic script
  keeps the first `GridEditor` and says so.

* __Port a plugin written for 6.x.__ The adapter does not keep 6.x plugins
  working: one registered on `$.fn.gridEditor.containers`, `.features`,
  `.utilities` or `.texts` is named in a warning and left out. What changes:

  - It registers on `GridEditor.containers`, `.features`, `.utilities` or
    `.texts`, and adds its strings with `Object.assign(GridEditor.locales.en, …)`.
    A classic script stops being `(function($) { … })(jQuery)`; loaded before
    the editor, the shipped ones throw an error saying so.
  - The handle gives and takes elements. `ge.canvas` is the canvas element;
    `ge.createTool` returns the tool; `ge.detailsOf`, `ge.drawerOf` and
    `ge.utilityField` return an element or `null` where 6.x gave an empty set;
    `ge.toolbarItems` returns an array; `ge.labelIn` returns the label.
  - Every hook is handed elements: `mark(container)`, `drawerTools(drawer,
    node, kind)`, `accepts(region, node)`, `onContentReady(area)` and the rest.
    What a hook makes - `create()`, `addPane()`, a toolbar item's `create()`,
    a utility's `panel()` - it returns as an element, or `null`.
  - A text editor's `start(contentAreas)` and `stop(contentAreas)` get an
    array of content areas.
  - The `sortable(lists, options)` a plugin's `onSortable` gets takes an
    element or an array of them, and `options.accepts` is asked with elements.
  - An event it listens for is a DOM event, the payload in `detail`.

  The shipped plugins in `src/js/plugins/` are ported the same way, and
  `grideditor.card.js` is still the shortest one to read.

* __What is gone.__ The `remove()` method, 6.x's deprecated alias of
  `destroy()`; 5.x's `$.fn.gridEditor.RTEs`; and tinyMCE's `oninit` option,
  which is ignored with a warning - use `init_instance_callback`.

* __What behaves differently.__
  - A `<script>` in html the editor writes - the source view,
    `source_textarea`, `createElement`, `createColumn`'s content, a paste - is
    kept in the markup and does not run in the editor. 6.x wrote through
    jQuery, which ran it.
  - A listener that throws no longer stops the operation: the browser reports
    the error, and the other listeners, the callbacks and the operation go on.
  - An element that has an editor gets it back when a second one is asked
    for, with its first options, and a warning. 6.x built a second editor
    over the first.
  - A jQuery listener on a page without the adapter gets the DOM event alone,
    with the payload in `event.originalEvent.detail`.
  - `custom_filter` given as a function, or as an array, runs: 6.x only ran a
    function it could find by name.

* __Summernote still needs jQuery__, for summernote itself: its page loads
  jQuery and summernote as before, and does not need the adapter.


Upgrading from grid-editor `5.*` to `6.*`
=========================================

Three changes make it a major: **elements are blocks of the column**, no longer
part of a text, **the text editors are not in the main bundle** - text itself
is theirs, not the core's - and **what is not the grid's is the host's plain
content**. Markup 5.x saved loads as it is, and `getPlainHtml` publishes the
same from it.

* __Load your text editor as a plugin.__ tinyMCE, CKEditor and summernote are
  plugins in `dist/plugins/`, loaded after the editor:

  ```html
  <script src="grid-editor/dist/jquery.grideditor.min.js"></script>
  <script src="grid-editor/dist/plugins/grideditor.tinymce.min.js"></script>
  ```

  Up to 5.x the main bundle, and the bundle with SortableJS, carried a copy of
  each, and since 5.2 editing with one said so in the console. Without the
  plugin a text is still a block, to move and delete, and its drawer says it
  cannot be edited.

* __Elements are blocks of the column.__ Up to 5.x an element lived inside a
  content area, among the text a rich text editor edited. Now it sits in the
  column beside the texts, and markup saved the 5.x way is converted as the
  editor starts: each content area is cut at each element among its own
  children - the text before it stays, the element goes into the column, the
  text after goes into a new content area of the same type - and the next
  `getHtml` saves the 6.0 shape.

  ```html
  <!-- 5.x -->
  <div class="ge-content"><p>Before</p><blockquote data-ge-element="quote">…</blockquote><p>After</p></div>

  <!-- 6.0 -->
  <div class="ge-content"><p>Before</p></div>
  <blockquote data-ge-element="quote">…</blockquote>
  <div class="ge-content"><p>After</p></div>
  ```

  What `getPlainHtml` publishes is the same, `div.ge-content` being taken off,
  with one exception: a content area with an id or classes of the host's
  keeps them on its first part only. What to do: nothing, unless you style a
  `div.ge-content` of your own as a whole, or read the saved markup expecting
  elements inside a content area. A marked node inside a paragraph or a list
  was text in 5.x and is text still.

  Rows and containers found inside a content area come out of it the same way.

* __`createElement` into a content area__ - `appendTo` or `prependTo` one - puts
  the element beside it instead, after or before, and warns once. Place it in a
  column.

* __`elements.auto: true`__ means every loose node of a column is an element,
  where it meant every child of a content area. A 5.x content area's children
  still come out as elements, so a page that relied on it looks the same.

* __A text dragged between columns is `kind: 'text'`__ in `before-move` and
  `after-move`, as it is in its add and delete events since 5.3. It was
  `kind: 'content'`.

* __No more `contenteditable="false"` or `data-mce-bogus` on elements__, which
  only existed to live inside a text editor. And a plugin that wrote an
  element's attributes through tinyMCE's `undoManager.transact` can write them
  with a plain `attr()`.

* __Loose content is plain content, not a text.__ Up to 5.x the markup the
  editor found loose in a column - or a whole page with no row - was wrapped
  as a text of the first `content_types`, `<div class="ge-content"
  data-ge-content-type="tinymce">`. Now it is wrapped with no type, as the
  host's plain content: a block to move and delete, edited in the source, and
  a click with a text editor loaded makes it a text, through
  `before-convert` and `after-convert`. Markup 5.x saved, with its content
  areas typed, loads as texts, as before. What to do: nothing, unless you
  read the saved markup expecting every content area to carry a type.

* __New columns are empty.__ A column the add column tool, a row button,
  `createRow` or `createColumn` makes - and a new container's or pane's
  region - has no content area in it. Add a text with the toolbar's *Text*
  button, clicked or dragged into the column, or `createText`. `createColumn(size, {
  content })` still holds its content: as a text of the first editor
  offered, or as plain content with none.

* __`content_types` defaults to every text editor loaded__, in the order the
  page loaded them, where it was `['tinymce']`. A page that loads one editor
  needs no `content_types`; one that loads several and wants one names it.

* __`text_tools`, `text_classes` and `createText` are the text editors'.__
  They work as before with any of the shipped editors loaded; with none,
  `createText` warns and returns null.

* __An integration of your own under `$.fn.gridEditor.RTEs`__ is ignored,
  with a warning, and so is one under `$.fn.gridEditor.texts` on a page
  that loads none of the shipped editors: `texts` is their own registry. An
  editor of your own is a feature plugin that declares its type with
  `textTypes`; [docs/plugins.md](docs/plugins.md#text) has the contract, and
  [example/custom_editor.html](example/custom_editor.html) is one in full.

* __No *Add text* tool in the columns' drawers.__ 5.3 put one there; a text
  is added with the toolbar's *Text* button, dragged into the column, or
  `createText`. The `tool.add_text` and `tool.add_text_type` locale keys are
  gone with it.

* __The source button can be left out__ with `edit_source: false`. A page
  that hid `.gm-edit-mode` with css of its own can drop that css.

* __A code editor of your own over the source textarea__ - CodeMirror, Ace,
  started on `.ge-html-output` when the source button is clicked - can be the
  codemirror plugin instead, which edits the source view in CodeMirror 5, or a
  feature plugin with `onSourceOpen(textarea)` and `onSourceClose(textarea)`:
  the editor goes over the textarea on open, and puts its value back in it on
  close, which is what the canvas is made of. See
  [docs/plugins.md](docs/plugins.md). The codemirror-inline plugin edits one
  block's html at a time, in place, from a </> tool in its drawer.

* __`destroy` with the source view open__ leaves the canvas with the html
  being written in it. It left the canvas hidden, holding the html it had
  before the source opened.

* __A page that names its plugins__ in the `plugins` setting names
  `codemirror` and `codemirror-inline` there too, as any feature plugin, to use
  them.


Upgrading from grid-editor `4.*` to `5.*`
=========================================

One change makes it a major: **the all view writes one class.** Everything
else in 5.0 is new, and a page that uses none of it edits as it did.

* __A size or an offset set in the all view is the class with no breakpoint.__
  Up to 4.x the all view wrote all six breakpoints; 5.0 writes the base class
  and takes the breakpoints' own sizes or offsets off, as the utilities have
  done since 4.1. The markup means the same on the page and is shorter:

  ```html
  <!-- 4.x, after "narrower" on a col-lg-6 column in the all view -->
  <div class="col-5 col-sm-5 col-md-5 col-lg-5 col-xl-5 col-xxl-5">

  <!-- 5.0, the same click -->
  <div class="col-5">
  ```

  Reading has not changed: markup with the six classes written out is read as
  before, and the first change made in the all view simplifies it. What to do:
  nothing, unless you compare or post-process the html the editor saves and
  expect six classes. A breakpoint view still writes its own breakpoint alone.

* __Resize and indent payloads carry `cleared` in the all view__, with what the
  write took off each breakpoint: `[{ breakpoint: 'lg', value: 6 }]`. A
  listener that checks the payload's keys exactly will see one more.

* __A resize's `from` and `to` can be `'equal'` or `'auto'`__ - Bootstrap's
  `col` and `col-auto` - and `from` is `null` for a column its row sizes with
  `row-cols`. `source` can be `panel`, for a width chosen in a column's
  settings panel. A listener that does arithmetic on them should check
  `typeof size === 'number'` first. These only happen on columns that use the
  new sizes.

* __`valid_col_sizes` has two more values by default__, `'equal'` and `'auto'`,
  which the add column picker and the width field offer. A host that sets its
  own list keeps it; one that wants the 4.x picker sets
  `valid_col_sizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]`.

* __Every column's settings panel has a Width field, and every row's a Columns
  per row field__, in the Responsive section, which is folded until the user
  opens it. `row_cols: false` takes the row field away.

* __Columns with `col`, `col-auto`, or in a row with `row-cols-*` are no longer
  given a `col-12`.__ In 4.x a column with only `col` was not a column at all,
  and one with `col-auto` got a `col-12` that overrode it; both now edit as
  Bootstrap renders them. A page that relied on the `col-12` gets the layout
  its classes describe instead.

New and opt-in, so nothing to do: the `sections` plugin for Bootstrap's
containers, and the feature hooks it is built on (`blocks`, `regions`,
`accepts`, `toolbar`). See the [CHANGELOG](CHANGELOG.md) for the full list.


Upgrading from grid-editor `3.*` to `4.*`
=========================================

One change, and it is worth the major: jQuery UI is gone. The editor is 51 kB
lighter on the page and works from a touchscreen, which it never did. Four
things to do:

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

* __jQuery UI is not a dependency.__ Drop its `<script>` and add SortableJS;
  resizing a column and carrying a toolbar button onto the canvas are the
  editor's own pointer code now. A page that would rather load one file can
  load `dist/jquery.grideditor.bundle.min.js`, the editor with SortableJS
  inside it, instead of the two.

  ```html
  <!-- 3.x -->
  <script src="jquery-ui.min.js"></script>
  <script src="dist/jquery.grideditor.min.js"></script>

  <!-- 4.x -->
  <script src="Sortable.min.js"></script>
  <script src="dist/jquery.grideditor.min.js"></script>
  ```

  Classes you may have styled:

  | 3.x | 4.0 |
  | --- | --- |
  | `.ui-sortable-helper` | `.ge-drag-helper` |
  | `.ui-sortable-placeholder` | `.ge-drag-placeholder` |
  | `.ui-resizable-handle` | `.ge-resize-handle` |
  | `.ui-resizable-e`, `.ui-resizable-w` | `.ge-resize-e`, `.ge-resize-w` |
  | `.ui-resizable-resizing` | `.ge-resizing` |
  | `.ui-draggable` on a toolbar button | `.ge-palette-button` |

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
