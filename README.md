Grid Editor
===========

Grid Editor is a visual javascript editor for the [bootstrap 5 grid system](https://getbootstrap.com/docs/5.3/layout/grid/), in plain DOM: no jQuery needed. You can create, drag, resize and delete rows and columns — sized in units, equal (`col`) or to their content (`col-auto`), or shared out by their row (`row-cols-*`) — indent them, group them in sections (`.container`), copy and paste them, and give each of bootstrap's six breakpoints its own layout — or edit them all at once, with a mouse or with a finger. Bootstrap's responsive utilities — display, flex, order, alignment, gutters, spacing, text alignment, sticky and float — are edited per breakpoint too, and any row, column, container or element can be given inline css, with Bootstrap's classes for it offered as chips. It also edits tabs, accordions, popups, carousels and cards, and any markup you mark as an element, and it tells your application about every change it makes.

This is a fork of [Friendly-Pixel/grid-editor](https://github.com/Friendly-Pixel/grid-editor)
by Simon Epskamp, carrying it on from 2.x. It is published as
`@themarioga/grid-editor`.

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
| [example/containers.html](example/containers.html) | Tabs, accordions, popups, carousels and cards, two levels deep | [live](https://themarioga.github.io/grid-editor/example/containers.html) |
| [example/elements.html](example/elements.html) | Element level controls, including an element with no visual output | [live](https://themarioga.github.io/grid-editor/example/elements.html) |
| [example/autocols.html](example/autocols.html) | Equal and auto columns, columns per row, and sections | [live](https://themarioga.github.io/grid-editor/example/autocols.html) |
| [example/utilities.html](example/utilities.html) | Bootstrap's responsive utilities, edited per breakpoint | [live](https://themarioga.github.io/grid-editor/example/utilities.html) |
| [example/locale.html](example/locale.html) | The interface in Spanish, with a language switcher | [live](https://themarioga.github.io/grid-editor/example/locale.html) |
| [example/ckeditor.html](example/ckeditor.html) | CKEditor instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/ckeditor.html) |
| [example/summernote.html](example/summernote.html) | Summernote instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/summernote.html) |
| [example/clipboard.html](example/clipboard.html) | Copy and paste, within an editor, between two, and between tabs | [live](https://themarioga.github.io/grid-editor/example/clipboard.html) |
| [example/wrap_content.html](example/wrap_content.html) | Non-bootstrap markup wrapped into the grid | [live](https://themarioga.github.io/grid-editor/example/wrap_content.html) |
| [example/autosave.html](example/autosave.html) | The autosave plugin: drafts kept as the user edits, offered back after a reload; import and export | [live](https://themarioga.github.io/grid-editor/example/autosave.html) |
| [example/adapter.html](example/adapter.html) | A page written for 6.x, with jQuery, running unchanged through the adapter | [live](https://themarioga.github.io/grid-editor/example/adapter.html) |

[example/angular](example/angular) is the editor in an Angular app, from the npm
package: an Angular CLI project, with a build step, unlike the pages above.

Installation
------------

* __Dependencies:__ Grid Editor depends on [SortableJS](https://sortablejs.github.io/Sortable/), Bootstrap Icons, and Bootstrap 5, so make sure you have included those in the page. It does not need jQuery.
    * If you want to use the tinyMCE integration, include tinyMCE 7 (7.9.3 or later) as well, and `dist/plugins/grideditor.tinymce.min.js` after the editor.
    * If you want to use the summernote integration, include summernote and `dist/plugins/grideditor.summernote.min.js`. Summernote needs jQuery itself, so that page loads jQuery too; nothing else does.
    * If you want to use the CKEditor integration... you get the point: CKEditor 5's browser build (`ckeditor5.umd.js` and `ckeditor5.css`) and `dist/plugins/grideditor.ckeditor.min.js`.
* From npm:

```
npm install @themarioga/grid-editor
```

* Or [download the latest version of Grid Editor](https://github.com/themarioga/grid-editor/archive/master.zip) and include it in your page: 

```html
<!-- Make sure SortableJS, bootstrap icons, and bootstrap 5 are included. TinyMCE is optional. -->
<link rel="stylesheet" type="text/css" href="grid-editor/dist/grideditor.min.css" />
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
<script src="grid-editor/dist/grideditor.min.js"></script>
<!-- The text editor you use, as a plugin -->
<script src="grid-editor/dist/plugins/grideditor.tinymce.min.js"></script>
```

Or, for a page that would rather load one file, the editor with SortableJS
inside it &mdash; one or the other, never both:

```html
<link rel="stylesheet" type="text/css" href="grid-editor/dist/grideditor.min.css" />
<script src="grid-editor/dist/grideditor.bundle.min.js"></script>
```

### As an ES module

An app built with a bundler - Angular, React, Vue, Vite - imports the editor
and the plugins it wants. A plugin registers as it is imported:

```javascript
import GridEditor from '@themarioga/grid-editor';
import '@themarioga/grid-editor/plugins/tabs';
import '@themarioga/grid-editor/plugins/tinymce';
import '@themarioga/grid-editor/locales/es';
import '@themarioga/grid-editor/css';
import Sortable from 'sortablejs';
import * as bootstrap from 'bootstrap';

// What a module app has as imports, not as window.Sortable and window.bootstrap
GridEditor.Sortable = Sortable;
GridEditor.bootstrap = bootstrap;

const ge = new GridEditor(element, { content_types: ['tinymce'] });
```

The module build imports nothing itself. Without `GridEditor.Sortable` or a
`window.Sortable`, dragging is off; without Bootstrap's javascript, a delete is
confirmed with the browser's `confirm()` and the modal settings panel opens
with a backdrop of the editor's own. Types for the public API come with the
package (`dist/grideditor.d.ts`).

[example/angular](example/angular) is a whole app that does this, with the
editor as an Angular component.

Load the classic script *or* the module build on a page, never both.

### A page written for 6.x

A page that uses the jQuery API of 6.x - `$(el).gridEditor(...)`, jQuery
events, jQuery objects in the payloads - keeps it by loading jQuery 4 and the
adapter after the editor, and the plugins after that:

```html
<script src="https://code.jquery.com/jquery-4.0.0.min.js"></script>
<script src="grid-editor/dist/grideditor.min.js"></script>
<script src="grid-editor/dist/grideditor.jquery.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.tabs.min.js"></script>
```

Plugins written for 6.x do not work with it, and throw as they register on
`$.fn.gridEditor`: [UPGRADING.md](UPGRADING.md) says how to port one.

Usage
-----
```javascript
var ge = new GridEditor('#myGrid', {
    new_row_layouts: [[12], [6,6], [9,3]],
});
// Call this to get the result after the user has done some editing:
var html = ge.getHtml();

// Or, for a page that only publishes the result and never edits it again:
var published = ge.getPlainHtml();
```

`getHtml` keeps a little of the editor's own marking: the `column` class, the
`div.ge-content` around each column's content, and the `ge-*` classes and
`data-ge-*` attributes that say which rich text editor a content area uses and
which parts are elements, tabs, accordions or popups. That marking is how the
editor reads its markup back, so **save `getHtml`** for anything that will be
edited again.

`getHtml` takes the canvas out of editing to read it and puts it back, which
closes a text being typed into and a settings panel that is open.
`getHtml({ keepEditing: true })` gives the same markup without the canvas
leaving editing - it is read on a copy - which is what something that reads
it as the user works, an autosave, wants. A plugin that cannot be read on a
copy (see [docs/plugins.md](docs/plugins.md#reading-on-a-copy)) makes it fall
back on `getHtml`, with a warning in the console.

`getPlainHtml` is the same markup with that marking taken off, and each
`div.ge-content` replaced by what it holds. Bootstrap's own classes and
attributes stay, so tabs, accordions and popups still work in a page that
never loads grid-editor. It is a one-way export: loaded back into the editor,
the rows, columns and text come back, but containers and elements are plain
markup and the content areas lose their rich text editor.

Methods
-------

```javascript
var ge = new GridEditor('#myGrid', options);   // or GridEditor.create('#myGrid', options)
ge.method(argument);

GridEditor.get('#myGrid');   // the editor on an element, or null
```

The element is an element or a selector, which takes the first element it
matches; one that matches nothing throws a `TypeError`. An element has one
editor at most: asked for a second, `new GridEditor` hands back the one it
has, with the options it was made with, and warns once.

| Method | Arguments | Returns | What it does |
| --- | --- | --- | --- |
| `getHtml` | `options?` | `String` | The clean html: no drawers, no editor classes, no inline styles. `{ keepEditing: true }` reads it without the canvas leaving editing |
| `getPlainHtml` | `options?` | `String` | `getHtml` without grid-editor's marking (`ge-*`, `column`, `data-ge-*`), for publishing. It cannot be edited again as it was. Takes the same `options` |
| `init` | — | `this` | Run the editing pass over the canvas again. Safe to call after you inject markup |
| `deinit` | — | `this` | Strip the editing furniture, leave the markup |
| `reset` | — | `this` | `deinit()` then `init()` |
| `destroy` | — | `this` | Deinit, drop the controls, unbind, forget the instance |
| `changeView` | `breakpoint` | `this` | `'xs'`…`'xxl'`, or `'all'` to edit every breakpoint at once, with one class |
| `getView` | — | `String` | The view the editor is in |
| `getActiveTarget` | — | `Element` | With `active_target`, the column or section the toolbar adds to, or `null` |
| `setActiveTarget` | `node` | `this` | Make a column or section - an element or a selector - the one the toolbar adds to, or `null` for none |
| `setLocale` | `code` | `this` | Switch language and re-render the controls |
| `createRow` | `layout?`, `options?` | `Element` | A row, optionally with columns: `createRow([8, 4])`, `createRow(['auto', 'equal'])`, `createRow({ row_cols: { xs: 1, md: 3 }, columns: 6 })` |
| `createColumn` | `size`, `options?` | `Element` | An empty column: units, `'equal'` or `'auto'`; no size into a row with row-cols takes the row's share. `options`: `offset`, `content` - a text of the first editor offered, or plain content with none |
| `createSection` | `options?` | `Element` | A section, with the sections plugin. `options`: `width` (`'fixed'`, `'fluid'` or a breakpoint), `rows` (layouts), and a placement |
| `createElement` | `content`, `options?` | `Element` | Host markup wrapped as an element. `options`: `type`, `label` |
| `createText` | `type?`, `options?` | `Element` | A content area for a text editor, the first one offered by default. `options`: `content`, and a placement. `null` if the editor is not loaded, or no text editor is |
| `createContainer` | `type`, `options?` | `Element` | `'tabs'`, `'accordion'`, `'popup'`, `'carousel'` or `'card'` |
| `addTab` | `container`, `options?` | `Element` | Appends a tab, returns its pane |
| `addAccordionItem` | `container`, `options?` | `Element` | Appends an item, returns its body |
| `addPane` | `container`, `options?` | `Element` | Appends a pane to a container of any type that has them - a tab, an item, a carousel slide, whose `options.interval` is its time in milliseconds - and returns it. `null`, and a warning, for a node that is not one |
| `getUtility` | `node`, `family`, `view?` | `String` | A utility plugin's value on a node in a view (the current one by default), or `null` |
| `setUtility` | `node`, `family`, `value`, `view?` | `Boolean` | Write it through the events; `null` is inherit. `false` if canceled or nothing changed |

The methods that do something hand back the editor, so they chain. After
`destroy()` every method is a no-op that says so once, but for `getHtml` and
`getPlainHtml`, which read the element as it is.

The `create*` methods hand back the element they made, or `null` when a handler
canceled the add. It comes back **detached**: place it and call `reset()`, or
pass a parent - an element or a selector - and let grid-editor do both.

```javascript
// place it yourself
var row = ge.createRow([8, 4]);
document.querySelector('#myGrid').appendChild(row);
ge.reset();

// or say where it goes: appendTo, prependTo, insertAfter, insertBefore
ge.createRow([8, 4], { appendTo: '#myGrid' });
```

Besides the methods, the editor has its canvas and a read-only copy of the
settings:

```javascript
ge.createRow([12], { appendTo: ge.canvas });
ge.settings.locale;   // 'en'
```

A html string written into the canvas - through the source view,
`source_textarea`, `createElement` or a paste - is parsed as `innerHTML`
parses: a `<script>` in it is kept in the markup and does not run in the
editor.

Events
------

Every operation is announced before and after it happens, as a DOM event on
the canvas - a `CustomEvent` with the payload as its `detail` - and as a
callback. A `before-*` can be canceled.

```javascript
ge.canvas.addEventListener('grideditor:before-delete', function(e) {
    if (e.detail.node.classList.contains('locked')) { e.preventDefault(); }
});

new GridEditor('#myGrid', {
    callbacks: {
        after_move: function(payload) { console.log(payload.from, payload.to); },
    },
});
```

The full catalogue, the payload and what canceling each operation does is in
[docs/events.md](docs/events.md).

Languages
---------

The interface ships in English and Spanish. English is built into the editor;
every other language is a file you load after it.

| Code | Language | File |
| --- | --- | --- |
| `en` | English | built in, and the fallback for every other locale |
| `es` | Spanish | `dist/locales/grideditor.es.js` |

```html
<script src="grid-editor/dist/grideditor.min.js"></script>
<script src="grid-editor/dist/locales/grideditor.es.js"></script>
<script>new GridEditor('#myGrid', { locale: 'es' });</script>
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
new GridEditor('#myGrid', {
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
for every size.

The settings button on a row, a column, a container, a tab, an accordion item
or an element opens a panel with two fields: the node's `id`, and its css
classes. The classes field shows what your markup put
there and nothing else — the grid classes, and everything else the editor
writes, are not yours to lose and are not shown.

__`row_classes`:__ Preset classes the user can toggle from that panel, as
buttons beside the two fields. Empty by default; the classes field covers the
general case, and this is for the handful a host wants one click away.

```javascript
new GridEditor('#myGrid', {
    row_classes: [{ label: 'Dark', cssClass: 'my-app-dark' }],
});
```

__`col_classes`:__ The same as `row_classes`, but for columns. `container_classes`, `pane_classes` and `element_classes` do the same for a container, for a tab or accordion item, and for an element.

__`row_tools`:__ Add extra tool buttons to the row toolbar.

```javascript
new GridEditor('#myGrid', {
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
new GridEditor('#myGrid', {
    drag_handle: 'drawer',
});
```

__`toolbar_drag`:__ Whether the toolbar's buttons are a palette: drag one onto the canvas and the row or container it stands for is created where you drop it, with a line showing where that is. `'auto'`, the default, turns it on when `drag_handle` is `'drawer'`, since that is the same idea applied to the toolbar; `true` and `false` decide it outright. Clicking a button still adds at the end either way.

```javascript
new GridEditor('#myGrid', {
    drag_handle: 'drawer',
    toolbar_drag: 'auto',
});
```

__`toolbar_overflow`:__ What the toolbar does with the add buttons that don't fit on its line. `'menu'`, the default, keeps it to one line: the last add buttons go behind a `⋯` button at its end, which opens them in a panel, and they come back onto the line when there is room again. They are the same buttons, so a click, a drag or `toolbarItems` work on them as on the line. `'wrap'` lets the toolbar wrap onto another line, as it did before 8.3.

```javascript
new GridEditor('#myGrid', {
    toolbar_overflow: 'wrap',
});
```

__`drawer_overflow`:__ The same for the drawers of rows, columns, containers, elements and sections. `'menu'`, the default, keeps a drawer's tools to one line: the ones that don't fit are hidden from the end, behind a `⋯` tool that unfolds the drawer to show them all, and they come back when there is room. They stay in their drawer, so whatever finds a tool there still does. A text's drawer and a pane's are left alone. `'wrap'` lets the drawers wrap onto more lines, as they did before 8.4.

```javascript
new GridEditor('#myGrid', {
    drawer_overflow: 'wrap',
});
```

__`toolbar_groups`:__ Whether the toolbar's add buttons are sorted into categories, with tabs at the start of the toolbar choosing which one shows. Default `false`. With `true` the core's categories are *Rows*, the add row buttons, *Content*, the containers and the sections, and *Elements*, the texts and the elements of `elements.types`; a plugin's buttons go in the category they name with `group` (see [docs/plugins.md](docs/plugins.md)), or in one of their own. The tab chosen is kept while the editor lives, through `setLocale` too. With a single category there is nothing to choose and no tabs. The buttons on the right - the view, source and preview, paste - are never grouped. The more button of `toolbar_overflow` holds what doesn't fit of the category shown; the tabs themselves never go behind it, so with a great many categories they can run out of room.

```javascript
new GridEditor('#myGrid', {
    toolbar_groups: true,
});
```

__`active_target`:__ Whether a click in a column or a section makes it where the toolbar's buttons add. Default `false`, and the toolbar adds at the end of the canvas. With `true`, the column or section clicked last - marked with a dashed outline - gets what a button makes at its end, as if the button had been dropped there: a text or a container goes into a column as it is, and into a section in a row of its own; a row goes into a column as a nested row; a section, which only the canvas takes, goes to the canvas just after the block the target is in. The toolbar's paste button pastes there too. Escape, a click in the canvas on no column or section, a click again on the target's own background or drawer (not on a tool or on what it holds), or deleting the target clears it, and the toolbar adds at the end of the canvas again; dragging a button still drops it where it is let go.

```javascript
const ge = new GridEditor('#myGrid', { active_target: true });
ge.canvas.addEventListener('grideditor:target-change', function(e) {
    console.log('the toolbar adds to', e.detail.target || 'the end of the canvas');
});
```

__`custom_filter`:__ Allows the execution of a custom function before initialization and after de-initialization. Accepts a functions or a function name as string.
Gives the `canvas` element and `isInit` (true/false) as parameter. `getHtml({ keepEditing: true })` runs it too, with `isInit` false, on a copy of the canvas rather than the canvas: work on the element it is given, not on one you kept.

```javascript
new GridEditor('#myGrid', {
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
new GridEditor('#myGrid', {
    'custom_filter': function(canvas, isInit) {
        //...
    },
});
```

__`valid_col_sizes`:__ The column sizes the +/- buttons step through, and that the add column picker and the width field offer. Default `[1, 2, … 12, 'equal', 'auto']`; leave `'equal'` and `'auto'` out and they are not offered, though a column that has one still shows it.

```javascript
new GridEditor('#myGrid', {
    'valid_col_sizes': [2, 5, 8, 10],
});
```

__`valid_col_offsets`:__ The same, for the indent buttons. Default `[0, 1, … 11]`.

__`indent`:__ The indent tools in a column's drawer. `indent: { tools: false }`
takes them out; the offsets the markup has are kept, and
`createColumn(size, { offset })` still indents. Default `{ tools: true }`.

__`add_column`:__ What the add column tool in a row's drawer does. A click adds a column of `size`; holding the tool for `delay` milliseconds — with the pointer or with a finger — offers the widths in `valid_col_sizes` instead, marking the ones that no longer fit the row. Defaults:

```javascript
new GridEditor('#myGrid', {
    add_column: {
        size: 12,      // what a click adds
        picker: true,  // false turns the hold gesture off
        delay: 600,
    },
});
```

__`callbacks`:__ A `before_*`/`after_*` function per operation, the same notifications as the events. Returning `false` from a `before_*` cancels it. See [docs/events.md](docs/events.md).

```javascript
new GridEditor('#myGrid', {
    callbacks: {
        before_delete: function(payload) { return !payload.node.classList.contains('locked'); },
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
| `'inline'` | Unfolded in the drawer itself |

Each is titled after its node ("Column settings"), the node is outlined while its settings are open, and Escape closes them. The editor opens and places them itself, with Bootstrap's markup and css: a page needs neither Popper nor Bootstrap's javascript, and the modal is Bootstrap's own when Bootstrap is there. [example/utilities.html](example/utilities.html) switches between the four.

```javascript
new GridEditor('#myGrid', { settings_panel: 'popover' });
```

__`confirm_delete`:__ Whether to ask before deleting a row, column, element or container. Default `true`. The question is asked in a Bootstrap modal the editor builds outside your canvas, in the interface language; a page that loaded Bootstrap's css but not its javascript gets the browser's own confirm instead. Set it to `false` if you cancel `before-delete` and ask in your own way.

__`drag`:__ How a drag behaves, wherever the editor drags something. Named for the gesture rather than for the library underneath, so it survives a change of library. Every gesture works from a touchscreen, which is what `touch_delay` is for: a touch drag that started instantly would take the page's scrolling with it, so a finger has to rest for a moment before it moves anything. Setting `delay` makes both gestures wait that long.

```javascript
new GridEditor('#myGrid', {
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

__`layout_modes`:__ Which views the toolbar dropdown offers. Default `['all', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl']`. Offer fewer for a simpler dropdown:

```javascript
new GridEditor('#myGrid', {
    layout_modes: ['all', 'lg', 'sm', 'xs'],
});
```

__`default_view`:__ The view the editor starts in. Default `'all'`, which writes one class for every breakpoint at once — what a layout that needs no per-device tuning wants.

__`resize`:__ Resizing a column: by dragging its edge, and with the
narrower and wider tools (− +) in its drawer. Defaults:

```javascript
new GridEditor('#myGrid', {
    resize: {
        enabled: true,     // the handle on the edge; false leaves the − + tools only
        tools: true,       // the − + tools; false leaves the handle only
        handles: 'e',      // 'w' for a right to left page, 'e, w' for both
        balance: 'next',   // the following column absorbs the change; false lets the row wrap
    },
});
```


### Text

A column's text is a *text block*: a content area, the text editor that edits
it, and a drawer of its own - move, which editor, settings, the host's
`text_tools`, delete - like any other block. It drags between columns, the
clipboard copies it, and spacing, text alignment and display apply to it.
The markup does not change: the drawer sits beside the content area in a
wrapper that only exists while editing, because inside it the text editor would
take it for text. It sits over the text's top right corner and takes no room,
showing while the pointer is over the text, while the text is being edited or
holds the focus, and while its settings are open. While the text is being
edited it stays faint, not to hide the end of the line being typed, until the
pointer is on the drawer itself.

The toolbar has a *Text* button, one per editor when `content_types` offers
several (*Text (tinyMCE)*, *Text (CKEditor)*...). The button adds a row with
the text in it, or, dragged into a column, puts the text where it is dropped.

```javascript
ge.createText({ content: '<p>Hello</p>', appendTo: '#myColumn' });
```

A text whose editor's plugin is not loaded is still a block, to move and
delete, and its drawer says it cannot be edited.

What the editor finds in a column that is not the grid's - loose markup, or a
page that had no row at all - is the host's *plain content*: a content area
with no text editor's type on it. It moves and deletes like any block, is
edited in the source (the toolbar's code button, or the codemirror-inline
plugin's </> tool), and nothing in the editor makes a new one. With a text editor loaded, a click makes it a text of that
editor - of the one chosen, when there are several - through the
`before-convert` and `after-convert` events. New columns start empty, and
`createColumn(size, { content })` holds its content as a text of the first
editor offered, or as plain content with none.

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
new GridEditor('#myGrid', {
    elements: {
        enabled: 'auto',                 // on when the page has any; true or false to decide yourself
        selector: '[data-ge-element]',   // what counts as an element
        auto: false,                     // true treats every loose node of a column as one
        types: [],                       // the elements the toolbar offers, see below
    },
});
```

__`elements.types`:__ The elements the toolbar offers, a button each, in this order. A click makes one in a row and column of its own at the end of the canvas - or at the end of the active target, with `active_target` - and a drag drops it in the column it lands in, as a text or a container. Declaring a type turns `enabled: 'auto'` on, so the buttons are there on a page with no elements yet; `enabled: false` takes them away too.

| Field | | |
| --- | --- | --- |
| `type` | required | what it is: its `data-ge-element` |
| `html` | required | its markup: html, or a function called for each one made, which returns html or a node |
| `label` / `labelKey` | | the button's label, as it is or as a locale key, which wins and follows `setLocale`. Without either, the `type` |
| `iconClass` | | the button shows the icon alone, with the label as its title |
| `group` | | its `toolbar_groups` category. Default `elements` |

What a button makes is the html's root, marked the way you mark your own elements - `data-ge-element`, and `data-ge-label` with the label unless the html has one - so `getHtml` gives it back as you would have written it. Html with more than one root, or none, is wrapped in a `div`. A `<script>` in html given as a string does not run. A type with no `type` or no `html` is left off the toolbar, and one whose function throws or gives nothing adds nothing; both with a warning in the console, as is a type whose markup does not match your `elements.selector`.

```javascript
new GridEditor('#myGrid', {
    elements: {
        types: [
            { type: 'quote', label: 'Pull quote', iconClass: 'bi bi-quote',
              html: '<blockquote class="my-quote"><p>Quote</p></blockquote>' },
            { type: 'figure', labelKey: 'element.figure', group: 'media',
              html: function() { return '<figure id="fig-' + Date.now() + '"><img src="…"></figure>'; } },
        ],
    },
});
```

__`element_tools`:__ Extra tools on every element drawer, same shape as `row_tools`.

See [example/elements.html](example/elements.html), which also shows the
pattern for an element with no visual output of its own.

### Inline style

Inline css for rows, columns, containers, panes, elements and sections, and
Bootstrap's classes for it. A plugin:

```html
<script src="grid-editor/dist/plugins/grideditor.inline-style.min.js"></script>   <!-- after grideditor.elements -->
```

Each of those nodes gets a *Style* accordion in its settings panel, between
its id and classes and the *Responsive* section. One section is open at a
time, and the one you opened last is open on the next node too.

| Section | Inline fields | Per breakpoint |
| --- | --- | --- |
| Size | `width`, `height`, `min-*` and `max-*` (a column: `min-*` and `max-*` only, its width is the grid's) | |
| Spacing | `margin-*` and `padding-*`, by side | padding and margin, `{p,m}{,x,y,t,b,s,e}-{bp}-{0–5}` |
| Border | width, style, color, radius, and a shadow builder | |
| Background | color, image, size, position, repeat | |
| Text | color, size, alignment, and a text shadow builder | `text-{bp}-start`, `-center`, `-end` |
| Typography | family, weight, style, line height, letter spacing, transform, decoration | |
| Display | display, opacity, overflow, visibility | display, `d-{bp}-*` from `none` to `inline-flex`, with the eye in the drawer that hides and shows |
| Flex | | direction, wrap, `justify-content-{bp}-*`, `align-items-{bp}-*`, `align-content-{bp}-*`; on anything but a row the gaps, `gap-{bp}-{0–5}`, `row-gap-*`, `column-gap-*`, and fill, grow and shrink |
| Position | position, `top`, `right`, `bottom`, `left` (not on a column), `z-index` | sticky, `sticky-{bp}-top` / `-bottom`; float, `float-{bp}-*`, on an element |
| Custom css | whatever no field stands for, as text | |

What you type goes to the node's own `style`, through the browser: a value it
does not take is marked and not written, and whatever the host wrote that you
do not edit is kept, `!important` included. The style attribute is the same at
every size, and in a breakpoint view the accordion says so; the per breakpoint
fields are Bootstrap's responsive classes, and edit the view you are in.
A text gets only Text and Display, with their per breakpoint fields: its
editor owns what is inside it.

Every section but Spacing and Custom css also offers Bootstrap's classes for
what it styles - `rounded-3`, `shadow-sm`, `bg-primary`, `bg-primary-subtle`,
`text-bg-dark`, `bg-opacity-50`, `fs-4`, `fw-bold`, `vstack`, `fixed-top`,
and on an element `img-fluid` and `object-fit-cover`… - as chips. A chip puts its class in the
classes field, and pressing it again takes it off; chips that are
alternatives, like `rounded-2` and `rounded-pill`, take each other off.
Bootstrap's utilities are `!important`, so a field whose property a class on
the node also sets says which class takes priority.

With `settings_panel: 'popover'` or `'inline'` the panel has a *Style* button
instead, which opens the accordion in a dialog.

__`inline_style`:__ Every section, unless you say otherwise.

```javascript
new GridEditor('#myGrid', {
    inline_style: {
        sections: {
            position: false,                                                  // no Position section
            border: { properties: ['border-width', 'border-color'], catalog: false },  // two fields, no chips
        },
        spacing: { values: ['0', '2', '4'], scale: [/* if you changed $spacers */] },
        visibility: { drawer: false },   // no eye in the drawers, the display field only
    },
});
```

The sections are `size`, `spacing`, `border`, `background`, `text`,
`typography`, `display`, `flex`, `position` and `custom`. `properties` chooses and
orders a section's inline fields; the per breakpoint ones stay while the
section does. What a section you left out or narrowed would have shown is in
Custom css.

Sanitizing what `getHtml` returns is the page's business, style attributes
included.

A node that is flex or grid in the view you are in - a column with `d-flex`,
a row with `flex-nowrap` - has its drawer on top, out of the flow, so the
canvas lays out its content as the page will.

See [example/inline-style.html](example/inline-style.html).

### Responsive utilities

Bootstrap's responsive utility classes, edited per breakpoint. The grid's are
plugins of their own; the ones that style a node are the inline-style plugin's, above.

```html
<script src="grid-editor/dist/plugins/grideditor.order.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.alignment.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.gutters.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.inline-style.min.js"></script>
```

| Plugin | Classes | On |
| --- | --- | --- |
| `order` | `order-{bp}-{first,0–5,last}` | columns |
| `alignment` | `align-self-{bp}-*` | columns |
| `gutters` | `g-{bp}-{0–5}`, `gx-{bp}-*`, `gy-{bp}-*` | rows |
| `inline-style` | display, flex (a row's `justify-content-*` and `align-items-*` among it), spacing, text alignment, sticky and float; see [Inline style](#inline-style) | rows, columns, elements, containers, texts |

A plugin puts a field in the *Responsive* section of each drawer's settings
panel - or, for the inline-style plugin, in its section of the *Style* accordion -
and some add a tool to the drawer. In a breakpoint view a change is
written for that breakpoint alone, and the field says what it inherits and from
where. In the all view it is written once, as the class with no breakpoint, and
replaces what the breakpoints said. While you edit, the canvas shows what the
classes mean in the view you are in; `getHtml` returns only the classes.

```javascript
ge.setUtility(column, 'display', 'none', 'md');   // d-md-none
ge.getUtility(column, 'display', 'lg');           // 'none', inherited
```

__`utilities`:__ Options for each plugin, under its name.

```javascript
new GridEditor('#myGrid', {
    utilities: {
        order: { drawer: false },        // no arrows in the column drawers
        gutters: { scale: ['0', '.25rem', '.5rem', '1rem', '1.5rem', '3rem'] },  // if you changed $spacers
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
ge.createSection({ width: 'md', rows: [[6, 6]], appendTo: '#myGrid' });
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

### Autosave

A plugin:

```html
<script src="grid-editor/dist/plugins/grideditor.autosave.min.js"></script>
```

What is being edited is kept in the browser's storage as it changes: a second
after the last change, and when the page is left or reloaded. It is read with
`getHtml({ keepEditing: true })`, so a text being typed into stays open, with
its cursor. When an editor starts and a draft of the same html is saved, the
editor's confirm modal asks whether to restore it; *Discard*, or closing the
modal, takes the draft away.

```javascript
new GridEditor('#myGrid', {
    autosave: {
        enabled: true,        // saving from the start; the methods turn it on and off
        storage: 'local',     // or 'session'
        key: null,            // where the draft is kept: one per document, see below
        delay: 1000,          // milliseconds after the last change
        maxAge: null,         // milliseconds a draft is offered for; null for ever
    },
});
```

A draft remembers the html its editor started from, and is only offered to an
editor that starts from the same html. A page that loads one document after
another into the editor is not offered one document's draft over another, but
with one key, editing the second overwrites the first's draft. Give each
document a key of its own - its file name, its id - and each keeps its draft:

```javascript
new GridEditor('#myGrid', { autosave: { key: 'page-' + pageId } });
```

The default key is `grideditor.autosave:` with the page's path and the canvas's
id. Two editors on a page with the same key would overwrite each other's
drafts, so the second saves nothing and says so in the console.

| Method | Returns | What it does |
| --- | --- | --- |
| `enableAutosave()` | `Boolean` | Starts saving, from what there is now |
| `disableAutosave()` | `Boolean` | Stops saving; the draft is kept |
| `saveDraft()` | `Boolean` | Saves now, if the html changed, even when disabled; `true` when it wrote |
| `getDraft()` | `Object` | `{ html, savedAt }`, or `null` |
| `clearDraft()` | `Boolean` | Takes the draft away, as a page does once it has saved to its server. A save still waiting is dropped, and what there is now is where a new draft starts from: only a change after it saves again |

The methods are there only when the plugin is loaded, and answer `false` or
`null` when the browser gives the page no storage - a private window may not -
in which case nothing is saved and the console says so.

| Event | Payload | Fires |
| --- | --- | --- |
| `grideditor:after-autosave` | `canvas`, `html`, `savedAt`, `source` (`change`, `pagehide`, `api` or `destroy`) | after a draft is written |
| `grideditor:after-restore-draft` | `canvas`, `html`, `savedAt` | after the user chose to restore one |
| `grideditor:autosave-error` | `canvas`, `error` | when the storage refused a draft - it is full; the next change tries again |

A draft in `localStorage` outlives the browser being closed, on a computer
someone else may use next: `storage: 'session'` keeps it for the tab only. A
draft is offered only to an editor that starts from the same html *as this
version of grid-editor reads it*, so one saved before an upgrade that changes
what `getHtml` gives is not offered after it. Drafts are a safety net, not a
place to keep work.

### Containers

Tabs, accordions, popups, carousels and cards. A tabs, accordion, popup or
carousel container holds panes; a card holds one region. Either way a region is an ordinary one: rows,
columns, content areas and elements nest inside it exactly as they do at the
top level.

Each type is a plugin, in a file of its own, and loading the file is what makes
it available:

```html
<script src="grid-editor/dist/grideditor.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.tabs.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.accordion.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.popup.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.carousel.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.card.min.js"></script>
```

The toolbar offers a button per loaded plugin. See [docs/plugins.md](docs/plugins.md)
for the contract, and for writing one of your own.

__`plugins`:__ Which of the loaded plugins to use, containers, features and utilities alike. Every one by default; name them to use fewer than the page loaded.

```javascript
new GridEditor('#myGrid', { plugins: ['tabs', 'elements'] });
```

__`tabs`:__ The variant of the tabs containers made new, from the toolbar or with `createContainer`: `variant` (`'tabs'`, `'pills'` or `'underline'`), `width` (`'natural'`, `'fill'` or `'justified'`), `align` (`'start'`, `'center'` or `'end'`, with the natural width only) and `vertical` (`false`, `true`, or a breakpoint to go vertical from, `'md'`). Every tabs container also has a *Tabs* section in its settings panel, which changes its own. It is all Bootstrap's classes on the strip and the container, so a page's markup says it too - pills written by hand are tabs.

```javascript
new GridEditor('#myGrid', { tabs: { variant: 'pills', vertical: 'md' } });   // a side menu from tablet up
ge.createContainer('tabs', { variant: 'underline', width: 'fill' });          // an option given wins
```

__`carousel`:__ The options of the carousels made new, from the toolbar or with `createContainer`, as Bootstrap has them: `controls` and `indicators` (the arrows and the dots, both `true`), `fade`, `dark` (`data-bs-theme="dark"`), `ride` (`false`, `'carousel'` to start on load, or `'true'` to start after the first interaction), `interval` (milliseconds, 1000 or more, `null` for Bootstrap's own), `pause`, `wrap`, `keyboard` and `touch` (all `true`), and `slides` (how many, 2). A value a key does not take is warned about and its default used. Every carousel also has a *Carousel* section in its settings panel, which changes its own, and every slide an interval in its own. It is all Bootstrap's classes and attributes, so a page's markup says it too.

```javascript
new GridEditor('#myGrid', { carousel: { fade: true, ride: 'carousel', interval: 4000 } });
ge.createContainer('carousel', { slides: 3, controls: false });   // an option given wins
ge.addPane(carousel, { interval: 8000 });                         // a slide that stays for 8 seconds
```

__`container_tools`, `tab_tools`, `accordion_tools`, `carousel_tools`:__ Extra tools on the container drawer and on each pane's drawer, same shape as `row_tools`.

```javascript
var tabs = ge.createContainer('tabs', {
    tabs: 2,
    labels: ['Overview', 'Details'],
    appendTo: $('#myGrid .column').first(),
});
ge.addTab(tabs, { label: 'Third', activate: true });

ge.createContainer('accordion', { items: 3, stay_open: true });
ge.createContainer('popup', { title: 'Terms', trigger_label: 'Read them', size: 'lg' });
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

A carousel shows one slide at a time while editing, as it does on the page.
The container's drawer has the arrows and says which slide it is on, and
Bootstrap's own arrows and indicators are drawn but do not answer: the editor
puts the attributes Bootstrap's javascript acts on aside, so an autoplay never
starts over the canvas. Each slide's drawer moves it a place back or on. What
`getHtml` gives starts at the first slide, whichever one the canvas was on.

See [example/containers.html](example/containers.html).

### Localization

__`locale`:__ The code of a locale in `$.fn.gridEditor.locales`. Default `'en'`.

__`locale_strings`:__ Overrides for individual keys, without a locale file.

```javascript
new GridEditor('#myGrid', {
    locale: 'es',
    locale_strings: { 'tool.move': 'Arrastrar' },
});
```

__`source_textarea`:__ Allows to set an already existing textarea as input for grid editor: an element, or a selector.

```javascript
new GridEditor('#myGrid', {
    source_textarea: 'textarea.myTextarea',
});
```

You will have write back the content to the textarea before saving, for example in this way:

```javascript
document.querySelector('form.myForm').addEventListener('submit', function() {
    document.querySelector('textarea.myTextarea').value = ge.getHtml();
});
```

### Source view

The toolbar's <i>code</i> button turns the canvas into its html, to edit by
hand, and back again with what was written.

__`edit_source`:__ Whether the toolbar has that button. Default value: `true`.

```javascript
new GridEditor('#myGrid', {
    edit_source: false,
});
```

The html is edited in a plain textarea. With the codemirror plugin it is
edited in [CodeMirror 5](https://codemirror.net/5/), highlighted and with line
numbers - load CodeMirror, its `htmlmixed` mode and the modes it is made of,
then the plugin ([example](example/codemirror.html)):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/lib/codemirror.min.css">
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/lib/codemirror.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/mode/xml/xml.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/mode/javascript/javascript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/mode/css/css.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/codemirror@5.65.21/mode/htmlmixed/htmlmixed.min.js"></script>
<script src="grid-editor/dist/plugins/grideditor.codemirror.min.js"></script>
```

__`codemirror.config`:__ Anything `CodeMirror.fromTextArea` takes, over the
plugin's defaults: `mode: 'htmlmixed'`, `lineNumbers`, `lineWrapping`, a tab
of 2.

```javascript
new GridEditor('#myGrid', {
    codemirror: { config: { theme: 'monokai' } },
});
```

CodeMirror 5 rather than 6: 6 comes as ES modules, for a bundler, where 5
loads from a script tag like the rest of the page. Without CodeMirror loaded
the source view is the textarea, and the console says why.

The codemirror-inline plugin edits one block's html instead of the whole
canvas's: a </> tool in the drawer of every row, column, text, element,
section and container, and of the host's plain content, opens the block's
html - the block itself and everything in it - in CodeMirror where the block
was, and *Apply* puts what was written in its place, through the
`before-edit-html` and `after-edit-html` events. A tab or an accordion item
has no tool of its own: its html is its container's. It uses CodeMirror the
same way, `codemirror.config` included, and a textarea without it.

```html
<script src="grid-editor/dist/plugins/grideditor.codemirror-inline.min.js"></script>
```

### Rich text editor options

Grid editor comes with support for the following rich text editors (RTEs), each a plugin of its own to load after the editor:
* [TinyMCE](http://www.tinymce.com/) 7 - `dist/plugins/grideditor.tinymce.min.js` - [(example)](example/basic.html)
* [summernote](http://summernote.org/) 0.9 - `dist/plugins/grideditor.summernote.min.js` - [(example)](example/summernote.html)
* [CKEditor](http://ckeditor.com/) 5 - `dist/plugins/grideditor.ckeditor.min.js` - [(example)](example/ckeditor.html)

A text editor is chosen by `content_types`, not by the `plugins` setting: a page
that names its containers in `plugins` still has its editor. Summernote 0.9.1
calls `$.now()`, which jQuery 4 removed; its plugin gives it back, and only if
it is missing. Another editor is a plugin of your own:
[docs/plugins.md](docs/plugins.md#text) says how, and
[example/custom_editor.html](example/custom_editor.html) is one.

__`content_types`:__ Specify the RTEs to offer, in order. Valid values: any of `'tinymce'`, `'summernote'`, `'ckeditor'` whose plugin is loaded. Default value: every text editor loaded, in the order the page loaded them.

```javascript
new GridEditor('#myGrid', {
    content_types: ['summernote'],
});
```

__`ckeditor.config`:__ Specify CKEditor 5 config, when using the `ckeditor` `content_types`:
anything `InlineEditor.create` takes. See the [CKEditor documentation](https://ckeditor.com/docs/ckeditor5/latest/).
Also check out the [ckeditor example](example/ckeditor.html).

Load CKEditor 5's browser build, which puts it on the page as `window.CKEDITOR`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ckeditor5@48.5.2/dist/browser/ckeditor5.css">
<script src="https://cdn.jsdelivr.net/npm/ckeditor5@48.5.2/dist/browser/ckeditor5.umd.js"></script>
```

CKEditor 5 does not start without a `licenseKey`: pass `'GPL'` to accept its
GPL-2.0-or-later licence, or your own key if you have a commercial licence.
Grid editor does not pass one for you, since the licence is yours to choose,
and logs `CKEditor could not start: license-key-missing` when there is none.
CKEditor's cloud CDN is for commercial keys: with `'GPL'`, load it from npm,
as above, or host it yourself.

CKEditor 5 has no plugins of its own, so grid editor gives it a set - the basic
styles, headings h1 to h6, links, lists, block quotes, tables and horizontal
lines - and a toolbar for them. `plugins` and `toolbar` in your config replace
those; a plugin can be given by its name on `window.CKEDITOR`. Markup that no
loaded plugin knows is dropped as the editor opens, a class included: add
`'GeneralHtmlSupport'` and its `htmlSupport` option to keep it.

```javascript
new GridEditor('#myGrid', {
    ckeditor: {
        config: {
            licenseKey: 'GPL',
            plugins: ['Essentials', 'Paragraph', 'Heading', 'Bold', 'Italic', 'Link', 'GeneralHtmlSupport'],
            toolbar: ['heading', 'bold', 'italic', 'link'],
            htmlSupport: { allow: [{ name: /^(p|h[1-6]|a|strong|i)$/, classes: true }] },
        }
    }
});
```

__`summernote.config`:__ Specify summernote config, when using the `summernote` `content_types`.
See the [summernote documentation](http://summernote.org/deep-dive/). 
Also check out the [summernote example](example/summernote.html).

```javascript
new GridEditor('#myGrid', {
    summernote: {
        config: { shortcuts: false }
    }
});
```

__`tinymce.config`:__ Specify tinyMCE config, when using the `tinymce` `content_types`.
See the [tinyMCE documentation](https://www.tiny.cloud/docs/tinymce/7/).
Also check out the [tinymce example](example/basic.html).

```javascript
new GridEditor('#myGrid', {
    tinymce: {
        config: { paste_as_text: true }
    }
});
```

Grid editor passes `promotion: false`, so tinyMCE's "Upgrade" badge does not
appear in the menubar of an inline editor sitting in someone's page. Pass
`promotion: true` in your own config to get it back.

tinyMCE 7 is licensed GPL-2.0-or-later, and asks for a `license_key`: pass
`license_key: 'gpl'` to accept the GPL, or your own key if you have a
commercial licence. Without one it runs in evaluation mode and says so in the
console. Grid editor does not pass one for you, since the licence is yours to
choose.

```javascript
new GridEditor('#myGrid', {
    tinymce: {
        config: { license_key: 'gpl' }
    }
});
```

Use 7.9.3 or later: every tinyMCE 6 release, and 7.x before 7.9.3, has known
cross-site scripting vulnerabilities. The integration still works with
tinyMCE 6, but the examples and tests run on 7.9.3.


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
