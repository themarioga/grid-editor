Writing a plugin
================

Tabs, accordions, popups and the element level controls are not built into
grid-editor: each is a file you load beside it, and loading the file is what
turns the feature on.

```html
<script src="dist/jquery.grideditor.min.js"></script>
<script src="dist/plugins/grideditor.tabs.min.js"></script>
<script src="dist/plugins/grideditor.popup.min.js"></script>
<script src="dist/plugins/grideditor.elements.min.js"></script>
```

There are two kinds. A **container plugin** builds a type of container — it
registers under `$.fn.gridEditor.containers`, and the toolbar offers a button
for it. A **feature plugin** is anything else the editor can do —
`$.fn.gridEditor.features`, hooks into the canvas, and may contribute methods.
Both are factories called once per editor with the same handle.

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
        onSortable: function(shared) { … },    // make your own sortables
    };
};
```

- **`onSortable(shared)`** is handed the options the editor's own sortables
  use — the handle, the cancel selector, the start and stop handlers — so a
  plugin's sortables answer to `drag_handle` and fire the move events like
  everything else.
- **`methods`** are added to the instance handle. A method the editor
  documents but a plugin implements — `createElement` — warns and returns null
  when the plugin is not loaded.
- **`kindOf(node)`** returns the `kind` an event should carry for a node the
  plugin owns, or null.

The core's own sortables and the plugins' are taken down together: jQuery UI
marks what it made, so a plugin does not have to unmake it.


What the editor does for you
----------------------------

Panes are ordinary canvas regions. `init()` walks the whole canvas, so rows,
columns, content areas and elements nest inside a pane exactly as they do at
the top level, and containers nest inside each other, with nothing asked of
the plugin.

Sorting is the one thing a plugin sets up itself, in `mark`, because only the
plugin knows which of its parts move: the tabs plugin makes its strip sortable
and puts the panes back in strip order in `afterPaneMove`.
