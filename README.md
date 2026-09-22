Grid Editor
===========

Grid Editor is a visual javascript editor for the [bootstrap 5 grid system](https://getbootstrap.com/docs/5.3/layout/grid/), written as a [jQuery](http://jquery.com/) plugin. You can create, drag, resize and delete rows and columns, indent them, and give each of bootstrap's six breakpoints its own layout — or edit them all at once, with a mouse or with a finger. It also edits tabs, accordions, popups and cards, and any markup you mark as an element, and it tells your application about every change it makes.

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
| [example/containers.html](example/containers.html) | Tabs, accordions, popups and cards, two levels deep | [live](https://themarioga.github.io/grid-editor/example/containers.html) |
| [example/elements.html](example/elements.html) | Element level controls, including an element with no visual output | [live](https://themarioga.github.io/grid-editor/example/elements.html) |
| [example/utilities.html](example/utilities.html) | Bootstrap's responsive utilities, edited per breakpoint | [live](https://themarioga.github.io/grid-editor/example/utilities.html) |
| [example/locale.html](example/locale.html) | The interface in Spanish, with a language switcher | [live](https://themarioga.github.io/grid-editor/example/locale.html) |
| [example/ckeditor.html](example/ckeditor.html) | CKEditor instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/ckeditor.html) |
| [example/summernote.html](example/summernote.html) | Summernote instead of tinyMCE | [live](https://themarioga.github.io/grid-editor/example/summernote.html) |
| [example/wrap_content.html](example/wrap_content.html) | Non-bootstrap markup wrapped into the grid | [live](https://themarioga.github.io/grid-editor/example/wrap_content.html) |
| [example/autosave.html](example/autosave.html) | Saving the html as the user edits | [live](https://themarioga.github.io/grid-editor/example/autosave.html) |

Installation
------------

* __Dependencies:__ Grid Editor depends on jQuery, [SortableJS](https://sortablejs.github.io/Sortable/), Bootstrap Icons, and Bootstrap 5, so make sure you have included those in the page. 
    * If you want to use the tinyMCE integration, include tinyMCE 6 as well. The tinyMCE jQuery plugin is no longer needed, and no longer exists as of tinyMCE 6.
    * If you want to use the summernote integration, include summernote as well.
    * If you want to use the CKEditor integration... you get the point.
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
```

Methods
-------

```javascript
$('#myGrid').gridEditor('method', argument);
```

| Method | Arguments | Returns | What it does |
| --- | --- | --- | --- |
| `getHtml` | — | `String` | The clean html: no drawers, no editor classes, no inline styles |
| `init` | — | `this` | Run the editing pass over the canvas again. Safe to call after you inject markup |
| `deinit` | — | `this` | Strip the editing furniture, leave the markup |
| `reset` | — | `this` | `deinit()` then `init()` |
| `destroy` | — | `this` | Deinit, drop the controls, unbind, forget the instance |
| `remove` | — | `this` | Deprecated alias of `destroy` |
| `changeView` | `breakpoint` | `this` | `'xs'`…`'xxl'`, or `'all'` to edit every breakpoint at once |
| `getView` | — | `String` | The view the editor is in |
| `setLocale` | `code` | `this` | Switch language and re-render the controls |
| `createRow` | `layout?`, `options?` | `jQuery` | A row, optionally with columns: `createRow([8, 4])` |
| `createColumn` | `size`, `options?` | `jQuery` | A column. `options`: `offset`, `content` |
| `createElement` | `content`, `options?` | `jQuery` | Host markup wrapped as an element. `options`: `type`, `label` |
| `createContainer` | `type`, `options?` | `jQuery` | `'tabs'`, `'accordion'` or `'popup'` |
| `addTab` | `container`, `options?` | `jQuery` | Appends a tab, returns its pane |
| `addAccordionItem` | `container`, `options?` | `jQuery` | Appends an item, returns its body |
| `getUtility` | `node`, `family`, `view?` | `String` | A utility plugin's value on a node in a view (the current one by default), or `null` |
| `setUtility` | `node`, `family`, `value`, `view?` | `Boolean` | Write it through the events; `null` is inherit. `false` if canceled or nothing changed |

A method called on an element with no editor on it is a no-op that returns the
set, so host code does not have to check first. `getHtml` is the exception: it
returns the element's html either way.

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

__`new_row_layouts`:__ Set the column layouts that appear in the "new row" buttons at the top of the editor.

```javascript
$('#myGrid').gridEditor({
    new_row_layouts: [[12], [6,6], [9,3]],
});
```

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

__`valid_col_sizes`:__ Specify the column widths that can be selected using the +/- buttons

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

__`default_view`:__ The view the editor starts in. Default `'all'`, which writes every breakpoint at once — what a layout that needs no per-device tuning wants.

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


### Elements

An element is a node inside a content area that the editor treats as one
movable, deletable thing instead of as rich text. It is a plugin, like the
containers:

```html
<script src="grid-editor/dist/plugins/grideditor.elements.min.js"></script>
```

You mark the elements themselves:

```html
<div class="ge-content">
  <blockquote data-ge-element="quote" data-ge-label="Pull quote">…your markup…</blockquote>
</div>
```

__`elements`:__ Defaults:

```javascript
$('#myGrid').gridEditor({
    elements: {
        enabled: 'auto',                 // on when the page has any; true or false to decide yourself
        selector: '[data-ge-element]',   // what counts as an element
        auto: false,                     // true treats every child of a content area as one
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
```

| Plugin | Classes | On |
| --- | --- | --- |
| `visibility` | `d-{bp}-none`, `d-{bp}-block`, `d-{bp}-flex` | rows, columns, elements, containers |
| `order` | `order-{bp}-{first,0–5,last}` | columns |
| `alignment` | `justify-content-{bp}-*`, `align-items-{bp}-*`; `align-self-{bp}-*` | rows; columns |
| `gutters` | `g-{bp}-{0–5}`, `gx-{bp}-*`, `gy-{bp}-*` | rows |
| `spacing` | `{p,m}{,x,y,t,b,s,e}-{bp}-{0–5}`, and `auto` for margin | rows, columns, elements, containers |

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

Grid editor comes bundles with support for the following rich text editors (RTEs): 
* [TinyMCE](http://www.tinymce.com/) - [(example)](example/basic.html)
* [summernote](http://summernote.org/) - [(example)](example/summernote.html)
* [CKEditor](http://ckeditor.com/) - [(example)](example/ckeditor.html)

__`content_types`:__ Specify the RTE to use. Valid values: `['tinymce']`, `['summernote']`, `['ckeditor']`. Default value: `['tinymce']`.

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
