/**
 * Grid editor plugin.
 *
 * A fork of https://github.com/Friendly-Pixel/grid-editor by Simon Epskamp,
 * maintained at https://github.com/themarioga/grid-editor.
 */
(function( $ ){

/**
 * Every method the plugin dispatches, and how to dispatch it.
 *
 * `value` marks a method that hands back something other than the jQuery set
 * - html, a breakpoint key, a created node - so it runs against the first
 * element of the set only and does not chain. `noInstance` is the answer for
 * an element that carries no editor; every other method is a no-op returning
 * the set. `unimplemented` registers a method a later phase fills in, so a
 * host that calls it early gets told rather than ignored.
 */
var METHODS = {
    getHtml:          { value: true, noInstance: function(element) { return element.html(); } },
    getPlainHtml:     { value: true, noInstance: function(element) { return plainHtml(element.html()); } },
    init:             {},
    deinit:           {},
    reset:            {},
    destroy:          {},
    remove:           {},
    changeView:       {},
    getView:          { value: true },
    createRow:        { value: true },
    createColumn:     { value: true },
    createElement:    { value: true },
    createSection:    { value: true },
    createContainer:  { value: true },
    addTab:           { value: true },
    addAccordionItem: { value: true },
    setLocale:        {},
    getUtility:       { value: true },
    setUtility:       { value: true },
};

/**
 * Where a create* call may put the node it just made. The first one given
 * wins, and giving none leaves the node detached for the host to place.
 */
var PLACEMENTS = ['appendTo', 'prependTo', 'insertAfter', 'insertBefore'];

/**
 * Bootstrap 5's breakpoints, smallest first, which is the order the cascade
 * runs in: a size written for a tier applies to every wider tier that does not
 * override it. Every size and offset class grid-editor reads or writes comes
 * from this table, so adding a tier is a row here and nothing else.
 *
 * `infix` is what Bootstrap's utility classes put between the property and
 * the value - `order-md-2`, `d-none` - and is empty for the smallest tier.
 */
var BREAKPOINTS = [
    { key: 'xs', infix: '', colPrefix: 'col-', offsetPrefix: 'offset-', min: 0, preview: 400, labelKey: 'view.xs' },
    { key: 'sm', infix: 'sm', colPrefix: 'col-sm-', offsetPrefix: 'offset-sm-', min: 576, preview: 576, labelKey: 'view.sm' },
    { key: 'md', infix: 'md', colPrefix: 'col-md-', offsetPrefix: 'offset-md-', min: 768, preview: 768, labelKey: 'view.md' },
    { key: 'lg', infix: 'lg', colPrefix: 'col-lg-', offsetPrefix: 'offset-lg-', min: 992, preview: 992, labelKey: 'view.lg' },
    { key: 'xl', infix: 'xl', colPrefix: 'col-xl-', offsetPrefix: 'offset-xl-', min: 1200, preview: 1200, labelKey: 'view.xl' },
    { key: 'xxl', infix: 'xxl', colPrefix: 'col-xxl-', offsetPrefix: 'offset-xxl-', min: 1400, preview: null, labelKey: 'view.xxl' },
];

/**
 * The view that edits every tier at once. It is the default, and the one most
 * pages want: a layout that needs no per-device tuning is written once, as the
 * class with no breakpoint, and applies at every size.
 */
var ALL_VIEW = 'all';
var ALL_VIEW_LABEL_KEY = 'view.all';

/** Every view key the dropdown can offer, in the order it offers them. */
var VIEW_KEYS = [ALL_VIEW].concat(BREAKPOINTS.map(function(tier) { return tier.key; }));

/** What the three layout mode indexes of 2.x meant. */
var LEGACY_VIEW_INDEXES = ['lg', 'sm', 'xs'];

var MAX_COL_SIZE = 12;
var MAX_COL_OFFSET = 11;

/**
 * The two sizes that are not a number of units: `equal` is Bootstrap's col,
 * which shares what the row has left with the other equal columns, and
 * `auto` is col-auto, as wide as its content.
 */
var FLEX_SIZES = ['equal', 'auto'];

/** How many columns a row-cols class puts on a line. */
var ROW_COLS_VALUES = ['1', '2', '3', '4', '5', '6', 'auto'];

function rowColsClass(tier, value) {
    return 'row-cols' + (tier.infix ? '-' + tier.infix : '') + '-' + value;
}

function isUnits(size) {
    return typeof size === 'number';
}

/** The class that gives a column `size` at one tier: col-md-4, col-md, col-md-auto. */
function sizeClass(tier, size) {
    if (size === 'equal') { return tier.infix ? 'col-' + tier.infix : 'col'; }

    return tier.colPrefix + size;
}

function breakpoint(key) {
    for (var i = 0; i < BREAKPOINTS.length; i++) {
        if (BREAKPOINTS[i].key === key) { return BREAKPOINTS[i]; }
    }
    return null;
}

/**
 * The tier a view writes to. The all view writes the base class, the one
 * with no breakpoint, and takes the others off.
 */
function tiersFor(view) {
    if (view === ALL_VIEW) { return [BREAKPOINTS[0]]; }

    var tier = breakpoint(view);
    return tier ? [tier] : [];
}

function labelKeyFor(view) {
    var tier = breakpoint(view);
    return tier ? tier.labelKey : ALL_VIEW_LABEL_KEY;
}

/**
 * Settings that are objects of grid-editor's own keys rather than something
 * the host owns outright. A host naming one of their keys means "this one is
 * different", not "forget the others", so these are filled in from their
 * defaults instead of being replaced wholesale.
 */
var NESTED_SETTINGS = {
    add_column: {
        size: 12, // What a click on the add column tool adds
        picker: true, // Holding it offers the sizes instead
        delay: 600, // How long to hold, in milliseconds
    },
    elements: {
        enabled: 'auto', // 'auto' turns them on when the page has any
        selector: '[data-ge-element]', // What the host marks an element with
        auto: false, // Treat every child of a content area as an element
    },
    resize: {
        enabled: true,
        handles: 'e', // Which edges carry a handle: 'e', 'w', or 'e, w'
        balance: 'next', // 'next' takes the units out of the following column
    },
    drag: {
        delay: 0, // Milliseconds to hold before a drag starts
        touch_delay: 100, // The same for touch, where 0 eats the page's scrolling
        threshold: 3, // Pixels of movement before a gesture counts as a drag
        animation: 150, // Milliseconds of reordering animation, 0 for none
        scroll: true, // Scroll the page when a drag reaches its edge
    },
};

/** Settings 4.0 took away, and what a host should reach for instead. */
var REMOVED_SETTINGS = {
    sortable_options: 'drag',
    resizable_options: 'resize',
};

var warned = {};

/** Editors on the page, counted so each one's sortable groups are its own. */
var editorCounter = 0;

/**
 * Translate one key.
 *
 * Lookup order is locale_strings, then the selected locale, then English,
 * then the key itself, so a missing string is a visible key and never an
 * empty tooltip. `params` fills {name} placeholders.
 *
 * Exposed as $.fn.gridEditor.t for the editor integrations in the other
 * source files, which are handed the settings and have no instance of their
 * own.
 */
function translate(settings, key, params) {
    var locales = $.fn.gridEditor.locales;
    var locale = locales[settings.locale] || {};
    var overrides = settings.locale_strings || {};
    var string = overrides[key];

    if (string === undefined) { string = locale[key]; }
    if (string === undefined) { string = locales.en[key]; }

    if (string === undefined) {
        warnOnce('locale:' + key, 'no string for "' + key + '" in any locale, showing the key');
        string = key;
    }

    return string.replace(/\{(\w+)\}/g, function(placeholder, name) {
        return params && params[name] !== undefined ? params[name] : placeholder;
    });
}

function warn(message) {
    if (window.console && window.console.warn) {
        window.console.warn('grid-editor: ' + message);
    }
}

/** Warn about something the host can only usefully be told about once. */
function warnOnce(key, message) {
    if (warned[key]) { return; }
    warned[key] = true;
    warn(message);
}

/**
 * Run a string method against a set of elements.
 *
 * An element with no editor on it is not an error: the method is a no-op and
 * the set comes back for chaining, so host code does not have to check first.
 * `getHtml` is the exception, because reading an element's html makes sense
 * whether or not it is being edited.
 */
function dispatch(set, name, args) {
    var descriptor = METHODS[name];

    if (!descriptor) {
        warnOnce('method:' + name, 'unknown method "' + name + '"');
        return set;
    }

    if (descriptor.value) {
        var element = set.first();
        if (!element.length) { return null; }

        var instance = element.data('grideditor');
        if (!instance) {
            return descriptor.noInstance ? descriptor.noInstance(element) : null;
        }

        return instance[name].apply(instance, args);
    }

    set.each(function() {
        var found = $(this).data('grideditor');
        if (found) { found[name].apply(found, args); }
    });

    return set;
}

/**
 * Html with grid-editor's own marking taken off: the ge-* classes, the
 * column class and the data-ge-* attributes. A div that was only there for
 * the editor - a content area, a bare element or container wrapper - is left
 * with nothing on it, and goes, its children taking its place.
 *
 * The marking is what lets the editor read its markup back, so this is for
 * publishing, not for saving something to edit again.
 */
function plainHtml(html) {
    // Parsed in a document of its own, which is inert: no script in the
    // markup runs and no image starts loading while it is being cleaned
    var root = $(document.implementation.createHTMLDocument('').body);
    root[0].innerHTML = html;
    var emptied = [];

    root.find('*').each(function() {
        var node = $(this);
        var marked = false;

        $.each($.makeArray(this.attributes), function(i, attribute) {
            if (attribute.name.indexOf('data-ge-') === 0) {
                node.removeAttr(attribute.name);
                marked = true;
            }
        });

        var classes = (node.attr('class') || '').split(/\s+/).filter(Boolean);
        var kept = classes.filter(function(name) {
            return name !== 'column' && name.indexOf('ge-') !== 0;
        });
        if (kept.length !== classes.length) { marked = true; }
        if (kept.length) {
            node.attr('class', kept.join(' '));
        } else {
            node.removeAttr('class');
        }

        if (marked && this.tagName === 'DIV' && !this.attributes.length) {
            emptied.push(this);
        }
    });

    emptied.forEach(function(div) {
        $(div).replaceWith($(div).contents());
    });

    return root[0].innerHTML;
}

$.fn.gridEditor = function( optionsOrMethod ) {

    var self = this;

    /** Methods **/

    if (typeof optionsOrMethod == 'string') {
        return dispatch(self, optionsOrMethod, Array.prototype.slice.call(arguments, 1));
    }

    /** Initialize plugin */

    self.each(function(baseIndex, baseElem) {
        baseElem = $(baseElem);

        var settings = $.extend({
            'new_row_layouts'   : [ // Column layouts for add row buttons
                                    [12],
                                    [6, 6],
                                    [4, 4, 4],
                                    [3, 3, 3, 3],
                                    [2, 2, 2, 2, 2, 2],
                                    [2, 8, 2],
                                    [4, 8],
                                    [8, 4]
                                ],
            'row_classes'       : [], // Preset class toggles, on top of the classes field
            'col_classes'       : [],
            'col_tools'         : [], /* Example:
                                        [ {
                                            title: 'Set background image',
                                            iconClass: 'glyphicon-picture',
                                            on: { click: function() {} }
                                        } ]
                                    */
            'row_tools'         : [],
            'drag_handle'       : 'tool', // 'tool' for the move tool, 'drawer' for the whole drawer
            'toolbar_drag'      : 'auto', // Drag the toolbar's buttons onto the canvas. 'auto' follows drag_handle
            'element_tools'     : [], // Host tools on element drawers, same shape as row_tools
            'element_classes'   : [], // Preset class toggles on an element's settings panel
            'container_classes' : [], // The same, on a container's panel
            'pane_classes'      : [], // And on a tab's or an accordion item's
            'container_tools'   : [], // Host tools on container drawers
            'tab_tools'         : [], // Host tools on tab drawers
            'accordion_tools'   : [], // Host tools on accordion item drawers
            'plugins'           : null, // Plugins to use, of any kind; null means every one loaded
            'row_cols'          : true, // A row's "columns per row" field, row-cols-*
            'utilities'         : {}, // Options for the utility plugins, by plugin name
            'elements'          : NESTED_SETTINGS.elements, // Element level controls, below the column
            'custom_filter'     : '',
            'content_types'     : ['tinymce'],
            'valid_col_sizes'   : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'equal', 'auto'],
            'valid_col_offsets' : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'add_column'        : NESTED_SETTINGS.add_column, // The add column tool
            'layout_modes'      : VIEW_KEYS.slice(), // Which views the dropdown offers
            'default_view'      : ALL_VIEW,
            'resize'            : NESTED_SETTINGS.resize, // Resizing a column by dragging its edge
            'source_textarea'   : '',
            'locale'            : 'en', // Code of a locale in $.fn.gridEditor.locales
            'locale_strings'    : {}, // Overrides for individual keys
            'callbacks'         : {}, // before_*/after_* functions, the events by another route
            'confirm_delete'    : true, // Ask before deleting a row or a column
            'drag'              : NESTED_SETTINGS.drag // How a drag behaves, whatever drives it
        }, optionsOrMethod);

        // Merged rather than replaced, so `elements: { auto: true }` keeps the
        // default selector instead of losing it
        $.each(NESTED_SETTINGS, function(name, defaults) {
            settings[name] = $.extend({}, defaults, settings[name]);
        });

        // Both handed out the drag toolkit's own options, which 4.0 stops
        // promising: there is no widget underneath a host should be reaching
        // for. What they were used for is a setting of the editor's now.
        $.each(REMOVED_SETTINGS, function(name, replacement) {
            if (optionsOrMethod && optionsOrMethod[name] !== undefined) {
                warn($.fn.gridEditor.t(settings, 'warning.setting_removed', {
                    setting: name,
                    replacement: replacement,
                }));
            }
        });


        // Elems
        var canvas,
            mainControls,
            wrapper, // controls wrapper
            addRowGroup,
            addContainerGroup,
            layoutDropdown,
            htmlTextArea
        ;
        var curView = settings.default_view; // Breakpoint key, or 'all'
        var confirmDialog = null; // The delete confirmation, built when first needed
        var sizePicker = null; // The open column size picker, if there is one
        var dropMarker = null; // The line showing where a dragged toolbar button would land
        var warnedHere = {}; // Deprecations are worth saying once per instance, not once per call
        var sortables = []; // Every list made sortable, so deinit destroys exactly those
        var instanceId = ++editorCounter; // Scopes the sortable groups to this editor

        // Before anything else, because the instance handle hands the canvas
        // to hosts and the rest of setup() runs at the end of this function
        canvas = baseElem.addClass('ge-canvas');

        function warnOnceHere(key, message) {
            if (warnedHere[key]) { return; }
            warnedHere[key] = true;
            warn(message);
        }

        /** This instance's strings, in the locale its settings asked for. */
        function t(key, params) {
            return translate(settings, key, params);
        }

        /**
         * Swap language at runtime. The controls carry their strings in
         * attributes, so they are rebuilt rather than patched.
         */
        function setLocale(code) {
            settings.locale = code;
            handle.settings = settingsCopy();

            removeConfirmModal();
            mainControls.remove();
            createMainControls();
            reset();
        }

        var operationDepth = 0; // Operations running right now
        var deferredWork = []; // What handlers asked for while one was running

        /**
         * The payload every notification carries. Built here, and only here,
         * so no caller assembles one by hand and gets a field wrong.
         *
         * `parent` is where the node is going, or where it is coming from on a
         * delete, which is not the same as node.parent() while the node is
         * still detached - so an add passes it in.
         */
        function payloadFor(kind, node, extra) {
            return $.extend({
                kind: kind,
                node: node,
                parent: node.parent(),
                canvas: canvas,
                breakpoint: getView(),
                source: 'api',
            }, extra || {});
        }

        /**
         * Deliver one notification twice: as a jQuery event on the canvas -
         * the specific name first, then the generic one - and as the matching
         * settings.callbacks entries. Everything is delivered whatever the
         * first listener says, and the answer is whether any of them canceled,
         * which only means something for a before-* notification.
         */
        function emit(name, payload) {
            var names = [name];
            var generic = name.replace(/^(before|after)-add-.+$/, '$1-add');
            if (generic !== name) { names.push(generic); }

            var canceled = false;

            names.forEach(function(eventName) {
                var event = $.Event('grideditor:' + eventName);
                canvas.trigger(event, [payload]);
                if (event.isDefaultPrevented()) { canceled = true; }
            });

            names.forEach(function(eventName) {
                var callback = settings.callbacks[eventName.replace(/-/g, '_')];
                if (typeof callback == 'function' && callback(payload) === false) {
                    canceled = true;
                }
            });

            return !canceled;
        }

        /**
         * One operation, from its before-* notification to its after-* one.
         *
         * Anything a handler asks the editor to do while the operation runs is
         * queued and played back once it finishes, so a handler cannot reset
         * the canvas out from under the operation that called it.
         */
        function operate(body) {
            operationDepth++;
            try {
                return body();
            } finally {
                operationDepth--;
                if (operationDepth === 0) {
                    while (deferredWork.length) {
                        deferredWork.shift()();
                    }
                }
            }
        }

        /** Run `work` now, or after the running operation if there is one. */
        function defer(work) {
            if (operationDepth === 0) {
                work();
                return;
            }

            deferredWork.push(work);
        }

        /**
         * Insert a node: ask, insert, bring the canvas up to date so the new
         * markup has its controls, then announce it. Hands back the node, or
         * null when a handler canceled.
         *
         * The update is init() rather than reset(): a reset deinitializes
         * every rich text editor on the canvas, and adding a row somewhere
         * else is no reason to close the editor the user is typing in.
         */
        function addNode(kind, node, insert, extra) {
            var name = addEventName(kind);

            return operate(function() {
                var payload = payloadFor(kind, node, extra);

                if (!emit('before-add-' + name, payload)) { return null; }

                insert();
                init();
                emit('after-add-' + name, payload);

                return node;
            });
        }

        /**
         * Every container type shares one pair of add events, with the
         * payload's kind saying which type it was: a host that cares about
         * containers binds one name, not three.
         */
        function addEventName(kind) {
            return $.fn.gridEditor.containers[kind] ? 'container' : kind;
        }

        /**
         * Ask the user, in Bootstrap's own modal.
         *
         * Bootstrap is already a dependency of an editor for Bootstrap's grid,
         * and window.confirm cannot be styled, cannot be translated by us and
         * blocks the page while it is up. The modal lives outside the canvas,
         * so it is never part of what getHtml returns.
         *
         * A page that loaded Bootstrap's css but not its javascript still gets
         * asked - by the browser, as before.
         */
        function askToDelete(message, whenConfirmed) {
            if (!settings.confirm_delete) {
                whenConfirmed();
                return;
            }

            if (!window.bootstrap || !window.bootstrap.Modal) {
                if (window.confirm(message)) { whenConfirmed(); }
                return;
            }

            var modal = confirmModal();
            var confirmed = false;

            modal.find('.ge-confirm-message').text(message);
            modal.find('.ge-confirm-ok').off('click').on('click', function() {
                confirmed = true;
                window.bootstrap.Modal.getInstance(modal[0]).hide();
            });

            modal.off('hidden.bs.modal').on('hidden.bs.modal', function() {
                // After the modal is out of the way, so the backdrop is not
                // sitting over the animation the delete runs
                if (confirmed) { whenConfirmed(); }
            });

            modal.off('shown.bs.modal').on('shown.bs.modal', function() {
                modal.find('.ge-confirm-ok').trigger('focus');
            });

            window.bootstrap.Modal.getOrCreateInstance(modal[0]).show();
        }

        /** Built once per instance, and taken away again by destroy(). */
        function confirmModal() {
            if (confirmDialog) { return confirmDialog; }

            confirmDialog = $(
                '<div class="modal fade ge-confirm" tabindex="-1" aria-hidden="true">' +
                    '<div class="modal-dialog modal-dialog-centered">' +
                        '<div class="modal-content">' +
                            '<div class="modal-header">' +
                                '<h5 class="modal-title"></h5>' +
                                '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
                            '</div>' +
                            '<div class="modal-body"><p class="ge-confirm-message"></p></div>' +
                            '<div class="modal-footer">' +
                                '<button type="button" class="btn btn-secondary ge-confirm-cancel" data-bs-dismiss="modal"></button>' +
                                '<button type="button" class="btn btn-danger ge-confirm-ok"></button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            ).appendTo('body');

            confirmDialog.find('.modal-title').text(t('confirm.title'));
            confirmDialog.find('.btn-close').attr('aria-label', t('confirm.cancel'));
            confirmDialog.find('.ge-confirm-cancel').text(t('confirm.cancel'));
            confirmDialog.find('.ge-confirm-ok').text(t('confirm.ok'));

            return confirmDialog;
        }

        /** The confirm modal is rebuilt in the new language on setLocale. */
        function removeConfirmModal() {
            if (!confirmDialog) { return; }

            if (window.bootstrap && window.bootstrap.Modal) {
                var instance = window.bootstrap.Modal.getInstance(confirmDialog[0]);
                if (instance) { instance.dispose(); }
            }

            confirmDialog.remove();
            confirmDialog = null;
        }

        /**
         * Remove a node: ask the host, then the user, then remove it, update
         * the canvas and announce it once the animation has finished.
         *
         * The host's handler goes first on purpose. A host that cancels
         * before-delete to ask in its own way does not want the built-in
         * question to have been asked already.
         */
        function deleteNode(kind, node, message, animate) {
            operate(function() {
                var payload = payloadFor(kind, node, { source: 'tool' });

                if (!emit('before-delete', payload)) { return; }

                askToDelete(message, function() {
                    operate(function() {
                        animate(function() {
                            node.remove();
                            operate(function() {
                                init();
                                emit('after-delete', payload);
                            });
                        });
                    });
                });
            });
        }

        /**
         * What resizing this column to `size` in `view` would write, or null
         * when the budget refuses it or there is nothing to change.
         *
         * A breakpoint view writes its own tier. The all view writes the base
         * class and takes the size off every other tier, so one size is what
         * applies everywhere; the plan says what it took off.
         *
         * Refused rather than quietly clamped: the offset is something the
         * user set, and a tool that rewrites it is a tool that lies. In the
         * all view the base size has to fit every tier's offset, since it is
         * the size at every tier once the others are gone.
         */
        function planSize(col, size, view) {
            view = view || curView;

            if (view !== ALL_VIEW) {
                var tier = breakpoint(view);
                var wanted = clamp({ size: size, offset: getEffectiveOffset(col, tier) || 0 });

                if (wanted.refused || getSize(col, tier) === wanted.size) { return null; }

                return { writes: [{ tier: tier, size: wanted.size }], cleared: null, size: wanted.size };
            }

            var refused = BREAKPOINTS.some(function(each) {
                return clamp({ size: size, offset: getEffectiveOffset(col, each) || 0 }).refused;
            });
            if (refused) { return null; }

            var base = BREAKPOINTS[0];
            var writes = [];
            var cleared = [];

            BREAKPOINTS.slice(1).forEach(function(each) {
                var own = getSize(col, each);
                if (own === null) { return; }

                writes.push({ tier: each, size: null });
                cleared.push({ breakpoint: each.key, value: own });
            });

            if (getSize(col, base) !== size) { writes.unshift({ tier: base, size: size }); }

            return writes.length ? { writes: writes, cleared: cleared, size: size } : null;
        }

        function writeSize(col, plan) {
            plan.writes.forEach(function(write) { setSize(col, write.tier, write.size); });
            stripPixelWidths(col);
        }

        /** The all view's payloads say what the write took off the breakpoints. */
        function withCleared(extra, cleared) {
            if (cleared) { extra.cleared = cleared; }
            return extra;
        }

        /**
         * Resize a column, announcing it either side. `size` is units,
         * `equal` or `auto`; `view` is the current one unless the size field
         * of a plugin's panel says otherwise.
         */
        function resizeColumn(col, size, source, view) {
            view = view || curView;

            var from = currentSize(col);
            var plan = planSize(col, size, view);

            if (!plan) { return false; }

            return operate(function() {
                var payload = payloadFor('column', col, withCleared({
                    source: source,
                    breakpoint: view,
                    from: from,
                    to: plan.size,
                }, plan.cleared));

                if (!emit('before-resize', payload)) {
                    refreshUtilities(col);
                    return false;
                }

                writeSize(col, plan);
                refreshUtilities(col);
                emit('after-resize', payload);

                return true;
            });
        }

        /**
         * Indent a column, shrinking it when the budget needs it: the offset
         * is what the user asked for, so it is the one that gets its way.
         *
         * Like a size, an offset is written to the tier being edited, or in
         * the all view as the base class with every other tier's taken off.
         */
        function indentColumn(col, offset, source) {
            var everywhere = curView === ALL_VIEW;
            var tier = everywhere ? BREAKPOINTS[0] : breakpoint(curView);
            var from = currentOffset(col);

            offset = Math.min(Math.max(offset, 0), MAX_COL_OFFSET);

            var others = everywhere ? BREAKPOINTS.slice(1).filter(function(each) {
                return getOffset(col, each) !== null;
            }) : [];

            if ((getOffset(col, tier) || 0) === offset && !others.length) { return false; }

            return operate(function() {
                var payload = payloadFor('column', col, withCleared({
                    source: source,
                    from: from,
                    to: offset,
                }, everywhere ? others.map(function(each) {
                    return { breakpoint: each.key, value: getOffset(col, each) };
                }) : null));

                if (!emit('before-indent', payload)) { return false; }

                setOffset(col, tier, offset);
                others.forEach(function(each) { setOffset(col, each, 0); });

                // Wherever the column's size and the new offset no longer fit
                // - one tier, or every tier in the all view - the size gives
                // way, at that tier only. An equal or auto column fits anywhere.
                (everywhere ? BREAKPOINTS : [tier]).forEach(function(each) {
                    var was = getEffectiveSize(col, each);
                    if (!isUnits(was)) { return; }

                    var wanted = clamp({ size: was, offset: offset, leading: 'offset' });
                    if (wanted.size !== was) { setSize(col, each, wanted.size); }
                });

                refreshUtilities(col);
                emit('after-indent', payload);

                return true;
            });
        }

        /**
         * Where a node sits, for the from/to of a move. Tool drawers are not
         * counted, so the index is the one a host would recognize.
         */
        function positionOf(node) {
            var parent = node.parent();

            return {
                parent: parent,
                index: parent.children().not('.ge-tools-drawer').index(node),
            };
        }

        function kindOf(node) {
            var fromPlugin = null;

            $.each(FEATURES, function(name, feature) {
                if (!fromPlugin && feature.kindOf) { fromPlugin = feature.kindOf(node); }
            });
            if (fromPlugin) { return fromPlugin; }

            if (node.attr('data-ge-container')) { return node.attr('data-ge-container'); }
            if (node.hasClass('ge-tab')) { return 'tab'; }
            if (node.hasClass('ge-accordion-item')) { return 'accordion-item'; }
            if (node.hasClass('row')) { return 'row'; }
            if (node.hasClass('column')) { return 'column'; }
            if (node.hasClass('ge-element')) { return 'element'; }
            if (node.hasClass('ge-content')) { return 'content'; }
            return 'node';
        }
        
        // Copy html to sourceElement if a source textarea is given
        if (settings.source_textarea) {
            var sourceHtml = $(settings.source_textarea).val();
            if (sourceHtml.length > 0 && $('<div>' + sourceHtml + '</div>').find('.row').addBack('.row').length == 0) {
                var sourceRow = createRow();
                var sourceColumn = createColumn(12).appendTo(sourceRow);
                sourceColumn.find('.ge-content').html(sourceHtml);
                sourceHtml = sourceColumn.html();
            } 
            baseElem.html(sourceHtml);
        }
        
        // Wrap content if it is non-bootstrap
        if (baseElem.children().length && !baseElem.find('div.row').length) {
            var children = baseElem.children();
            var newRow = $('<div class="row"><div class="col-lg-12"/></div>').appendTo(baseElem);
            newRow.find('.col-lg-12').append(children);
        }

        // setup() and init() run at the end of this function, once every
        // table and helper below has been assigned: the toolbar is built from
        // the container registry, and a var declared later is not there yet.

        function setup() {
            htmlTextArea = $('<textarea class="ge-html-output"/>').insertBefore(canvas);

            createMainControls();

            // Make controls fixed on scroll
            $(window).on('scroll', onScroll);

            /* Init RTE on click */
            canvas.on('click', '.ge-content', initRTE);

            /* A trigger is often a link, and a link still navigates even
               with its Bootstrap attributes suspended */
            canvas.on('click', '.ge-popup-trigger, [data-ge-popup-target]', function(e) {
                if (canvas.hasClass('ge-editing')) { e.preventDefault(); }
            });

            // A rich text editor rewrites the content area as it takes over,
            // which costs the element drawers inside it. The integrations say
            // when their editor is ready, and the drawers go back in.
            canvas.on('ge-rte-ready', '.ge-content', function() {
                plugins('onContentReady', $(this));
                refreshPreviews($(this));
            });
        }

        /**
         * The toolbar above the canvas. Separate from setup() because every
         * string in it comes from the locale, so setLocale() rebuilds it.
         */
        function createMainControls() {
            mainControls = $('<div class="ge-mainControls" />').insertBefore(htmlTextArea);
            wrapper = $('<div class="ge-wrapper ge-top" />').appendTo(mainControls);

            // Add row
            addRowGroup = $('<div class="ge-addRowGroup btn-group" />').appendTo(wrapper);
            addContainerGroup = $('<div class="ge-addContainerGroup btn-group" />');
            $.each(settings.new_row_layouts, function(j, layout) {
                var grouped = !Array.isArray(layout);
                var btn = $('<a class="btn btn-sm btn-primary" />')
                    .attr('title', grouped
                        ? t('row.add_row_cols', { columns: layout.columns, counts: rowColsText(layout.row_cols) })
                        : t('row.add', { layout: layout.join('-') }))
                    // What this button makes, in the markup rather than in
                    // jQuery data: a drag works on a clone of it
                    .attr('data-ge-toolbar', 'row')
                    .attr('data-ge-layout', grouped ? JSON.stringify(layout) : layout.join(','))
                    .on('click', function() {
                        var row = rowFromLayoutValue(layout);

                        var added = addNode('row', row, function() {
                            row.appendTo(canvas);
                        }, { parent: canvas, source: 'tool' });

                        if (added && row[0].scrollIntoView) {
                            row[0].scrollIntoView({behavior: 'smooth'});
                        }
                    })
                    .appendTo(addRowGroup)
                ;

                btn.append('<i class="bi bi-plus"></i>');

                // A row of columns shares out the icon as they share the row;
                // a row with row-cols draws one line of its widest count
                var sizes = grouped ? rowColsIcon(layout) : layout;
                var icon = '<div class="row ge-row-icon">';
                sizes.forEach(function(size) {
                    // Closed explicitly: jQuery 4 no longer expands <div/>, and
                    // each column would be parsed inside the one before
                    icon += '<div class="column ' + sizeClass(BREAKPOINTS[0], size) + '"></div>';
                });
                icon += '</div>';
                btn.append(icon);
            });

            addContainerGroup.appendTo(wrapper);

            // A container starts in a row of its own, the way the add row
            // buttons next to these ones do
            $.each(CONTAINERS, function(type, definition) {
                $('<a class="btn btn-sm btn-primary ge-add-container" />')
                    .attr('title', t(definition.labelKey))
                    .attr('data-ge-toolbar', 'container')
                    .attr('data-ge-container-type', type)
                    .append('<i class="bi bi-plus"></i>')
                    .append($('<span />').text(t(definition.labelKey)))
                    .on('click', function() {
                        var row = createRow();
                        var column = createColumn(MAX_COL_SIZE).appendTo(row);
                        var container = definition.create({});

                        column.find('> .ge-content').replaceWith(container);

                        addNode(type, container, function() {
                            row.appendTo(canvas);
                        }, { parent: canvas, source: 'tool' });
                    })
                    .appendTo(addContainerGroup)
                ;
            });

            // A feature plugin's own buttons, beside the containers': what
            // one makes goes onto the canvas, where the plugin says it belongs
            $.each(FEATURES, function(name, feature) {
                (feature.toolbar || []).forEach(function(item, index) {
                    $('<a class="btn btn-sm btn-primary ge-add-container ge-add-feature" />')
                        .attr('title', t(item.labelKey))
                        .attr('data-ge-toolbar', 'feature')
                        .attr('data-ge-feature', name)
                        .attr('data-ge-item', index)
                        .append($('<i />').addClass(item.iconClass || 'bi bi-plus'))
                        .append($('<span />').text(t(item.labelKey)))
                        .on('click', function() {
                            var made = item.create();

                            addNode(item.kind, made, function() {
                                made.appendTo(canvas);
                            }, { parent: canvas, source: item.source || 'tool' });
                        })
                        .appendTo(addContainerGroup)
                    ;
                });
            });

            // Buttons on right
            layoutDropdown = $('<div class="dropdown pull-right ge-layout-mode">' +
                '<button type="button" class="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown"></button>' +
                    '<div class="dropdown-menu" role="menu"></div>' +
                '</div>')
                .on('click', 'a', function() {
                    // Through changeView, so the dropdown and the method are
                    // one path rather than two that have to agree
                    changeView($(this).attr('data-ge-view'));
                })
                .appendTo(wrapper)
            ;
            settings.layout_modes.forEach(function(view) {
                $('<a class="dropdown-item" />')
                    .attr('data-ge-view', view)
                    .attr('title', t(labelKeyFor(view)))
                    .text(t(labelKeyFor(view)))
                    .appendTo(layoutDropdown.find('.dropdown-menu'))
                ;
            });
            layoutDropdown.find('button').text(t(labelKeyFor(curView)));

            var btnGroup = $('<div class="btn-group pull-right"/>')
                .appendTo(wrapper)
            ;
            var htmlButton = $('<button type="button" class="btn btn-sm btn-primary gm-edit-mode"><i class="bi bi-code-slash"></i></button>')
                .attr('title', t('tool.edit_source'))
                .on('click', function() {
                    if (htmlButton.hasClass('active')) {
                        canvas.empty().html(htmlTextArea.val()).show();
                        init();
                        htmlTextArea.hide();
                    } else {
                        deinit();
                        htmlTextArea
                            .height(0.8 * $(window).height())
                            .val(canvas.html())
                            .show()
                        ;
                        canvas.hide();
                    }

                    htmlButton.toggleClass('active btn-danger');
                })
                .appendTo(btnGroup)
            ;
            var previewButton = $('<button type="button" class="btn btn-sm btn-primary gm-preview"><i class="bi bi-eye-fill"></i></button>')
                .attr('title', t('tool.preview'))
                .on('mouseenter', function() {
                    canvas.removeClass('ge-editing');
                })
                .on('click', function() {
                    previewButton.toggleClass('active btn-danger').trigger('mouseleave');
                })
                .on('mouseleave', function() {
                    if (!previewButton.hasClass('active')) {
                        canvas.addClass('ge-editing');
                    }
                })
                .appendTo(btnGroup)
            ;

            makeToolbarDraggable();
        }
        
        /**
         * The toolbar's buttons as a palette: drag one onto the canvas and
         * what it makes is created where it lands, rather than at the end.
         *
         * On by default in the mode where everything else is dragged by its
         * body rather than by a handle, since that is the same idea applied to
         * the toolbar; toolbar_drag: true or false decides it outright.
         */
        function toolbarDrags() {
            if (settings.toolbar_drag === 'auto') { return settings.drag_handle === 'drawer'; }

            return !!settings.toolbar_drag;
        }

        function makeToolbarDraggable() {
            var buttons = mainControls.find('[data-ge-toolbar]')
                .removeClass('ge-palette-button')
                .off('pointerdown.ge-palette')
            ;

            if (!toolbarDrags()) { return; }

            buttons.addClass('ge-palette-button').on('pointerdown.ge-palette', startToolbarDrag);
        }

        /**
         * A toolbar button carried onto the canvas.
         *
         * Nothing happens until the pointer has moved far enough to mean it:
         * below that the gesture is a click, and the button's own handler
         * adds the block at the end of the canvas as it always has - which is
         * also what keeps the add column tool's hold-to-pick working.
         */
        function startToolbarDrag(e) {
            var button = $(e.currentTarget);
            var startX = e.pageX;
            var startY = e.pageY;
            var helper = null;

            if (e.button) { return; }

            function far(move) {
                return Math.abs(move.pageX - startX) + Math.abs(move.pageY - startY) >
                    settings.drag.threshold;
            }

            function onMove(move) {
                if (!helper) {
                    if (!far(move)) { return; }

                    helper = button.clone()
                        .addClass('ge-toolbar-helper')
                        .appendTo('body')
                    ;
                    canvas.addClass('ge-dropping');
                }

                helper.css({ left: move.pageX - 14, top: move.pageY - 14 });
                showDropMarker(move.pageX, move.pageY);
            }

            function onUp(up) {
                $(document)
                    .off('pointermove.ge-toolbar', onMove)
                    .off('pointerup.ge-toolbar pointercancel.ge-toolbar', onUp)
                ;

                if (!helper) { return; }

                helper.remove();
                canvas.removeClass('ge-dropping');
                hideDropMarker();

                // The click that follows a drag would add the block a second
                // time, at the end of the canvas
                button.one('click', function(click) {
                    click.preventDefault();
                    click.stopImmediatePropagation();
                });

                var where = dropPlaceAt(up.pageX, up.pageY);
                if (where) { insertFromToolbar(button, where); }
            }

            // On the document, not on the button: until the gesture is far
            // enough along to be a drag there is nothing to capture the
            // pointer with, and the pointer has left the button by then
            $(document)
                .on('pointermove.ge-toolbar', onMove)
                .on('pointerup.ge-toolbar pointercancel.ge-toolbar', onUp)
            ;
        }

        /**
         * Where a drop at this point would put things: which region it lands
         * in, and which of that region's children it goes before.
         *
         * Worked out from the pointer rather than handed to a sortable. The
         * canvas is a tree of regions that connected sortables fight over -
         * a column grows as a placeholder is put in it, until it covers the
         * pointer wherever the pointer goes - and a new block has one
         * question to answer, which is where it lands.
         */
        function dropPlaceAt(pageX, pageY) {
            var x = pageX - window.scrollX;
            var y = pageY - window.scrollY;
            var under = document.elementFromPoint(x, y);

            if (!under) { return null; }

            var region = $(under).closest(['.column', '.ge-canvas'].concat(pluginHooks('regions')).join(', '));
            if (!region.length || (region[0] !== canvas[0] && !canvas[0].contains(region[0]))) {
                return null;
            }

            var before = null;

            region.children(blockSelector()).each(function() {
                if (before) { return; }

                var box = this.getBoundingClientRect();
                if (y < box.top + box.height / 2) { before = $(this); }
            });

            return { region: region, before: before };
        }

        /**
         * A feature's toolbar button dropped on the canvas. A region that will
         * not have what it makes - a section dropped on a column - gives way
         * to the canvas, just after the top level block the pointer was in.
         */
        function insertFeatureFromToolbar(button, where) {
            var item = FEATURES[button.attr('data-ge-feature')].toolbar[parseInt(button.attr('data-ge-item'), 10)];
            var made = item.create();

            if (!acceptsBlock(where.region, made)) {
                var top = where.region.parentsUntil(canvas).addBack().first();
                where = { region: canvas, before: top.length ? top.next() : null };
                if (where.before && !where.before.length) { where.before = null; }
            }

            return addNode(item.kind, made, function() {
                if (where.before) {
                    made.insertBefore(where.before);
                } else {
                    made.appendTo(where.region);
                }
            }, { parent: where.region, source: item.source || 'dragdrop' });
        }

        /** A line where the block would go, following the pointer. */
        function showDropMarker(pageX, pageY) {
            var where = dropPlaceAt(pageX, pageY);

            if (!where) { return hideDropMarker(); }

            if (!dropMarker) { dropMarker = $('<div class="ge-drop-marker" />'); }

            if (where.before) {
                dropMarker.insertBefore(where.before);
            } else {
                dropMarker.appendTo(where.region);
            }

            return undefined;
        }

        function hideDropMarker() {
            if (dropMarker) { dropMarker.remove(); }
        }

        /**
         * The row or container a toolbar button stands for, made and put where
         * the pointer left it.
         */
        function insertFromToolbar(button, where) {
            if (button.attr('data-ge-toolbar') === 'feature') {
                return insertFeatureFromToolbar(button, where);
            }

            var container = button.attr('data-ge-toolbar') === 'container';
            var type = button.attr('data-ge-container-type');
            var made = container
                ? CONTAINERS[type].create({})
                : rowFromLayout(button.attr('data-ge-layout'));

            // A container belongs in a column: dropped straight onto the
            // canvas it brings a row and a column of its own
            var placed = made;
            if (container && !where.region.is('.column')) {
                placed = createRow();
                createColumn(MAX_COL_SIZE).appendTo(placed)
                    .find('> .ge-content').replaceWith(made);
            }

            return addNode(container ? type : 'row', made, function() {
                if (where.before) {
                    placed.insertBefore(where.before);
                } else {
                    placed.appendTo(where.region);
                }
            }, { parent: where.region, source: 'dragdrop' });
        }

        /**
         * The column width as a utility family, so the Responsive section of
         * a column's panel has a field for it: every size, units or not, in
         * the view being edited. A write is a resize, through the resize
         * events, not a utility change.
         */
        function widthFamily() {
            var values = [];
            for (var units = 1; units <= MAX_COL_SIZE; units++) { values.push(String(units)); }

            return {
                name: 'col',
                values: values.concat(FLEX_SIZES),
                appliesTo: ['column'],
                labelKey: 'utility.col_width',
                className: function(key, value) { return sizeClass(breakpoint(key), parseSize(value)); },
                choices: function() { return settings.valid_col_sizes.map(String); },
                label: function(value) {
                    if (value === 'equal') { return t('utility.col_equal'); }
                    if (value === 'auto') { return t('utility.col_auto'); }

                    return value;
                },
                write: function(col, value, view, source) {
                    return resizeColumn(col, value === null ? null : parseSize(value), source, view);
                },
                // With no size of its own, a column in a row with row-cols
                // takes its share from the row, which the field says
                blank: function(col, view) {
                    var winner = view === ALL_VIEW ? null : rowColsWinner(col, breakpoint(view));
                    return winner ? t('utility.col_from_row', { count: rowColsLabel(winner.value) }) : null;
                },
            };
        }

        /** A size as markup or a select carries it: '4' is 4, 'equal' and 'auto' are themselves. */
        function parseSize(size) {
            return /^\d+$/.test(String(size)) ? parseInt(size, 10) : size;
        }

        /** A row from a toolbar button's data-ge-layout: sizes, or a row-cols layout as JSON. */
        function rowFromLayout(layout) {
            if (/^\s*\{/.test(layout || '')) { return rowFromLayoutValue(JSON.parse(layout)); }

            return rowFromLayoutValue((layout || '').split(',').filter(function(size) {
                return size !== '';
            }).map(parseSize));
        }

        /**
         * A row from a layout: an array of sizes, or { row_cols, columns } -
         * row-cols per breakpoint, and that many columns sized by the row.
         */
        function rowFromLayoutValue(layout) {
            var row = createRow();

            if (Array.isArray(layout)) {
                layout.forEach(function(size) { createColumn(size).appendTo(row); });
                return row;
            }

            $.each(layout.row_cols || {}, function(key, value) {
                var tier = breakpoint(key);
                if (tier && ROW_COLS_VALUES.indexOf(String(value)) !== -1) { row.addClass(rowColsClass(tier, value)); }
            });

            for (var i = 0; i < (layout.columns || 0); i++) { createColumn(null).appendTo(row); }

            return row;
        }

        /** "1, md: 3": a row-cols layout's counts, for its button's title. */
        function rowColsText(counts) {
            return BREAKPOINTS.filter(function(tier) { return counts && counts[tier.key] !== undefined; })
                .map(function(tier) { return (tier.infix ? tier.key + ': ' : '') + counts[tier.key]; })
                .join(', ');
        }

        /** The icon of a row-cols layout: one line of equal columns, as many as its widest count. */
        function rowColsIcon(layout) {
            var widest = 1;
            $.each(layout.row_cols || {}, function(key, value) {
                if (value !== 'auto') { widest = Math.max(widest, parseInt(value, 10) || 1); }
            });

            return Array.apply(null, Array(Math.min(widest, layout.columns || widest))).map(function() { return 'equal'; });
        }

        function onScroll(e) {
            var $window = $(window);
            
            if (
                $window.scrollTop() > mainControls.offset().top &&
                $window.scrollTop() < canvas.offset().top + canvas.height()
            ) {
                if (wrapper.hasClass('ge-top')) {
                    wrapper
                        .css({
                            left: wrapper.offset().left,
                            width: wrapper.outerWidth(),
                        })
                        .removeClass('ge-top')
                        .addClass('ge-fixed')
                    ;
                }
            } else {
                if (wrapper.hasClass('ge-fixed')) {
                    wrapper
                        .css({ left: '', width: '' })
                        .removeClass('ge-fixed')
                        .addClass('ge-top')
                    ;
                }
            }
        }
        
        function initRTE(e) {
            if ($(this).hasClass('ge-rte-active')) { return; }

            // A content area nobody can see - a tab that is not the open one,
            // a closed accordion item - has no geometry for an editor to lay
            // its toolbar out against, and nothing anyone can type into
            if (!$(this).is(':visible')) { return; }
            
            var rte = getRTE($(this).data('ge-content-type'));
            if (rte) {
                $(this).addClass('ge-rte-active', true);
                rte.init(settings, $(this));
            }
        }

        function reset() {
            deinit();
            init();
        }

        function init() {
            runFilter(true);
            canvas.addClass('ge-editing');
            canvas.toggleClass('ge-drag-drawer', settings.drag_handle === 'drawer');
            addAllColClasses();
            wrapContent();
            createRowControls();
            createColControls();
            markContainers();
            plugins('onInit');
            makeSortable();
            makeResizable();
            switchLayout(curView);
            refreshPreviews(canvas);
        }

        function deinit() {
            canvas.removeClass('ge-editing ge-drag-drawer ge-dropping');
            var contents = canvas.find('.ge-content').each(function() {
                var content = $(this);
                var rte = getRTE(content.data('ge-content-type'));
                if (rte) {
                    rte.deinit(settings, content);
                }
                // Cleared after rte.deinit, not before: an editor can restore the
                // class attribute it snapshotted when it was created, which would
                // leave ge-rte-active in place and make initRTE ignore every later
                // click on this content area.
                content.removeClass('ge-rte-active');
            });
            closeSizePicker();
            hideDropMarker();
            canvas.find('.ge-tools-drawer').remove();
            plugins('onDeinit');
            // After the rich text editors have let go of their content areas:
            // one that rebuilt its area's DOM brought the preview styles back
            // with it, and the attribute recording them came back too
            clearPreviews(canvas);
            canvas.find('[data-ge-row-cols]').removeAttr('data-ge-row-cols');
            unmarkContainers();
            removeSortable();
            removeResizable();
            runFilter(false);
        }
        
        /**
         * The markup as a host would save it: no drawers, no editor, no
         * sortables. The canvas goes back to editing afterwards.
         */
        function getHtml() {
            deinit();
            stripPixelWidths(canvas);
            var html = canvas.html();
            init();
            return html;
        }

        /**
         * One node's markup, as getHtml would give it: the canvas goes out of
         * editing to read it and comes back, as it does for getHtml.
         */
        function nodeHtml(node) {
            deinit();
            stripPixelWidths(node);
            var html = node[0].outerHTML;
            init();
            return html;
        }

        /** getHtml with grid-editor's own classes and attributes taken off. */
        function getPlainHtml() {
            return plainHtml(getHtml());
        }

        function destroy() {
            deinit();
            removeConfirmModal();
            mainControls.remove();
            htmlTextArea.remove();
            $(window).off('scroll', onScroll);
            canvas.off('click', '.ge-content', initRTE);
            canvas.off('ge-rte-ready', '.ge-content');
            canvas.removeData('grideditor');
        }

        function deprecatedRemove() {
            warnOnceHere('remove', 'remove() is deprecated and will be removed in a later ' +
                'release. Use destroy(), which does the same thing.');
            destroy();
        }


        /** The elements of one content area: its marked children, or all of them. */

        /**
         * Give every element its class, its drawer and, while editing, the
         * contenteditable="false" that makes a rich text editor treat it as
         * one atomic thing rather than as text it may rewrite.
         *
         * The class is re-applied on every init rather than trusted to
         * survive: an editor that snapshots and restores the markup inside a
         * content area can drop it, and the marking that identifies an
         * element lives in a data attribute for exactly that reason.
         */



        /**
         * What the info tool calls this element: its label, its type, or both.
         * An element found by elements.auto has neither, so it is named after
         * its tag, which is the only thing it has said about itself.
         */

        /**
         * The container plugins this editor is using: the ones registered by
         * the files the page loaded, narrowed by the plugins setting.
         *
         * Each is a factory, called once here with the handle it works
         * through. Everything a plugin needs from the editor goes through
         * that handle, because the closure it runs outside of is not
         * something it can see.
         */
        function loadPlugins() {
            var api = pluginApi();

            registerFamily('grid', {}, widthFamily());
            if (settings.row_cols !== false) { registerFamily('grid', {}, rowColsFamily()); }
            var wanted = function(name) {
                return !settings.plugins || settings.plugins.indexOf(name) !== -1;
            };

            $.each($.fn.gridEditor.containers, function(type, factory) {
                if (wanted(type)) { CONTAINERS[type] = factory(api); }
            });

            $.each($.fn.gridEditor.features, function(name, factory) {
                if (wanted(name)) { FEATURES[name] = factory(api); }
            });

            $.each($.fn.gridEditor.utilities, function(name, factory) {
                if (!wanted(name)) { return; }

                UTILITIES[name] = factory(api);
                (UTILITIES[name].families || []).forEach(function(family) {
                    registerFamily(name, UTILITIES[name], family);
                });
            });

            $.each(FEATURES, function(name, feature) {
                $.each(feature.methods || {}, function(method, implementation) {
                    featureMethods[method] = implementation;
                });
            });

            (settings.plugins || []).forEach(function(name) {
                if (CONTAINERS[name] || FEATURES[name] || UTILITIES[name]) { return; }

                warnOnceHere('plugin:' + name, 'the "' + name + '" plugin is not loaded: ' +
                    'include dist/plugins/grideditor.' + name + '.js after the editor');
            });
        }

        /**
         * A hook every loaded plugin may have. Containers first, since a
         * feature that looks at the canvas - elements, say - wants the
         * containers already marked, and utilities last, since they decorate
         * nodes the other two may have just made.
         */
        function plugins(hook, argument) {
            $.each(CONTAINERS, function(type, definition) {
                if (definition[hook]) { definition[hook](argument); }
            });
            $.each(FEATURES, function(name, feature) {
                if (feature[hook]) { feature[hook](argument); }
            });
            $.each(UTILITIES, function(name, utility) {
                if (utility[hook]) { utility[hook](argument); }
            });
        }

        /** What a plugin is handed. See docs/plugins.md. */
        function pluginApi() {
            return {
                canvas: canvas,
                settings: settings,
                t: t,
                warn: warn,
                containerId: containerId,
                defaultRegion: defaultRegion,
                createTool: createTool,
                createMoveTool: createMoveTool,
                addSettingsTool: addSettingsTool,
                deleteNode: deleteNode,
                place: place,
                createPaneControls: createPaneControls,
                makeLabelEditable: makeLabelEditable,
                labelIn: labelIn,
                unwrapLabels: unwrapLabels,
                suspendToggles: suspendToggles,
                resumeToggles: resumeToggles,
                emit: emit,
                payloadFor: payloadFor,
                operate: operate,
                kindOf: kindOf,
                view: getView,
                viewTiers: function() {
                    return tiersFor(curView).map(function(tier) { return tier.key; });
                },
                breakpoints: BREAKPOINTS.map(function(tier) { return tier.key; }),
                getUtility: getUtility,
                setUtility: setUtility,
                utilityField: utilityField,
                bareStyle: bareStyle,
                rowFromLayout: rowFromLayoutValue,
                nodeHtml: nodeHtml,
                toolbarItems: function(name) {
                    return mainControls
                        ? mainControls.find('[data-ge-toolbar="feature"][data-ge-feature="' + name + '"]')
                        : $();
                },
            };
        }

        /* --------------------------------------------------------------
         * Utilities: Bootstrap's responsive utility classes.
         *
         * A utility plugin declares families - order, d, justify-content -
         * and this is everything that reads or writes one. Every family is
         * spelled the way Bootstrap spells them all, {prefix}-{infix}-{value}
         * with no infix at the smallest tier, and cascades the way the size
         * classes do: a tier that says nothing takes the nearest smaller one.
         *
         * The canvas cannot show a breakpoint's utilities by itself. A
         * per-breakpoint view narrows the canvas, not the viewport, and
         * Bootstrap's utilities answer to the viewport with !important. So
         * each node gets what its classes mean at the view being edited,
         * as inline !important styles, recorded in an attribute so they come
         * off again - exactly those, leaving the host's own style alone.
         * -------------------------------------------------------------- */

        var FAMILIES = {}; // Every family the utility plugins declare, by name
        var UTILITY_NODES = '.row, .column, .ge-element, [data-ge-container]';
        var PREVIEW_ATTR = 'data-ge-preview';
        var utilitiesOpen = false; // Whether the panels show their Responsive section unfolded

        function registerFamily(pluginName, utility, family) {
            var name = family.name || family.prefix;

            if (FAMILIES[name]) {
                warn('the "' + pluginName + '" plugin declares the utility "' + name +
                    '", which the "' + FAMILIES[name].plugin + '" plugin already declared: ignored');
                return;
            }

            FAMILIES[name] = {
                plugin: pluginName,
                family: $.extend({}, family, {
                    name: name,
                    values: family.values.map(String),
                    appliesTo: family.appliesTo || utility.appliesTo || ['row', 'column'],
                }),
            };
        }

        /** The family a caller named, or null and a warning when no plugin declares it. */
        function familyNamed(name, method) {
            if (FAMILIES[name]) { return FAMILIES[name].family; }

            warnOnceHere('utility:' + name, method + '(' + JSON.stringify(name) + '): no loaded ' +
                'plugin declares that utility');
            return null;
        }

        /**
         * Whether a family applies to a kind of node. A container answers to
         * `container` and to its own type, so a plugin can take them all or
         * name the ones it means.
         */
        function appliesTo(family, kind) {
            if (family.appliesTo.indexOf(kind) !== -1) { return true; }

            return !!CONTAINERS[kind] && family.appliesTo.indexOf('container') !== -1;
        }

        function familiesFor(kind) {
            return $.map(FAMILIES, function(entry) {
                return appliesTo(entry.family, kind) ? entry.family : null;
            });
        }

        function utilityClass(family, tier, value) {
            if (family.className) { return family.className(tier.key, value); }

            return family.prefix + (tier.infix ? '-' + tier.infix : '') + '-' + value;
        }

        /** The value a node carries a class for at exactly this tier, or null. */
        function ownUtility(node, family, tier) {
            var classes = (node.attr('class') || '').split(/\s+/);

            for (var i = 0; i < family.values.length; i++) {
                if (classes.indexOf(utilityClass(family, tier, family.values[i])) !== -1) {
                    return family.values[i];
                }
            }

            return null;
        }

        /**
         * The tier below this one that decides the value here, and what it
         * says, when this tier says nothing itself. Null when nothing below
         * says anything either.
         */
        function inheritedUtility(node, family, tier) {
            for (var i = BREAKPOINTS.indexOf(tier) - 1; i >= 0; i--) {
                var value = ownUtility(node, family, BREAKPOINTS[i]);
                if (value !== null) { return { tier: BREAKPOINTS[i], value: value }; }
            }

            return null;
        }

        /** What applies at a tier: its own class, or what it inherits. */
        function effectiveUtility(node, family, tier) {
            var own = ownUtility(node, family, tier);
            if (own !== null) { return own; }

            var inherited = inheritedUtility(node, family, tier);
            return inherited ? inherited.value : null;
        }

        /** Every tier the node carries a class of this family for. */
        function utilityTiers(node, family) {
            return BREAKPOINTS.map(function(tier) {
                return { tier: tier, value: ownUtility(node, family, tier) };
            }).filter(function(entry) { return entry.value !== null; });
        }

        function writeUtility(node, family, tier, value) {
            family.values.forEach(function(candidate) {
                node.removeClass(utilityClass(family, tier, candidate));
            });

            if (value !== null) { node.addClass(utilityClass(family, tier, value)); }
            if (!node.attr('class')) { node.removeAttr('class'); }
        }

        /**
         * What a view reads. A breakpoint reads what applies there. The all
         * view reads the class with no infix, since that is what it writes:
         * the one class that means "the same at every size".
         */
        function readUtility(node, family, view) {
            return view === ALL_VIEW
                ? ownUtility(node, family, BREAKPOINTS[0])
                : effectiveUtility(node, family, breakpoint(view));
        }

        /**
         * What writing `value` in a view comes to, or null when it changes
         * nothing. A breakpoint writes its own tier and nothing else. The all
         * view writes the class with no infix and clears the family from
         * every other tier, and says what it cleared: choosing one value for
         * every size is choosing it over what the sizes said.
         */
        function planUtility(node, family, view, value) {
            if (view !== ALL_VIEW) {
                var tier = breakpoint(view);
                if (ownUtility(node, family, tier) === value) { return null; }

                return { writes: [{ tier: tier, value: value }], cleared: [] };
            }

            var writes = [];
            var cleared = [];

            utilityTiers(node, family).forEach(function(entry) {
                if (entry.tier === BREAKPOINTS[0]) { return; }

                writes.push({ tier: entry.tier, value: null });
                cleared.push({ breakpoint: entry.tier.key, value: entry.value });
            });

            if (ownUtility(node, family, BREAKPOINTS[0]) !== value) {
                writes.unshift({ tier: BREAKPOINTS[0], value: value });
            }

            return writes.length ? { writes: writes, cleared: cleared } : null;
        }

        /** getUtility(node, family, view?): the value that applies, or null. */
        function getUtility(node, name, view) {
            node = $(node).first();

            var family = familyNamed(name, 'getUtility');
            if (!family || !node.length) { return null; }

            var key = view === undefined ? curView : viewKey(view);
            if (key === null) {
                warn('getUtility(' + JSON.stringify(view) + '): no such layout mode');
                return null;
            }

            return readUtility(node, family, key);
        }

        /**
         * setUtility(node, family, value, view?): write a value through the
         * events. Null is "inherit". The last argument is a view key, or
         * { view, source } from a plugin that wants its tool named in the
         * payload. False when a handler canceled or nothing changed.
         */
        function setUtility(node, name, value, options) {
            options = typeof options == 'string' ? { view: options } : (options || {});
            node = $(node).first();

            var family = familyNamed(name, 'setUtility');
            if (!family || !node.length) { return false; }

            var view = options.view === undefined ? curView : viewKey(options.view);
            if (view === null) {
                warn('setUtility(' + JSON.stringify(options.view) + '): no such layout mode');
                return false;
            }

            value = value === null || value === undefined || value === '' ? null : String(value);
            if (value !== null && family.values.indexOf(value) === -1) {
                warn('setUtility: ' + JSON.stringify(value) + ' is not a value of "' + name +
                    '", which takes ' + JSON.stringify(family.values));
                return false;
            }

            var kind = kindOf(node);
            if (!appliesTo(family, kind)) {
                warn('setUtility: "' + name + '" does not apply to a ' + kind);
                return false;
            }

            // A family whose writes are some other operation - the column
            // width, which is a resize - does them its own way
            if (family.write) { return family.write(node, value, view, options.source || 'api'); }

            var plan = planUtility(node, family, view, value);
            if (!plan) { return false; }

            return operate(function() {
                var payload = payloadFor(kind, node, {
                    family: name,
                    breakpoint: view,
                    tiers: plan.writes.map(function(write) { return write.tier.key; }),
                    from: readUtility(node, family, view),
                    to: value,
                    cleared: plan.cleared,
                    source: options.source || 'api',
                });

                if (!emit('before-utility', payload)) {
                    // The panel already shows the value that was refused
                    refreshUtilities(node);
                    return false;
                }

                plan.writes.forEach(function(write) {
                    writeUtility(node, family, write.tier, write.value);
                });
                refreshUtilities(node);
                emit('after-utility', payload);

                return true;
            });
        }

        /**
         * ge.bareStyle(node, family, property): what a css property comes to
         * on a node with none of the family's classes, at any breakpoint. The
         * answer a preview needs for "no class applies here" when that is not
         * a constant: text-align inherits from the parent, and the host's own
         * css may float an element. The browser is the only one who knows, so
         * the classes come off for the moment it takes to ask.
         */
        function bareStyle(node, name, property) {
            var family = familyNamed(name, 'bareStyle');
            node = $(node).first();
            if (!family || !node.length) { return null; }

            var original = node.attr('class');
            BREAKPOINTS.forEach(function(tier) { writeUtility(node, family, tier, null); });

            var value = getComputedStyle(node[0]).getPropertyValue(property);

            if (original === undefined) { node.removeAttr('class'); } else { node.attr('class', original); }

            return value;
        }

        /** Bring a node's panel and preview up to date with its classes. */
        function refreshUtilities(node) {
            var details = node.children('.ge-tools-drawer').children('.ge-details');

            details.children('.ge-classes').val(hostClasses(node).join(' '));
            details.children('.ge-utilities').each(function() { renderUtilities($(this)); });
            refreshPreviews(node);
        }

        /* Preview */

        function utilityNodes(scope) {
            return scope.find(UTILITY_NODES).addBack(UTILITY_NODES);
        }

        /**
         * Put what each node's utilities mean at the view being edited on the
         * node itself. Only nodes that carry a class of a family get anything,
         * and they get the family's answer for the view even when that is
         * "nothing": a wider tier's class is still live in a wide window, and
         * has to be overruled.
         *
         * The all view gets nothing. Its canvas is not narrowed, every tier is
         * live, and what Bootstrap shows is the truth.
         */
        function refreshPreviews(scope) {
            clearPreviews(scope);

            if (curView !== ALL_VIEW) { previewTier(scope, breakpoint(curView)); }

            markRowCols(scope);

            // Whatever a plugin marks the canvas with to show its utilities
            // goes stale at the same moments the preview does
            plugins('onRefresh', scope);
        }

        function previewTier(scope, tier) {
            utilityNodes(scope).each(function() {
                var node = $(this);
                var kind = kindOf(node);
                var styles = {};

                familiesFor(kind).forEach(function(family) {
                    if (!family.preview || !utilityTiers(node, family).length) { return; }

                    $.extend(styles, family.preview(effectiveUtility(node, family, tier), node, kind));
                });

                if (kind === 'column') { $.extend(styles, rowColsPreview(node, tier)); }

                // A plugin whose families settle one property between them
                // previews the node as a whole
                $.each(UTILITIES, function(name, utility) {
                    if (utility.preview) { $.extend(styles, utility.preview(node, kind, tier.key)); }
                });

                if (!$.isEmptyObject(styles)) { applyPreview(node, styles); }
            });
        }

        /**
         * Set inline !important styles, which is the one thing that beats
         * Bootstrap's own !important, and remember what each property was so
         * it can be put back. The record is an attribute rather than jQuery
         * data because a rich text editor rebuilds the DOM of the area it
         * edits, and the record has to come back with the node.
         */
        function applyPreview(node, styles) {
            var style = node[0].style;
            var was = {};

            $.each(styles, function(property, value) {
                was[property] = [style.getPropertyValue(property), style.getPropertyPriority(property)];
                style.setProperty(property, String(value), 'important');
            });

            node.attr(PREVIEW_ATTR, JSON.stringify(was));
        }

        function clearPreviews(scope) {
            scope.find('[' + PREVIEW_ATTR + ']').addBack('[' + PREVIEW_ATTR + ']').each(function() {
                var node = $(this);
                var style = this.style;
                var was = {};

                try { was = JSON.parse(node.attr(PREVIEW_ATTR)) || {}; } catch (error) { /* a mangled record: drop it */ }

                $.each(was, function(property, before) {
                    if (before && before[0]) {
                        style.setProperty(property, before[0], before[1]);
                    } else {
                        style.removeProperty(property);
                    }
                });

                node.removeAttr(PREVIEW_ATTR);
                if (!node.attr('style')) { node.removeAttr('style'); }
            });
        }

        /* The panel */

        /**
         * The Responsive section of a node's settings panel: one field per
         * family that applies to the node, reading and writing the view being
         * edited, and whatever fields a plugin builds itself. Folded until the
         * user unfolds one, and then unfolded on every node, since whoever
         * wanted it on one wants it on the next.
         */
        function createUtilitiesSection(node) {
            var kind = kindOf(node);
            var fields = familiesFor(kind)
                .filter(function(family) { return family.panel !== false; })
                .map(function(family) { return createField(node, family); });

            $.each(UTILITIES, function(name, utility) {
                var own = utility.panel ? utility.panel(node, kind) : null;
                if (own && own.length) { fields.push(own); }
            });

            if (!fields.length) { return null; }

            var section = $('<div class="ge-utilities" />')
                .toggleClass('ge-open', utilitiesOpen)
                .data('ge-node', node)
            ;

            $('<a class="ge-utilities-toggle" />')
                .appendTo(section)
                .on('click', function() {
                    utilitiesOpen = !section.hasClass('ge-open');
                    canvas.find('.ge-utilities').toggleClass('ge-open', utilitiesOpen);
                })
            ;

            var body = $('<div class="ge-utilities-body" />').appendTo(section);
            fields.forEach(function(field) { field.appendTo(body); });

            renderUtilities(section);

            return section;
        }

        /**
         * One family's field: its label, a select that writes through
         * setUtility, and a note. Filled by renderField, again whenever the
         * view or the node's classes change.
         */
        function createField(node, family) {
            var field = $('<label class="ge-utility" />').attr('data-ge-family', family.name);

            $('<span class="ge-utility-label" />')
                .text(family.labelKey ? t(family.labelKey) : family.name)
                .appendTo(field)
            ;
            $('<select />')
                .appendTo(field)
                .on('change', function() {
                    setUtility(node, family.name, this.value, { source: 'panel' });
                })
            ;
            $('<small class="ge-utility-note" />').appendTo(field);

            return field;
        }

        /** ge.utilityField(node, family): a field a plugin places in a panel of its own. */
        function utilityField(node, name) {
            var family = familyNamed(name, 'utilityField');
            if (!family) { return $(); }

            var field = createField(node, family);
            renderField(field, node);

            return field;
        }

        /** Fill a section's fields, the families' and the plugins' own, for the view being edited. */
        function renderUtilities(section) {
            var node = section.data('ge-node');

            section.children('.ge-utilities-toggle')
                .text(t('utility.section', { view: t(labelKeyFor(curView)) }));

            section.find('.ge-utility').each(function() { renderField($(this), node); });
        }

        function renderField(field, node) {
            var family = FAMILIES[field.attr('data-ge-family')].family;
            var select = field.children('select').empty();
            var choices = family.choices ? family.choices(node, kindOf(node)) : family.values;
            var own, blank, note = '';

            if (curView === ALL_VIEW) {
                own = ownUtility(node, family, BREAKPOINTS[0]);
                blank = t('utility.default');

                var varies = utilityTiers(node, family).filter(function(entry) {
                    return entry.tier !== BREAKPOINTS[0];
                });
                if (varies.length) {
                    note = t('utility.varies', {
                        breakpoints: varies.map(function(entry) { return entry.tier.key; }).join(', '),
                    });
                }
            } else {
                var tier = breakpoint(curView);
                var inherited = inheritedUtility(node, family, tier);

                own = ownUtility(node, family, tier);
                blank = inherited
                    ? t('utility.inherit', { value: labelOf(family, inherited.value), breakpoint: inherited.tier.key })
                    : t('utility.default');

                // What the empty choice means is sometimes not the family's
                // own business: a column's width can come from its row
                var custom = family.blank ? family.blank(node, curView) : null;
                if (custom && own === null) { blank = custom; }
            }

            // A value the markup carries is shown even when the family
            // would not offer it here, rather than shown as something else
            if (own !== null && choices.indexOf(own) === -1) { choices = choices.concat([own]); }

            $('<option value="" />').text(blank).appendTo(select);
            choices.forEach(function(value) {
                $('<option />').attr('value', value).text(labelOf(family, value)).appendTo(select);
            });

            select.val(own === null ? '' : own);
            field.children('.ge-utility-note').text(note).toggle(note !== '');
        }

        function labelOf(family, value) {
            return family.label ? family.label(value) : value;
        }

        /* --------------------------------------------------------------
         * Containers: tabs, accordions and popups.
         *
         * A container holds panes, and a pane is an ordinary canvas region -
         * rows, columns, content areas and elements nest inside one exactly
         * as they do at the top level, because init() walks the whole canvas
         * and does not care how deep it is.
         *
         * What a container is, is said by data-ge-container. The ge-* classes
         * are editing furniture and come off with everything else, so a host
         * restyling the markup cannot break detection and getHtml stays clean.
         * -------------------------------------------------------------- */

        var CONTAINERS = {}; // The container plugins in use, by the type each builds
        var FEATURES = {}; // The feature plugins in use, by name
        var UTILITIES = {}; // The utility plugins in use, by name
        var featureMethods = {}; // The methods those features contribute
        var containerCounter = 0;

        /**
         * Ids go into the markup rather than into jQuery data: Bootstrap's
         * toggles are written in terms of them, and the markup has to survive
         * getHtml with those toggles still pointing at the right panes.
         */
        function containerId(type) {
            containerCounter++;

            return 'ge-' + type + '-' + containerCounter + '-' +
                Math.random().toString(36).slice(2, 6);
        }

        /** A pane's starting content: one full width column, ready to edit. */
        function defaultRegion() {
            var row = createRow();
            createColumn(MAX_COL_SIZE).appendTo(row);
            return row;
        }

        function containerTypeOf(container) {
            return container.attr('data-ge-container');
        }

        function markContainers() {
            canvas.find('[data-ge-container]').each(function() {
                var container = $(this);
                var type = containerTypeOf(container);
                var definition = CONTAINERS[type];

                if (!definition) {
                    warnOnceHere('container:' + type, 'unknown container type "' + type + '"');
                    return;
                }

                container.addClass('ge-container ge-container-' + type);
                definition.mark(container);

                if (!container.find('> .ge-tools-drawer').length) {
                    createContainerControls(container, type, definition);
                }
            });
        }

        function unmarkContainers() {
            canvas.find('[data-ge-container]').each(function() {
                var container = $(this);
                var definition = CONTAINERS[containerTypeOf(container)];

                if (definition) { definition.unmark(container); }

                container.removeClass('ge-container ge-container-' + containerTypeOf(container));
                if (!container.attr('class')) { container.removeAttr('class'); }
            });
        }

        function createContainerControls(container, type, definition) {
            var drawer = $('<div class="ge-tools-drawer ge-container-drawer" />').prependTo(container);

            createMoveTool(drawer);
            addSettingsTool(drawer, container, settings.container_classes);

            settings.container_tools.forEach(function(hostTool) {
                createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });

            if (definition.tools) { definition.tools(drawer, container); }

            createTool(drawer, t('tool.delete_container'), 'ge-delete-container', 'bi bi-trash', function() {
                deleteNode(type, container, t('confirm.delete_container'), function(removed) {
                    container.slideUp(removed);
                });
            });

            // Delete then add, the order rows and columns have
            if (definition.addPane) {
                createTool(drawer, t(definition.addPaneKey), 'ge-add-pane', 'bi bi-plus-circle', function() {
                    var pane = definition.addPane(container, {});

                    addNode(definition.paneKind, pane, function() {}, {
                        parent: container,
                        source: 'tool',
                        container: container,
                    });
                });
            }
        }

        /**
         * A pane drawer: small, inline, and made the same way for every
         * container type so a tab and an accordion item behave alike.
         */
        function createPaneControls(pane, kind, hostTools, confirmText, remove) {
            var drawer = $('<div class="ge-tools-drawer ge-pane-drawer" />').prependTo(pane);

            createMoveTool(drawer);
            addSettingsTool(drawer, pane, settings.pane_classes);

            hostTools.forEach(function(hostTool) {
                createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });

            createTool(drawer, t('tool.delete_pane'), 'ge-delete-pane', 'bi bi-trash', function() {
                deleteNode(kind, pane, confirmText, function(removed) {
                    remove(removed);
                });
            });

            return drawer;
        }

        /**
         * Take a Bootstrap toggle away from a node, and give it back later.
         *
         * Bootstrap binds its data-api handlers on the document in the
         * capture phase, so a listener on the node cannot stop one: the
         * document sees the click first. What does work is leaving nothing
         * for its selector to match, so the attribute is moved aside while
         * the editor needs the control not to react, and moved back on the
         * way out.
         */
        function suspendToggles(scope) {
            scope.find('[data-bs-toggle], [data-bs-dismiss]').addBack('[data-bs-toggle], [data-bs-dismiss]')
                .each(function() {
                    var node = $(this);

                    ['toggle', 'dismiss'].forEach(function(name) {
                        var value = node.attr('data-bs-' + name);
                        if (value === undefined) { return; }

                        node.attr('data-ge-bs-' + name, value).removeAttr('data-bs-' + name);
                    });
                });
        }

        function resumeToggles(scope) {
            scope.find('[data-ge-bs-toggle], [data-ge-bs-dismiss]').addBack('[data-ge-bs-toggle], [data-ge-bs-dismiss]')
                .each(function() {
                    var node = $(this);

                    ['toggle', 'dismiss'].forEach(function(name) {
                        var value = node.attr('data-ge-bs-' + name);
                        if (value === undefined) { return; }

                        node.attr('data-bs-' + name, value).removeAttr('data-ge-bs-' + name);
                    });
                });
        }

        /**
         * Rename a label in place. The label sits inside the button Bootstrap
         * toggles from, so the toggle is suspended while the label is being
         * edited: typing in a tab's name must not switch tabs.
         */
        function makeLabelEditable(label) {
            if (label.data('ge-editable')) { return; }

            var toggle = label.closest('[data-bs-toggle], [data-ge-bs-toggle]');

            label.data('ge-editable', true)
                .attr('title', t('tool.rename'))
                .on('dblclick', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    suspendToggles(toggle);
                    label.attr('contenteditable', 'true').trigger('focus');
                    window.getSelection().selectAllChildren(label[0]);
                })
                .on('keydown', function(e) {
                    if (label.attr('contenteditable') !== 'true') { return; }

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        label.trigger('blur');
                    }
                })
                .on('blur', function() {
                    label.removeAttr('contenteditable');
                    resumeToggles(toggle);
                })
            ;
        }


        /** Exactly one tab is the active one, in the strip and in the content. */

        /**
         * An accordion whose items carry no data-bs-parent is one Bootstrap
         * lets you open several items in at once. The markup is the state:
         * there is nothing else to remember it in.
         */


        /**
         * An item dropped into another accordion collapses against the one it
         * landed in, and takes on that accordion's idea of whether several
         * items may be open at once.
         */
        /**
         * Open or close an item while editing.
         *
         * The editor does this itself rather than letting Bootstrap's collapse
         * run over the canvas, and it writes what it does to data-ge-open, so
         * what is left open here is what the authored page opens with. An
         * accordion that closes its siblings - one without stay_open - closes
         * them here too, because the canvas is meant to look like the page.
         */

        /** One item's state, in the attribute and in Bootstrap's own classes. */




        /**
         * A trigger is any node the host marked with data-ge-popup-target,
         * plus the button the container makes for itself. Ids go stale - a
         * popup deleted, a trigger pasted from another page - so what can be
         * repaired is repaired, and the rest is reported rather than removed.
         * Grid-editor never deletes a node the host wrote.
         */

        /**
         * On the way out, every trigger gets the attributes that make
         * Bootstrap open the modal in the authored page. An orphan gets
         * nothing, because there is nothing to point it at.
         */


        /**
         * What each container type is made of, and what has to happen to one
         * while it is being edited. Everything type specific lives here; the
         * core above treats them all the same.
         */
        /** The label inside a pane's button, wrapped so it can be edited alone. */
        function labelIn(button) {
            var label = button.find('> .ge-pane-label');

            if (!label.length) {
                label = $('<span class="ge-pane-label" />').text(button.text().trim());
                button.empty().append(label);
            }

            return label;
        }

        function unwrapLabels(scope) {
            scope.find('.ge-pane-label').each(function() {
                $(this).removeData('ge-editable').contents().unwrap();
            });
        }

        /**
         * Add a column of `size` to a row, through the add events.
         */
        function addColumnTo(row, size) {
            var column = createColumn(size);

            return addNode('column', column, function() {
                row.append(column);
            }, { parent: row, source: 'tool' });
        }

        /**
         * Holding the add column tool offers the sizes instead of taking the
         * default one.
         *
         * Held rather than hovered alone, because a hover is a gesture a touch
         * screen does not have, and the tooltip says so: a gesture nobody can
         * see is a gesture nobody finds.
         */
        function attachSizePicker(tool, row) {
            if (!settings.add_column.picker) { return; }

            var timer = null;

            var cancel = function() {
                window.clearTimeout(timer);
                timer = null;
            };

            tool.on('mouseenter mousedown', function() {
                if (timer || sizePicker) { return; }

                timer = window.setTimeout(function() {
                    timer = null;
                    openSizePicker(tool, row);
                }, settings.add_column.delay);
            });

            tool.on('mouseleave', cancel);
            tool.on('mouseup', cancel);
        }

        /**
         * The sizes a column may be given, as a strip under the tool. Sizes
         * that do not fit what is left of the row are marked, not withheld:
         * a row is allowed to wrap, and that is the host's page to lay out.
         */
        function openSizePicker(tool, row) {
            closeSizePicker();

            var room = spare(row, leadingTier());

            // The drawer it hangs off is raised while it is open: drawers sit
            // below the resize handles, so without this the drawer of the
            // column below takes the clicks meant for the picker
            tool.closest('.ge-tools-drawer').addClass('ge-picker-open');

            sizePicker = $('<div class="ge-size-picker" />').appendTo(tool);

            settings.valid_col_sizes.forEach(function(size) {
                $('<a class="ge-size" />')
                    .attr('data-ge-size', size)
                    .attr('title', sizeTitle(size))
                    .toggleClass('ge-size-tight', isUnits(size) && size > room)
                    .toggleClass('ge-size-flex', !isUnits(size))
                    .text(isUnits(size) ? size : sizeClass(BREAKPOINTS[0], size))
                    .on('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        closeSizePicker();
                        addColumnTo(row, size);
                    })
                    .appendTo(sizePicker)
                ;
            });

            // Anywhere else, and the question is withdrawn
            tool.one('mouseleave', function() {
                window.setTimeout(function() {
                    if (sizePicker && !sizePicker.is(':hover')) { closeSizePicker(); }
                }, 400);
            });
        }

        /** True when there was one to close, which is also a click's answer. */
        function sizeTitle(size) {
            if (size === 'equal') { return t('tool.column_equal'); }
            if (size === 'auto') { return t('tool.column_auto'); }

            return t('tool.column_size', { size: size });
        }

        function closeSizePicker() {
            if (!sizePicker) { return false; }

            sizePicker.closest('.ge-tools-drawer').removeClass('ge-picker-open');
            sizePicker.remove();
            sizePicker = null;

            return true;
        }

        function createRowControls() {
            canvas.find('.row').each(function() {
                var row = $(this);
                if (row.find('> .ge-tools-drawer').length) { return; }

                var drawer = $('<div class="ge-tools-drawer" />').prependTo(row);
                createMoveTool(drawer);
                addSettingsTool(drawer, row, settings.row_classes);

                settings.row_tools.forEach(function(hostTool) {
                    createTool(drawer, hostTool.title || '', hostTool.className || '',
                        hostTool.iconClass || 'bi bi-wrench', hostTool.on);
                });
                createTool(drawer, t('tool.delete_row'), 'ge-delete-row', 'bi bi-trash', function() {
                    deleteNode('row', row, t('confirm.delete_row'), function(removed) {
                        row.slideUp(removed);
                    });
                });
                createTool(drawer, t('tool.add_column'), 'ge-add-column', 'bi bi-plus-circle', function() {
                    if (closeSizePicker()) { return; } // The picker was open: that was the answer

                    // In a row with row-cols the new column takes its share
                    addColumnTo(row, rowColsSource(row, leadingTier()) ? null : settings.add_column.size);
                });

                attachSizePicker(drawer.find('> .ge-add-column'), row);

            });
        }

        function createColControls() {
            canvas.find('.column').each(function() {
                var col = $(this);
                if (col.find('> .ge-tools-drawer').length) { return; }

                var drawer = $('<div class="ge-tools-drawer" />').prependTo(col);

                createMoveTool(drawer);

                createTool(drawer, t('tool.column_narrower'), 'ge-decrease-col-width', 'bi bi-dash-lg', function(e) {
                    resizeColumn(col, e.shiftKey
                        ? smallest(settings.valid_col_sizes)
                        : stepThrough(settings.valid_col_sizes.filter(isUnits), currentUnits(col), -1),
                        'tool');
                });

                createTool(drawer, t('tool.column_wider'), 'ge-increase-col-width', 'bi bi-plus-lg', function(e) {
                    resizeColumn(col, e.shiftKey
                        ? widestFor(col)
                        : stepThrough(settings.valid_col_sizes.filter(isUnits), currentUnits(col), 1),
                        'tool');
                });

                createTool(drawer, t('tool.indent_decrease'), 'ge-decrease-col-offset', 'bi bi-text-indent-right', function(e) {
                    indentColumn(col, e.shiftKey
                        ? smallest(settings.valid_col_offsets)
                        : stepThrough(settings.valid_col_offsets, currentOffset(col), -1),
                        'tool');
                });

                createTool(drawer, t('tool.indent_increase'), 'ge-increase-col-offset', 'bi bi-text-indent-left', function(e) {
                    indentColumn(col, e.shiftKey ? deepestFor(col) : stepThrough(settings.valid_col_offsets, currentOffset(col), 1), 'tool');
                });

                addSettingsTool(drawer, col, settings.col_classes);

                settings.col_tools.forEach(function(hostTool) {
                    createTool(drawer, hostTool.title || '', hostTool.className || '',
                        hostTool.iconClass || 'bi bi-wrench', hostTool.on);
                });

                createTool(drawer, t('tool.delete_column'), 'ge-delete-column', 'bi bi-trash', function() {
                    deleteNode('column', col, t('confirm.delete_column'), function(removed) {
                        col.animate({
                            opacity: 'hide',
                            width: 'hide',
                            height: 'hide'
                        }, 400, removed);
                    });
                });

                createTool(drawer, t('tool.add_row'), 'ge-add-row', 'bi bi-plus-circle', function() {
                    // An empty row: the columns in it are the next decision,
                    // and its drawer's add column tool is where that is made
                    var row = createRow();

                    addNode('row', row, function() {
                        col.append(row);
                    }, { parent: col, source: 'tool' });
                });

            });
        }

        /**
         * The tier the tools read when they need one number.
         *
         * In a per-breakpoint view that is the tier being edited. In the all
         * view it is the widest tier, because the canvas is not constrained
         * there and the widest tier is what the user is looking at: clicking
         * "narrower" on a column authored as col-lg-6 should take it to 5,
         * not to 11 because no base class was ever written. What the all view
         * writes is the base class all the same.
         */
        function leadingTier() {
            return curView === ALL_VIEW ? BREAKPOINTS[BREAKPOINTS.length - 1] : breakpoint(curView);
        }

        /** The size that applies in the view: units, `equal` or `auto`. */
        function currentSize(col) {
            var tier = leadingTier();

            // Sized by its row: it has no size of its own to report
            if (rowColsWinner(col, tier)) { return null; }

            var size = getEffectiveSize(col, tier);
            return size === null ? MAX_COL_SIZE : size;
        }

        /**
         * The size in units, which is what the tools step through. An equal
         * or auto column has no number, so it is measured: the width it has
         * on the canvas, in twelfths of its row.
         */
        function currentUnits(col) {
            var size = currentSize(col);
            if (isUnits(size)) { return size; }

            var units = Math.round(col.outerWidth() / rowContentWidth(col.parent()) * MAX_COL_SIZE);
            return Math.min(Math.max(units, 1), MAX_COL_SIZE);
        }

        function rowContentWidth(row) {
            var style = window.getComputedStyle(row[0]);

            return row[0].clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }

        function currentOffset(col) {
            return getEffectiveOffset(col, leadingTier()) || 0;
        }

        /** The next value a tool moves to, one step along the allowed list. */
        function stepThrough(values, from, direction) {
            var index = values.indexOf(from);

            if (index === -1) {
                // A value the host did not allow: step to the nearest one it did
                return values.reduce(function(best, value) {
                    return Math.abs(value - from) < Math.abs(best - from) ? value : best;
                }, values[0]);
            }

            return values[Math.min(Math.max(index + direction, 0), values.length - 1)];
        }

        function smallest(values) {
            return values.filter(isUnits).reduce(function(a, b) { return Math.min(a, b); }, MAX_COL_SIZE);
        }

        function largest(values) {
            return values.filter(isUnits).reduce(function(a, b) { return Math.max(a, b); }, 0);
        }

        /**
         * The widest this column can be: everything the row has left, minus
         * its own indent. What "hold shift for max" means.
         */
        function widestFor(col) {
            var room = spare(col.parent(), leadingTier(), col) - currentOffset(col);

            return Math.min(largest(settings.valid_col_sizes), Math.max(room, 1));
        }

        /**
         * The deepest this column can be indented and still have a unit of
         * itself left inside the row.
         */
        function deepestFor(col) {
            var room = spare(col.parent(), leadingTier(), col) - currentUnits(col);

            return Math.min(largest(settings.valid_col_offsets), Math.max(room, 0));
        }

        /**
         * The move tool, unless the whole drawer is the handle - in which case
         * a tool that only says "drag from here" is one tool too many.
         */
        function createMoveTool(drawer) {
            if (settings.drag_handle === 'drawer') { return; }

            createTool(drawer, t('tool.move'), 'ge-move', 'bi bi-arrows-move');
        }

        function createTool(drawer, title, className, iconClass, eventHandlers) {
            var tool = $('<a title="' + title + '" class="' + className + '"><i class="' + iconClass + '"></i></a>')
                .appendTo(drawer)
            ;
            if (typeof eventHandlers == 'function') {
                tool.on('click', eventHandlers);
            }
            if (typeof eventHandlers == 'object') {
                $.each(eventHandlers, function(name, func) {
                    tool.on(name, func);
                });
            }
        }

        /**
         * The classes on a node that are the host's own, rather than the ones
         * the grid and the editor put there. What the settings panel shows,
         * and the only ones it is allowed to take away.
         */
        function hostClasses(node) {
            return (node.attr('class') || '').split(/\s+/).filter(function(name) {
                return name !== '' && !isEditorClass(name);
            });
        }

        function isEditorClass(name) {
            if (name === 'row' || name === 'column') { return true; }
            if (/^(ge-|ui-)/.test(name)) { return true; }
            if (/^col(-(sm|md|lg|xl|xxl))?(-auto)?$/.test(name)) { return true; }

            return BREAKPOINTS.some(function(tier) {
                return new RegExp('^(' + tier.colPrefix + '|' + tier.offsetPrefix + ')\\d+$').test(name);
            });
        }

        function setHostClasses(node, value) {
            hostClasses(node).forEach(function(name) { node.removeClass(name); });

            value.split(/\s+/).forEach(function(name) {
                if (name !== '') { node.addClass(name); }
            });

            if (!node.attr('class')) { node.removeAttr('class'); }
        }

        /**
         * The gear and the panel it opens: the node's id, its css classes, and
         * whatever preset toggles the host configured for that kind of node.
         */
        function addSettingsTool(drawer, node, presets) {
            var details = createDetails(node, presets || []);

            createTool(drawer, t('tool.settings'), 'ge-settings', 'bi bi-gear-fill', function() {
                details.toggle();
            });

            // Beside the gear, because every node that has one is a node a
            // utility may apply to, whichever plugin built its drawer. A
            // feature plugin's tools go there too, for the same reason: the
            // gear is the one tool every drawer has.
            var kind = kindOf(node);
            $.each(UTILITIES, function(name, utility) {
                if (utility.drawerTools) { utility.drawerTools(drawer, node, kind); }
            });
            $.each(FEATURES, function(name, feature) {
                if (feature.drawerTools) { feature.drawerTools(drawer, node, kind); }
            });

            return details.appendTo(drawer);
        }

        function createDetails(container, cssClasses) {
            var detailsDiv = $('<div class="ge-details" />');

            $('<input class="ge-id" />')
                .attr('placeholder', t('tool.id_placeholder'))
                .val(container.attr('id'))
                .attr('title', t('tool.id_title'))
                .appendTo(detailsDiv)
                .on('change', function() {
                    // An empty field means no id, not an empty one
                    if (this.value === '') {
                        container.removeAttr('id');
                    } else {
                        container.attr('id', this.value);
                    }
                })
            ;

            $('<input class="ge-classes" />')
                .attr('placeholder', t('tool.classes_placeholder'))
                .attr('title', t('tool.classes_title'))
                .val(hostClasses(container).join(' '))
                .appendTo(detailsDiv)
                .on('change', function() {
                    setHostClasses(container, this.value);
                    refreshUtilities(container);
                })
            ;

            var classGroup = $('<div class="btn-group" />').appendTo(detailsDiv);
            cssClasses.forEach(function(rowClass) {
                var btn = $('<a class="btn btn-sm btn-default" />')
                    .html(rowClass.label)
                    .attr('title', rowClass.title ? rowClass.title : t('tool.toggle_class', { label: rowClass.label }))
                    .toggleClass('active btn-primary', container.hasClass(rowClass.cssClass))
                    .on('click', function() {
                        btn.toggleClass('active btn-primary');
                        container.toggleClass(rowClass.cssClass, btn.hasClass('active'));
                        refreshUtilities(container);
                    })
                    .appendTo(classGroup)
                ;
            });

            var utilities = createUtilitiesSection(container);
            if (utilities) { utilities.appendTo(detailsDiv); }

            return detailsDiv;
        }

        /**
         * Make sure every column is marked as one, and that a column with no
         * sizing at all gets some.
         *
         * Deliberately conservative: a column that carries any size class is
         * left exactly as authored. Seeding every tier would put six classes
         * on every column now that there are six tiers, and the smallest tier
         * already applies to the wider ones, so one class is enough for a
         * column that had none.
         */
        function addAllColClasses() {
            canvas.find('.column, div[class*="col-"], div.col').each(function() {
                var col = $(this).addClass('column');

                // A column in a row with row-cols is sized by its row
                if (sizedTiers(col).length || hasRowCols(col.parent())) { return; }

                setSize(col, BREAKPOINTS[0], MAX_COL_SIZE);
            });
        }

        /* --------------------------------------------------------------
         * Columns per row: row-cols-*.
         *
         * A row's row-cols class gives every child an equal share of a
         * line, and a column's own size class takes that share's place.
         * Which of the two wins at a breakpoint is settled the way
         * Bootstrap's css settles it: the class from the wider breakpoint,
         * and at one breakpoint col loses to row-cols, which loses to
         * col-auto and col-N - the order Bootstrap writes their rules in.
         * -------------------------------------------------------------- */

        function hasRowCols(row) {
            return row.hasClass('row') && BREAKPOINTS.some(function(tier) {
                return ROW_COLS_VALUES.some(function(value) { return row.hasClass(rowColsClass(tier, value)); });
            });
        }

        /** The row-cols class that applies to a row at a tier, as { tier, value }, or null. */
        function rowColsSource(row, tier) {
            if (!row.hasClass('row')) { return null; }

            for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
                for (var v = 0; v < ROW_COLS_VALUES.length; v++) {
                    if (row.hasClass(rowColsClass(BREAKPOINTS[i], ROW_COLS_VALUES[v]))) {
                        return { tier: i, value: ROW_COLS_VALUES[v] };
                    }
                }
            }

            return null;
        }

        /** The column's own size that applies at a tier, as { tier, size }, or null. */
        function columnSource(col, tier) {
            for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
                var size = getSize(col, BREAKPOINTS[i]);
                if (size !== null) { return { tier: i, size: size }; }
            }

            return null;
        }

        /**
         * The row-cols class that sizes this column at a tier, or null when
         * the column's own size does.
         */
        function rowColsWinner(col, tier) {
            var row = rowColsSource(col.parent(), tier);
            if (!row) { return null; }

            var own = columnSource(col, tier);
            if (!own || row.tier > own.tier) { return row; }

            return row.tier === own.tier && own.size === 'equal' ? row : null;
        }

        /** A column's share of a line when its row sizes it, in units: auto has no number. */
        function rowColsUnits(winner) {
            return winner.value === 'auto' ? 0 : MAX_COL_SIZE / parseInt(winner.value, 10);
        }

        /**
         * What a breakpoint view shows of the row-cols a column is under. The
         * view narrows the canvas, not the window, and Bootstrap's
         * .row-cols-md-3 > * answers to the window - and to nothing the
         * preview can put on the row, since it styles the row's children.
         */
        function rowColsPreview(col, tier) {
            var winner = rowColsWinner(col, tier);

            if (winner) {
                return {
                    flex: '0 0 auto',
                    width: winner.value === 'auto' ? 'auto' : (100 / parseInt(winner.value, 10)) + '%',
                    'max-width': '100%',
                };
            }

            // A wider breakpoint's row-cols is live in a wide window; a
            // column with no size of its own here is a full width one
            if (hasRowCols(col.parent()) && !columnSource(col, tier)) {
                return { flex: '0 0 auto', width: '100%', 'max-width': '100%' };
            }

            return {};
        }

        /**
         * The badge on a row whose columns are sized by row-cols in the view,
         * and in the all view by its row-cols with no breakpoint.
         */
        function markRowCols(scope) {
            scope.find('.row').addBack('.row').each(function() {
                var row = $(this);
                var source = settings.row_cols === false ? null : (curView === ALL_VIEW
                    ? (rowColsSource(row, BREAKPOINTS[0]) || null)
                    : rowColsSource(row, breakpoint(curView)));

                if (!source) {
                    row.removeAttr('data-ge-row-cols');
                } else {
                    row.attr('data-ge-row-cols', rowColsLabel(source.value));
                }
            });
        }

        function rowColsLabel(value) {
            return value === 'auto' ? t('badge.row_cols_auto') : t('badge.row_cols', { count: value });
        }

        /** The core's family for the field in a row's panel. */
        function rowColsFamily() {
            return {
                name: 'row-cols',
                prefix: 'row-cols',
                values: ROW_COLS_VALUES,
                appliesTo: ['row'],
                labelKey: 'utility.row_cols',
            };
        }

        /* --------------------------------------------------------------
         * The sizing core.
         *
         * Everything that reads or writes a size or an offset class goes
         * through here: the width and indent tools, drag resize,
         * createColumn and the getHtml cleanup. One place owns the class
         * names, the 12 unit budget and what an absent class means.
         * -------------------------------------------------------------- */

        /**
         * A column's size at one tier: a number of units, `equal`, `auto`, or
         * null when that tier says nothing.
         */
        function getSize(col, tier) {
            var units = readUnits(col, tier.colPrefix);
            if (units !== null) { return units; }

            if (col.hasClass(sizeClass(tier, 'auto'))) { return 'auto'; }
            if (col.hasClass(sizeClass(tier, 'equal'))) { return 'equal'; }

            return null;
        }

        /** The units a column is indented by at one tier, or null. */
        function getOffset(col, tier) {
            return readUnits(col, tier.offsetPrefix);
        }

        /**
         * What actually applies at a tier: its own class, or the nearest
         * smaller tier that has one, because that is how Bootstrap cascades.
         * Null when no tier below it says anything either.
         *
         * Not a "return the first thing I found" fallback: it walks the tiers
         * downward from the one asked about, so an offset lookup can never
         * answer with a size, and a lookup for one tier can never answer with
         * a wider tier's value.
         */
        function getEffectiveSize(col, tier) {
            return readEffective(col, tier, getSize);
        }

        function getEffectiveOffset(col, tier) {
            return readEffective(col, tier, getOffset);
        }

        function readEffective(col, tier, read) {
            for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
                var units = read(col, BREAKPOINTS[i]);
                if (units !== null) { return units; }
            }

            return null;
        }

        function readUnits(col, prefix) {
            var match = new RegExp('(?:^|\\s)' + prefix + '(\\d+)(?:\\s|$)').exec(col.attr('class') || '');
            return match ? parseInt(match[1], 10) : null;
        }

        function writeUnits(col, prefix, units) {
            var classes = (col.attr('class') || '').split(/\s+/).filter(function(name) {
                return name !== '' && !new RegExp('^' + prefix + '\\d+$').test(name);
            });

            if (units !== null) { classes.push(prefix + units); }

            col.attr('class', classes.join(' '));
        }

        /** One size per tier: writing a size takes whatever size the tier had off. */
        function setSize(col, tier, size) {
            writeUnits(col, tier.colPrefix, null);
            FLEX_SIZES.forEach(function(flex) { col.removeClass(sizeClass(tier, flex)); });

            if (size !== null && size !== undefined) { col.addClass(sizeClass(tier, size)); }
        }

        /** An offset of 0 is written as no class at all, which is what it means. */
        function setOffset(col, tier, units) {
            writeUnits(col, tier.offsetPrefix, units ? units : null);
        }

        /** The tiers a column carries an explicit size for. */
        function sizedTiers(col) {
            return BREAKPOINTS.filter(function(tier) {
                return getSize(col, tier) !== null;
            });
        }

        /**
         * The units left in a row at one tier, counting every sibling's size
         * and offset. What "hold shift for max" grows into.
         */
        function spare(row, tier, ignore) {
            var used = 0;

            row.children('.column').each(function() {
                var sibling = $(this);
                if (ignore && sibling[0] === ignore[0]) { return; }

                // An equal or auto column takes what is left, so it uses none;
                // one its row sizes uses its share of the line
                var winner = rowColsWinner(sibling, tier);
                var size = winner ? rowColsUnits(winner) : getEffectiveSize(sibling, tier);
                used += (isUnits(size) ? size : 0) + (getEffectiveOffset(sibling, tier) || 0);
            });

            return MAX_COL_SIZE - used;
        }

        /**
         * The 12 unit budget, in one place: a column's size plus its offset
         * never exceeds 12 at any tier.
         *
         * Which of the two gives way is the caller's decision, expressed by
         * which one it marks as leading. Growing an offset shrinks the column;
         * growing a column with no room left is refused, so the tool visibly
         * does nothing rather than quietly rewriting an offset the user set.
         */
        function clamp(request) {
            var size = request.size === null || request.size === undefined ? null : request.size;
            var offset = request.offset === null || request.offset === undefined ? 0 : request.offset;

            offset = Math.min(Math.max(offset, 0), MAX_COL_OFFSET);

            if (size === null || !isUnits(size)) { return { size: size, offset: offset, refused: false }; }

            size = Math.min(Math.max(size, 1), MAX_COL_SIZE);

            if (size + offset <= MAX_COL_SIZE) {
                return { size: size, offset: offset, refused: false };
            }

            if (request.leading === 'offset') {
                return { size: MAX_COL_SIZE - offset, offset: offset, refused: false };
            }

            return { size: null, offset: offset, refused: true };
        }

        /**
         * Drag resize leaves an inline pixel width behind: the column follows
         * the pointer in pixels while the gesture lasts. It does not belong in
         * the markup a host saves, or in the canvas once the size class has
         * been written.
         */
        function stripPixelWidths(scope) {
            scope.find('.column').addBack('.column').each(function() {
                var col = $(this);

                col.css({ width: '', height: '', left: '', top: '' });

                // Clearing the last property leaves style="" behind, which is
                // an editor leftover like any other
                if (!col.attr('style')) { col.removeAttr('style'); }
            });
        }

        /**
         * A group name, scoped to this editor.
         *
         * Two editors on one page must not drag into each other, since a node
         * carries its drawer - and the events that go with it - from the
         * editor that made it.
         */
        function groupName(name) {
            return 'ge-' + name + '-' + instanceId;
        }

        /**
         * What the canvas, the columns and the plugins' regions move: rows,
         * content areas and containers, and whatever blocks a feature adds -
         * the sections plugin's sections.
         */
        function blockSelector() {
            return ['.row', '.ge-content', '[data-ge-container]'].concat(pluginHooks('blocks')).join(', ');
        }

        /** A selector every feature plugin may contribute to, under one name. */
        function pluginHooks(name) {
            return $.map(FEATURES, function(feature) { return feature[name] || null; });
        }

        /**
         * Whether a region will have a block dropped in it. Every block goes
         * everywhere unless a feature says otherwise: a section only on the
         * canvas, and only rows in a section.
         */
        function acceptsBlock(region, node) {
            var accepted = true;

            $.each(FEATURES, function(name, feature) {
                if (accepted && feature.accepts && feature.accepts(region, node) === false) { accepted = false; }
            });

            return accepted;
        }

        /** What must never start a drag, whatever the handle is. */
        function dragCancelSelector() {
            return settings.drag_handle === 'drawer'
                // With the whole drawer as the handle, the tools inside it are
                // still tools: a drag starting on one would swallow its click,
                // and the settings panel has fields to type in
                ? '.ge-tools-drawer > a, .ge-details, input, textarea, button, select, option'
                : 'input, textarea, button, select, option';
        }

        /**
         * Every sortable list the editor makes, core's and a plugin's alike,
         * is made here.
         *
         * A caller says what moves (`draggable`) and what the list connects to
         * (`group`, or none for a list that sorts only within itself); the
         * handle, the filter, the callbacks and the drag settings are this
         * function's business. That is the whole point of it: the toolkit
         * underneath is named in one place, so replacing it is one function
         * and not thirty call sites.
         */
        function sortable(lists, options) {
            if (!lists.length || !window.Sortable) { return; }

            var wholeDrawer = settings.drag_handle === 'drawer';
            var cancel = dragCancelSelector();
            var soloGroup = 0;

            lists.each(function() {
                var list = this;

                // A list with no group sorts only within itself, which is what
                // a tab strip wants: a name of its own, closed both ways
                var group = options.group
                    ? { name: groupName(options.group) }
                    : { name: groupName(options.draggable + '-' + (++soloGroup)), pull: false, put: false };

                // A list may turn some of its group's items away. A put
                // function replaces SortableJS's own test that the item comes
                // from the same group, so it makes that test too: without it
                // a column would drop into the canvas, or into another editor
                if (options.group && options.accepts) {
                    group.put = function(to, from, dragged) {
                        return from.options.group.name === group.name && options.accepts($(to.el), $(dragged));
                    };
                }

                sortables.push(window.Sortable.create(list, $.extend({
                    group: group,
                    draggable: options.draggable,
                    handle: wholeDrawer ? '.ge-tools-drawer' : '.ge-tools-drawer .ge-move',

                    /**
                     * Two refusals in one, because SortableJS asks once.
                     *
                     * A tool or a form field never starts a drag, as the
                     * cancel list said before. And only a direct child of
                     * this list moves: the selector is matched against every
                     * descendant, so without this the canvas would pick up a
                     * row nested three columns down and drag that.
                     */
                    filter: function(e, item) {
                        if ($(e.target).closest(cancel, list).length) { return true; }

                        return !item || item.parentNode !== list;
                    },

                    // A filtered pointerdown is still a click on a tool
                    preventOnFilter: false,

                    // The HTML5 drag and drop API cannot be driven by
                    // synthetic events, so the tests could not exist without
                    // this; it also gives one helper across browsers
                    forceFallback: true,
                    fallbackOnBody: true,

                    ghostClass: 'ge-drag-placeholder',
                    chosenClass: 'ge-drag-chosen',
                    dragClass: 'ge-drag-helper',
                    fallbackClass: 'ge-drag-helper',

                    animation: settings.drag.animation,

                    // One delay, which applies to both gestures or to touch
                    // alone: a touch drag that starts instantly takes the
                    // page's scrolling with it, a mouse drag has no such
                    // problem, and asking for `delay` means asking for both
                    delay: settings.drag.delay || settings.drag.touch_delay,
                    delayOnTouchOnly: !settings.drag.delay,

                    touchStartThreshold: settings.drag.threshold,
                    scroll: settings.drag.scroll,

                    onStart: sortStart,
                    onEnd: sortEnd,
                }, options.options || {})));
            });
        }

        function makeSortable() {
            if (!window.Sortable) {
                warnOnceHere('sortable_missing', t('error.sortable_missing'));
                return;
            }

            sortable(canvas.find('.row'), {
                draggable: '.column',
                group: 'column',
            });

            sortable(canvas.add(canvas.find('.column')), {
                draggable: blockSelector(),
                group: 'block',
                accepts: acceptsBlock,
            });

            // A plugin's region can be a block itself - a section is both -
            // and SortableJS tests a list's own element against the draggable
            // selector when it counts the list's children, so every child of
            // a section would count as a block, its drawer first. '>' is
            // SortableJS for "direct children only", which the list is not.
            var regions = pluginHooks('regions');
            if (regions.length) {
                sortable(canvas.find(regions.join(', ')), {
                    draggable: '>' + blockSelector(),
                    group: 'block',
                    accepts: acceptsBlock,
                });
            }

            // A plugin makes its own: only it knows which of its parts move
            plugins('onSortable', sortable);
        }

        /**
         * A drag cannot be refused once it has started, so a canceled
         * before-move is remembered here and undone on drop (spec 2.4). The
         * node carries the mark, because with connected lists the drop is not
         * always reported by the list that started the drag.
         */
        function sortStart(e) {
            var node = $(e.item);
            var from = positionOf(node);

            node.data('ge-move-from', from);
            node.removeData('ge-move-canceled');

            operate(function() {
                var moving = emit('before-move', payloadFor(kindOf(node), node, {
                    parent: from.parent,
                    source: 'dragdrop',
                    from: from,
                }));

                if (!moving) { node.data('ge-move-canceled', true); }
            });
        }

        /** Put a node back where a refused drag found it. */
        function putBack(node, from) {
            var siblings = from.parent.children().not('.ge-tools-drawer').not(node);

            if (!siblings.length || from.index >= siblings.length) {
                node.appendTo(from.parent);
            } else {
                node.insertBefore(siblings.eq(from.index));
            }
        }

        function sortEnd(e) {
            var node = $(e.item);
            var from = node.data('ge-move-from') || positionOf(node);

            node.removeData('ge-move-from');

            if (node.data('ge-move-canceled')) {
                node.removeData('ge-move-canceled');
                putBack(node, from);
                return;
            }

            var to = positionOf(node);
            if (to.parent[0] === from.parent[0] && to.index === from.index) {
                return; // A drag that went nowhere is not a move
            }

            var container = node.closest('[data-ge-container]');
            var definition = CONTAINERS[containerTypeOf(container)];
            if (definition && definition.afterPaneMove) {
                definition.afterPaneMove(container, node, from);
            }

            // No init() here, unlike an add: the node brought its drawer
            // with it, and the drag is still being finished, so this is the
            // wrong moment to rebuild the lists it is using.
            operate(function() {
                emit('after-move', payloadFor(kindOf(node), node, {
                    parent: to.parent,
                    source: 'dragdrop',
                    from: from,
                    to: to,
                    container: container.length ? container : undefined,
                }));
            });
        }

        /**
         * Resizing a column by dragging its edge.
         *
         * The handle sits on the column's edge and the sort handle is the
         * drawer, so the two gestures never fight over the same pixels. The
         * column follows the pointer in pixels while dragging, the drawer says
         * which class it would land on, and the pixels are snapped to whole
         * units and thrown away on drop.
         */
        function makeResizable() {
            if (!settings.resize.enabled) { return; }

            canvas.find('.column').each(function() {
                var col = $(this);
                if (col.find('> .ge-resize-handle').length) { return; }

                $('<span class="ge-resize-size" />').appendTo(col.find('> .ge-tools-drawer'));

                $.each(resizeEdges(), function(_, edge) {
                    $('<span class="ge-resize-handle" />')
                        .addClass('ge-resize-' + edge)
                        .attr('data-ge-edge', edge)
                        .on('pointerdown', startResizeDrag)
                        .appendTo(col)
                    ;
                });
            });
        }

        /** Which edges carry a handle: 'e', 'w', or both. */
        function resizeEdges() {
            return String(settings.resize.handles).split(',')
                .map(function(edge) { return edge.trim(); })
                .filter(function(edge) { return edge === 'e' || edge === 'w'; });
        }

        /**
         * One resize gesture, from the pointer going down on a handle to it
         * coming up again.
         *
         * The pointer is captured, so a fast drag that leaves the column
         * behind keeps resizing it, and a refused before-resize simply never
         * starts: nothing is written and the column does not move.
         */
        function startResizeDrag(e) {
            var handle = $(e.currentTarget);
            var col = handle.parent();
            var west = handle.attr('data-ge-edge') === 'w';
            var startX = e.pageX;
            var startWidth = col.outerWidth();

            e.preventDefault();

            if (!resizeStart(col)) { return; }

            col.addClass('ge-resizing');
            if (e.pointerId !== undefined && handle[0].setPointerCapture) {
                handle[0].setPointerCapture(e.pointerId);
            }

            function widthAt(move) {
                var delta = move.pageX - startX;

                return Math.max(1, startWidth + (west ? -delta : delta));
            }

            function onMove(move) {
                col.css('width', widthAt(move) + 'px');
                resizeMove(col, widthAt(move));
            }

            function onUp(up) {
                handle.off('pointermove', onMove).off('pointerup pointercancel', onUp);
                col.removeClass('ge-resizing');
                resizeStop(col, widthAt(up));
            }

            handle.on('pointermove', onMove).on('pointerup pointercancel', onUp);
        }

        function removeResizable() {
            canvas.find('.ge-resize-handle').remove();

            canvas.find('.ge-resize-size').remove();
            stripPixelWidths(canvas);
        }

        /**
         * The units a pixel width comes to, snapped to whole ones and held
         * inside the same budget the tools obey. With balance 'next' the
         * column may grow into its neighbour, which is what dragging the
         * divider between two columns looks like it should do.
         */
        function snapUnits(col, pixels) {
            var units = Math.round(pixels / rowContentWidth(col.parent()) * MAX_COL_SIZE);
            var next = balanceSibling(col);
            var nextSize = next ? currentSize(next) : null;

            // Measured when the drag started: the column is the width of the
            // pointer now, which is not what it was
            var own = col.data('ge-resize-units');

            // With a sibling to balance against, the drag may take that
            // column's units but not its last one. Without one, the row is
            // allowed to wrap - that is what balance false means - so the only
            // limit is the column's own budget against its indent.
            // An equal or auto sibling gives way by itself, so it sets no limit
            var room = next && isUnits(nextSize)
                ? own + nextSize - smallest(settings.valid_col_sizes)
                : MAX_COL_SIZE - currentOffset(col);

            return Math.min(
                Math.max(units, smallest(settings.valid_col_sizes)),
                Math.max(room, smallest(settings.valid_col_sizes)),
                largest(settings.valid_col_sizes)
            );
        }

        /** The column that absorbs the delta, when the host asked for that. */
        function balanceSibling(col) {
            if (settings.resize.balance !== 'next') { return null; }

            var next = col.nextAll('.column').first();
            return next.length ? next : null;
        }

        function resizeReadout(col, text) {
            col.find('> .ge-tools-drawer > .ge-resize-size').text(text);
        }

        function sizeLabel(units) {
            return (curView === ALL_VIEW ? BREAKPOINTS[0].colPrefix : leadingTier().colPrefix) + units;
        }

        /**
         * A canceled before-resize refuses the gesture before it begins, so
         * nothing is written and the column does not move. Under jQuery UI
         * this took a flag on the column and a refusal from every step of the
         * drag, because resizable ignores false from its start handler.
         */
        function resizeStart(col) {
            var from = currentSize(col);

            var allowed = operate(function() {
                return emit('before-resize', payloadFor('column', col, {
                    source: 'dragdrop',
                    from: from,
                    to: null, // Not known until the pointer stops
                }));
            });

            if (!allowed) { return false; }

            col.data('ge-resize-from', from);
            col.data('ge-resize-units', currentUnits(col));
            resizeReadout(col, sizeLabel(col.data('ge-resize-units')));

            return true;
        }

        function resizeMove(col, width) {
            resizeReadout(col, sizeLabel(snapUnits(col, width)));
        }

        function resizeStop(col, width) {
            var from = col.data('ge-resize-from');
            var started = col.data('ge-resize-units');
            var units = snapUnits(col, width);

            col.removeData('ge-resize-from').removeData('ge-resize-units');
            resizeReadout(col, '');
            stripPixelWidths(col);

            if (from === undefined) { return; }

            // A drag of a couple of pixels lands on the size it started from,
            // and is not a resize - not even of an equal or auto column,
            // which it would otherwise turn into a number
            if (units === started) { return; }

            var plan = planSize(col, units);
            if (!plan) { return; }

            operate(function() {
                writeSize(col, plan);
                balanceAfterResize(col, units - started);
                refreshUtilities(col);

                emit('after-resize', payloadFor('column', col, withCleared({
                    source: 'dragdrop',
                    from: from,
                    to: plan.size,
                }, plan.cleared)));
            });
        }

        /**
         * Move the delta into the following column, so a full row stays full.
         * It is part of the same gesture, so it is not announced separately.
         */
        /**
         * The column after takes what the resized one gave or took, unless it
         * is equal or auto: those take what is left by themselves.
         */
        function balanceAfterResize(col, delta) {
            var next = balanceSibling(col);
            if (!next || !delta) { return; }

            var size = currentSize(next);
            if (!isUnits(size)) { return; }

            var plan = planSize(next, size - delta);
            if (plan) {
                writeSize(next, plan);
                refreshUtilities(next);
            }
        }

        /**
         * Undo every list `sortable()` made, and only those.
         *
         * The registry is what makes that exact: deinit() is a public method,
         * so it can be called twice, and a list the host made sortable itself
         * is none of the editor's business.
         */
        function removeSortable() {
            $.each(sortables, function(_, instance) { instance.destroy(); });

            sortables = [];
        }

        function createRow() {
            return $('<div class="row" />');
        }

        /**
         * Put a freshly created node where the caller asked for it, through
         * the add events, and bring the canvas up to date so the new markup
         * gets its controls. With no placement option the node stays
         * detached, and placing it and calling reset() is the host's job
         * (spec 1.2).
         *
         * Returns the node, or null when a handler canceled the add. A call
         * made from inside an event handler is queued, and then returns the
         * node without knowing yet whether the add will be canceled.
         */
        function place(node, kind, options) {
            var placement = null;

            PLACEMENTS.forEach(function(name) {
                if (placement === null && options && options[name] !== undefined) {
                    placement = name;
                }
            });

            if (placement === null) { return node; }

            var target = $(options[placement]);
            var parent = (placement === 'appendTo' || placement === 'prependTo')
                ? target
                : target.parent();

            var add = function() {
                return addNode(kind, node, function() {
                    node[placement](options[placement]);
                }, { parent: parent, source: options.source || 'api' });
            };

            if (operationDepth > 0) {
                defer(add);
                return node;
            }

            return add();
        }

        /**
         * A row, optionally with columns in it: createRow([8, 4]).
         */
        function apiCreateRow(layout, options) {
            var row = createRow();

            if (layout !== undefined && !Array.isArray(layout) && !(layout && layout.row_cols)) {
                warn('createRow: the layout is an array of column sizes, as in [8, 4], or ' +
                    '{ row_cols, columns }. Making an empty row instead.');
                layout = [];
            }

            if (layout && !Array.isArray(layout)) { row = rowFromLayoutValue(layout); }

            (Array.isArray(layout) ? layout : []).forEach(function(size) {
                createColumn(size).appendTo(row);
            });

            return place(row, 'row', options);
        }

        /**
         * A column of `size` units, optionally holding `options.content`.
         */
        function apiCreateColumn(size, options) {
            options = options || {};

            // Going into a row with row-cols, no size is a size: the row's share
            var into = $(options.appendTo || options.prependTo || []).first();

            if (size === undefined && into.length && rowColsSource(into, leadingTier())) {
                size = null;
            } else if (!isUnits(size) && FLEX_SIZES.indexOf(size) === -1) {
                warn('createColumn: no column size given, using ' + MAX_COL_SIZE);
                size = MAX_COL_SIZE;
            }

            var column = createColumn(size, options.offset);
            if (options.content !== undefined) {
                column.find('.ge-content').html(options.content);
            }

            return place(column, 'column', options);
        }

        /**
         * A container of the given type, with its panes already in it.
         */
        function apiCreateContainer(type, options) {
            options = options || {};

            var definition = CONTAINERS[type];
            if (!definition) {
                warn('createContainer: no such container type "' + type + '"');
                return null;
            }

            return place(definition.create(options), type, options);
        }

        /** A pane appended to a container, through the add events. */
        function addPaneTo(container, type, options) {
            container = $(container);
            options = options || {};

            var definition = CONTAINERS[containerTypeOf(container)];

            if (!definition || containerTypeOf(container) !== type) {
                warn('this is not a ' + type + ' container');
                return null;
            }

            var pane = definition.addPane(container, options);

            return addNode(definition.paneKind, pane, function() {}, {
                parent: container,
                source: 'api',
                container: container,
            });
        }

        /**
         * Host markup wrapped as a grid-editor element (spec 4.5). What is
         * inside stays the host's; grid-editor owns the wrapper only.
         */

        /**
         * A shallow frozen copy of the settings for the instance handle, so a
         * host can read what the editor is running with without changing it
         * behind the editor's back. Arrays are copied; the objects inside them
         * are the host's own and stay shared.
         */
        function settingsCopy() {
            var copy = {};

            $.each(settings, function(key, value) {
                copy[key] = Array.isArray(value) ? value.slice() : value;
            });

            return Object.freeze(copy);
        }

        /**
         * A column sized for the current view: its tier, or the base class in
         * the all view. `offset` indents it, within the same 12 unit budget.
         */
        function createColumn(size, offset) {
            var rte = getRTE(settings.content_types[0]);
            var column = $('<div class="column"/>')
                .append(createDefaultContentWrapper().html(rte ? rte.initialContent : ''))
            ;

            // The tier being edited, or the base class in the all view
            var tier = tiersFor(curView)[0];
            var wanted = clamp({ size: size, offset: offset || 0, leading: 'offset' });

            setSize(column, tier, wanted.size === null ? size : wanted.size);
            setOffset(column, tier, wanted.offset);

            return column;
        }

        /**
         * Run custom content filter on init and deinit
         */
        function runFilter(isInit) {
            if (settings.custom_filter.length) {
                $.each(settings.custom_filter, function(key, func) {
                    if (typeof func == 'string') {
                        func = window[func];
                    }

                    func(canvas, isInit);
                });
            }
        }

        /**
         * Wrap column content in <div class="ge-content"> where neccesary
         */
        function wrapContent() {
            canvas.find('.column').each(function() {
                var col = $(this);
                var contents = $();

                col.children().each(function() {
                    var child = $(this);

                    // The editor's own furniture is not content and not a
                    // boundary either. The resize handle used to be treated as
                    // content and wrapped into a content area of its own on
                    // the next init.
                    if (child.is('.ge-tools-drawer, .ge-resize-handle')) { return; }

                    // A container sits in the column beside the content
                    // areas, not inside one, so it ends a run of loose
                    // content rather than joining it
                    if (child.is('.row, .ge-content, [data-ge-container]')) {
                        contents = doWrap(contents);
                    } else {
                        contents = contents.add(child);
                    }
                });

                doWrap(contents);
            });
        }

        /**
         * Wrap a run of loose column content in a content area, and hand back
         * an empty set: the caller has to forget what it just wrapped, or the
         * next boundary wraps the same nodes again and leaves the first
         * wrapper behind, empty.
         */
        function doWrap(contents) {
            if (contents.length) {
                var contentArea = createDefaultContentWrapper().insertAfter(contents.last());
                contents.appendTo(contentArea);
            }

            return $();
        }

        /**
         * A content area for the first content type. With no content types
         * it is a content area and nothing more: there is no type to name.
         */
        function createDefaultContentWrapper() {
            var type = settings.content_types[0];
            var contentArea = $('<div class="ge-content"/>');

            if (type) {
                contentArea.addClass('ge-content-type-' + type).attr('data-ge-content-type', type);
            }

            return contentArea;
        }

        /**
         * Constrain the canvas to the view's preview width and make that
         * tier's classes the effective ones. The all view constrains nothing:
         * every tier is live, which is how the page will really render.
         */
        function switchLayout(view) {
            curView = view;

            VIEW_KEYS.forEach(function(key) {
                canvas.toggleClass('ge-layout-' + key, key === view);
            });
            layoutDropdown.find('button').text(t(labelKeyFor(view)));
        }

        /**
         * The view key a caller asked for, or null. 2.x callers passed a
         * layout mode index, which still works and says so once.
         */
        function viewKey(view) {
            if (typeof view == 'number') {
                warnOnceHere('changeView-index', 'changeView(' + view + '): layout modes are ' +
                    'identified by breakpoint key now, so pass one of ' +
                    JSON.stringify(VIEW_KEYS) + '. Numeric indexes still work, ' +
                    'but they mean what they meant in 2.x (' +
                    LEGACY_VIEW_INDEXES.join(', ') + ') and will be dropped.');
                return LEGACY_VIEW_INDEXES[view] || null;
            }

            return VIEW_KEYS.indexOf(view) === -1 ? null : view;
        }

        function changeView(view) {
            var key = viewKey(view);

            if (key === null) {
                warn('changeView(' + JSON.stringify(view) + '): no such layout mode');
                return;
            }

            var from = curView;
            switchLayout(key);

            if (key === from) { return; }

            canvas.find('.ge-utilities').each(function() { renderUtilities($(this)); });
            refreshPreviews(canvas);
            plugins('onViewChange', key);
            emit('view-change', { canvas: canvas, breakpoint: key, from: from, to: key });
        }

        function getView() {
            return curView;
        }
        
        function getRTE(type) {
            return $.fn.gridEditor.RTEs[type];
        }

        /**
         * The instance handle, documented API as of 3.0: the methods the
         * plugin dispatches, plus the settings and the canvas. A host holding
         * this can call several methods without dispatching each one.
         */
        var handle = {
            getHtml: getHtml,
            getPlainHtml: getPlainHtml,
            // init and reset are deferred when a handler calls them, so an
            // operation in flight finishes before the canvas is rebuilt
            init: function() { defer(init); },
            reset: function() { defer(reset); },
            deinit: deinit,
            destroy: destroy,
            remove: deprecatedRemove,
            changeView: changeView,
            getView: getView,
            createRow: apiCreateRow,
            createColumn: apiCreateColumn,
            createElement: function(content, options) {
                if (!featureMethods.createElement) {
                    warnOnceHere('plugin:elements', 'createElement needs the elements plugin: ' +
                        'include dist/plugins/grideditor.elements.js after the editor');
                    return null;
                }

                return featureMethods.createElement(content, options);
            },
            createSection: function(options) {
                if (!featureMethods.createSection) {
                    warnOnceHere('plugin:sections', 'createSection needs the sections plugin: ' +
                        'include dist/plugins/grideditor.sections.js after the editor');
                    return null;
                }

                return featureMethods.createSection(options);
            },
            createContainer: apiCreateContainer,
            addTab: function(container, options) { return addPaneTo(container, 'tabs', options); },
            addAccordionItem: function(container, options) {
                return addPaneTo(container, 'accordion', options);
            },
            setLocale: setLocale,
            getUtility: getUtility,
            setUtility: setUtility,
            canvas: canvas,
            settings: settingsCopy(),
        };

        // Methods a later phase fills in: registered, so calling one gets a
        // warning and null rather than silence.
        $.each(METHODS, function(name, descriptor) {
            if (!descriptor.unimplemented) { return; }

            handle[name] = function() {
                warnOnceHere(name, name + ' is registered but not implemented in this build yet');
                return null;
            };
        });

        baseElem.data('grideditor', handle);

        loadPlugins();
        setup();
        init();

    });

    return self;

};

$.fn.gridEditor.RTEs = {};

/**
 * Container plugins: tabs, accordions, popups, and whatever a host writes.
 *
 * A plugin is a factory registered under the type it builds, called once per
 * editor with the handle described in docs/plugins.md. Loading its file is
 * what makes the type available; the `plugins` setting narrows that list.
 *
 *   $.fn.gridEditor.containers.carousel = function(ge) {
 *       return { labelKey: ..., create: ..., mark: ..., unmark: ... };
 *   };
 */
$.fn.gridEditor.containers = {};

/**
 * Feature plugins: a piece of the editor that is not a container type, in a
 * file of its own. Element level controls are one. Same bargain as a
 * container plugin - a factory under its name, called once per editor with
 * the handle in docs/plugins.md - and the same `plugins` setting decides
 * which of the loaded ones are used.
 */
$.fn.gridEditor.features = {};

/**
 * Utility plugins: Bootstrap's responsive utility classes - order-md-2,
 * d-lg-none - edited per breakpoint. A plugin declares families of classes
 * and the editor reads them, writes them, puts them in the settings panel and
 * previews them in each view. Same factory, same `plugins` setting.
 *
 *   $.fn.gridEditor.utilities.order = function(ge) {
 *       return { families: [{ name: 'order', prefix: 'order', values: [...] }] };
 *   };
 */
$.fn.gridEditor.utilities = {};

/** Translator for the editor integrations, which get settings and no instance. */
$.fn.gridEditor.t = translate;

/**
 * Locale registry: code -> { key: string }.
 *
 * English is built in rather than shipped as a file, because it is where every
 * lookup ends: a page that loads no locale file still has a complete UI.
 * Removing a key from it is a breaking change. Locale files register
 * themselves here, see src/js/locales/.
 *
 * Every key is listed in docs/locale-keys.md, which test/locales.js holds to
 * this catalogue in both directions.
 */
$.fn.gridEditor.locales = {
    en: {
        'tool.move': 'Move',
        'tool.settings': 'Settings',
        'tool.add_row': 'Add row',
        'tool.add_column': 'Add column\n(hold to choose the width)',
        'tool.column_size': '{size} of 12',
        'tool.column_equal': 'Equal: shares what the row has left',
        'tool.column_auto': 'Auto: as wide as its content',
        'tool.delete_row': 'Remove row',
        'tool.delete_column': 'Remove col',
        'tool.delete_container': 'Remove container',
        'tool.delete_pane': 'Remove pane',
        'tool.rename': 'Double click to rename',
        'tool.column_narrower': 'Make column narrower\n(hold shift for min)',
        'tool.column_wider': 'Make column wider\n(hold shift for max)',
        'tool.indent_decrease': 'Decrease indent\n(hold shift for none)',
        'tool.indent_increase': 'Increase indent\n(hold shift for max)',
        'tool.edit_source': 'Edit Source Code',
        'tool.preview': 'Preview',
        'tool.id_placeholder': 'id',
        'tool.id_title': 'Set a unique identifier',
        'tool.classes_placeholder': 'classes',
        'tool.classes_title': 'Css classes, separated by spaces',
        'tool.toggle_class': 'Toggle "{label}" styling',
        'row.add': 'Add row {layout}',
        'row.add_row_cols': 'Add a row of {columns} columns, {counts} per row',
        'confirm.title': 'Confirm',
        'confirm.ok': 'Delete',
        'confirm.cancel': 'Cancel',
        'confirm.delete_row': 'Delete row?',
        'confirm.delete_column': 'Delete column?',
        'confirm.delete_container': 'Delete this container and everything in it?',
        'view.all': 'All sizes',
        'view.xs': 'Phone',
        'view.sm': 'Tablet',
        'view.md': 'Small desktop',
        'view.lg': 'Desktop',
        'view.xl': 'Large desktop',
        'view.xxl': 'Widescreen',
        'utility.section': 'Responsive: {view}',
        'utility.col_width': 'Width',
        'utility.col_equal': 'Equal',
        'utility.col_auto': 'Auto',
        'utility.col_from_row': 'From the row: {count}',
        'utility.row_cols': 'Columns per row',
        'badge.row_cols': '{count} per row',
        'badge.row_cols_auto': 'As wide as their content',
        'utility.default': 'Default',
        'utility.inherit': 'Inherit: {value} (from {breakpoint})',
        'utility.varies': 'Changes at {breakpoints}; choosing here replaces that',
        'error.sortable_missing': 'SortableJS not available! Make sure you loaded the Sortable js file; dragging is off without it.',
        'warning.setting_removed': 'The {setting} setting was removed in 4.0. Use {replacement} instead.',
        'error.tinymce_missing': 'tinyMCE not available! Make sure you loaded the tinyMCE js file.',
        'error.ckeditor_missing': 'CKEditor not available! Make sure you loaded the ckeditor and jquery adapter js files.',
        'error.summernote_missing': 'Summernote not available! Make sure you loaded the Summernote js file.',
    },
};

})( jQuery );
(function($) {
    $.fn.gridEditor.RTEs.ckeditor = {

        init: function(settings, contentAreas) {

            if (!window.CKEDITOR) {
                console.error($.fn.gridEditor.t(settings, 'error.ckeditor_missing'));
            }

            var self = this;
            contentAreas.each(function() {
                var contentArea = $(this);
                if (!contentArea.hasClass('active')) {
                    if (contentArea.html() == self.initialContent) {
                        // CKEditor kills this '&nbsp' creating a non usable box :/ 
                        contentArea.html('&nbsp;'); 
                    }
                    
                    // Add the .attr('contenteditable',''true') or CKEditor loads readonly
                    contentArea.addClass('active').attr('contenteditable', 'true');
                    
                    var configuration = $.extend(
                        {},
                        (settings.ckeditor && settings.ckeditor.config ? settings.ckeditor.config : {}), 
                        {
                            // Focus editor on creation
                            on: {
                                instanceReady: function( evt ) {
                                    // Call original instanceReady function, if one was passed in the config
                                    var callback;
                                    try {
                                        callback = settings.ckeditor.config.on.instanceReady;
                                    } catch (err) {
                                        // No callback passed
                                    }
                                    if (callback) {
                                        callback.call(this, evt);
                                    }

                                    // The editor owns what is inside the
                                    // content area now, so the grid editor is
                                    // told to put its own furniture back
                                    contentArea.trigger('ge-rte-ready');

                                    instance.focus();
                                }
                            }
                        }
                    );
                    var instance = CKEDITOR.inline(contentArea.get(0), configuration);
                }
            });
        },

        deinit: function(settings, contentAreas) {
            contentAreas.filter('.active').each(function() {
                var contentArea = $(this);
                
                // Destroy all CKEditor instances
                $.each(CKEDITOR.instances, function(_, instance) {
                    instance.destroy();
                });

                // Cleanup
                contentArea
                    .removeClass('active cke_focus')
                    .removeAttr('id')
                    .removeAttr('style')
                    .removeAttr('spellcheck')
                    .removeAttr('contenteditable')
                ;
            });
        },

        initialContent: '<p>Lorem initius... </p>',
    };
})(jQuery);
(function($) {

    $.fn.gridEditor.RTEs.summernote = {

        init: function(settings, contentAreas) {
            
            if (!jQuery().summernote) {
                console.error($.fn.gridEditor.t(settings, 'error.summernote_missing'));
            }

            var self = this;
            contentAreas.each(function() {
                var contentArea = $(this);
                if (!contentArea.hasClass('active')) {
                    if (contentArea.html() == self.initialContent) {
                        contentArea.html('');
                    }
                    contentArea.addClass('active');

                    var configuration = $.extend(
                        true, // deep copy
                        {},
                        (settings.summernote && settings.summernote.config ? settings.summernote.config : {}),
                        {
                            tabsize: 2,
                            airMode: true,
                            // Focus editor on creation
                            callbacks: {
                                onInit: function() {
                                    
                                    // Call original oninit function, if one was passed in the config
                                    var callback;
                                    try {
                                        callback = settings.summernote.config.callbacks.onInit;
                                    } catch (err) {
                                        // No callback passed
                                    }
                                    if (callback) {
                                        callback.call(this);
                                    }

                                    // The editor owns what is inside the
                                    // content area now, so the grid editor is
                                    // told to put its own furniture back
                                    contentArea.trigger('ge-rte-ready');
                                    
                                    contentArea.summernote('focus');
                                }
                            }
                        }
                    );
                    contentArea.summernote(configuration);
                }
            });
        },

        deinit: function(settings, contentAreas) {
            contentAreas.filter('.active').each(function() {
                var contentArea = $(this);
                contentArea.summernote('destroy');
                contentArea
                    .removeClass('active')
                    .removeAttr('id')
                    .removeAttr('style')
                    .removeAttr('spellcheck')
                ;
            });
        },

        initialContent: '<p>Lorem ipsum dolores</p>',
    };
})(jQuery);

(function($) {

    // tinyMCE snapshots the target element's attributes when an inline editor is
    // created and restores them on remove(), so this has to run *after* remove()
    // to keep the grid editor's own class and tinyMCE's leftovers off the element.
    function cleanUp(contentArea) {
        contentArea
            .removeClass('active')
            .removeClass('ge-rte-active')
            .removeAttr('id')
            .removeAttr('style')
            .removeAttr('spellcheck')
            .removeAttr('contenteditable')
            .removeAttr('data-mce-style')
        ;
    }

    $.fn.gridEditor.RTEs.tinymce = {

        init: function(settings, contentAreas) {

            if (!window.tinymce) {
                console.error($.fn.gridEditor.t(settings, 'error.tinymce_missing'));
                return;
            }

            var self = this;
            var userConfig = (settings.tinymce && settings.tinymce.config) ? settings.tinymce.config : {};

            contentAreas.each(function() {
                var contentArea = $(this);
                if (contentArea.hasClass('active')) { return; }

                if (contentArea.html() == self.initialContent) {
                    contentArea.html('');
                }
                contentArea.addClass('active');

                var configuration = $.extend({
                    // tinyMCE's own "Upgrade" badge in the menubar. Off by
                    // default because an inline editor here is a column of
                    // someone's page, not tinyMCE's own interface; a host that
                    // wants it back passes promotion: true.
                    promotion: false,
                }, userConfig, {
                    target: this,
                    inline: true,
                    init_instance_callback: function(editor) {
                        // deinit ran before this init finished, so tear it down again
                        if (contentArea.data('ge-tinymce-pending-remove')) {
                            contentArea.removeData('ge-tinymce-pending-remove');
                            editor.remove();
                            // deinit already ran and cannot clean up after this
                            // late remove(), so do it here instead
                            cleanUp(contentArea);
                            return;
                        }

                        contentArea.data('ge-tinymce', editor);

                        // The editor rewrote what is inside this content area
                        // while it took it over, so whatever the grid editor
                        // had in there is gone. Saying so lets it put its own
                        // furniture back (see RTE_READY in the core).
                        contentArea.trigger('ge-rte-ready');

                        // The inline toolbar is laid out against the element's
                        // geometry at the moment tinyMCE draws it, and an
                        // element that has just appeared - a tab pane, an
                        // accordion body, a column whose width is still
                        // settling - may not have its own width yet. Asking
                        // for the ui again once the browser has laid the frame
                        // out measures it as it now is, instead of leaving a
                        // toolbar wrapped into a narrow column.
                        window.requestAnimationFrame(function() {
                            if (editor.removed || !editor.ui || !editor.ui.show) { return; }

                            editor.ui.show();
                        });

                        // And again whenever the user comes back to this
                        // editor: by then the element may have been resized,
                        // hidden and shown again - a tab switched away from
                        // and back, a column made narrower - and the toolbar
                        // is only ever as right as its last measurement.
                        editor.on('focus', function() {
                            window.requestAnimationFrame(function() {
                                if (editor.removed || !editor.ui || !editor.ui.show) { return; }

                                editor.ui.show();
                            });
                        });

                        // Bring focus to text field
                        editor.focus();

                        // Call the original callbacks, if any were passed in the config
                        if (userConfig.init_instance_callback) {
                            userConfig.init_instance_callback.call(this, editor);
                        }
                        // 'oninit' is the pre-6 name, honoured so existing configs keep working
                        if (userConfig.oninit) {
                            userConfig.oninit.call(this, editor);
                        }
                    }
                });
                // We always edit the element we were handed, so a selector in the
                // user config would only fight with target
                delete configuration.selector;

                window.tinymce.init(configuration);
            });
        },

        deinit: function(settings, contentAreas) {
            contentAreas.filter('.active').each(function() {
                var contentArea = $(this);
                var editor = contentArea.data('ge-tinymce');

                if (editor) {
                    contentArea.removeData('ge-tinymce');
                    editor.remove();
                } else {
                    // tinymce.init() is asynchronous, so the editor may not exist
                    // yet. Leave a note for init_instance_callback to remove it.
                    contentArea.data('ge-tinymce-pending-remove', true);
                }

                cleanUp(contentArea);
            });
        },

        initialContent: '<p>Lorem ipsum dolores</p>',
    };
})(jQuery);
