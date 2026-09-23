Grid Editor
===========

Grid Editor is a visual javascript editor for the [bootstrap 5 grid system](https://getbootstrap.com/docs/5.3/layout/grid/), written as a [jQuery](http://jquery.com/) plugin. You can create, drag, resize and delete rows and columns — sized in units, equal (`col`) or to their content (`col-auto`), or shared out by their row (`row-cols-*`) — indent them, group them in sections (`.container`), copy and paste them, and give each of bootstrap's six breakpoints its own layout — or edit them all at once, with a mouse or with a finger. Bootstrap's responsive utilities — visibility, order, alignment, gutters, spacing, text alignment and float — are edited per breakpoint too. It also edits tabs, accordions, popups and cards, and any markup you mark as an element, and it tells your application about every change it makes.

This is a fork of [Friendly-Pixel/grid-editor](https://github.com/Friendly-Pixel/grid-editor)
by Simon Epskamp, carrying it on from 2.x. It is published as
`@themarioga/grid-editor`.

(Looking for the __bootstrap 3 support__? Use version 0 in the [bootstrap_3 branch](https://github.com/Friendly-Pixel/grid-editor/tree/bootstrap_3))

It provides integration plugins for the following rich text editors to edit column content: TinyMCE, summernote and CKEditor.

![Preview](http://i.imgur.com/UF9CCzk.png) 

Demos
-----

__[Try it live](https://themarioga.github.io/grid-editor/example/)__ &mdash; every
demo below, running on GitHub Pages.

Every page under `example/` is a working editor, and they are static: served
from any web server, or from GitHub Pages, with no build step.
[example/index.html](example/index.html) lists them all.

| Demo | What it shows | |
| --- | --- | --- |
| [example/basic.html](example/basic.html) | The editor with tinyMCE in the content areas | [live](https://themarioga.github.io/grid-editor/example/basic.html) |
| [example/breakpoints.html](example/breakpoints.html) | The six breakpoints and the "all sizes" view | [live](https://themarioga.github.io/grid-editor/example/breakpoints.html) |
| [example/plugins.html](example/plugins.html) | The plugin model, with one written in the page itself | [live](https://themarioga.github.io/grid-editor/example/plugins.html) |
| [example/attributes.html](example/attributes.html) | A plugin of your own: a drawer tool, a modal, and its settings saved as an attribute | [live](https://themarioga.github.io/grid-editor/example/attributes.html) |
| [example/containers.html](example/containers.html) | Tabs, accordions, popups and cards, two levels deep | [live](https://themarioga.github.io/grid-editor/example/containers.html) |
| [example/elements.html](example/elements.html) | Element level controls, including an element with no visual output | [live](https://themarioga.github.io/grid-editor/example/elements.html) |
| [example/autocols.html](example/autocols.html) | Equal and auto columns, columns per row, and sections | [live](https://themarioga.github.io/grid-editor/example/autocols.html) |
| [example/utilities.html](example/utilities.html) | Bootstrap's responsive utilities, edited per breakpoint | [live](https://themarioga.github.io/grid-editor/example/utilities.html) |
| [example/locale.html](example/locale.html) | The interface in Spanish, with a language switcher | [live](https://themarioga.github.io/grid-editor/example/locale.html) |
| [example/ckeditor.html](example/ckeditor.html) | CKEditor instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/ckeditor.html) |
| [example/summernote.html](example/summernote.html) | Summernote instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/summernote.html) |
| [example/clipboard.html](example/clipboard.html) | Copy and paste, within an editor, between two, and between tabs | [live](https://themarioga.github.io/grid-editor/example/clipboard.html) |
| [example/wrap_content.html](example/wrap_content.html) | Non-bootstrap markup wrapped into the grid | [live](https://themarioga.github.io/grid-editor/example/wrap_content.html) |
| [example/autosave.html](example/autosave.html) | Saving the html as the user edits | [live](https://themarioga.github.io/grid-editor/example/autosave.html) |

Installation
------------

* __Dependencies:__ Grid Editor depends on jQuery, [SortableJS](https://sortablejs.github.io/Sortable/), Bootstrap Icons, and Bootstrap 5, so make sure you have included those in the page. 
    * If you want to use the tinyMCE integration, include tinyMCE 6 as well, and `dist/plugins/grideditor.tinymce.min.js` after the editor. The tinyMCE jQuery plugin is no longer needed, and no longer exists as of tinyMCE 6.
    * If you want to use the summernote integration, include summernote and `dist/plugins/grideditor.summernote.min.js`.
    * If you want to use the CKEditor integration... you get the point: CKEditor and `dist/plugins/grideditor.ckeditor.min.js`.
    * Up to 5.x the main bundle carried a copy of the three; since 6.0 the plugin of the editor you use has to be loaded, as above. See [UPGRADING.md](UPGRADING.md).
* From npm:

```
npm install @themarioga/grid-editor
```

* Or [download the latest version of Grid Editor](https://github.com/themarioga/grid-editor/archive/master.zip) and include it in your page: 

```html
<!-- Make sure jQuery, SortableJS, bootstrap icons, and bootstrap 5 are included. TinyMCE is optional. -->
<link rel="stylesheet" type="text/css" href="grid-editor/dist/grideditor.min.css" />
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
<script src="grid-editor/dist/jquery.grideditor.min.js"></script>
<!-- The text editor you use, as a plugin -->
<script src="grid-editor/dist/plugins/grideditor.tinymce.min.js"></script>
```

Or, for a page that would rather load one file, the editor with SortableJS
inside it &mdash; one or the other, never both:

```html
<link rel="stylesheet" type="text/css" href="grid-editor/dist/grideditor.min.css" />
<script src="grid-editor/dist/jquery.grideditor.bundle.min.js"></script>
```

Usage
-----
```javascript
$('#myGrid').gridEditor({
    new_row_layouts: [[12], [6,6], [9,3]],
});
// Call this to get the result after the user has done some editing:
var html = $('#myGrid').gridEditor('getHtml');

// Or, for a page that only publishes the result and never edits it again:
var published = $('#myGrid').gridEditor('getPlainHtml');
```

`getHtml` keeps a little of the editor's own marking: the `column` class, the
`div.ge-content` around each column's content, and the `ge-*` classes and
`data-ge-*` attributes that say which rich text editor a content area uses and
which parts are elements, tabs, accordions or popups. That marking is how the
editor reads its markup back, so **save `getHtml`** for anything that will be
edited again.

`getPlainHtml` is the same markup with that marking taken off, and each
`div.ge-content` replaced by what it holds. Bootstrap's own classes and
attributes stay, so tabs, accordions and popups still work in a page that
never loads grid-editor. It is a one-way export: loaded back into the editor,
the rows, columns and text come back, but containers and elements are plain
markup and the content areas lose their rich text editor.

Methods
-------

```javascript
$('#myGrid').gridEditor('method', argument);
```

| Method | Arguments | Returns | What it does |
| --- | --- | --- | --- |
| `getHtml` | — | `String` | The clean html: no drawers, no editor classes, no inline styles |
| `getPlainHtml` | — | `String` | `getHtml` without grid-editor's marking (`ge-*`, `column`, `data-ge-*`), for publishing. It cannot be edited again as it was |
| `init` | — | `this` | Run the editing pass over the canvas again. Safe to call after you inject markup |
| `deinit` | — | `this` | Strip the editing furniture, leave the markup |
| `reset` | — | `this` | `deinit()` then `init()` |
| `destroy` | — | `this` | Deinit, drop the controls, unbind, forget the instance |
| `remove` | — | `this` | Deprecated alias of `destroy` |
| `changeView` | `breakpoint` | `this` | `'xs'`…`'xxl'`, or `'all'` to edit every breakpoint at once, with one class |
| `getView` | — | `String` | The view the editor is in |
| `setLocale` | `code` | `this` | Switch language and re-render the controls |
| `createRow` | `layout?`, `options?` | `jQuery` | A row, optionally with columns: `createRow([8, 4])`, `createRow(['auto', 'equal'])`, `createRow({ row_cols: { xs: 1, md: 3 }, columns: 6 })` |
| `createColumn` | `size`, `options?` | `jQuery` | A column: units, `'equal'` or `'auto'`; no size into a row with row-cols takes the row's share. `options`: `offset`, `content` |
| `createSection` | `options?` | `jQuery` | A section, with the sections plugin. `options`: `width` (`'fixed'`, `'fluid'` or a breakpoint), `rows` (layouts), and a placement |
| `createElement` | `content`, `options?` | `jQuery` | Host markup wrapped as an element. `options`: `type`, `label` |
| `createText` | `type?`, `options?` | `jQuery` | A content area for a text editor, the first one offered by default. `options`: `content`, and a placement. `null` if the editor is not loaded |
| `createContainer` | `type`, `options?` | `jQuery` | `'tabs'`, `'accordion'` or `'popup'` |
| `addTab` | `container`, `options?` | `jQuery` | Appends a tab, returns its pane |
| `addAccordionItem` | `container`, `options?` | `jQuery` | Appends an item, returns its body |
| `getUtility` | `node`, `family`, `view?` | `String` | A utility plugin's value on a node in a view (the current one by default), or `null` |
| `setUtility` | `node`, `family`, `value`, `view?` | `Boolean` | Write it through the events; `null` is inherit. `false` if canceled or nothing changed |

A method called on an element with no editor on it is a no-op that returns the
set, so host code does not have to check first. `getHtml` and `getPlainHtml`
are the exception: they return the element's html either way, and
`getPlainHtml` cleans it.

The `create*` methods hand back the node they made rather than the jQuery set,
because you need the node. It comes back **detached**: place it and call
`reset()`, or pass a parent and let grid-editor do both.

```javascript
// place it yourself
var row = $('#myGrid').gridEditor('createRow', [8, 4]);
row.appendTo('#myGrid');
$('#myGrid').gridEditor('reset');

// or say where it goes: appendTo, prependTo, insertAfter, insertBefore
$('#myGrid').gridEditor('createRow', [8, 4], { appendTo: '#myGrid' });
```

If you are calling several methods in a row, take the instance handle instead
of dispatching each one. It exposes the same methods, plus the canvas and a
read-only copy of the settings:

```javascript
var ge = $('#myGrid').data('grideditor');
ge.createRow([12], { appendTo: ge.canvas });
ge.changeView('lg');
```

Events
------

Every operation is announced before and after it happens, as a jQuery event on
the canvas and as a callback. A `before-*` can be canceled.

```javascript
$('#myGrid').on('grideditor:before-delete', function(e, payload) {
    if (payload.node.hasClass('locked')) { e.preventDefault(); }
});

$('#myGrid').gridEditor({
    callbacks: {
        after_move: function(payload) { console.log(payload.from, payload.to); },
    },
});
```

The full catalogue, the payload and what canceling each operation does is in
[docs/events.md](docs/events.md).

Languages
---------

The interface ships in English and Spanish. English is built into the plugin;
every other language is a file you load after it.

| Code | Language | File |
| --- | --- | --- |
| `en` | English | built in, and the fallback for every other locale |
| `es` | Spanish | `dist/locales/grideditor.es.js` |

```html
<script src="grid-editor/dist/jquery.grideditor.min.js"></script>
<script src="grid-editor/dist/locales/grideditor.es.js"></script>
<script>$('#myGrid').gridEditor({ locale: 'es' });</script>
```

Override single strings without a locale file with `locale_strings`, and switch
language at runtime with `setLocale('es')`. The keys are listed in
[docs/locale-keys.md](docs/locale-keys.md).

To contribute a language, copy `src/js/locales/grideditor.es.js`, change the
code and the strings, run `npm run build`, and open a pull request. A locale
file that omits keys is fine: the missing ones fall back to English.


Options
-------

### General options

__`new_row_layouts`:__ Set the column layouts that appear in the "new row" buttons at the top of the editor. A size is a number of units, `'equal'` (Bootstrap's `col`, sharing what the row has left) or `'auto'` (`col-auto`, as wide as its content).

```javascript
$('#myGrid').gridEditor({
    new_row_layouts: [[12], [6,6], [9,3], ['auto', 'equal'], { row_cols: { xs: 1, md: 3 }, columns: 6 }],
});
```

A layout can also be a row with columns per row: `{ row_cols: { xs: 1, md: 3 }, columns: 6 }` makes a `row-cols-1 row-cols-md-3` row of six columns with no size of their own.

### Column sizes

A column's size at each breakpoint is a number of units, equal or auto:

| Size | Class | On the page |
| --- | --- | --- |
| `1`–`12` | `col-4`, `col-md-4` | That many twelfths of the row |
| `'equal'` | `col`, `col-md` | An equal share of what the row has left |
| `'auto'` | `col-auto`, `col-md-auto` | As wide as its content |

The width tools and dragging a column's edge work in units, so they turn an
equal or auto column into a number, starting from the width it has on the
canvas. Every size is in the *Width* field of a column's settings panel, in its
Responsive section, and a change made there is a resize like any other.

**Columns per row.** A row's *Columns per row* field writes Bootstrap's
`row-cols-{bp}-{1–6,auto}`, which gives each column with no size of its own an
equal share of a line. A column added to such a row takes its share, and the
width tools take a column out of the share with a size of its own. Which one
sizes a column at a breakpoint is settled as in Bootstrap's css: the class from
the wider breakpoint wins, and at one breakpoint `col` loses to `row-cols`,
which loses to `col-auto` and `col-N`. `row_cols: false` takes the field away.

In a breakpoint view a size or an offset is written for that breakpoint. In the
all view it is written once, as the class with no breakpoint (`col-4`,
`offset-2`), and the breakpoints' own sizes or offsets are taken off: one value
for every size. Up to 4.x the all view wrote all six breakpoints instead.

The settings button on a row, a column, a container, a tab, an accordion item
or an element opens a panel with two fields: the node's `id`, and its css
classes. The classes field shows what your markup put
there and nothing else — the grid classes, and everything else the editor
writes, are not yours to lose and are not shown.

__`row_classes`:__ Preset classes the user can toggle from that panel, as
buttons beside the two fields. Empty by default; the classes field covers the
general case, and this is for the handful a host wants one click away.

```javascript
$('#myGrid').gridEditor({
    row_classes: [{ label: 'Dark', cssClass: 'my-app-dark' }],
});
```

__`col_classes`:__ The same as `row_classes`, but for columns. `container_classes`, `pane_classes` and `element_classes` do the same for a container, for a tab or accordion item, and for an element.

__`row_tools`:__ Add extra tool buttons to the row toolbar.

```javascript
$('#myGrid').gridEditor({
    row_tools: [{
        title: 'Set background image',
        iconClass: 'glyphicon-picture',
        on: { 
            click: function() {
                $(this).closest('.row').css('background-image', 'url(http://placekitten.com/g/300/300)');
            }
        }
    }]
});
```
    
__`col_tools`:__ The same as row_tools, but for columns.

__`drag_handle`:__ What a drag starts from. `'tool'`, the default, gives every drawer a move tool and only that tool drags. `'drawer'` makes the whole drawer the handle and drops the move tool, since it would then only say "drag from here". The tools inside a draggable drawer still answer to a click, and dragging from one starts no move.

```javascript
$('#myGrid').gridEditor({
    drag_handle: 'drawer',
});
```

__`toolbar_drag`:__ Whether the toolbar's buttons are a palette: drag one onto the canvas and the row or container it stands for is created where you drop it, with a line showing where that is. `'auto'`, the default, turns it on when `drag_handle` is `'drawer'`, since that is the same idea applied to the toolbar; `true` and `false` decide it outright. Clicking a button still adds at the end either way.

```javascript
$('#myGrid').gridEditor({
    drag_handle: 'drawer',
    toolbar_drag: 'auto',
});
```

__`custom_filter`:__ Allows the execution of a custom function before initialization and after de-initialization. Accepts a functions or a function name as string.
Gives the `canvas` element and `isInit` (true/false) as parameter.

```javascript
$('#myGrid').gridEditor({
    'custom_filter': 'functionname',
});

function functionname(canvas, isInit) {
    if(isInit) {
        // do magic on init
    } else {
        // do magic on de-init
    }
}
```

or

```javascript
$('#myGrid').gridEditor({
    'custom_filter': function(canvas, isInit) {
        //...
    },
});
```

__`valid_col_sizes`:__ The column sizes the +/- buttons step through, and that the add column picker and the width field offer. Default `[1, 2, … 12, 'equal', 'auto']`; leave `'equal'` and `'auto'` out and they are not offered, though a column that has one still shows it.

```javascript
$('#myGrid').gridEditor({
    'valid_col_sizes': [2, 5, 8, 10],
});
```

__`valid_col_offsets`:__ The same, for the indent buttons. Default `[0, 1, … 11]`.

__`add_column`:__ What the add column tool in a row's drawer does. A click adds a column of `size`; holding the tool for `delay` milliseconds — with the pointer or with a finger — offers the widths in `valid_col_sizes` instead, marking the ones that no longer fit the row. Defaults:

```javascript
$('#myGrid').gridEditor({
    add_column: {
        size: 12,      // what a click adds
        picker: true,  // false turns the hold gesture off
        delay: 600,
    },
});
```

__`callbacks`:__ A `before_*`/`after_*` function per operation, the same notifications as the events. Returning `false` from a `before_*` cancels it. See [docs/events.md](docs/events.md).

```javascript
$('#myGrid').gridEditor({
    callbacks: {
        before_delete: function(payload) { return !payload.node.hasClass('locked'); },
        after_add_row: function(payload) { console.log('row added', payload.node); },
    },
});
```

__`settings_panel`:__ Where the settings a gear opens are shown - a node's id, its classes, the presets and the *Responsive* fields. Default `'offcanvas'`.

| Value | Where |
| --- | --- |
| `'offcanvas'` | A Bootstrap offcanvas at the side of the window, from the bottom on a phone. It does not move the canvas, and has room for every field |
| `'popover'` | A Bootstrap popover under the gear, or over it when there is more room there; a press anywhere else puts it away |
| `'modal'` | A Bootstrap modal |
| `'inline'` | Unfolded in the drawer itself, as up to 5.x |

Each is titled after its node ("Column settings"), the node is outlined while its settings are open, and Escape closes them. The editor opens and places them itself, with Bootstrap's markup and css: a page needs neither Popper nor Bootstrap's javascript, and the modal is Bootstrap's own when Bootstrap is there. [example/utilities.html](example/utilities.html) switches between the four.

```javascript
$('#myGrid').gridEditor({ settings_panel: 'popover' });
```

__`confirm_delete`:__ Whether to ask before deleting a row, column, element or container. Default `true`. The question is asked in a Bootstrap modal the editor builds outside your canvas, in the interface language; a page that loaded Bootstrap's css but not its javascript gets the browser's own confirm instead. Set it to `false` if you cancel `before-delete` and ask in your own way.

__`drag`:__ How a drag behaves, wherever the editor drags something. Named for the gesture rather than for the library underneath, so it survives a change of library. Every gesture works from a touchscreen, which is what `touch_delay` is for: a touch drag that started instantly would take the page's scrolling with it, so a finger has to rest for a moment before it moves anything. Setting `delay` makes both gestures wait that long.

```javascript
$('#myGrid').gridEditor({
    drag: {
        delay: 0,           // ms to hold before a drag starts
        touch_delay: 100,   // the same for touch, where 0 eats the page's scrolling
        threshold: 3,       // px of movement before a gesture counts as a drag
        animation: 150,     // ms of reordering animation, 0 for none
        scroll: true,       // scroll the page when a drag reaches its edge
    },
});
```

### Breakpoints and sizing

__`layout_modes`:__ Which views the toolbar dropdown offers. Default `['all', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl']`. Offer fewer to keep the feel of 2.x:

```javascript
$('#myGrid').gridEditor({
    layout_modes: ['all', 'lg', 'sm', 'xs'],
});
```

__`default_view`:__ The view the editor starts in. Default `'all'`, which writes one class for every breakpoint at once — what a layout that needs no per-device tuning wants.

__`resize`:__ Resizing a column by dragging its edge. Defaults:

```javascript
$('#myGrid').gridEditor({
    resize: {
        enabled: true,
        handles: 'e',      // 'w' for a right to left page, 'e, w' for both
        balance: 'next',   // the following column absorbs the change; false lets the row wrap
    },
});
```


### Text

A column's text is a *text block*: a content area, the text editor that edits
it, and a drawer of its own - move, which editor, settings, the host's
`text_tools`, delete - like any other block. It drags between columns, the
clipboard copies it, and spacing, text alignment and visibility apply to it.
The markup does not change: the drawer sits beside the content area in a
wrapper that only exists while editing, because inside it the text editor would
take it for text. It sits over the text's top right corner and takes no room,
showing while the pointer is over the text, while the text is being edited or
holds the focus, and while its settings are open. While the text is being
edited it stays faint, not to hide the end of the line being typed, until the
pointer is on the drawer itself.

A column's drawer has an *Add text* tool, and the toolbar a *Text* button, one
per editor when `content_types` offers several (*Text (tinyMCE)*, *Text
(CKEditor)*...). Held, the add text tool offers each editor. The button adds a
row with the text in it, or, dragged, puts the text where it is dropped.

```javascript
$('#myGrid').gridEditor('createText', { content: '<p>Hello</p>', appendTo: '#myColumn' });
```

A text whose editor's plugin is not loaded is still a block, to move and
delete, and its drawer says it cannot be edited.

__`text_tools`:__ Extra tools on every text drawer, same shape as `row_tools`.

__`text_classes`:__ Preset class toggles on a text's settings panel, as `row_classes`.

### Elements

An element is a node the editor treats as one movable, deletable block instead
of as rich text: a block of the column, beside its texts, rows and containers,
never part of a text. It is a plugin, like the containers:

```html
<script src="grid-editor/dist/plugins/grideditor.elements.min.js"></script>
```

You mark the elements themselves:

```html
<div class="col-md-6">
  <div class="ge-content"><p>Some text</p></div>
  <blockquote data-ge-element="quote" data-ge-label="Pull quote">…your markup…</blockquote>
</div>
```

Up to 5.x an element lived inside a content area, among its text. Markup saved
that way still loads: each element comes out of the text it sits in, into the
column, and the text is cut there - before it, and after it in a new content
area of the same type. Only a content area's own children count, as in 5.x;
a marked node inside a paragraph is text. What `getPlainHtml` publishes is the
same as before. `createElement` with `appendTo` a content area puts the element
beside it instead, with a warning.

__`elements`:__ Defaults:

```javascript
$('#myGrid').gridEditor({
    elements: {
        enabled: 'auto',                 // on when the page has any; true or false to decide yourself
        selector: '[data-ge-element]',   // what counts as an element
        auto: false,                     // true treats every loose node of a column as one
    },
});
```

__`element_tools`:__ Extra tools on every element drawer, same shape as `row_tools`.

See [example/elements.html](example/elements.html), which also shows the
pattern for an element with no visual output of its own.

### Responsive utilities

Bootstrap's responsive utility classes, edited per breakpoint. Each family is
a plugin in a file of its own:

```html
<script src="grid-editor/dist/plugins/grideditor.visibility.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.order.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.alignment.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.gutters.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.spacing.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.textalign.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.float.min.js"></script>   <!-- after grideditor.elements -->
```

| Plugin | Classes | On |
| --- | --- | --- |
| `visibility` | `d-{bp}-none`, `d-{bp}-block`, `d-{bp}-flex` | rows, columns, elements, containers |
| `order` | `order-{bp}-{first,0–5,last}` | columns |
| `alignment` | `justify-content-{bp}-*`, `align-items-{bp}-*`; `align-self-{bp}-*` | rows; columns |
| `gutters` | `g-{bp}-{0–5}`, `gx-{bp}-*`, `gy-{bp}-*` | rows |
| `spacing` | `{p,m}{,x,y,t,b,s,e}-{bp}-{0–5}`, and `auto` for margin | rows, columns, elements, containers |
| `textalign` | `text-{bp}-start`, `-center`, `-end` | rows, columns, elements, containers |
| `float` | `float-{bp}-start`, `-end`, `-none` | elements |

A plugin puts a field in the *Responsive* section of each drawer's settings
panel, and some add a tool to the drawer. In a breakpoint view a change is
written for that breakpoint alone, and the field says what it inherits and from
where. In the all view it is written once, as the class with no breakpoint, and
replaces what the breakpoints said. While you edit, the canvas shows what the
classes mean in the view you are in; `getHtml` returns only the classes.

```javascript
$('#myGrid').gridEditor('setUtility', column, 'visibility', 'none', 'md');   // d-md-none
$('#myGrid').gridEditor('getUtility', column, 'visibility', 'lg');           // 'none', inherited
```

__`utilities`:__ Options for each plugin, under its name.

```javascript
$('#myGrid').gridEditor({
    utilities: {
        visibility: { drawer: false },   // no eye in the drawers, the field only
        order: { drawer: false },        // no arrows in the column drawers
        gutters: { scale: ['0', '.25rem', '.5rem', '1rem', '1.5rem', '3rem'] },  // if you changed $spacers
        spacing: { values: ['0', '2', '4'], scale: [/* the same */] },          // offer fewer steps
    },
});
```

See [example/utilities.html](example/utilities.html), and
[docs/plugins.md](docs/plugins.md#utility-plugins) for writing one.

### Sections

Bootstrap's `.container`, `.container-fluid` and `.container-{bp}` on the
canvas, each grouping rows at a width of its own. A plugin, since many pages
put the whole canvas in a `.container` already:

```html
<script src="grid-editor/dist/plugins/grideditor.sections.min.js"></script>
```

A container that is a child of the canvas is a section, and gets a drawer:
move, settings - with a *Width* field for the seven kinds of container - add
row and delete. The toolbar gets a *Section* button. Rows drag in and out of
sections, and sections drag along the canvas but not into a column. In a
breakpoint view each section is as wide as its container would be at that
breakpoint. They are called sections, not containers, because a container is
what the tabs, accordion, popup and card plugins make.

```javascript
$('#myGrid').gridEditor('createSection', { width: 'md', rows: [[6, 6]], appendTo: '#myGrid' });
```

__`sections`:__ `{ widths: ['fixed', 'sm', 'md', 'lg', 'xl', 'xxl', 'fluid'] }`, the widths the field offers.

### Copy and paste

A plugin:

```html
<script src="grid-editor/dist/plugins/grideditor.clipboard.min.js"></script>
```

Every row, column, section, text, container and element gets a *Copy* tool in its
drawer. While something is copied, a *Paste* tool shows wherever it can go, and
nowhere else:

| Copied | Pasted into |
| --- | --- |
| a row | a column, a section, or the canvas from the toolbar's paste button |
| a column | a row |
| a section | the canvas, from the toolbar's paste button |
| a container (tabs, accordion, popup, card) | a column |
| a text | a column |
| an element | a column |

The toolbar's paste button is the clipboard icon on the right, beside the
source and preview buttons, and shows only while a row or a section is copied.
A paste goes at the end of where it was pasted; the toolbar's button can also
be dragged to where the copy should land. Tabs and accordion items are not
copied on their own: copy their container.

What is copied is kept in `localStorage`, so it can be pasted in another
editor on the page, after a reload, or in another tab of the same site. A
browser that denies the page its storage keeps it in memory, for the page. An
editor that does not load the plugin a copy needs - a section without the
sections plugin, tabs without the tabs plugin - offers no paste for it.

The copy is what `getHtml` would give for that node. When it is pasted, any id
it carries that the page already has is renamed - `ge-tab-…` ids get new
generated ones, the host's own get a suffix, `hero` becoming `hero-2` - and
whatever inside the copy pointed at the old id (`data-bs-target`,
`data-bs-parent`, `href="#…"`, `aria-*`, a popup's trigger) points at the new
one. So the tabs of a copy open the copy's panes, not the original's.

A paste is an add like any other: `before-add-*` and `after-add-*` with
`source: 'paste'`, and canceling the first turns it away. A copy fires
`grideditor:after-copy`.

### Containers

Tabs, accordions, popups and cards. A tabs, accordion or popup container holds
panes; a card holds one region. Either way a region is an ordinary one: rows,
columns, content areas and elements nest inside it exactly as they do at the
top level.

Each type is a plugin, in a file of its own, and loading the file is what makes
it available:

```html
<script src="grid-editor/dist/jquery.grideditor.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.tabs.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.accordion.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.popup.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.card.min.js"></script>
```

The toolbar offers a button per loaded plugin. See [docs/plugins.md](docs/plugins.md)
for the contract, and for writing one of your own.

__`plugins`:__ Which of the loaded plugins to use, containers, features and utilities alike. Every one by default; name them to use fewer than the page loaded.

```javascript
$('#myGrid').gridEditor({ plugins: ['tabs', 'elements'] });
```

__`container_tools`, `tab_tools`, `accordion_tools`:__ Extra tools on the container drawer and on each pane's drawer, same shape as `row_tools`.

```javascript
var tabs = $('#myGrid').gridEditor('createContainer', 'tabs', {
    tabs: 2,
    labels: ['Overview', 'Details'],
    appendTo: $('#myGrid .column').first(),
});
$('#myGrid').gridEditor('addTab', tabs, { label: 'Third', activate: true });

$('#myGrid').gridEditor('createContainer', 'accordion', { items: 3, stay_open: true });
$('#myGrid').gridEditor('createContainer', 'popup', { title: 'Terms', trigger_label: 'Read them', size: 'lg' });
```

An accordion opens and closes from its headers while editing, and what you
leave open is what the authored page opens with. The editor answers the click
itself rather than letting Bootstrap's collapse run over the canvas, so
`stay_open` behaves the same in the editor as on the page.

A popup is a Bootstrap modal plus its trigger. While editing it is rendered
unfolded in place, so its body is an ordinary region and Bootstrap's modal JS
is never involved; `getHtml` gives you a closed modal that Bootstrap opens from
the trigger. Any node in the canvas carrying
`data-ge-popup-target="<popup id>"` is a trigger too — grid-editor leaves your
markup alone and writes Bootstrap's attributes onto it in the output.

See [example/containers.html](example/containers.html).

### Localization

__`locale`:__ The code of a locale in `$.fn.gridEditor.locales`. Default `'en'`.

__`locale_strings`:__ Overrides for individual keys, without a locale file.

```javascript
$('#myGrid').gridEditor({
    locale: 'es',
    locale_strings: { 'tool.move': 'Arrastrar' },
});
```

__`source_textarea`:__ Allows to set an already existing textarea as input for grid editor.

```javascript
$('#myGrid').gridEditor({
    source_textarea: 'textarea.myTextarea',
});
```

You will have write back the content to the textarea before saving, for example in this way:

```javascript
$('form.myForm').on('submit', function() {
    var html = $('#myGrid').gridEditor('getHtml');
    $('textarea.myTextarea').val(html);
});
```

### Rich text editor options

Grid editor comes with support for the following rich text editors (RTEs), each a plugin of its own to load after the editor:
* [TinyMCE](http://www.tinymce.com/) 6 - `dist/plugins/grideditor.tinymce.min.js` - [(example)](example/basic.html)
* [summernote](http://summernote.org/) 0.9 - `dist/plugins/grideditor.summernote.min.js` - [(example)](example/summernote.html)
* [CKEditor](http://ckeditor.com/) 4 - `dist/plugins/grideditor.ckeditor.min.js` - [(example)](example/ckeditor.html)

A text editor is chosen by `content_types`, not by the `plugins` setting: a page
that names its containers in `plugins` still has its editor. Summernote 0.9.1
calls `$.now()`, which jQuery 4 removed; its plugin gives it back, and only if
it is missing. [docs/plugins.md](docs/plugins.md#text-editor-plugins) says how
to write a plugin for another editor.

__`content_types`:__ Specify the RTE to use. Valid values: `['tinymce']`, `['summernote']`, `['ckeditor']`, or the name of a text editor plugin of your own. Default value: `['tinymce']`.

```javascript
$('#myGrid').gridEditor({
    content_types: ['summernote'],
});
```

__`ckeditor.config`:__ Specify ckeditor config, when using the `ckeditor` `content_types`.
See the [CKEditor documentation](http://docs.ckeditor.com/). 
Also check out the [ckeditor example](example/ckeditor.html).

```javascript
$('#myGrid').gridEditor({
    ckeditor: {
        config: { language: 'fr' }
    }
});
```

__`summernote.config`:__ Specify summernote config, when using the `summernote` `content_types`.
See the [summernote documentation](http://summernote.org/deep-dive/). 
Also check out the [summernote example](example/summernote.html).

```javascript
$('#myGrid').gridEditor({
    summernote: {
        config: { shortcuts: false }
    }
});
```

__`tinymce.config`:__ Specify tinyMCE config, when using the `tinymce` `content_types`.
See the [tinyMCE documentation](https://www.tiny.cloud/docs/tinymce/6/).
Also check out the [tinymce example](example/basic.html).

```javascript
$('#myGrid').gridEditor({
    tinymce: {
        config: { paste_as_text: true }
    }
});
```

Grid editor passes `promotion: false`, so tinyMCE's "Upgrade" badge does not
appear in the menubar of an inline editor sitting in someone's page. Pass
`promotion: true` in your own config to get it back.


Upgrading
---------

See [UPGRADING.md](UPGRADING.md) for what changes between major versions,
including 2.x to 3.x.

Building
--------

If you want to make your own changes to the source, see [BUILDING.md](BUILDING.md)


Contributing
--------
If you want to help out, please first read [CONTRIBUTING.md](CONTRIBUTING.md)


Attribution
-----------

Grid Editor was written by [Simon Epskamp](https://github.com/Friendly-Pixel) at
Frontwise, and lives at [Friendly-Pixel/grid-editor](https://github.com/Friendly-Pixel/grid-editor).
Everything from 3.x on is this fork; the MIT license, and the credit, are his.

It was heavily inspired by [Neokoenig's grid manager](https://github.com/neokoenig/jQuery-gridmanager)
