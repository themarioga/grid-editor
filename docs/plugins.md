Writing a plugin
================

Tabs, accordions, popups, cards and the element level controls are not built
into grid-editor: each is a file you load beside it, and loading the file is
what turns the feature on. `grideditor.card.js` is the shortest of them, and
the one to read first if you are about to write your own.

```html
<script src="dist/jquery.grideditor.min.js"></script>
<script src="dist/plugins/grideditor.tabs.min.js"></script>
<script src="dist/plugins/grideditor.popup.min.js"></script>
<script src="dist/plugins/grideditor.card.min.js"></script>
<script src="dist/plugins/grideditor.elements.min.js"></script>
```

There are three kinds. A **container plugin** builds a type of container — it
registers under `$.fn.gridEditor.containers`, and the toolbar offers a button
for it. A **utility plugin** declares families of Bootstrap's responsive
utility classes — `$.fn.gridEditor.utilities` — and the editor edits them per
breakpoint. A **feature plugin** is anything else the editor can do —
`$.fn.gridEditor.features`, hooks into the canvas, and may contribute methods.
All three are factories called once per editor with the same handle.

The `plugins` setting names which of the loaded ones to use:

```javascript
$('#myGrid').gridEditor({ plugins: ['tabs', 'elements'] });
```

Every loaded plugin is used when the setting is not given. A name that was
never loaded logs one warning and changes nothing else. A container in the
markup whose plugin is not loaded is left alone: no drawer, no tools, and
`getHtml` gives it back as it found it.

[example/plugins.html](../example/plugins.html) is this page as a working
editor: the shipped plugins, a container plugin written in the page itself,
and a checkbox per plugin so you can watch the toolbar and the canvas change.


The shape of a plugin
---------------------

A plugin registers a **factory** under the type it builds. The factory is
called once per editor, with the handle below, and returns the definition:

```javascript
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'container.add_carousel': 'Carousel',
    'container.carousel_label': 'Slide {number}',
});

$.fn.gridEditor.containers.carousel = function(ge) {

    function addSlideTo(container, options) { … }

    return {
        labelKey: 'container.add_carousel',   // the toolbar button's label
        addPaneKey: 'container.add_slide',    // the drawer's add pane tool
        paneKind: 'slide',                    // the kind its panes report

        create: function(options) { … },              // returns the container
        addPane: addSlideTo,                          // returns the new pane
        mark: function(container) { … },              // editing furniture on
        unmark: function(container) { … },            // and off again
        afterPaneMove: function(container, pane) { … },  // optional
        tools: function(drawer, container) { … },        // optional, extra tools
        onInit: function() { … },                        // optional, per canvas init
        onDeinit: function() { … },                      // optional, per canvas deinit
    };
};

})(jQuery);
```

- **`create(options)`** returns a detached container. It must carry
  `data-ge-container="<type>"`: that attribute, and never a class, is how the
  editor recognises one.
- **`mark(container)`** is called on every `init`. It adds the drawers, labels
  and editing attributes, and must be safe to run twice.
- **`unmark(container)`** is called on every `deinit`, which is what `getHtml`
  runs before reading the markup. Whatever `mark` added comes off here. What
  is left is what the host ships.
- **`onInit`/`onDeinit`** are for work that is about the whole canvas rather
  than one container — the popup plugin wires up the host's
  `data-ge-popup-target` triggers there.


The handle
----------

Everything a plugin needs from the editor comes through the handle its factory
is called with. It is the plugin contract: these names, and what they do, do
not change without a major version.

| | |
| --- | --- |
| `ge.canvas` | The canvas element |
| `ge.settings` | The live settings, for the host's own tool lists |
| `ge.t(key, params)` | A string from the locale |
| `ge.warn(message)` | A console warning, prefixed like the editor's own |
| `ge.containerId(type)` | A generated id, stable across a reset, for Bootstrap's toggles |
| `ge.defaultRegion()` | A row with one full width column: what an empty pane starts as |
| `ge.createTool(drawer, title, className, iconClass, handlers)` | A tool in a drawer |
| `ge.createMoveTool(drawer)` | The drag handle, unless `drag_handle` says the whole drawer is one |
| `ge.addSettingsTool(drawer, node, presets)` | The gear, and the id and class panel it opens |
| `ge.deleteNode(kind, node, confirmText, animate)` | Remove a node: ask, animate, announce |
| `ge.place(node, kind, options)` | Put a created node where `appendTo` and friends say, through the add events |
| `ge.createPaneControls(pane, kind, hostTools, confirmText, remove)` | The drawer a pane gets: move, the host's tools, delete |
| `ge.makeLabelEditable(label)` | Rename in place, with the Bootstrap toggle suspended while typing |
| `ge.labelIn(button)` | The label span inside a button, wrapped if it is not already |
| `ge.unwrapLabels(scope)` | Take those wrappers off again, for `unmark` |
| `ge.suspendToggles(scope)` / `ge.resumeToggles(scope)` | Move `data-bs-toggle` aside while editing, and back on the way out |
| `ge.emit(name, payload)` | Fire an event and its callbacks; false means a handler canceled |
| `ge.payloadFor(kind, node, extra)` | Build a payload the documented way |
| `ge.operate(body)` | Run `body` as one operation, so a handler calling back in is queued |
| `ge.kindOf(node)` | What an event calls a node: `row`, `column`, `element`, a container's type… |
| `ge.view()` | The view being edited: a breakpoint key, or `'all'` |
| `ge.viewTiers()` | The breakpoint key that view writes: the one being edited, or `xs` - the class with no breakpoint - in the all view |
| `ge.breakpoints` | Every breakpoint key, smallest first |
| `ge.getUtility(node, family, view?)` | A utility's value, as in the public method |
| `ge.setUtility(node, family, value, options?)` | Write one through the events. `options` is a view key or `{ view, source }` |
| `ge.utilityField(node, family)` | A panel field for one family, for a plugin that builds its own panel |
| `ge.bareStyle(node, family, property)` | A css property's value on the node with none of the family's classes: what a preview shows when no class applies and that is not a constant |

The add, delete and move events for a container and its panes are fired by the
editor, not by the plugin: `createPaneControls` handles a pane's delete, and
the toolbar and the drawer handle the adds.


Feature plugins
---------------

A feature plugin returns hooks rather than a container definition:

```javascript
$.fn.gridEditor.features.elements = function(ge) {
    return {
        methods: { createElement: … },   // added to the editor's own methods
        kindOf: function(node) { … },    // what an event calls this node
        onInit: function() { … },        // every init: put the furniture in
        onDeinit: function() { … },      // every deinit: take it out again
        onContentReady: function(area) { … },  // a rich text editor just took over
        onSortable: function(sortable) { … },  // declare your own sortable lists
    };
};
```

- **`onSortable(sortable)`** is handed the function the editor makes all of its
  own lists with. A plugin describes a list; it never touches the drag toolkit
  itself, which is what keeps `drag_handle`, the cancel selector and the move
  events the same everywhere:

  ```javascript
  onSortable: function(sortable) {
      sortable(ge.canvas.find('.ge-content'), {
          draggable: '> .ge-element',   // which children move
          group: 'element',             // lists sharing a group connect
      });
  }
  ```

  Leaving `group` out makes a list that sorts only within itself, which is what
  a tab strip wants. Group names are scoped to the editor instance, so two
  editors on one page never drag into each other.
- **`methods`** are added to the instance handle. A method the editor
  documents but a plugin implements — `createElement` — warns and returns null
  when the plugin is not loaded.
- **`kindOf(node)`** returns the `kind` an event should carry for a node the
  plugin owns, or null.

The core's own lists and the plugins' are taken down together: every list made
through `sortable()` is registered, so `deinit` unmakes exactly those and a
plugin does not have to unmake anything.


What the editor does for you
----------------------------

Panes are ordinary canvas regions. `init()` walks the whole canvas, so rows,
columns, content areas and elements nest inside a pane exactly as they do at
the top level, and containers nest inside each other, with nothing asked of
the plugin.

Sorting is the one thing a plugin sets up itself, in `mark`, because only the
plugin knows which of its parts move: the tabs plugin makes its strip sortable
and puts the panes back in strip order in `afterPaneMove`.


Utility plugins
---------------

A utility plugin edits one of Bootstrap's responsive utility classes — the
ones spelled `{property}-{breakpoint}-{value}`, like `order-md-2` or
`d-lg-none` — and hardly has to do anything to do it. It declares **families**,
and the editor reads, writes, previews and announces them:

```javascript
$.fn.gridEditor.utilities.order = function(ge) {
    return {
        families: [{
            name: 'order',                 // what events and setUtility call it
            prefix: 'order',               // order-2, order-md-2, order-xxl-2
            values: ['first', 0, 1, 2, 3, 4, 5, 'last'],
            appliesTo: ['column'],         // row | column | element | container | a container type
            labelKey: 'utility.order',     // the field's label, optional
            label: function(value) { … },  // an option's text, optional: the value itself otherwise
            choices: function(node, kind) { … },   // what to offer this node, optional: every value otherwise
            panel: false,                          // optional: no field of its own, see "A panel of your own"
            className: function(breakpoint, value) { … },   // optional, for classes not spelled {prefix}-{bp}-{value}
            write: function(node, value, view, source) { … }, // optional, a write that is some other operation
            preview: function(value, node, kind) { // what the value looks like, see below
                return { order: value === null ? 0 : value };
            },
        }],
        drawerTools: function(drawer, node, kind) { … },  // optional, tools beside the gear
        onRefresh: function(scope) { … },                 // optional, see below
        panel: function(node, kind) { … },                // optional, see "A panel of your own"
        preview: function(node, kind, breakpoint) { … },  // optional, the same
        onViewChange: function(view) { … },               // optional
    };
};
```

What the editor does with a family:

- **Reading follows the cascade.** A breakpoint's value is its own class or the
  nearest smaller breakpoint's. The all view reads the class with no infix.
- **Writing depends on the view.** A breakpoint view writes its own tier and
  nothing else. The all view writes the class with no infix and takes the
  family off every other breakpoint, because choosing one value for every size
  is choosing it over what the sizes said; the event says what it took off.
  `null` is inherit: the tier's class comes off.
- **The panel.** Every node with a gear gets a folded *Responsive* section in
  its settings panel, with a field per family that applies to it. A field shows
  the view being edited, says what it inherits and from which breakpoint, and
  follows the classes field when the user types there.
- **The preview.** A breakpoint view narrows the canvas, not the window, and
  Bootstrap's utilities answer to the window with `!important`. So in a
  breakpoint view each node that carries a family's class gets
  `preview(value)` — the value that applies there, or `null` — as inline
  `!important` styles. Return what `null` looks like too: a wider breakpoint's
  class is still live in a wide window and has to be overruled. When what
  `null` looks like depends on the page — `text-align` inherits, the host's
  css may float an element — `ge.bareStyle(node, family, property)` asks the
  browser. Parents are previewed before their children. The all view
  previews nothing, since every breakpoint there is live and what Bootstrap
  shows is the truth. The styles come off on `deinit`, leaving the host's own
  `style` as it was, so `getHtml` never sees them.
- **The events.** Every write goes through `before-utility`, which can cancel
  it, and `after-utility`. See [events.md](events.md).

`drawerTools` runs for every drawer that has a gear — rows, columns, elements,
containers and panes — so a plugin checks `kind` and adds nothing where its
tool does not belong. A tool writes with `ge.setUtility(node, family, value,
{ source: 'tool' })`, and the panel, the classes field and the preview follow.

`onRefresh(scope)` runs whenever the preview is redrawn — on `init`, on a view
change, after a write, after the user types in a classes field — with the node
whose utilities changed, or the canvas. It is for what a plugin marks the canvas
with beyond inline styles: the visibility plugin keeps hidden nodes on the
canvas and fades them there. Whatever it adds, `onDeinit` takes away.

### A panel of your own

A field per family is the right panel for most plugins and the wrong one for
some: spacing has fourteen families, and fourteen fields. Such a plugin marks
its families `panel: false` and returns its own element from
`panel(node, kind)` — or null where it does not apply — and the editor puts it
in the Responsive section. Inside it, `ge.utilityField(node, family)` makes the
same field the editor would, and the editor keeps every such field up to date
with the view and the classes; swapping one field for another is the plugin's
business. The spacing plugin's panel is a side and one field, and choosing a
side swaps the field for that side's family.

The same plugins tend to need the node as a whole for the preview, because
their families settle one property between them — `p-3` and `pt-md-1` both
set the top padding. A plugin-level `preview(node, kind, breakpoint)` is called
for every node in a breakpoint view, after the families' own, and returns the
styles for the node or an empty object.

Two escape hatches, which the column width uses: `className(breakpoint,
value)` spells the classes of a family that does not follow the pattern
(`col`, `col-md`, `col-md-auto`), and `write(node, value, view, source)` does a
write some other way than a utility change - the width field's writes are
resizes, through the resize events. The editor still checks the value and the
node before it calls `write`.

Two plugins cannot declare the same family name: the second one is ignored,
with a warning.

Plugin options live in the `utilities` setting, under the plugin's name:
`utilities: { spacing: { values: ['0', '2', '4'] } }`. The editor passes the
setting through as it is; each plugin fills in its own defaults.

