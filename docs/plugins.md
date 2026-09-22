Writing a container plugin
==========================

Tabs, accordions and popups are not built into grid-editor: each is a file you
load beside it, and loading the file is what makes the type available.

```html
<script src="dist/jquery.grideditor.min.js"></script>
<script src="dist/plugins/grideditor.tabs.min.js"></script>
<script src="dist/plugins/grideditor.popup.min.js"></script>
```

The toolbar then offers a button per loaded plugin. The `plugins` setting
narrows that list when a page loads more than it wants to offer:

```javascript
$('#myGrid').gridEditor({ plugins: ['tabs'] });
```

A type that is named but never loaded logs one warning and changes nothing
else. A container in the markup whose plugin is not loaded is left alone: no
drawer, no tools, and `getHtml` gives it back as it found it.


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


What the editor does for you
----------------------------

Panes are ordinary canvas regions. `init()` walks the whole canvas, so rows,
columns, content areas and elements nest inside a pane exactly as they do at
the top level, and containers nest inside each other, with nothing asked of
the plugin.

Sorting is the one thing a plugin sets up itself, in `mark`, because only the
plugin knows which of its parts move: the tabs plugin makes its strip sortable
and puts the panes back in strip order in `afterPaneMove`.
