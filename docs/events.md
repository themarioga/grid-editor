grid-editor events
==================

Every operation grid-editor performs is announced, twice: as a jQuery event on
the canvas, and as a callback in the `callbacks` setting. The event is the
primary mechanism — several listeners, namespacing, `off()` — and the callback
is there for hosts that configure the plugin once, from generated or
server-side code, and cannot easily bind.

```javascript
// as events
$('#myGrid').on('grideditor:before-add-row', function(e, payload) {
    if (payload.parent.hasClass('locked')) { e.preventDefault(); }
});

// as callbacks
$('#myGrid').gridEditor({
    callbacks: {
        before_add_row: function(payload) { return !payload.parent.hasClass('locked'); },
        after_move: function(payload) { console.log(payload.from, payload.to); },
    },
});
```

A callback's name is its event name with `grideditor:` dropped and the dashes
turned into underscores: `before-add-row` → `before_add_row`.


The catalogue
-------------

Adding fires a specific event and then a generic one, so a listener that cares
about every insertion can bind `grideditor:before-add` and switch on
`payload.kind`.

| Specific | Generic | Cancelable | Fires |
| --- | --- | --- | --- |
| `grideditor:before-add-row` | `grideditor:before-add` | yes | before a row is inserted |
| `grideditor:after-add-row` | `grideditor:after-add` | no | after insertion, once the canvas is up to date |
| `grideditor:before-add-column` | `grideditor:before-add` | yes | before a column is inserted |
| `grideditor:after-add-column` | `grideditor:after-add` | no | |
| `grideditor:before-add-container` | `grideditor:before-add` | yes | before a container is inserted; `payload.kind` is `tabs`, `accordion` or `popup` |
| `grideditor:after-add-container` | `grideditor:after-add` | no | |
| `grideditor:before-add-tab` | `grideditor:before-add` | yes | before a tab is added to a tabs container |
| `grideditor:after-add-tab` | `grideditor:after-add` | no | |
| `grideditor:before-add-accordion-item` | `grideditor:before-add` | yes | before an item is added to an accordion |
| `grideditor:after-add-accordion-item` | `grideditor:after-add` | no | |
| `grideditor:before-add-element` | `grideditor:before-add` | yes | before an element is inserted |
| `grideditor:after-add-element` | `grideditor:after-add` | no | |
| `grideditor:before-delete` | — | yes | before any node is removed, whatever its kind |
| `grideditor:after-delete` | — | no | after removal completes, animation included |
| `grideditor:before-move` | — | yes | on drag start (see *Canceling*) |
| `grideditor:after-move` | — | no | on drop, only if the node actually changed position |
| `grideditor:before-resize` | — | yes | before a column's size changes, from a tool or a drag |
| `grideditor:after-resize` | — | no | after the size class is written, only if the size changed |
| `grideditor:before-indent` | — | yes | before a column's offset changes |
| `grideditor:after-indent` | — | no | after the offset class is written |
| `grideditor:popup-orphan` | — | no | on `init`, once per trigger whose popup is missing and cannot be re-pointed |

Two things here are not in the 3.0 specification's catalogue. The indent pair,
because the indent tools are an operation like any other and announce
themselves like one. And the add events for panes — a tab, an accordion item —
which follow the same pattern as the rest.


The payload
-----------

```javascript
{
    kind: 'row',          // row | column | content | element
                          // tabs | accordion | popup | tab | accordion-item
    node: jQuery,         // the node added, deleted, moved or resized
    parent: jQuery,       // where it is going, or where it came from on a delete
    canvas: jQuery,
    breakpoint: 'lg',     // the view at the time: a breakpoint key, or 'all'
    source: 'tool',       // tool | api | dragdrop

    // move only
    from: { parent: jQuery, index: 2 },
    to:   { parent: jQuery, index: 0 },

    // resize and indent only: units, not pixels
    from: 6,
    to: 7,

    // a pane inside a container
    container: jQuery,

    // popup-orphan only
    missing: 'ge-popup-3-a91',   // the id the trigger pointed at
}
```

`source` matters to a host that both drives the editor from its own palette and
listens for what the user does: `api` is your own call coming back to you,
`tool` is a click in the editor, `dragdrop` is a gesture.

`kind: 'content'` appears when a content area itself is dragged between
columns. The kinds for containers are the container's own type, so a listener
can tell a tabs container from an accordion without reading the markup.


Canceling, and what it can honestly do
--------------------------------------

`preventDefault()` on either event, or returning `false` from the callback,
cancels a `before-*`. What that means depends on the operation:

- **Add.** Nothing is inserted and no `after-*` fires. A `create*` method
  returns `null` instead of the node, so a host can tell.
- **Delete.** The node is left alone. This is how a host replaces the built-in
  question with a dialog of its own: cancel the event, ask in your own way, and
  then remove the node and call `reset()`. The editor's own confirmation modal
  never appears for a canceled delete — the host's handler runs first, on
  purpose.
- **Move.** jQuery UI cannot refuse a drag once it has started, so
  `before-move` fires from the sortable's `start` handler and canceling marks
  the drag: on drop the item returns to where it came from and no `after-move`
  fires. The drag is visible and then reverts; it is not prevented outright.
- **Resize.** From a tool, nothing is written. From a drag, the drag is refused
  at every step, so the column ends where it began — jQuery UI's `resizable`
  ignores `false` from its start handler, unlike its `draggable`.
- **Indent.** Nothing is written.

`after-move` is suppressed when the drop leaves the node in the same parent at
the same index, and `after-resize` when the snapped size equals the old one, so
a click-drag that goes nowhere is not reported as an operation.


Ordering
--------

1. `before-*`, the specific name and then the generic one, then the matching
   callbacks — any of them may cancel
2. the DOM change
3. `init()`, so drawers and sortables exist for the new markup
4. `after-*`, in the same order

An `after-*` handler therefore sees a canvas that is ready to be edited.


Calling back into the editor
----------------------------

A handler may call the editor. `init`, `reset` and the `create*` methods called
from inside a handler are queued and run when the operation that called them
has finished, rather than rebuilding the canvas underneath it:

```javascript
$('#myGrid').on('grideditor:after-add-row', function(e, payload) {
    // runs after this add has finished, not in the middle of it
    $('#myGrid').gridEditor('createRow', [6, 6], { appendTo: payload.canvas });
});
```

A `create*` called this way returns the node it made, but cannot say yet
whether its own `before-add` will be canceled.
