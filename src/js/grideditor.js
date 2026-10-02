/**
 * Grid editor.
 *
 * A fork of https://github.com/Friendly-Pixel/grid-editor by Simon Epskamp,
 * maintained at https://github.com/themarioga/grid-editor.
 *
 * Plain DOM: nothing here needs jQuery. A page written against the jQuery
 * API loads grideditor.jquery.js beside this file.
 */
import * as dom from './dom.js';

/**
 * The methods an instance has, and which of them hand back something other
 * than the instance: html, a view key, a created node. After destroy() every
 * one of them is a no-op that says so once, and the value methods answer
 * null - but for getHtml and getPlainHtml, which read the element as it is.
 */
var METHODS = {
    getHtml:          { value: true },
    getPlainHtml:     { value: true },
    init:             {},
    deinit:           {},
    reset:            {},
    destroy:          {},
    changeView:       {},
    getView:          { value: true },
    createRow:        { value: true },
    createColumn:     { value: true },
    createElement:    { value: true },
    createText:       { value: true },
    createSection:    { value: true },
    createContainer:  { value: true },
    addTab:           { value: true },
    addAccordionItem: { value: true },
    setLocale:        {},
    getUtility:       { value: true },
    setUtility:       { value: true },
    getActiveTarget:  { value: true },
    setActiveTarget:  {},
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
        types: [], // The elements the toolbar offers: { type, html, label | labelKey, iconClass, group }
    },
    resize: {
        enabled: true, // The handle on the column's edge
        tools: true, // The narrower and wider tools in the column's drawer
        handles: 'e', // Which edges carry a handle: 'e', 'w', or 'e, w'
        balance: 'next', // 'next' takes the units out of the following column
    },
    indent: {
        tools: true, // The indent tools in the column's drawer
    },
    drag: {
        delay: 0, // Milliseconds to hold before a drag starts
        touch_delay: 100, // The same for touch, where 0 eats the page's scrolling
        threshold: 3, // Pixels of movement before a gesture counts as a drag
        animation: 150, // Milliseconds of reordering animation, 0 for none
        scroll: true, // Scroll the page when a drag reaches its edge
    },
};

var warned = {};

/** Editors on the page, counted so each one's sortable groups are its own. */
var editorCounter = 0;

/** The editor on each canvas element, so there is never a second one. */
var instances = new WeakMap();

/**
 * Translate one key.
 *
 * Lookup order is locale_strings, then the selected locale, then English,
 * then the key itself, so a missing string is a visible key and never an
 * empty tooltip. `params` fills {name} placeholders.
 *
 * Exposed as GridEditor.t for the plugins that have settings and no
 * instance of their own.
 */
function translate(settings, key, params) {
    var locales = GridEditor.locales;
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

/** Whether some locale has a string for the key, asked without the warning a missing one gets. */
function hasString(settings, key) {
    var locales = GridEditor.locales;

    return (settings.locale_strings || {})[key] !== undefined ||
        (locales[settings.locale] || {})[key] !== undefined ||
        locales.en[key] !== undefined;
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

/** A string in English, for the few things said before an editor has settings. */
function english(key, params) {
    return translate({ locale: 'en' }, key, params);
}

/**
 * The element an editor goes on: an element, or the first one a selector
 * matches. Anything else is a mistake worth throwing for, since there is no
 * editor to hand back.
 */
function targetElement(target) {
    if (typeof target === 'string') {
        var found = document.querySelector(target);
        if (!found) { throw new TypeError('grid-editor: no element matches ' + JSON.stringify(target)); }
        return found;
    }

    if (target && target.nodeType === 1) { return target; }

    throw new TypeError('grid-editor: the target is an element or a selector, not ' +
        (target === null ? 'null' : typeof target));
}

/** A node a caller handed in, as an element: an element, a selector's first match, or null. */
function nodeFrom(node) {
    if (typeof node === 'string') { return document.querySelector(node); }
    return node && node.nodeType === 1 ? node : null;
}

/**
 * SortableJS, and Bootstrap's Modal, as the host provided them: assigned to
 * GridEditor by a page that imports them as modules, or the page's globals.
 */
function sortableLibrary() {
    return GridEditor.Sortable || window.Sortable || null;
}

function modalLibrary() {
    var bootstrap = GridEditor.bootstrap || window.bootstrap;
    return bootstrap && bootstrap.Modal ? bootstrap.Modal : null;
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
    var root = document.implementation.createHTMLDocument('').body;
    root.innerHTML = html;
    var emptied = [];

    dom.all(root, '*').forEach(function(node) {
        var marked = false;

        Array.prototype.slice.call(node.attributes).forEach(function(attribute) {
            if (attribute.name.indexOf('data-ge-') === 0) {
                node.removeAttribute(attribute.name);
                marked = true;
            }
        });

        var classes = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
        var kept = classes.filter(function(name) {
            return name !== 'column' && name.indexOf('ge-') !== 0;
        });
        if (kept.length !== classes.length) { marked = true; }
        if (kept.length) {
            node.setAttribute('class', kept.join(' '));
        } else {
            node.removeAttribute('class');
        }

        if (marked && node.tagName === 'DIV' && !node.attributes.length) {
            emptied.push(node);
        }
    });

    emptied.forEach(function(div) {
        dom.unwrap(div);
    });

    return root.innerHTML;
}

/**
 * An editor on `target`: an element, or the first one a selector matches.
 *
 *   var ge = new GridEditor('#myGrid', { new_row_layouts: [[12], [6, 6]] });
 *   var html = ge.getHtml();
 *
 * An element carries one editor at most: asked for a second, this hands back
 * the one it has, with the options it was made with, and says so once.
 */
function GridEditor(target, options) {
    var element = targetElement(target);
    var existing = instances.get(element);

    if (existing) {
        if (!doubleWarned.has(element)) {
            doubleWarned.add(element);
            warn(english('warning.already_editing'));
        }
        return existing;
    }

    if (!(this instanceof GridEditor)) { return new GridEditor(element, options); }

    build(this, element, options || {});
}

/** The elements a second editor was asked for on, so each is told about once. */
var doubleWarned = new WeakSet();

GridEditor.create = function(target, options) {
    return new GridEditor(target, options);
};

/** The editor on `target`, or null. */
GridEditor.get = function(target) {
    var element = nodeFrom(target);
    return element ? instances.get(element) || null : null;
};

function build(instance, baseElem, optionsOrMethod) {

        var settings = Object.assign({
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
                                            iconClass: 'bi bi-image',
                                            on: { click: function(event) {} }
                                        } ]
                                    */
            'row_tools'         : [],
            'drag_handle'       : 'tool', // 'tool' for the move tool, 'drawer' for the whole drawer
            'toolbar_drag'      : 'auto', // Drag the toolbar's buttons onto the canvas. 'auto' follows drag_handle
            'toolbar_overflow'  : 'menu', // What doesn't fit on one line: 'menu' behind a button, 'wrap' onto another line
            'drawer_overflow'   : 'menu', // The same for the drawers' tools: 'menu' behind a button, 'wrap' onto another line
            'toolbar_groups'    : false, // The add buttons in categories, one shown at a time, picked with tabs
            'active_target'     : false, // A click in a column makes it where the toolbar's buttons add
            'element_tools'     : [], // Host tools on element drawers, same shape as row_tools
            'element_classes'   : [], // Preset class toggles on an element's settings panel
            // content_types, text_tools and text_classes are the text editor
            // plugins' settings: see grideditor.text.js
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
            'valid_col_sizes'   : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'equal', 'auto'],
            'valid_col_offsets' : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'add_column'        : NESTED_SETTINGS.add_column, // The add column tool
            'layout_modes'      : VIEW_KEYS.slice(), // Which views the dropdown offers
            'default_view'      : ALL_VIEW,
            'resize'            : NESTED_SETTINGS.resize, // Resizing a column by dragging its edge
            'indent'            : NESTED_SETTINGS.indent, // Indenting a column, offset-*
            'source_textarea'   : '',
            'edit_source'       : true, // The toolbar's button to edit the canvas as html
            'locale'            : 'en', // Code of a locale in GridEditor.locales
            'locale_strings'    : {}, // Overrides for individual keys
            'callbacks'         : {}, // before_*/after_* functions, the events by another route
            'confirm_delete'    : true, // Ask before deleting a row or a column
            'settings_panel'    : 'offcanvas', // Where a node's settings open: 'offcanvas', 'popover', 'modal' or 'inline'
            'drag'              : NESTED_SETTINGS.drag // How a drag behaves, whatever drives it
        }, optionsOrMethod);

        // Merged rather than replaced, so `elements: { auto: true }` keeps the
        // default selector instead of losing it
        Object.keys(NESTED_SETTINGS).forEach(function(name) {
            settings[name] = Object.assign({}, NESTED_SETTINGS[name], settings[name]);
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
        var sourceOpen = false; // Whether the canvas is being edited as html
        var dropMarker = null; // The line showing where a dragged toolbar button would land
        var activeTarget = null; // The column or region the toolbar adds to, with active_target
        var toolbarLifetime = null; // Aborted when the toolbar is rebuilt or taken away
        var closeOverflowMenu = function() {}; // Folds the toolbar's overflow menu away, when it has one
        var refitToolbar = function() {}; // Works out again what the toolbar's overflow menu holds, when it has one
        var addButtons = []; // The toolbar's add buttons, in toolbar order: { button, home, group }
        var toolbarGroup = null; // The category shown, with toolbar_groups. Kept when the toolbar is rebuilt
        var warnedHere = {}; // Some warnings are worth saying once per instance, not once per call
        var sortables = []; // Every list made sortable, so deinit destroys exactly those
        var instanceId = ++editorCounter; // Scopes the sortable groups to this editor
        var destroyed = false;

        // What the editor remembers about the nodes it edits, which used to
        // be jQuery data: a node's settings panel, a drag or a resize in
        // progress. Kept off the markup, and gone with the node.
        var detailsFor = new WeakMap(); // node -> its settings panel
        var moves = new WeakMap(); // dragged node -> { from, canceled }
        var resizes = new WeakMap(); // column -> { from, units }
        var sectionNodes = new WeakMap(); // Responsive section -> the node it edits
        var editableLabels = new WeakSet(); // labels made editable in place

        // Listeners the editor puts on things it does not own - the window,
        // the document, the canvas - taken off together by destroy()
        var lifetime = new AbortController();

        // Before anything else, because the instance hands the canvas to
        // hosts and the rest of setup() runs at the end of this function
        canvas = dom.addClass(baseElem, 'ge-canvas');

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
            instance.settings = settingsCopy();

            removeConfirmModal();
            removeSettingsPanels();
            removeDialog();
            removeMainControls();
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
         * delete, which is not the same as the node's parent while the node is
         * still detached - so an add passes it in.
         */
        function payloadFor(kind, node, extra) {
            return Object.assign({
                kind: kind,
                node: node,
                parent: node.parentElement,
                canvas: canvas,
                breakpoint: getView(),
                source: 'api',
            }, extra || {});
        }

        /**
         * Deliver one notification twice: as a DOM event on the canvas - the
         * specific name first, then the generic one - and as the matching
         * settings.callbacks entries. Everything is delivered whatever the
         * first listener says, and the answer is whether any of them canceled,
         * which only means something for a before-* notification.
         *
         * A listener that throws is the browser's to report: the other
         * listeners, the callbacks and the operation go on.
         */
        function emit(name, payload) {
            var names = [name];
            var generic = name.replace(/^(before|after)-add-.+$/, '$1-add');
            if (generic !== name) { names.push(generic); }

            var canceled = false;

            names.forEach(function(eventName) {
                var event = new CustomEvent('grideditor:' + eventName, {
                    detail: payload,
                    bubbles: true,
                    cancelable: true,
                });
                if (!canvas.dispatchEvent(event)) { canceled = true; }
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
            return GridEditor.containers[kind] ? 'container' : kind;
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
         * asked - by the browser, as before. A page that imports Bootstrap as
         * a module hands its Modal over as GridEditor.bootstrap.
         */
        function askToDelete(message, whenConfirmed) {
            if (!settings.confirm_delete) {
                whenConfirmed();
                return;
            }

            var Modal = modalLibrary();

            if (!Modal) {
                if (window.confirm(message)) { whenConfirmed(); }
                return;
            }

            var modal = confirmModal();
            var confirmed = false;

            dom.one(modal, '.ge-confirm-message').textContent = message;
            dom.one(modal, '.ge-confirm-ok').onclick = function() {
                confirmed = true;
                Modal.getInstance(modal).hide();
            };

            confirmHandlers.hidden = function() {
                // After the modal is out of the way, so the backdrop is not
                // sitting over the animation the delete runs
                if (confirmed) { whenConfirmed(); }
            };

            confirmHandlers.shown = function() {
                dom.one(modal, '.ge-confirm-ok').focus();
            };

            Modal.getOrCreateInstance(modal).show();
        }

        // What the confirm modal does when Bootstrap says it is shown or
        // hidden: this question's answer, replaced by the next question's
        var confirmHandlers = { hidden: null, shown: null };

        /** Built once per instance, and taken away again by destroy(). */
        function confirmModal() {
            if (confirmDialog) { return confirmDialog; }

            confirmDialog = dom.create(
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
            );
            document.body.appendChild(confirmDialog);

            dom.one(confirmDialog, '.modal-title').textContent = t('confirm.title');
            dom.one(confirmDialog, '.btn-close').setAttribute('aria-label', t('confirm.cancel'));
            dom.one(confirmDialog, '.ge-confirm-cancel').textContent = t('confirm.cancel');
            dom.one(confirmDialog, '.ge-confirm-ok').textContent = t('confirm.ok');

            trackModal(confirmDialog);
            confirmDialog.addEventListener('hidden.bs.modal', function() {
                if (confirmHandlers.hidden) { confirmHandlers.hidden(); }
            });
            confirmDialog.addEventListener('shown.bs.modal', function() {
                if (confirmHandlers.shown) { confirmHandlers.shown(); }
            });

            return confirmDialog;
        }

        /** The confirm modal is rebuilt in the new language on setLocale. */
        function removeConfirmModal() {
            if (!confirmDialog) { return; }

            // Its answer is not wanted any more: the editor it asked for is going
            confirmHandlers.hidden = null;
            confirmHandlers.shown = null;
            retireModal(confirmDialog);
            confirmDialog = null;
        }

        /**
         * Take a Bootstrap modal away. One out of sight goes at once. One that
         * is showing, or on its way in or out, is asked to hide and goes when
         * Bootstrap says it is hidden: Bootstrap finishes a transition on the
         * node it started it on, and a node taken away under it throws, and
         * leaves the page's body locked, with no scrolling.
         */
        function retireModal(panel) {
            var Modal = modalLibrary();
            var modal = Modal ? Modal.getInstance(panel) : null;
            var gone = false;
            var finish = function() {
                if (gone) { return; }
                gone = true;
                if (modal) { modal.dispose(); }
                panel.remove();
            };

            if (!modal || (!modalMoving.get(panel) && !dom.hasClass(panel, 'show'))) {
                finish();
                return;
            }

            panel.addEventListener('hidden.bs.modal', finish, { once: true });
            // Still on its way in, it ignores a hide: once it is in, it takes one
            panel.addEventListener('shown.bs.modal', function() { modal.hide(); }, { once: true });
            modal.hide();
        }

        /** Whether a modal is between Bootstrap's show and shown, or hide and hidden. */
        var modalMoving = new WeakMap();

        function trackModal(panel) {
            dom.on(panel, 'show.bs.modal hide.bs.modal', function() { modalMoving.set(panel, true); });
            dom.on(panel, 'shown.bs.modal hidden.bs.modal', function() { modalMoving.set(panel, false); });
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
            var parent = node.parentElement;

            return {
                parent: parent,
                index: dom.children(parent).filter(function(child) {
                    return !dom.hasClass(child, 'ge-tools-drawer');
                }).indexOf(node),
            };
        }

        function kindOf(node) {
            var fromPlugin = null;

            Object.keys(FEATURES).forEach(function(name) {
                var feature = FEATURES[name];
                if (!fromPlugin && feature.kindOf) { fromPlugin = feature.kindOf(node); }
            });
            if (fromPlugin) { return fromPlugin; }

            if (node.getAttribute('data-ge-container')) { return node.getAttribute('data-ge-container'); }
            if (dom.hasClass(node, 'ge-tab')) { return 'tab'; }
            if (dom.hasClass(node, 'ge-accordion-item')) { return 'accordion-item'; }
            if (dom.hasClass(node, 'row')) { return 'row'; }
            if (dom.hasClass(node, 'column')) { return 'column'; }
            if (dom.hasClass(node, 'ge-element')) { return 'element'; }
            // A content area is a text when an editor's type is on it, and the
            // host's plain content when there is none
            if (dom.hasClass(node, 'ge-text-block')) { node = dom.child(node, '.ge-content') || node; }
            if (dom.hasClass(node, 'ge-content')) { return node.getAttribute('data-ge-content-type') ? 'text' : 'plain'; }
            return 'node';
        }

        // Copy html to sourceElement if a source textarea is given
        if (settings.source_textarea) {
            var sourceHtml = nodeFrom(settings.source_textarea).value;
            // Html with no grid in it goes into a row and a full width column
            // of its own, where init wraps it as the host's plain content
            var probe = dom.element('div');
            probe.innerHTML = sourceHtml;
            if (sourceHtml.length > 0 && !probe.querySelector('.row')) {
                sourceHtml = '<div class="row"><div class="col-lg-12">' + sourceHtml + '</div></div>';
            }
            dom.setHtml(baseElem, sourceHtml);
        }

        // Wrap content if it is non-bootstrap
        if (baseElem.children.length && !baseElem.querySelector('div.row')) {
            var children = dom.children(baseElem);
            var newRow = dom.create('<div class="row"><div class="col-lg-12"></div></div>');
            baseElem.appendChild(newRow);
            children.forEach(function(child) { newRow.firstChild.appendChild(child); });
        }

        // setup() and init() run at the end of this function, once every
        // table and helper below has been assigned: the toolbar is built from
        // the container registry, and a var declared later is not there yet.

        function setup() {
            htmlTextArea = dom.element('textarea', { 'class': 'ge-html-output' });
            canvas.parentNode.insertBefore(htmlTextArea, canvas);

            createMainControls();
            watchDrawers();

            var signal = { signal: lifetime.signal };

            // Make controls fixed on scroll
            window.addEventListener('scroll', onScroll, signal);

            /* A click on the host's plain content offers to make it a text */
            dom.delegate(canvas, 'click', '.ge-content', onContentClick, signal);

            /* A trigger is often a link, and a link still navigates even
               with its Bootstrap attributes suspended */
            dom.delegate(canvas, 'click', '.ge-popup-trigger, [data-ge-popup-target]', function(e) {
                if (dom.hasClass(canvas, 'ge-editing')) { e.preventDefault(); }
            }, signal);

            if (settings.active_target) {
                // Whatever the click was for - a text, a tool - it also says
                // where the toolbar adds next. A click on no column or region
                // says nowhere, and the toolbar adds to the canvas again.
                // The click a drag ends in - a resize, a move - is not one:
                // it comes where the pointer let go, not where it pressed
                var pressed = null;
                canvas.addEventListener('pointerdown', function(e) {
                    pressed = { x: e.clientX, y: e.clientY };
                }, signal);
                canvas.addEventListener('click', function(e) {
                    var from = pressed;
                    pressed = null;
                    if (!dom.hasClass(canvas, 'ge-editing')) { return; }
                    if (from && Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y) > settings.drag.threshold) { return; }
                    var region = dom.closest(e.target, targetSelector());

                    // The target's own background, or its drawer's, clicked
                    // again takes it back. What is in it - a text, a tool, a
                    // nested column - keeps it, or makes that the target
                    if (region && region === activeTarget &&
                        (e.target === region || e.target === dom.child(region, '.ge-tools-drawer'))) {
                        changeTarget(null);
                        return;
                    }

                    changeTarget(region && region !== canvas && canvas.contains(region) ? region : null);
                }, signal);

                // Escape is the panel's, the dialog's, and a field's or a
                // text's while one has the focus; after those, it is this
                document.addEventListener('keydown', function(e) {
                    if (e.key !== 'Escape' || !activeTarget || openSettingsState || dialogState) { return; }
                    var focus = document.activeElement;
                    if (focus && (dom.is(focus, 'input, textarea, select') || focus.isContentEditable)) { return; }
                    changeTarget(null);
                }, signal);
            }
        }

        /**
         * A rich text editor rewrites the content area as it takes over,
         * which costs the element drawers inside it. The integrations say
         * when their editor is ready, and the drawers go back in.
         */
        function textReady(block) {
            if (!dom.is(block, '.ge-content') || !canvas.contains(block)) { return; }

            plugins('onContentReady', block);
            refreshPreviews(block);
        }

        /**
         * The toolbar above the canvas. Separate from setup() because every
         * string in it comes from the locale, so setLocale() rebuilds it.
         */
        function createMainControls() {
            mainControls = dom.element('div', { 'class': 'ge-mainControls' });
            htmlTextArea.parentNode.insertBefore(mainControls, htmlTextArea);
            wrapper = mainControls.appendChild(dom.element('div', { 'class': 'ge-wrapper ge-top' }));

            // With the overflow menu, the add buttons stand in a line of
            // their own that keeps to one line, beside the menu's button
            var overflowMenu = settings.toolbar_overflow !== 'wrap';
            var start = wrapper;
            if (overflowMenu) {
                dom.addClass(wrapper, 'ge-toolbar-menu');
                start = wrapper.appendChild(dom.element('div', { 'class': 'ge-toolbar-start' }));
            }

            addButtons = [];

            // Add row
            addRowGroup = start.appendChild(dom.element('div', { 'class': 'ge-addRowGroup btn-group' }));
            addContainerGroup = dom.element('div', { 'class': 'ge-addContainerGroup btn-group ms-1' });
            settings.new_row_layouts.forEach(function(layout) {
                var grouped = !Array.isArray(layout);
                var btn = dom.element('a', {
                    'class': 'btn btn-sm btn-light',
                    title: grouped
                        ? t('row.add_row_cols', { columns: layout.columns, counts: rowColsText(layout.row_cols) })
                        : t('row.add', { layout: layout.join('-') }),
                    // What this button makes, in the markup rather than in
                    // memory: a drag works on a clone of it
                    'data-ge-toolbar': 'row',
                    'data-ge-layout': grouped ? JSON.stringify(layout) : layout.join(','),
                });

                btn.addEventListener('click', function() {
                    if (activeTarget) { addToTarget(btn, 'tool'); return; }

                    var row = rowFromLayoutValue(layout);

                    var added = addNode('row', row, function() {
                        canvas.appendChild(row);
                    }, { parent: canvas, source: 'tool' });

                    if (added && row.scrollIntoView) {
                        row.scrollIntoView({behavior: 'smooth'});
                    }
                });
                addRowGroup.appendChild(btn);
                addButtons.push({ button: btn, home: addRowGroup, group: 'rows' });

                btn.appendChild(dom.create('<i class="bi bi-plus"></i>'));

                // A row of columns shares out the icon as they share the row;
                // a row with row-cols draws one line of its widest count
                var sizes = grouped ? rowColsIcon(layout) : layout;
                var icon = '<div class="row ge-row-icon">';
                sizes.forEach(function(size) {
                    icon += '<div class="column ' + sizeClass(BREAKPOINTS[0], size) + '"></div>';
                });
                icon += '</div>';
                btn.appendChild(dom.create(icon));
            });

            start.appendChild(addContainerGroup);

            // A container starts in a row of its own, the way the add row
            // buttons next to these ones do
            Object.keys(CONTAINERS).forEach(function(type) {
                var definition = CONTAINERS[type];
                var button = labelButton(dom.element('a', { 'class': 'btn btn-sm btn-light ge-add-container' }),
                    t(definition.labelKey), definition.iconClass);

                dom.attr(button, { 'data-ge-toolbar': 'container', 'data-ge-container-type': type });
                button.addEventListener('click', function() {
                    if (activeTarget) { addToTarget(button, 'tool'); return; }

                    var row = createRow();
                    var column = row.appendChild(createColumn(MAX_COL_SIZE));
                    var container = column.appendChild(definition.create({}));

                    addNode(type, container, function() {
                        canvas.appendChild(row);
                    }, { parent: canvas, source: 'tool' });
                });
                addContainerGroup.appendChild(button);
                addButtons.push({ button: button, home: addContainerGroup, group: toolbarGroupOf(definition.group) || 'content' });
            });

            // A feature plugin's own buttons, beside the containers': what
            // one makes goes onto the canvas, where the plugin says it belongs.
            // One with align 'end' goes on the right instead, as an icon,
            // beside the source and preview buttons.
            var endItems = [];
            Object.keys(FEATURES).forEach(function(name) {
                (FEATURES[name].toolbar || []).forEach(function(item, index) {
                    var button = featureButton(name, item, index);

                    if (item.align === 'end') {
                        endItems.push(button);
                    } else {
                        addContainerGroup.appendChild(button);
                        // One that names no category of its own has its plugin's
                        addButtons.push({ button: button, home: addContainerGroup, group: toolbarGroupOf(item.group) || name });
                    }
                });
            });

            // Buttons on right
            layoutDropdown = dom.create('<div class="dropdown pull-right ge-layout-mode">' +
                '<button type="button" class="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown"></button>' +
                    '<div class="dropdown-menu" role="menu"></div>' +
                '</div>');
            dom.delegate(layoutDropdown, 'click', 'a', function() {
                // Through changeView, so the dropdown and the method are
                // one path rather than two that have to agree
                changeView(this.getAttribute('data-ge-view'));
            });
            wrapper.appendChild(layoutDropdown);

            settings.layout_modes.forEach(function(view) {
                dom.one(layoutDropdown, '.dropdown-menu').appendChild(dom.element('a', {
                    'class': 'dropdown-item',
                    'data-ge-view': view,
                    title: t(labelKeyFor(view)),
                }, t(labelKeyFor(view))));
            });
            dom.one(layoutDropdown, 'button').textContent = t(labelKeyFor(curView));

            var btnGroup = wrapper.appendChild(dom.element('div', { 'class': 'btn-group pull-right' }));

            if (settings.edit_source) {
                // Built again by setLocale, maybe with the source open
                var htmlButton = dom.create('<button type="button" class="btn btn-sm btn-primary gm-edit-mode"><i class="bi bi-code-slash"></i></button>');
                htmlButton.setAttribute('title', t('tool.edit_source'));
                dom.toggleClass(htmlButton, 'active btn-danger', sourceOpen);
                htmlButton.addEventListener('click', function() {
                    if (sourceOpen) {
                        closeSource();
                    } else {
                        openSource();
                    }

                    dom.toggleClass(htmlButton, 'active btn-danger', sourceOpen);
                });
                btnGroup.appendChild(htmlButton);
            }

            var previewButton = dom.create('<button type="button" class="btn btn-sm btn-primary gm-preview"><i class="bi bi-eye-fill"></i></button>');
            var endPreview = function() {
                if (!dom.hasClass(previewButton, 'active')) {
                    dom.addClass(canvas, 'ge-editing');
                }
            };
            previewButton.setAttribute('title', t('tool.preview'));
            previewButton.addEventListener('mouseenter', function() {
                dom.removeClass(canvas, 'ge-editing');
            });
            previewButton.addEventListener('click', function() {
                dom.toggleClass(previewButton, 'active btn-danger');
                endPreview();
            });
            previewButton.addEventListener('mouseleave', endPreview);
            btnGroup.appendChild(previewButton);

            // Floated right after the source and preview buttons, so it
            // stands to their left. Not a btn-group: its buttons show one at
            // a time, and a hidden one still counts as a neighbour to
            // Bootstrap, which squares off the corners they would share.
            if (endItems.length) {
                var end = wrapper.appendChild(dom.element('div', { 'class': 'pull-right ge-toolbar-end' }));
                endItems.forEach(function(button) { end.appendChild(button); });
            }

            if (settings.toolbar_groups) { createGroupTabs(start); }
            if (overflowMenu) { createOverflowMenu(start); }

            makeToolbarDraggable();
        }

        /** The core's categories, ahead of the plugins' own. */
        var CORE_GROUPS = [
            { name: 'rows', labelKey: 'group.rows' },
            { name: 'content', labelKey: 'group.content' },
            { name: 'elements', labelKey: 'group.elements' },
        ];

        /** A plugin's category, when it names one. */
        function toolbarGroupOf(value) {
            return typeof value === 'string' && value.trim() !== '' ? value : null;
        }

        /**
         * toolbar_groups: tabs at the start of the toolbar, one per category
         * of add buttons, and only the chosen one's buttons on it. The rest
         * wait in a hidden stash inside the toolbar, so toolbarItems still
         * finds them and the btn-groups round the corners of what shows. With
         * a single category there is nothing to choose, and no tabs.
         */
        function createGroupTabs(start) {
            // The core's two first, then the rest as their first button comes
            var names = CORE_GROUPS.map(function(group) { return group.name; });
            addButtons.forEach(function(entry) {
                if (names.indexOf(entry.group) < 0) { names.push(entry.group); }
            });
            names = names.filter(function(name) {
                return addButtons.some(function(entry) { return entry.group === name; });
            });

            if (names.length < 2) { return; }

            var tabs = dom.element('div', { 'class': 'ge-toolbar-groups btn-group', role: 'tablist', 'aria-label': t('group.select') });
            start.insertBefore(tabs, start.firstChild);
            var stash = mainControls.appendChild(dom.element('div', { 'class': 'ge-toolbar-stash', hidden: 'hidden' }));

            names.forEach(function(name) {
                var tab = tabs.appendChild(dom.element('button', {
                    type: 'button',
                    'class': 'btn btn-sm btn-outline-secondary',
                    role: 'tab',
                    'data-ge-group': name,
                }, groupLabel(name)));

                tab.addEventListener('click', function() { showGroup(name); });
            });

            showGroup(names.indexOf(toolbarGroup) >= 0 ? toolbarGroup : names[0]);

            function showGroup(name) {
                toolbarGroup = name;

                addButtons.forEach(function(entry) {
                    (entry.group === name ? entry.home : stash).appendChild(entry.button);
                });

                dom.children(tabs).forEach(function(tab) {
                    var chosen = tab.getAttribute('data-ge-group') === name;
                    dom.toggleClass(tab, 'active', chosen);
                    tab.setAttribute('aria-selected', chosen ? 'true' : 'false');
                });

                refitToolbar();
            }
        }

        /** A category's label: its group.<name> string, or its first button's when it has none. */
        function groupLabel(name) {
            var key = 'group.' + name;
            if (hasString(settings, key)) { return t(key); }

            var first = addButtons.filter(function(entry) { return entry.group === name; })[0];
            return first.button.getAttribute('title') || name;
        }

        /** The add buttons on the toolbar's line: all of them, or the chosen category's. */
        function shownAddButtons() {
            return addButtons.filter(function(entry) { return !dom.closest(entry.button, '.ge-toolbar-stash'); });
        }

        /** The toolbar off the page, with what keeps its overflow menu up to date. */
        function removeMainControls() {
            if (toolbarLifetime) { toolbarLifetime.abort(); }
            toolbarLifetime = null;
            closeOverflowMenu = function() {};
            refitToolbar = function() {};
            mainControls.remove();
        }

        /**
         * The add buttons that don't fit on the toolbar's line, behind a
         * button at its end. They are the same buttons, moved rather than
         * copied, so a click, a drag or a plugin finding them with
         * toolbarItems works as it does on the line. Which ones go is worked
         * out again whenever the toolbar or what is on it changes size.
         */
        function createOverflowMenu(start) {
            var more = dom.create('<div class="ge-toolbar-more">' +
                '<button type="button" class="btn btn-sm btn-light"><i class="bi bi-three-dots"></i></button>' +
                '<div class="ge-toolbar-overflow">' +
                    '<div class="ge-addRowGroup btn-group"></div>' +
                    '<div class="ge-addContainerGroup btn-group"></div>' +
                '</div>' +
            '</div>');
            start.parentNode.insertBefore(more, start.nextSibling);

            var toggle = dom.one(more, 'button');
            var panel = dom.one(more, '.ge-toolbar-overflow');
            var spares = dom.all(panel, '.btn-group');
            // The spare group in the menu for each group on the line
            function spareOf(home) {
                return home === addRowGroup ? spares[0] : spares[1];
            }

            toggle.setAttribute('title', t('tool.more'));
            toggle.setAttribute('aria-haspopup', 'true');
            toggle.setAttribute('aria-expanded', 'false');

            var menuLifetime = toolbarLifetime = new AbortController();
            var signal = { signal: menuLifetime.signal };

            toggle.addEventListener('click', function() { openOverflow(!dom.hasClass(more, 'ge-open')); });
            // A button in the menu has done its job once it is clicked
            panel.addEventListener('click', function(e) {
                if (dom.closest(e.target, '[data-ge-toolbar]')) { openOverflow(false); }
            });
            document.addEventListener('pointerdown', function(e) {
                if (!more.contains(e.target)) { openOverflow(false); }
            }, signal);
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') { openOverflow(false); }
            }, signal);
            closeOverflowMenu = function() { openOverflow(false); };
            // A category chosen: another set of buttons to fit
            refitToolbar = fit;

            fit();

            if (window.ResizeObserver) {
                // Not in the callback itself: moving buttons there would
                // resize what is being observed before the frame is drawn
                var pending = false;
                var observer = new window.ResizeObserver(function() {
                    if (pending) { return; }
                    pending = true;
                    window.requestAnimationFrame(function() {
                        pending = false;
                        if (!menuLifetime.signal.aborted) { fit(); }
                    });
                });
                // The toolbar's width, and the buttons on the right of it
                // showing and hiding, as the paste button does
                observer.observe(wrapper);
                observer.observe(start);
                menuLifetime.signal.addEventListener('abort', function() { observer.disconnect(); });
            }

            function openOverflow(open) {
                open = open && dom.hasClass(more, 'ge-needed');
                dom.toggleClass(more, 'ge-open', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            }

            /** Back on the line, then the last ones off it until the rest fit. */
            function fit() {
                // Only the chosen category's, with toolbar_groups: the others
                // wait in their stash
                var homes = shownAddButtons();
                homes.forEach(function(entry) { entry.home.appendChild(entry.button); });
                dom.removeClass(more, 'ge-needed');

                if (start.scrollWidth <= start.clientWidth) {
                    openOverflow(false);
                    return;
                }

                dom.addClass(more, 'ge-needed');
                for (var i = homes.length - 1; i >= 0 && start.scrollWidth > start.clientWidth; i--) {
                    var into = spareOf(homes[i].home);
                    into.insertBefore(homes[i].button, into.firstChild);
                }
            }
        }

        /**
         * A toolbar button's face: the plugin's icon alone when it has one,
         * with its label as the title, or a plus and the label otherwise.
         */
        function labelButton(button, label, iconClass) {
            button.setAttribute('title', label);

            if (iconClass) {
                button.appendChild(dom.element('i', { 'class': iconClass }));
                return button;
            }

            button.appendChild(dom.create('<i class="bi bi-plus"></i>'));
            button.appendChild(dom.element('span', {}, label));
            return button;
        }

        /** A feature plugin's toolbar button. At the end it is always an icon, `bi bi-plus` if it has none of its own. */
        function featureButton(name, item, index) {
            var iconClass = item.iconClass || (item.align === 'end' ? 'bi bi-plus' : null);
            // A label of its own, worked out when the toolbar is built - and
            // built again by setLocale - or the string its labelKey names
            var label = typeof item.label === 'function' ? item.label() : (item.label || t(item.labelKey));
            // Grey with the add buttons on the left, blue with the source and
            // preview buttons on the right
            var colour = item.align === 'end' ? 'btn-primary' : 'btn-light';
            var button = labelButton(dom.element('a', { 'class': 'btn btn-sm ' + colour + ' ge-add-container ge-add-feature' }), label, iconClass);

            dom.addClass(button, item.className || '');
            dom.attr(button, {
                'data-ge-toolbar': 'feature',
                'data-ge-feature': name,
                'data-ge-item': index,
            });
            button.addEventListener('click', function() {
                if (activeTarget) { addToTarget(button, item.source || 'tool'); return; }

                var made = item.create();
                // A plugin that could not make one says so with null
                if (!made) { return; }

                // One that belongs in a column brings a row and a column
                // of its own, the way a container does
                var placed = item.inColumn ? inRowOfItsOwn(made) : made;

                var added = addNode(item.kind, made, function() {
                    canvas.appendChild(placed);
                }, { parent: canvas, source: item.source || 'tool' });

                if (added && item.inColumn && placed.scrollIntoView) {
                    placed.scrollIntoView({behavior: 'smooth'});
                }
            });

            return button;
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
            var buttons = dom.all(mainControls, '[data-ge-toolbar]');

            buttons.forEach(function(button) {
                dom.removeClass(button, 'ge-palette-button');
                button.removeEventListener('pointerdown', startToolbarDrag);
            });

            if (!toolbarDrags()) { return; }

            buttons.forEach(function(button) {
                dom.addClass(button, 'ge-palette-button');
                button.addEventListener('pointerdown', startToolbarDrag);
            });
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
            var button = e.currentTarget;
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

                    helper = dom.addClass(button.cloneNode(true), 'ge-toolbar-helper');
                    document.body.appendChild(helper);
                    // The menu a button came from would hide where it lands
                    closeOverflowMenu();
                    dom.addClass(canvas, 'ge-dropping');
                }

                dom.css(helper, { left: move.pageX - 14, top: move.pageY - 14 });
                showDropMarker(move.pageX, move.pageY);
            }

            function onUp(up) {
                document.removeEventListener('pointermove', onMove);
                dom.off(document, 'pointerup pointercancel', onUp);

                if (!helper) { return; }

                helper.remove();
                dom.removeClass(canvas, 'ge-dropping');
                hideDropMarker();

                // The click that follows a drag would add the block a second
                // time, at the end of the canvas. Caught on the way down, so
                // it never reaches the button's own handler.
                var swallow = function(click) {
                    if (click.target !== button && !button.contains(click.target)) { return; }
                    click.preventDefault();
                    click.stopImmediatePropagation();
                };
                window.addEventListener('click', swallow, { capture: true, once: true });
                // A drag the browser does not follow with a click leaves
                // nothing to swallow: the next click is a click
                window.setTimeout(function() { window.removeEventListener('click', swallow, { capture: true }); }, 0);

                var where = dropPlaceAt(up.pageX, up.pageY);
                if (where) { insertFromToolbar(button, where); }
            }

            // On the document, not on the button: until the gesture is far
            // enough along to be a drag there is nothing to capture the
            // pointer with, and the pointer has left the button by then
            document.addEventListener('pointermove', onMove);
            dom.on(document, 'pointerup pointercancel', onUp);
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

            var region = dom.closest(under, ['.column', '.ge-canvas'].concat(pluginHooks('regions')).join(', '));
            if (!region || (region !== canvas && !canvas.contains(region))) {
                return null;
            }

            var before = null;

            dom.children(region, blockSelector()).forEach(function(block) {
                if (before) { return; }

                var box = block.getBoundingClientRect();
                if (y < box.top + box.height / 2) { before = block; }
            });

            return { region: region, before: before };
        }

        /**
         * A feature's toolbar button dropped on the canvas. A region that will
         * not have what it makes - a section dropped on a column - gives way
         * to the canvas, just after the top level block the pointer was in.
         */
        function insertFeatureFromToolbar(button, where, source) {
            var item = FEATURES[button.getAttribute('data-ge-feature')].toolbar[parseInt(button.getAttribute('data-ge-item'), 10)];
            var made = item.create();
            if (!made) { return null; }
            var placed = made;

            if (item.inColumn) {
                // Where it lands in a column, or in a row and a column of its
                // own anywhere else
                if (!dom.is(where.region, '.column')) { placed = inRowOfItsOwn(made); }
            } else if (!acceptsBlock(where.region, made)) {
                var ancestors = where.region === canvas ? [] : dom.parentsUntil(where.region, canvas).reverse().concat([where.region]);
                var top = ancestors[0] || null;
                where = { region: canvas, before: top ? top.nextElementSibling : null };
            }

            return addNode(item.kind, made, function() {
                if (where.before) {
                    where.before.parentNode.insertBefore(placed, where.before);
                } else {
                    where.region.appendChild(placed);
                }
            }, { parent: where.region, source: item.source || source || 'dragdrop' });
        }

        /** A detached row with one full width column holding `node`. */
        function inRowOfItsOwn(node) {
            var row = createRow();
            row.appendChild(createColumn(MAX_COL_SIZE)).appendChild(node);

            return row;
        }

        /** A line where the block would go, following the pointer. */
        function showDropMarker(pageX, pageY) {
            var where = dropPlaceAt(pageX, pageY);

            if (!where) { return hideDropMarker(); }

            if (!dropMarker) { dropMarker = dom.element('div', { 'class': 'ge-drop-marker' }); }

            if (where.before) {
                where.before.parentNode.insertBefore(dropMarker, where.before);
            } else {
                where.region.appendChild(dropMarker);
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
        function insertFromToolbar(button, where, source) {
            if (button.getAttribute('data-ge-toolbar') === 'feature') {
                return insertFeatureFromToolbar(button, where, source);
            }

            var container = button.getAttribute('data-ge-toolbar') === 'container';
            var type = button.getAttribute('data-ge-container-type');
            var made = container
                ? CONTAINERS[type].create({})
                : rowFromLayout(button.getAttribute('data-ge-layout'));

            // A container belongs in a column: dropped straight onto the
            // canvas it brings a row and a column of its own
            var placed = made;
            if (container && !dom.is(where.region, '.column')) { placed = inRowOfItsOwn(made); }

            return addNode(container ? type : 'row', made, function() {
                if (where.before) {
                    where.before.parentNode.insertBefore(placed, where.before);
                } else {
                    where.region.appendChild(placed);
                }
            }, { parent: where.region, source: source || 'dragdrop' });
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
                layout.forEach(function(size) { row.appendChild(createColumn(size)); });
                return row;
            }

            Object.keys(layout.row_cols || {}).forEach(function(key) {
                var value = layout.row_cols[key];
                var tier = breakpoint(key);
                if (tier && ROW_COLS_VALUES.indexOf(String(value)) !== -1) { dom.addClass(row, rowColsClass(tier, value)); }
            });

            for (var i = 0; i < (layout.columns || 0); i++) { row.appendChild(createColumn(null)); }

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
            Object.keys(layout.row_cols || {}).forEach(function(key) {
                var value = layout.row_cols[key];
                if (value !== 'auto') { widest = Math.max(widest, parseInt(value, 10) || 1); }
            });

            return Array.apply(null, Array(Math.min(widest, layout.columns || widest))).map(function() { return 'equal'; });
        }

        function onScroll() {
            var scrollTop = window.pageYOffset;

            if (
                scrollTop > dom.offset(mainControls).top &&
                scrollTop < dom.offset(canvas).top + dom.contentHeight(canvas)
            ) {
                if (dom.hasClass(wrapper, 'ge-top')) {
                    dom.css(wrapper, {
                        left: dom.offset(wrapper).left,
                        width: dom.outerWidth(wrapper),
                    });
                    dom.removeClass(wrapper, 'ge-top');
                    dom.addClass(wrapper, 'ge-fixed');
                }
            } else {
                if (dom.hasClass(wrapper, 'ge-fixed')) {
                    dom.css(wrapper, { left: '', width: '' });
                    dom.removeClass(wrapper, 'ge-fixed');
                    dom.addClass(wrapper, 'ge-top');
                }
            }
        }

        /**
         * A click on the host's plain content makes it a text: of the one
         * editor offered, or of the one chosen when there are several. What
         * a click on a text does is its editor plugin's business.
         */
        function onContentClick() {
            var block = this;
            if (block.getAttribute('data-ge-content-type')) { return; }

            // A second click, with the choice still open, withdraws it
            if (closeSizePicker()) { return; }

            // Content nobody can see - a tab that is not the open one, a
            // closed accordion item - has no geometry for an editor to lay
            // its toolbar out against, and nothing anyone can type into
            if (!dom.visible(block)) { return; }

            var offers = textOffers();
            if (!offers.length) { return; }

            if (offers.length === 1) {
                convertPlain(block, offers[0]);
            } else {
                openConvertPicker(block, offers);
            }
        }

        /**
         * Plain content made a text of `offer`'s type, through the convert
         * events: the type goes on, and the plugin that declared it takes the
         * block over and opens its editor. Nothing else about the node
         * changes. False when the library is missing or a handler canceled.
         */
        function convertPlain(block, offer) {
            // Not converted, so the next click tries again: the library may
            // be loaded by then
            if (offer.available && !offer.available()) {
                if (offer.missingKey) { console.error(t(offer.missingKey)); }
                return false;
            }

            return operate(function() {
                var payload = payloadFor('plain', block, { source: 'tool', from: 'plain', to: offer.type });

                if (!emit('before-convert', payload)) { return false; }

                dom.addClass(block, 'ge-content-type-' + offer.type);
                block.setAttribute('data-ge-content-type', offer.type);

                // Its plain drawer goes: the block is the plugin's now, and
                // the plugin gives it the drawer a text has
                var textBlock = block.parentElement;
                if (dom.hasClass(textBlock, 'ge-text-block')) {
                    dom.removeClass(textBlock, 'ge-plain-block');
                    dom.children(textBlock, '.ge-tools-drawer').forEach(function(drawer) { drawer.remove(); });
                }

                emit('after-convert', payload);
                offer.edit(block);

                return true;
            });
        }

        /**
         * The text types offered, as a strip under the plain content's
         * drawer, when there is more than one to choose from.
         */
        function openConvertPicker(block, offers) {
            var textBlock = dom.hasClass(block.parentElement, 'ge-text-block') ? block.parentElement : null;
            if (!textBlock) { return; }

            openPicker(dom.child(textBlock, '.ge-tools-drawer'), offers.map(function(offer) {
                return {
                    label: offer.label,
                    title: t('tool.convert_type', { editor: offer.label }),
                    attributes: { 'data-ge-content-type': offer.type },
                    choose: function() { convertPlain(block, offer); },
                };
            }), 'ge-text-picker ge-convert-picker', textBlock);
        }

        /**
         * A choice as a strip under `anchor` - a tool, or a drawer - one
         * button per `{ label, title, attributes, choose }`. Leaving `hover`
         * (the anchor by default) withdraws it, and so does closeSizePicker.
         */
        function openPicker(anchor, choices, className, hover) {
            closeSizePicker();
            if (!anchor) { return; }

            var drawer = dom.closest(anchor, '.ge-tools-drawer');
            if (drawer) { dom.addClass(drawer, 'ge-picker-open'); }
            sizePicker = anchor.appendChild(dom.addClass(dom.element('div', { 'class': 'ge-size-picker' }), className || ''));

            choices.forEach(function(choice) {
                var button = dom.attr(dom.element('a', { 'class': 'ge-size ge-size-flex' }), choice.attributes || {});

                button.setAttribute('title', choice.title || choice.label);
                button.textContent = choice.label;
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    closeSizePicker();
                    choice.choose();
                });
                sizePicker.appendChild(button);
            });

            withdrawOnLeave(hover || anchor);
        }

        /** Leaving `node` withdraws the picker open under it, unless the pointer went into the picker. */
        function withdrawOnLeave(node) {
            node.addEventListener('mouseleave', function() {
                window.setTimeout(function() {
                    if (sizePicker && !sizePicker.matches(':hover')) { closeSizePicker(); }
                }, 400);
            }, { once: true });
        }

        /**
         * Every text type the feature plugins declare, in the order they
         * were registered: the first plugin to declare a type owns it.
         */
        function textTypes() {
            var owners = {};
            var entries = [];

            Object.keys(FEATURES).forEach(function(name) {
                var feature = FEATURES[name];
                if (!feature.textTypes) { return; }

                (feature.textTypes() || []).forEach(function(entry) {
                    if (owners[entry.type]) {
                        if (owners[entry.type] !== name) {
                            warnOnceHere('text-type:' + entry.type, 'the "' + name + '" plugin declares the ' +
                                'text type "' + entry.type + '", which the "' + owners[entry.type] +
                                '" plugin already declares: ignored');
                        }
                        return;
                    }

                    owners[entry.type] = name;
                    entries.push(entry);
                });
            });

            return entries;
        }

        /** The types plain content can be made, in order: the ones not marked `offered: false`. */
        function textOffers() {
            return textTypes().filter(function(entry) { return entry.offered !== false; });
        }

        /** Whether a plugin declares this text type. */
        function hasTextOwner(type) {
            return textTypes().some(function(entry) { return entry.type === type; });
        }

        function reset() {
            deinit();
            init();
        }

        /**
         * The canvas as html, in the textarea in its place, to edit by hand.
         * A feature plugin's onSourceOpen may put a code editor over the
         * textarea; its onSourceClose puts what it holds back in it, which is
         * what the canvas is made of again.
         */
        function openSource() {
            deinit();
            // The canvas is made again from the html when it comes back
            changeTarget(null);
            htmlTextArea.style.height = (0.8 * document.documentElement.clientHeight) + 'px';
            htmlTextArea.value = canvas.innerHTML;
            dom.show(htmlTextArea);
            dom.hide(canvas);
            sourceOpen = true;
            plugins('onSourceOpen', htmlTextArea);
        }

        /**
         * The textarea's html back into the canvas. innerHTML, so a <script>
         * typed into the source is markup like any other and does not run in
         * the editor; the page it is published on runs it.
         */
        function closeSource() {
            plugins('onSourceClose', htmlTextArea);
            sourceOpen = false;
            dom.setHtml(canvas, htmlTextArea.value);
            dom.show(canvas);
            init();
            dom.hide(htmlTextArea);
        }

        /**
         * What can be the active target: a column, or a plugin's region - a
         * section. Not the canvas, which is where the toolbar adds without one.
         */
        function targetSelector() {
            return ['.column'].concat(pluginHooks('regions')).join(', ');
        }

        function isTarget(node) {
            return !!node && node !== canvas && canvas.contains(node) && dom.is(node, targetSelector());
        }

        /** The one way the active target changes, told only when it does. */
        function changeTarget(node) {
            if (node === activeTarget) { return; }

            var from = activeTarget;
            if (from) { dom.removeClass(from, 'ge-active-target'); }
            activeTarget = node;
            if (node && dom.hasClass(canvas, 'ge-editing')) { dom.addClass(node, 'ge-active-target'); }

            emit('target-change', { canvas: canvas, target: node, from: from });
        }

        /**
         * A toolbar button's click with an active target: what it makes goes
         * where a drop at the target's end would put it.
         */
        function addToTarget(button, source) {
            var made = insertFromToolbar(button, { region: activeTarget, before: null }, source);
            if (made && made.scrollIntoView) { made.scrollIntoView({ behavior: 'smooth' }); }
        }

        function init() {
            // The node whose settings were open is gone - deleted, say - and
            // its panel with it
            if (openSettingsState && !dom.attached(openSettingsState.node)) {
                closeSettings();
            }
            // And a dialog showing part of a panel that is gone
            if (dialogState && dialogState.home && !dom.attached(dialogState.home)) {
                closeDialog();
            }

            runFilter(true);
            dom.addClass(canvas, 'ge-editing');
            dom.toggleClass(canvas, 'ge-drag-drawer', settings.drag_handle === 'drawer');
            addAllColClasses();
            var cutter = textCutter();
            splitTexts(cutter);
            wrapContent(cutter);
            wrapTexts();
            createRowControls();
            createColControls();
            markContainers();
            plugins('onInit');
            makeSortable();
            makeResizable();
            switchLayout(curView);
            refreshPreviews(canvas);

            // Deleted, or taken out some other way, it is a target no more
            if (activeTarget && !canvas.contains(activeTarget)) {
                changeTarget(null);
            } else if (activeTarget) {
                dom.addClass(activeTarget, 'ge-active-target');
            }
        }

        function deinit() {
            // Its panel goes home to its drawer first, and both go together
            closeSettings();
            dom.removeClass(canvas, 'ge-editing ge-drag-drawer ge-dropping');
            // The mark goes, the target stays: getHtml comes straight back
            if (activeTarget) { dom.removeClass(activeTarget, 'ge-active-target'); }
            // Before the drawers and the text blocks come off: an editor
            // plugin closes its editors here, and finds them where it left them
            plugins('onBeforeDeinit');
            closeSizePicker();
            hideDropMarker();
            // In case a dialog was opened with no settings panel open
            closeDialog();
            dom.all(canvas, '.ge-tools-drawer').forEach(function(drawer) { drawer.remove(); });
            pluginFields.clear();
            unwrapTexts();
            plugins('onDeinit');
            // After the rich text editors have let go of their content areas:
            // one that rebuilt its area's DOM brought the preview styles back
            // with it, and the attribute recording them came back too
            clearPreviews(canvas);
            dom.all(canvas, '[data-ge-row-cols]').forEach(function(row) { row.removeAttribute('data-ge-row-cols'); });
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
            var html = canvas.innerHTML;
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
            var html = node.outerHTML;
            init();
            return html;
        }

        /** getHtml with grid-editor's own classes and attributes taken off. */
        function getPlainHtml() {
            return plainHtml(getHtml());
        }

        /**
         * Take the editor off the canvas: the markup stays, as getHtml would
         * give it, and everything the editor added - controls, panels,
         * listeners - goes. Safe on a canvas already taken out of the page,
         * as a framework tearing a component down does.
         */
        function destroy() {
            // The html being edited is what the canvas is left with
            if (sourceOpen) { closeSource(); }
            deinit();
            activeTarget = null;
            removeConfirmModal();
            removeSettingsPanels();
            removeDialog();
            removeMainControls();
            htmlTextArea.remove();
            lifetime.abort();
            instances.delete(canvas);
            destroyed = true;
        }

        /**
         * The plugins this editor is using: the ones registered by the files
         * the page loaded, narrowed by the plugins setting.
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

            // What the plugins setting does not choose: the text editors,
            // which content_types chooses. A page that names its containers
            // there has named no editor, and still wants the one it uses.
            var featureWanted = function(name, factory) {
                return factory.always === true || wanted(name);
            };

            Object.keys(GridEditor.containers).forEach(function(type) {
                if (wanted(type)) { CONTAINERS[type] = GridEditor.containers[type](api); }
            });

            Object.keys(GridEditor.features).forEach(function(name) {
                var factory = GridEditor.features[name];
                if (featureWanted(name, factory)) { FEATURES[name] = factory(api); }
            });

            Object.keys(GridEditor.utilities).forEach(function(name) {
                if (!wanted(name)) { return; }

                UTILITIES[name] = GridEditor.utilities[name](api);
                (UTILITIES[name].families || []).forEach(function(family) {
                    registerFamily(name, UTILITIES[name], family);
                });
            });

            Object.keys(FEATURES).forEach(function(name) {
                var methods = FEATURES[name].methods || {};
                Object.keys(methods).forEach(function(method) {
                    featureMethods[method] = methods[method];
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
            [CONTAINERS, FEATURES, UTILITIES].forEach(function(registry) {
                Object.keys(registry).forEach(function(name) {
                    if (registry[name][hook]) { registry[name][hook](argument); }
                });
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
                // The host's own style, under the preview
                hostStyle: hostStyle,
                setHostStyle: setHostStyle,
                // A modal of the editor's own, over the settings
                openDialog: openDialog,
                closeDialog: closeDialog,
                rowFromLayout: rowFromLayoutValue,
                nodeHtml: nodeHtml,
                // A text editor has rewritten a content area, so whatever the
                // editor and its plugins had put in there goes back in
                textReady: textReady,
                // A choice under a tool, offered by holding it
                attachPicker: attachPicker,
                openPicker: openPicker,
                closePicker: closeSizePicker,
                // A node's settings panel, in its drawer or open outside it
                detailsOf: detailsOf,
                // A node's drawer: its first child, or for a content area the
                // one beside it in its text block
                drawerOf: drawerOf,
                toolbarItems: function(name) {
                    return mainControls
                        ? dom.all(mainControls, '[data-ge-toolbar="feature"][data-ge-feature="' + name + '"]')
                        : [];
                },
            };
        }

        function drawerOf(node) {
            if (dom.hasClass(node, 'ge-content')) {
                var textBlock = node.parentElement;
                return dom.hasClass(textBlock, 'ge-text-block') ? dom.child(textBlock, '.ge-tools-drawer') : null;
            }

            return dom.child(node, '.ge-tools-drawer');
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
        var UTILITY_NODES = '.row, .column, .ge-content, .ge-element, [data-ge-container]';
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
                family: Object.assign({}, family, {
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
            // The host's plain content reads and previews its utilities as a
            // text does; with no gear, nothing in its drawer writes them
            if (kind === 'plain') { kind = 'text'; }
            if (family.appliesTo.indexOf(kind) !== -1) { return true; }

            return !!CONTAINERS[kind] && family.appliesTo.indexOf('container') !== -1;
        }

        function familiesFor(kind) {
            return Object.keys(FAMILIES).map(function(name) {
                return FAMILIES[name].family;
            }).filter(function(family) {
                return appliesTo(family, kind);
            });
        }

        function utilityClass(family, tier, value) {
            if (family.className) { return family.className(tier.key, value); }

            return family.prefix + (tier.infix ? '-' + tier.infix : '') + '-' + value;
        }

        /** The value a node carries a class for at exactly this tier, or null. */
        function ownUtility(node, family, tier) {
            var classes = (node.getAttribute('class') || '').split(/\s+/);

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
                dom.removeClass(node, utilityClass(family, tier, candidate));
            });

            if (value !== null) { dom.addClass(node, utilityClass(family, tier, value)); }
            dom.dropEmptyClass(node);
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
            node = nodeFrom(node);

            var family = familyNamed(name, 'getUtility');
            if (!family || !node) { return null; }

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
            node = nodeFrom(node);

            var family = familyNamed(name, 'setUtility');
            if (!family || !node) { return false; }

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
            node = nodeFrom(node);
            if (!family || !node) { return null; }

            var original = node.getAttribute('class');
            BREAKPOINTS.forEach(function(tier) { writeUtility(node, family, tier, null); });

            var value = getComputedStyle(node).getPropertyValue(property);

            if (original === null) { node.removeAttribute('class'); } else { node.setAttribute('class', original); }

            return value;
        }

        /** Bring a node's panel and preview up to date with its classes. */
        function refreshUtilities(node) {
            var details = detailsOf(node);

            if (details) {
                var classes = dom.one(details, '.ge-classes');
                if (classes) { classes.value = hostClasses(node).join(' '); }
                dom.children(details, '.ge-utilities').forEach(function(section) { renderUtilities(section); });
            }
            renderPluginFields(node);
            refreshPreviews(node);
        }

        /* Preview */

        function utilityNodes(scope) {
            return dom.selfAndAll(scope, UTILITY_NODES);
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
            utilityNodes(scope).forEach(function(node) {
                var kind = kindOf(node);
                var styles = {};

                familiesFor(kind).forEach(function(family) {
                    if (!family.preview || !utilityTiers(node, family).length) { return; }

                    Object.assign(styles, family.preview(effectiveUtility(node, family, tier), node, kind));
                });

                if (kind === 'column') { Object.assign(styles, rowColsPreview(node, tier)); }

                // A plugin whose families settle one property between them
                // previews the node as a whole
                Object.keys(UTILITIES).forEach(function(name) {
                    var utility = UTILITIES[name];
                    if (utility.preview) { Object.assign(styles, utility.preview(node, kind, tier.key)); }
                });

                if (Object.keys(styles).length) { applyPreview(node, styles); }
            });
        }

        /**
         * Set inline !important styles, which is the one thing that beats
         * Bootstrap's own !important, and remember what each property was so
         * it can be put back. The record is an attribute because a rich text
         * editor rebuilds the DOM of the area it edits, and the record has to
         * come back with the node.
         */
        function applyPreview(node, styles) {
            var style = node.style;
            var was = {};

            Object.keys(styles).forEach(function(property) {
                was[property] = [style.getPropertyValue(property), style.getPropertyPriority(property)];
                style.setProperty(property, String(styles[property]), 'important');
            });

            node.setAttribute(PREVIEW_ATTR, JSON.stringify(was));
        }

        function clearPreviews(scope) {
            dom.selfAndAll(scope, '[' + PREVIEW_ATTR + ']').forEach(function(node) {
                var style = node.style;
                var was = {};

                try { was = JSON.parse(node.getAttribute(PREVIEW_ATTR)) || {}; } catch (error) { /* a mangled record: drop it */ }

                Object.keys(was).forEach(function(property) {
                    var before = was[property];

                    if (before && before[0]) {
                        style.setProperty(property, before[0], before[1]);
                    } else {
                        style.removeProperty(property);
                    }
                });

                node.removeAttribute(PREVIEW_ATTR);
                dom.dropEmptyStyle(node);
            });
        }

        /* The host's own style, under the preview */

        /**
         * The node's style as the host wrote it: its declarations with every
         * property the preview set put back to what the preview recorded.
         * Held in a detached element's style, which parses and serializes it
         * the way the node's own would.
         */
        function hostDeclaration(node) {
            var scratch = document.createElement('div');
            var was = {};

            scratch.style.cssText = node.style.cssText;
            try { was = JSON.parse(node.getAttribute(PREVIEW_ATTR)) || {}; } catch (error) { /* no record */ }

            Object.keys(was).forEach(function(property) {
                var before = was[property];

                if (before && before[0]) {
                    scratch.style.setProperty(property, before[0], before[1]);
                } else {
                    scratch.style.removeProperty(property);
                }
            });

            return scratch.style;
        }

        /**
         * ge.hostStyle(node, property): { value, priority } of one property
         * of the host's style, never the preview's. With no property, the
         * host's whole style as css text.
         */
        function hostStyle(node, property) {
            var declaration = hostDeclaration(node);

            if (property === undefined) { return declaration.cssText; }

            return {
                value: declaration.getPropertyValue(property),
                priority: declaration.getPropertyPriority(property),
            };
        }

        /**
         * ge.setHostStyle(node, property, value, priority): write one property
         * of the host's style, or take it off with an empty value. The
         * preview comes off the node while it is written and goes back on
         * after, so what the preview put back on deinit is the host's new
         * value. False, and nothing written, when the browser refuses the
         * value. `priority` left out keeps the one the property had.
         */
        function setHostStyle(node, property, value, priority) {
            value = value === null || value === undefined ? '' : String(value).trim();

            if (priority === undefined) { priority = hostStyle(node, property).priority; }

            if (value !== '') {
                var check = document.createElement('div').style;
                check.setProperty(property, value, priority || '');
                if (check.getPropertyValue(property) === '') { return false; }
            }

            var previewed = node.hasAttribute(PREVIEW_ATTR);
            if (previewed) { clearPreviews(node); }

            if (value === '') {
                node.style.removeProperty(property);
            } else {
                node.style.setProperty(property, value, priority || '');
            }
            dom.dropEmptyStyle(node);

            if (previewed) { refreshPreviews(node); }

            return true;
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

            Object.keys(UTILITIES).forEach(function(name) {
                var utility = UTILITIES[name];
                var own = utility.panel ? utility.panel(node, kind) : null;
                if (own) { fields.push(own); }
            });

            if (!fields.length) { return null; }

            var section = dom.toggleClass(dom.element('div', { 'class': 'ge-utilities' }), 'ge-open', utilitiesOpen);
            sectionNodes.set(section, node);

            var toggle = section.appendChild(dom.element('a', { 'class': 'ge-utilities-toggle' }));
            toggle.addEventListener('click', function() {
                utilitiesOpen = !dom.hasClass(section, 'ge-open');
                settingsScope().forEach(function(scope) {
                    dom.all(scope, '.ge-utilities').forEach(function(each) {
                        dom.toggleClass(each, 'ge-open', utilitiesOpen);
                    });
                });
            });

            var body = section.appendChild(dom.element('div', { 'class': 'ge-utilities-body' }));
            fields.forEach(function(field) { body.appendChild(field); });

            renderUtilities(section);

            return section;
        }

        /**
         * One family's field: its label, a select that writes through
         * setUtility, and a note. Filled by renderField, again whenever the
         * view or the node's classes change.
         */
        function createField(node, family) {
            var field = dom.element('label', { 'class': 'ge-utility', 'data-ge-family': family.name });

            field.appendChild(dom.element('span', { 'class': 'ge-utility-label' },
                family.labelKey ? t(family.labelKey) : family.name));

            var select = field.appendChild(dom.element('select', { 'class': 'form-select form-select-sm' }));
            select.addEventListener('change', function() {
                setUtility(node, family.name, this.value, { source: 'panel' });
            });

            field.appendChild(dom.element('small', { 'class': 'ge-utility-note' }));

            return field;
        }

        /** ge.utilityField(node, family): a field a plugin places in a panel of its own. */
        function utilityField(node, name) {
            var family = familyNamed(name, 'utilityField');
            if (!family) { return null; }

            var field = createField(node, family);
            renderField(field, node);
            pluginFields.set(field, node);

            return field;
        }

        /**
         * The fields a plugin made, wherever it put them: a Responsive
         * section renders its own, and these are the rest - in a plugin's
         * section of the panel, or in the dialog. Each one's node's, or
         * every node's; a field no longer on the page is forgotten.
         */
        var pluginFields = new Map(); // field -> the node it edits

        function renderPluginFields(node) {
            pluginFields.forEach(function(fieldNode, field) {
                if (!field.isConnected) {
                    pluginFields.delete(field);
                    return;
                }
                if (node && fieldNode !== node) { return; }
                if (dom.closest(field, '.ge-utilities')) { return; }

                renderField(field, fieldNode);
            });
        }

        /** Fill a section's fields, the families' and the plugins' own, for the view being edited. */
        function renderUtilities(section) {
            var node = sectionNodes.get(section);

            dom.children(section, '.ge-utilities-toggle').forEach(function(toggle) {
                toggle.textContent = t('utility.section', { view: t(labelKeyFor(curView)) });
            });

            dom.all(section, '.ge-utility').forEach(function(field) { renderField(field, node); });
        }

        function renderField(field, node) {
            var family = FAMILIES[field.getAttribute('data-ge-family')].family;
            var select = dom.child(field, 'select');
            var choices = family.choices ? family.choices(node, kindOf(node)) : family.values;
            var own, blank, note = '';

            select.innerHTML = '';

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

            select.appendChild(dom.element('option', { value: '' }, blank));
            choices.forEach(function(value) {
                select.appendChild(dom.element('option', { value: value }, labelOf(family, value)));
            });

            select.value = own === null ? '' : own;

            var noteNode = dom.child(field, '.ge-utility-note');
            noteNode.textContent = note;
            dom.toggle(noteNode, note !== '');
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
         * Ids go into the markup rather than into memory: Bootstrap's toggles
         * are written in terms of them, and the markup has to survive getHtml
         * with those toggles still pointing at the right panes.
         */
        function containerId(type) {
            containerCounter++;

            return 'ge-' + type + '-' + containerCounter + '-' +
                Math.random().toString(36).slice(2, 6);
        }

        /** A pane's starting content: one full width column, ready to edit. */
        function defaultRegion() {
            var row = createRow();
            row.appendChild(createColumn(MAX_COL_SIZE));
            return row;
        }

        function containerTypeOf(container) {
            return container ? container.getAttribute('data-ge-container') : null;
        }

        function markContainers() {
            dom.all(canvas, '[data-ge-container]').forEach(function(container) {
                var type = containerTypeOf(container);
                var definition = CONTAINERS[type];

                if (!definition) {
                    warnOnceHere('container:' + type, 'unknown container type "' + type + '"');
                    return;
                }

                dom.addClass(container, 'ge-container ge-container-' + type);
                definition.mark(container);

                if (!dom.child(container, '.ge-tools-drawer')) {
                    createContainerControls(container, type, definition);
                }
            });
        }

        function unmarkContainers() {
            dom.all(canvas, '[data-ge-container]').forEach(function(container) {
                var definition = CONTAINERS[containerTypeOf(container)];

                if (definition) { definition.unmark(container); }

                dom.removeClass(container, 'ge-container ge-container-' + containerTypeOf(container));
                dom.dropEmptyClass(container);
            });
        }

        /** A new drawer as the first child of `node`. */
        function prependDrawer(node, className) {
            var drawer = dom.element('div', { 'class': className });
            node.insertBefore(drawer, node.firstChild);
            return drawer;
        }

        /** The host's own tools, from a *_tools setting, in a drawer. */
        function hostTools(drawer, tools) {
            (tools || []).forEach(function(hostTool) {
                createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });
        }

        function createContainerControls(container, type, definition) {
            var drawer = prependDrawer(container, 'ge-tools-drawer ge-container-drawer');

            createMoveTool(drawer);
            addSettingsTool(drawer, container, settings.container_classes);

            hostTools(drawer, settings.container_tools);

            if (definition.tools) { definition.tools(drawer, container); }

            createTool(drawer, t('tool.delete_container'), 'ge-delete-container', 'bi bi-trash', function() {
                deleteNode(type, container, t('confirm.delete_container'), function(removed) {
                    dom.slideUp(container, removed);
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
        function createPaneControls(pane, kind, tools, confirmText, remove) {
            var drawer = prependDrawer(pane, 'ge-tools-drawer ge-pane-drawer');

            createMoveTool(drawer);
            addSettingsTool(drawer, pane, settings.pane_classes);

            hostTools(drawer, tools);

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
            if (!scope) { return; }

            dom.selfAndAll(scope, '[data-bs-toggle], [data-bs-dismiss]').forEach(function(node) {
                ['toggle', 'dismiss'].forEach(function(name) {
                    var value = node.getAttribute('data-bs-' + name);
                    if (value === null) { return; }

                    node.setAttribute('data-ge-bs-' + name, value);
                    node.removeAttribute('data-bs-' + name);
                });
            });
        }

        function resumeToggles(scope) {
            if (!scope) { return; }

            dom.selfAndAll(scope, '[data-ge-bs-toggle], [data-ge-bs-dismiss]').forEach(function(node) {
                ['toggle', 'dismiss'].forEach(function(name) {
                    var value = node.getAttribute('data-ge-bs-' + name);
                    if (value === null) { return; }

                    node.setAttribute('data-bs-' + name, value);
                    node.removeAttribute('data-ge-bs-' + name);
                });
            });
        }

        /**
         * Rename a label in place. The label sits inside the button Bootstrap
         * toggles from, so the toggle is suspended while the label is being
         * edited: typing in a tab's name must not switch tabs.
         */
        function makeLabelEditable(label) {
            if (editableLabels.has(label)) { return; }

            var toggle = dom.closest(label, '[data-bs-toggle], [data-ge-bs-toggle]');

            editableLabels.add(label);
            label.setAttribute('title', t('tool.rename'));
            label.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();

                suspendToggles(toggle);
                label.setAttribute('contenteditable', 'true');
                label.focus();
                window.getSelection().selectAllChildren(label);
            });
            label.addEventListener('keydown', function(e) {
                if (label.getAttribute('contenteditable') !== 'true') { return; }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    label.blur();
                }
            });
            label.addEventListener('blur', function() {
                label.removeAttribute('contenteditable');
                resumeToggles(toggle);
            });
        }

        /** The label inside a pane's button, wrapped so it can be edited alone. */
        function labelIn(button) {
            var label = dom.child(button, '.ge-pane-label');

            if (!label) {
                label = dom.element('span', { 'class': 'ge-pane-label' }, button.textContent.trim());
                button.innerHTML = '';
                button.appendChild(label);
            }

            return label;
        }

        function unwrapLabels(scope) {
            dom.all(scope, '.ge-pane-label').forEach(function(label) {
                editableLabels.delete(label);
                dom.unwrap(label);
            });
        }

        /**
         * Add a column of `size` to a row, through the add events.
         */
        function addColumnTo(row, size) {
            var column = createColumn(size);

            return addNode('column', column, function() {
                row.appendChild(column);
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
            if (!settings.add_column.picker || !tool) { return; }

            attachPicker(tool, function() { openSizePicker(tool, row); });
        }

        /**
         * Hold a tool - or rest the pointer on it - and `open` offers a
         * choice under it. The add text tool offers its editors the same way.
         */
        function attachPicker(tool, open) {
            var timer = null;

            var cancel = function() {
                window.clearTimeout(timer);
                timer = null;
            };

            dom.on(tool, 'mouseenter mousedown', function() {
                if (timer || sizePicker) { return; }

                timer = window.setTimeout(function() {
                    timer = null;
                    open();
                }, settings.add_column.delay);
            });

            dom.on(tool, 'mouseleave mouseup', cancel);
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
            var drawer = dom.closest(tool, '.ge-tools-drawer');
            if (drawer) { dom.addClass(drawer, 'ge-picker-open'); }

            sizePicker = tool.appendChild(dom.element('div', { 'class': 'ge-size-picker' }));

            settings.valid_col_sizes.forEach(function(size) {
                var choice = dom.element('a', {
                    'class': 'ge-size',
                    'data-ge-size': size,
                    title: sizeTitle(size),
                }, isUnits(size) ? size : sizeClass(BREAKPOINTS[0], size));

                dom.toggleClass(choice, 'ge-size-tight', isUnits(size) && size > room);
                dom.toggleClass(choice, 'ge-size-flex', !isUnits(size));
                choice.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    closeSizePicker();
                    addColumnTo(row, size);
                });
                sizePicker.appendChild(choice);
            });

            // Anywhere else, and the question is withdrawn
            withdrawOnLeave(tool);
        }

        function sizeTitle(size) {
            if (size === 'equal') { return t('tool.column_equal'); }
            if (size === 'auto') { return t('tool.column_auto'); }

            return t('tool.column_size', { size: size });
        }

        /** True when there was one to close, which is also a click's answer. */
        function closeSizePicker() {
            if (!sizePicker) { return false; }

            var drawer = dom.closest(sizePicker, '.ge-tools-drawer');
            if (drawer) { dom.removeClass(drawer, 'ge-picker-open'); }
            sizePicker.remove();
            sizePicker = null;

            return true;
        }

        function createRowControls() {
            dom.all(canvas, '.row').forEach(function(row) {
                if (dom.child(row, '.ge-tools-drawer')) { return; }

                var drawer = prependDrawer(row, 'ge-tools-drawer');
                createMoveTool(drawer);
                addSettingsTool(drawer, row, settings.row_classes);

                hostTools(drawer, settings.row_tools);
                createTool(drawer, t('tool.delete_row'), 'ge-delete-row', 'bi bi-trash', function() {
                    deleteNode('row', row, t('confirm.delete_row'), function(removed) {
                        dom.slideUp(row, removed);
                    });
                });
                createTool(drawer, t('tool.add_column'), 'ge-add-column', 'bi bi-plus-circle', function() {
                    if (closeSizePicker()) { return; } // The picker was open: that was the answer

                    // In a row with row-cols the new column takes its share
                    addColumnTo(row, rowColsSource(row, leadingTier()) ? null : settings.add_column.size);
                });

                attachSizePicker(dom.child(drawer, '.ge-add-column'), row);

            });
        }

        function createColControls() {
            dom.all(canvas, '.column').forEach(function(col) {
                if (dom.child(col, '.ge-tools-drawer')) { return; }

                var drawer = prependDrawer(col, 'ge-tools-drawer');

                createMoveTool(drawer);

                if (settings.resize.tools !== false) {
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
                }

                if (settings.indent.tools !== false) {
                    createTool(drawer, t('tool.indent_decrease'), 'ge-decrease-col-offset', 'bi bi-text-indent-right', function(e) {
                        indentColumn(col, e.shiftKey
                            ? smallest(settings.valid_col_offsets)
                            : stepThrough(settings.valid_col_offsets, currentOffset(col), -1),
                            'tool');
                    });

                    createTool(drawer, t('tool.indent_increase'), 'ge-increase-col-offset', 'bi bi-text-indent-left', function(e) {
                        indentColumn(col, e.shiftKey ? deepestFor(col) : stepThrough(settings.valid_col_offsets, currentOffset(col), 1), 'tool');
                    });
                }

                addSettingsTool(drawer, col, settings.col_classes);

                hostTools(drawer, settings.col_tools);

                createTool(drawer, t('tool.delete_column'), 'ge-delete-column', 'bi bi-trash', function() {
                    deleteNode('column', col, t('confirm.delete_column'), function(removed) {
                        dom.shrinkAway(col, 400, removed, true);
                    });
                });

                createTool(drawer, t('tool.add_row'), 'ge-add-row', 'bi bi-plus-circle', function() {
                    // An empty row: the columns in it are the next decision,
                    // and its drawer's add column tool is where that is made
                    var row = createRow();

                    addNode('row', row, function() {
                        col.appendChild(row);
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

            var units = Math.round(dom.outerWidth(col) / rowContentWidth(col.parentElement) * MAX_COL_SIZE);
            return Math.min(Math.max(units, 1), MAX_COL_SIZE);
        }

        function rowContentWidth(row) {
            var style = window.getComputedStyle(row);

            return row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
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
            var room = spare(col.parentElement, leadingTier(), col) - currentOffset(col);

            return Math.min(largest(settings.valid_col_sizes), Math.max(room, 1));
        }

        /**
         * The deepest this column can be indented and still have a unit of
         * itself left inside the row.
         */
        function deepestFor(col) {
            var room = spare(col.parentElement, leadingTier(), col) - currentUnits(col);

            return Math.min(largest(settings.valid_col_offsets), Math.max(room, 0));
        }

        /**
         * The move tool, unless the whole drawer is the handle - in which case
         * a tool that only says "drag from here" is one tool too many.
         */
        function createMoveTool(drawer) {
            if (settings.drag_handle === 'drawer') { return null; }

            return createTool(drawer, t('tool.move'), 'ge-move', 'bi bi-arrows-move');
        }

        /**
         * The drawers that span their node - a row's, a column's, a
         * container's, an element's, a section's - keep their tools to one
         * line. The tools that don't fit are hidden from the end, and a more
         * tool at the drawer's end unfolds it to show them all, wrapping as
         * it would otherwise. They stay where they are, so whatever finds a
         * tool in its drawer, or hangs a picker off it, still does.
         *
         * A text's drawer sits over the text, as wide as its tools, and a
         * pane's sits by its label: neither is one of them.
         */
        var FITTED_DRAWERS = '.ge-tools-drawer:not(.ge-text-drawer):not(.ge-pane-drawer):not(.ge-code-inline)';

        /**
         * Fit every drawer as it comes onto the canvas, and again when it
         * changes width or a tool is added to it, shown or hidden. Plugins
         * add tools at their own moments, so this watches rather than
         * waiting to be told.
         */
        function watchDrawers() {
            if (settings.drawer_overflow === 'wrap' || !window.ResizeObserver || !window.MutationObserver) { return; }

            var due = new Set();
            var frame = null;

            // Once a frame, after the layout: moving tools in the observers'
            // callbacks would resize what they are watching
            function schedule(drawer) {
                due.add(drawer);
                if (frame === null) { frame = window.requestAnimationFrame(flush); }
            }

            function flush() {
                frame = null;
                var drawers = Array.from(due);
                due.clear();
                drawers.forEach(function(drawer) {
                    if (!drawer.isConnected) {
                        drawerResizes.unobserve(drawer);
                        return;
                    }
                    fitDrawer(drawer);
                });
            }

            var drawerResizes = new window.ResizeObserver(function(entries) {
                entries.forEach(function(entry) { schedule(entry.target); });
            });

            var mutations = new window.MutationObserver(function(records) {
                records.forEach(function(record) {
                    var target = record.target;

                    // A tool shown or hidden
                    if (record.type === 'attributes') {
                        var parent = target.parentNode;
                        if (parent && parent.nodeType === 1 && parent.matches(FITTED_DRAWERS)) { schedule(parent); }
                        return;
                    }

                    // A tool added
                    if (target.nodeType === 1 && target.matches(FITTED_DRAWERS)) {
                        schedule(target);
                        return;
                    }

                    record.addedNodes.forEach(function(node) {
                        if (node.nodeType !== 1) { return; }
                        dom.selfAndAll(node, FITTED_DRAWERS).forEach(function(drawer) {
                            dom.addClass(drawer, 'ge-drawer-fit');
                            drawerResizes.observe(drawer);
                            schedule(drawer);
                        });
                    });
                });
            });
            mutations.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

            lifetime.signal.addEventListener('abort', function() {
                mutations.disconnect();
                drawerResizes.disconnect();
                if (frame !== null) { window.cancelAnimationFrame(frame); }
            });
        }

        /** Hide the tools that don't fit on the drawer's line, from the end, behind its more tool. */
        function fitDrawer(drawer) {
            var tools = dom.children(drawer, 'a').filter(function(tool) { return !dom.hasClass(tool, 'ge-drawer-more'); });
            var expanded = dom.hasClass(drawer, 'ge-drawer-expanded');

            // Measured on one line, with every tool back on it
            dom.removeClass(drawer, 'ge-drawer-overflow ge-drawer-expanded');
            tools.forEach(function(tool) { dom.removeClass(tool, 'ge-tool-overflow'); });

            if (!drawerOverflows(drawer, tools)) { return; }

            dom.addClass(drawer, 'ge-drawer-overflow');
            if (!dom.child(drawer, '.ge-drawer-more')) {
                createTool(drawer, t('tool.more'), 'ge-drawer-more', 'bi bi-three-dots', function() {
                    dom.toggleClass(drawer, 'ge-drawer-expanded');
                });
            }

            for (var i = tools.length - 1; i >= 0 && drawerOverflows(drawer, tools); i--) {
                dom.addClass(tools[i], 'ge-tool-overflow');
            }

            dom.toggleClass(drawer, 'ge-drawer-expanded', expanded);
        }

        function drawerOverflows(drawer, tools) {
            var style = window.getComputedStyle(drawer);
            var limit = drawer.getBoundingClientRect().right -
                parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);

            return tools.some(function(tool) {
                var rects = tool.getClientRects();
                return rects.length > 0 && rects[0].right > limit + 0.5;
            });
        }

        /**
         * A tool in a drawer: a link with an icon, and what it does. The
         * handlers are a click handler, or { eventName: handler }; each gets
         * the DOM event, with `this` the tool. Hands back the tool.
         */
        function createTool(drawer, title, className, iconClass, eventHandlers) {
            // Through setAttribute rather than spliced into markup: a title is
            // text, and a quote in it - a type name, a host's own title -
            // would end the attribute early
            var tool = dom.element('a', { title: title, 'class': className });
            tool.appendChild(dom.element('i', { 'class': iconClass }));
            drawer.appendChild(tool);

            if (typeof eventHandlers == 'function') {
                tool.addEventListener('click', eventHandlers);
            }
            if (eventHandlers && typeof eventHandlers == 'object') {
                Object.keys(eventHandlers).forEach(function(name) {
                    dom.on(tool, name, eventHandlers[name]);
                });
            }

            return tool;
        }

        /**
         * The classes on a node that are the host's own, rather than the ones
         * the grid and the editor put there. What the settings panel shows,
         * and the only ones it is allowed to take away.
         */
        function hostClasses(node) {
            return (node.getAttribute('class') || '').split(/\s+/).filter(function(name) {
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
            hostClasses(node).forEach(function(name) { dom.removeClass(node, name); });

            value.split(/\s+/).forEach(function(name) {
                if (name !== '') { dom.addClass(node, name); }
            });

            dom.dropEmptyClass(node);
        }

        /**
         * The gear and the panel it opens: the node's id, its css classes, and
         * whatever preset toggles the host configured for that kind of node.
         */
        function addSettingsTool(drawer, node, presets) {
            var details = createDetails(node, presets || []);
            detailsFor.set(node, details);

            createTool(drawer, t('tool.settings'), 'ge-settings', 'bi bi-gear-fill', function() {
                toggleSettings(node, details, this);
            });

            // Beside the gear, because every node that has one is a node a
            // utility may apply to, whichever plugin built its drawer. A
            // feature plugin's tools go there too, for the same reason: the
            // gear is the one tool every drawer has.
            var kind = kindOf(node);
            Object.keys(UTILITIES).forEach(function(name) {
                if (UTILITIES[name].drawerTools) { UTILITIES[name].drawerTools(drawer, node, kind); }
            });
            Object.keys(FEATURES).forEach(function(name) {
                if (FEATURES[name].drawerTools) { FEATURES[name].drawerTools(drawer, node, kind); }
            });

            return drawer.appendChild(details);
        }

        function createDetails(container, cssClasses) {
            var detailsDiv = dom.element('div', { 'class': 'ge-details' });
            detailsDiv.appendChild(sectionTitle(t('panel.section_general')));
            var general = detailsDiv.appendChild(dom.element('div', { 'class': 'ge-details-general' }));
            var field = function(label) {
                var holder = dom.element('label', { 'class': 'ge-field' });
                holder.appendChild(dom.element('span', { 'class': 'ge-field-label' }, label));
                return general.appendChild(holder);
            };

            var id = dom.element('input', {
                'class': 'ge-id form-control form-control-sm',
                placeholder: t('tool.id_placeholder'),
                title: t('tool.id_title'),
            });
            id.value = container.getAttribute('id') || '';
            field(t('panel.id')).appendChild(id);
            id.addEventListener('change', function() {
                // An empty field means no id, not an empty one
                if (this.value === '') {
                    container.removeAttribute('id');
                } else {
                    container.setAttribute('id', this.value);
                }
            });

            var classes = dom.element('input', {
                'class': 'ge-classes form-control form-control-sm',
                placeholder: t('tool.classes_placeholder'),
                title: t('tool.classes_title'),
            });
            classes.value = hostClasses(container).join(' ');
            field(t('panel.classes')).appendChild(classes);
            classes.addEventListener('change', function() {
                setHostClasses(container, this.value);
                refreshUtilities(container);
            });

            // Bootstrap's outline buttons, filled while their class is on
            var classGroup = general.appendChild(dom.element('div', { 'class': 'btn-group btn-group-sm ge-presets', role: 'group' }));
            cssClasses.forEach(function(rowClass) {
                var on = dom.hasClass(container, rowClass.cssClass);
                var btn = dom.element('a', {
                    role: 'button',
                    'class': 'btn btn-sm btn-outline-secondary',
                    title: rowClass.title ? rowClass.title : t('tool.toggle_class', { label: rowClass.label }),
                    'aria-pressed': on ? 'true' : 'false',
                });

                // A preset's label is the host's markup
                btn.innerHTML = rowClass.label;
                dom.toggleClass(btn, 'active', on);
                btn.addEventListener('click', function() {
                    dom.toggleClass(btn, 'active');
                    btn.setAttribute('aria-pressed', dom.hasClass(btn, 'active') ? 'true' : 'false');
                    dom.toggleClass(container, rowClass.cssClass, dom.hasClass(btn, 'active'));
                    refreshUtilities(container);
                });
                classGroup.appendChild(btn);
            });

            pluginSections(container).forEach(function(section) { detailsDiv.appendChild(section); });

            var utilities = createUtilitiesSection(container);
            if (utilities) { detailsDiv.appendChild(utilities); }

            return detailsDiv;
        }

        /** The heading of one of a panel's sections. */
        function sectionTitle(text) {
            return dom.element('h6', { 'class': 'ge-section-title' }, text);
        }

        /**
         * What plugins add to a node's panel, between its general fields and
         * the Responsive section: each plugin's panelSection(node, kind), in
         * the order they were registered. Where the panel has room - the
         * offcanvas, the modal - the section is in it. A popover or a panel
         * inline in the drawer gets a button instead, and the section opens
         * in the dialog.
         */
        function pluginSections(node) {
            var kind = kindOf(node);
            var mode = panelMode();
            var sections = [];

            [CONTAINERS, FEATURES, UTILITIES].forEach(function(registry) {
                Object.keys(registry).forEach(function(name) {
                    var plugin = registry[name];
                    var section = plugin.panelSection ? plugin.panelSection(node, kind) : null;
                    if (!section || !section.body) { return; }

                    var holder = dom.element('div', { 'class': 'ge-panel-section', 'data-ge-plugin': name });

                    if (mode === 'offcanvas' || mode === 'modal') {
                        holder.appendChild(sectionTitle(t(section.labelKey)));
                        holder.appendChild(section.body);
                    } else {
                        var label = t(section.labelKey);
                        var open = holder.appendChild(dom.element('button', {
                            type: 'button',
                            'class': 'btn btn-sm btn-outline-secondary ge-panel-section-open',
                        }, label));

                        dom.hide(section.body);
                        holder.appendChild(section.body);
                        open.addEventListener('click', function() {
                            openDialog(section.titleKey ? t(section.titleKey, { kind: kindLabel(node) }) : label,
                                section.body, open);
                        });
                    }

                    sections.push(holder);
                });
            });

            return sections;
        }

        /* --------------------------------------------------------------
         * Where a node's settings open.
         *
         * Each node's panel - createDetails' fields, and what plugins add to
         * them - is built into its drawer, as ever. settings_panel says where
         * it shows: 'inline' unfolds it in the drawer; 'offcanvas', 'popover'
         * and 'modal' move it into one of Bootstrap's, outside the canvas,
         * while it is open, and back into its drawer when it closes, so
         * everything that finds a panel through its node keeps working.
         *
         * Bootstrap's markup and styles, but the editor's own opening and
         * placing: a page may load Bootstrap's javascript without Popper, or
         * not at all. The modal is Bootstrap's own when Bootstrap is there.
         * -------------------------------------------------------------- */

        var PANEL_MODES = ['offcanvas', 'popover', 'modal', 'inline'];
        var settingsPanels = {}; // One of each, built on first use, outside the canvas
        var openSettingsState = null; // What is open: { mode, node, details, home, next, gear }
        var modalState = new WeakMap(); // modal panel -> { watched, wanted, busy, backdrop, dismissed }

        function panelMode() {
            if (PANEL_MODES.indexOf(settings.settings_panel) !== -1) { return settings.settings_panel; }

            warnOnceHere('settings_panel', 'settings_panel "' + settings.settings_panel + '" is not one of ' +
                PANEL_MODES.join(', ') + ': using offcanvas');
            return 'offcanvas';
        }

        /** A node's panel, wherever it is at the moment, or null. */
        function detailsOf(node) {
            return (node && detailsFor.get(node)) || null;
        }

        /** Where settings fields are found: the canvas, and the panel open outside it. */
        function settingsScope() {
            return openSettingsState && openSettingsState.mode !== 'inline'
                ? [canvas, openSettingsState.details]
                : [canvas];
        }

        /** The gear: its node's panel, opened or closed; another node's closes first. */
        function toggleSettings(node, details, gear) {
            var mode = panelMode();

            if (mode === 'inline') {
                dom.toggle(details);
                return;
            }

            var same = openSettingsState && openSettingsState.details === details;
            closeSettings();
            if (!same) { openSettings(mode, node, details, gear); }
        }

        function openSettings(mode, node, details, gear) {
            var panel = settingsPanel(mode);
            var listening = new AbortController();

            openSettingsState = {
                mode: mode,
                node: node,
                details: details,
                home: details.parentElement,
                next: details.nextElementSibling,
                gear: gear,
                listening: listening,
            };

            dom.one(panel, '.ge-settings-title').textContent = t('panel.title', { kind: kindLabel(node) });
            dom.one(panel, '.ge-settings-body').appendChild(details);
            dom.show(details);
            dom.addClass(node, 'ge-settings-target');

            var signal = { signal: listening.signal };
            document.addEventListener('keydown', function(e) {
                // A dialog over the panel takes the Escape for itself
                if (e.key === 'Escape' && !dialogState) { closeSettings(); }
            }, signal);

            if (mode === 'offcanvas') {
                // From the bottom on a phone, from the side anywhere wider
                var narrow = window.innerWidth < 576;
                dom.toggleClass(panel, 'offcanvas-end', !narrow);
                dom.toggleClass(panel, 'offcanvas-bottom', narrow);
                dom.removeClass(panel, 'hiding');
                panel.getBoundingClientRect(); // So the slide in is a transition, not a jump
                dom.addClass(panel, 'show');
            } else if (mode === 'popover') {
                placePopover(panel, gear);
                dom.on(window, 'scroll resize', function() { placePopover(panel, gear); }, signal);

                // And again whenever what is in it changes size: the
                // Responsive section unfolding, a plugin swapping a field
                if (window.ResizeObserver) {
                    openSettingsState.observer = new window.ResizeObserver(function() { placePopover(panel, gear); });
                    openSettingsState.observer.observe(details);
                }
                // A press anywhere else puts it away, as a popover does
                dom.on(document, 'mousedown touchstart', function(e) {
                    if (!dialogState && !panel.contains(e.target) && !gear.contains(e.target)) { closeSettings(); }
                }, signal);
            } else {
                showModal(panel, function() {
                    if (openSettingsState && openSettingsState.mode === 'modal') { closeSettings(); }
                });
            }
        }

        /** Put what is open away, and its panel back in its drawer. */
        function closeSettings() {
            // A dialog opened from the panel goes with it
            closeDialog();

            var open = openSettingsState;
            if (!open) { return; }
            openSettingsState = null;

            var panel = settingsPanels[open.mode];
            open.listening.abort();
            if (open.observer) { open.observer.disconnect(); }

            if (open.mode === 'offcanvas') {
                dom.removeClass(panel, 'show');
                dom.addClass(panel, 'hiding');
                window.setTimeout(function() { dom.removeClass(panel, 'hiding'); }, 300);
            } else if (open.mode === 'popover') {
                dom.hide(panel);
            } else {
                hideModal(panel);
            }

            dom.removeClass(open.node, 'ge-settings-target');
            open.details.style.removeProperty('display');
            dom.dropEmptyStyle(open.details);

            // Where it was in its drawer, if the drawer is still there: a
            // node deleted while its settings were open took it with it
            if (open.home && dom.attached(open.home)) {
                if (open.next && open.next.parentElement === open.home) {
                    open.home.insertBefore(open.details, open.next);
                } else {
                    open.home.appendChild(open.details);
                }
            } else {
                open.details.remove();
            }
        }

        /** Built once per mode, on first use, and taken away by destroy() or setLocale(). */
        function settingsPanel(mode) {
            if (settingsPanels[mode]) { return settingsPanels[mode]; }

            var closeButton = function() {
                return dom.element('button', {
                    type: 'button',
                    'class': 'btn-close ge-settings-close',
                    'aria-label': t('panel.close'),
                });
            };
            var panel;

            if (mode === 'offcanvas') {
                panel = dom.create('<div class="offcanvas offcanvas-end ge-settings-panel ge-settings-offcanvas" tabindex="-1" role="dialog">' +
                    '<div class="offcanvas-header"><h5 class="offcanvas-title ge-settings-title"></h5></div>' +
                    '<div class="offcanvas-body ge-settings-body"></div>' +
                '</div>');
                dom.one(panel, '.offcanvas-header').appendChild(closeButton());
            } else if (mode === 'popover') {
                panel = dom.create('<div class="popover bs-popover-bottom ge-settings-panel ge-settings-popover" role="dialog">' +
                    '<div class="popover-arrow"></div>' +
                    '<div class="popover-header"><span class="ge-settings-title"></span></div>' +
                    '<div class="popover-body ge-settings-body"></div>' +
                '</div>');
                dom.one(panel, '.popover-header').appendChild(closeButton());
                dom.hide(panel);
            } else {
                panel = dom.create('<div class="modal fade ge-settings-panel ge-settings-modal" tabindex="-1" role="dialog" aria-hidden="true">' +
                    '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">' +
                        '<div class="modal-content">' +
                            '<div class="modal-header"><h5 class="modal-title ge-settings-title"></h5></div>' +
                            '<div class="modal-body ge-settings-body"></div>' +
                            '<div class="modal-footer"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>');
                dom.one(panel, '.modal-header').appendChild(closeButton());
                dom.one(panel, '.modal-footer').appendChild(dom.element('button', {
                    type: 'button',
                    'class': 'btn btn-primary ge-settings-close',
                }, t('panel.done')));
            }

            dom.delegate(panel, 'click', '.ge-settings-close', function(e) {
                e.preventDefault();
                closeSettings();
            });

            settingsPanels[mode] = document.body.appendChild(panel);
            return panel;
        }

        function removeSettingsPanels() {
            closeSettings();

            Object.keys(settingsPanels).forEach(function(mode) {
                if (mode === 'modal') {
                    retireModal(settingsPanels[mode]);
                } else {
                    settingsPanels[mode].remove();
                }
            });
            Object.keys(settingsPanels).forEach(function(mode) { removeBackdrop(settingsPanels[mode]); });
            settingsPanels = {};
        }

        /**
         * Under the gear, or over it when there is more room there, inside
         * the window, and no taller than the room it has: past that its body
         * scrolls.
         */
        function placePopover(panel, gear) {
            if (!dom.attached(gear)) { return; }

            dom.show(panel);

            var tool = gear.getBoundingClientRect();
            var gap = 8;
            var body = dom.child(panel, '.popover-body');
            body.style.removeProperty('max-height');
            var width = dom.outerWidth(panel);
            var height = dom.outerHeight(panel);
            var roomBelow = window.innerHeight - tool.bottom - 2 * gap;
            var roomAbove = tool.top - 2 * gap;
            var below = height <= roomBelow || roomBelow >= roomAbove;
            var room = below ? roomBelow : roomAbove;

            if (height > room) {
                dom.css(body, { 'max-height': Math.max(120, room - (height - dom.outerHeight(body))) });
                height = dom.outerHeight(panel);
            }

            var top = below ? tool.bottom + gap : tool.top - gap - height;
            var left = Math.max(gap, Math.min(tool.left + tool.width / 2 - 24, window.innerWidth - width - gap));

            dom.toggleClass(panel, 'bs-popover-bottom', below);
            dom.toggleClass(panel, 'bs-popover-top', !below);
            dom.css(panel, { top: top + window.pageYOffset, left: left + window.pageXOffset });

            // The arrow points at the gear, wherever the popover had to go
            dom.css(dom.child(panel, '.popover-arrow'), {
                left: Math.max(gap, Math.min(tool.left + tool.width / 2 - left - 8, width - 24)),
            });
        }

        /**
         * Bootstrap's modal ignores a hide while it is still fading in, and a
         * show while it is fading out, so the editor asks for what it wants
         * and has it done once the running transition ends: a panel closed as
         * it opens - getHtml, a second click - would otherwise stay open, and
         * empty. A hide Bootstrap starts itself, from Escape or the backdrop,
         * calls `dismissed`, as the close button does: the settings modal
         * closes the settings, the dialog closes the dialog.
         *
         * Without Bootstrap's javascript the modal is shown by hand, over a
         * backdrop of the editor's own that dismisses it when clicked.
         */
        function showModal(panel, dismissed) {
            var Modal = modalLibrary();
            var state = modalState.get(panel);

            if (!state) {
                state = { wanted: null, busy: false, backdrop: null, dismissed: dismissed };
                modalState.set(panel, state);
            }
            state.dismissed = dismissed;

            if (!Modal) {
                if (!state.backdrop) {
                    state.backdrop = dom.element('div', { 'class': 'modal-backdrop fade show ge-settings-backdrop' });
                    state.backdrop.addEventListener('click', function() { state.dismissed(); });
                    document.body.appendChild(state.backdrop);
                }
                dom.addClass(panel, 'show');
                panel.style.display = 'block';
                panel.removeAttribute('aria-hidden');
                return;
            }

            var modal = Modal.getOrCreateInstance(panel);

            if (!state.watched) {
                state.watched = true;
                trackModal(panel);

                panel.addEventListener('hide.bs.modal', function() {
                    // Not asked for: Escape or the backdrop
                    if (state.wanted === 'open') {
                        state.wanted = 'closed';
                        state.busy = true;
                    }
                });
                panel.addEventListener('shown.bs.modal', function() {
                    state.busy = false;
                    if (state.wanted === 'closed') { hideModal(panel); }
                });
                panel.addEventListener('hidden.bs.modal', function() {
                    state.busy = false;
                    if (state.wanted === 'open') {
                        showModal(panel, state.dismissed);
                    } else {
                        state.dismissed();
                    }
                });
            }

            state.wanted = 'open';
            if (!state.busy) {
                state.busy = true;
                modal.show();
            }
        }

        function hideModal(panel) {
            var Modal = modalLibrary();
            var state = modalState.get(panel);

            if (!state) { return; }
            state.wanted = 'closed';

            if (!Modal) {
                if (state.backdrop) { state.backdrop.remove(); state.backdrop = null; }
                dom.removeClass(panel, 'show');
                panel.style.removeProperty('display');
                panel.setAttribute('aria-hidden', 'true');
                return;
            }

            // Already out of sight - Bootstrap hid it itself, and this is its
            // hidden event closing the settings - and nothing is under way:
            // a hide now would be ignored, and no event would come to say so
            if (!state.busy && dom.hasClass(panel, 'show')) {
                state.busy = true;
                Modal.getOrCreateInstance(panel).hide();
            }
        }

        /** A modal's hand made backdrop goes with it. */
        function removeBackdrop(panel) {
            var state = modalState.get(panel);
            if (state && state.backdrop) { state.backdrop.remove(); state.backdrop = null; }
        }

        /* --------------------------------------------------------------
         * The dialog: a modal of the editor's own, over whatever settings
         * panel is open, for what does not fit in one. A plugin's section
         * of the panel opens in it when the panel is a popover or inline,
         * and a plugin can open one itself through ge.openDialog.
         *
         * What it shows is borrowed: the body goes into the dialog when it
         * opens and back where it was when it closes, so everything that
         * finds it through its node keeps working. One per editor, built
         * on first use, outside the canvas.
         * -------------------------------------------------------------- */

        var dialogPanel = null;
        var dialogState = null; // What is open: { body, home, next, opener, listening }

        function dialog() {
            if (dialogPanel) { return dialogPanel; }

            dialogPanel = dom.create('<div class="modal fade ge-dialog" tabindex="-1" role="dialog" aria-hidden="true">' +
                '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header"><h5 class="modal-title ge-dialog-title"></h5></div>' +
                        '<div class="modal-body ge-dialog-body"></div>' +
                        '<div class="modal-footer"></div>' +
                    '</div>' +
                '</div>' +
            '</div>');
            dom.one(dialogPanel, '.modal-header').appendChild(dom.element('button', {
                type: 'button',
                'class': 'btn-close ge-dialog-close',
                'aria-label': t('panel.close'),
            }));
            dom.one(dialogPanel, '.modal-footer').appendChild(dom.element('button', {
                type: 'button',
                'class': 'btn btn-primary ge-dialog-close',
            }, t('panel.done')));

            dom.delegate(dialogPanel, 'click', '.ge-dialog-close', function(e) {
                e.preventDefault();
                closeDialog();
            });

            return document.body.appendChild(dialogPanel);
        }

        /**
         * ge.openDialog(title, body, opener): show `body` in the dialog. One
         * already open closes first. `opener`, when given, has the focus back
         * when it closes.
         */
        function openDialog(title, body, opener) {
            closeDialog();

            var panel = dialog();
            var listening = new AbortController();

            dialogState = {
                body: body,
                home: body.parentElement,
                next: body.nextElementSibling,
                opener: opener || document.activeElement,
                listening: listening,
            };

            dom.one(panel, '.ge-dialog-title').textContent = title;
            dom.one(panel, '.ge-dialog-body').appendChild(body);
            dom.show(body);

            // Bootstrap's modal takes its own Escape; a hand made one does not
            if (!modalLibrary()) {
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') { closeDialog(); }
                }, { signal: listening.signal });
            }

            // Bootstrap puts a popover over a modal: the panel the dialog was
            // opened from goes under its backdrop while it is up
            Object.keys(settingsPanels).forEach(function(mode) {
                dom.addClass(settingsPanels[mode], 'ge-under-dialog');
            });

            showModal(panel, function() { closeDialog(); });
        }

        /** ge.closeDialog(): put the dialog away, and what it showed back where it was. */
        function closeDialog() {
            var open = dialogState;
            if (!open) { return; }
            dialogState = null;

            open.listening.abort();
            hideModal(dialogPanel);
            Object.keys(settingsPanels).forEach(function(mode) {
                dom.removeClass(settingsPanels[mode], 'ge-under-dialog');
            });

            dom.hide(open.body);
            if (open.home && dom.attached(open.home)) {
                if (open.next && open.next.parentElement === open.home) {
                    open.home.insertBefore(open.body, open.next);
                } else {
                    open.home.appendChild(open.body);
                }
            } else {
                open.body.remove();
            }

            if (open.opener && dom.attached(open.opener) && open.opener.focus) { open.opener.focus(); }
        }

        function removeDialog() {
            closeDialog();
            if (!dialogPanel) { return; }

            removeBackdrop(dialogPanel);
            retireModal(dialogPanel);
            dialogPanel = null;
        }

        /** What a panel's title calls a node. */
        function kindLabel(node) {
            var kind = kindOf(node);

            if (CONTAINERS[kind] && CONTAINERS[kind].labelKey) { return t(CONTAINERS[kind].labelKey); }

            switch (kind) {
                case 'row': return t('panel.kind_row');
                case 'column': return t('panel.kind_column');
                case 'text': return t('panel.kind_text');
                case 'element': return t('panel.kind_element');
                case 'section': return t('panel.kind_section');
                case 'tab': return t('panel.kind_tab');
                case 'accordion-item': return t('panel.kind_accordion_item');
                default: return kind;
            }
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
            dom.all(canvas, '.column, div[class*="col-"], div.col').forEach(function(col) {
                dom.addClass(col, 'column');

                // A column in a row with row-cols is sized by its row
                if (sizedTiers(col).length || hasRowCols(col.parentElement)) { return; }

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
            return dom.hasClass(row, 'row') && BREAKPOINTS.some(function(tier) {
                return ROW_COLS_VALUES.some(function(value) { return dom.hasClass(row, rowColsClass(tier, value)); });
            });
        }

        /** The row-cols class that applies to a row at a tier, as { tier, value }, or null. */
        function rowColsSource(row, tier) {
            if (!dom.hasClass(row, 'row')) { return null; }

            for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
                for (var v = 0; v < ROW_COLS_VALUES.length; v++) {
                    if (dom.hasClass(row, rowColsClass(BREAKPOINTS[i], ROW_COLS_VALUES[v]))) {
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
            var row = rowColsSource(col.parentElement, tier);
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
            if (hasRowCols(col.parentElement) && !columnSource(col, tier)) {
                return { flex: '0 0 auto', width: '100%', 'max-width': '100%' };
            }

            return {};
        }

        /**
         * The badge on a row whose columns are sized by row-cols in the view,
         * and in the all view by its row-cols with no breakpoint.
         */
        function markRowCols(scope) {
            dom.selfAndAll(scope, '.row').forEach(function(row) {
                var source = settings.row_cols === false ? null : (curView === ALL_VIEW
                    ? (rowColsSource(row, BREAKPOINTS[0]) || null)
                    : rowColsSource(row, breakpoint(curView)));

                if (!source) {
                    row.removeAttribute('data-ge-row-cols');
                } else {
                    row.setAttribute('data-ge-row-cols', rowColsLabel(source.value));
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

            if (dom.hasClass(col, sizeClass(tier, 'auto'))) { return 'auto'; }
            if (dom.hasClass(col, sizeClass(tier, 'equal'))) { return 'equal'; }

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
            var match = new RegExp('(?:^|\\s)' + prefix + '(\\d+)(?:\\s|$)').exec(col.getAttribute('class') || '');
            return match ? parseInt(match[1], 10) : null;
        }

        function writeUnits(col, prefix, units) {
            var classes = (col.getAttribute('class') || '').split(/\s+/).filter(function(name) {
                return name !== '' && !new RegExp('^' + prefix + '\\d+$').test(name);
            });

            if (units !== null) { classes.push(prefix + units); }

            col.setAttribute('class', classes.join(' '));
        }

        /** One size per tier: writing a size takes whatever size the tier had off. */
        function setSize(col, tier, size) {
            writeUnits(col, tier.colPrefix, null);
            FLEX_SIZES.forEach(function(flex) { dom.removeClass(col, sizeClass(tier, flex)); });

            if (size !== null && size !== undefined) { dom.addClass(col, sizeClass(tier, size)); }
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

            dom.children(row, '.column').forEach(function(sibling) {
                if (ignore && sibling === ignore) { return; }

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
            dom.selfAndAll(scope, '.column').forEach(function(col) {
                dom.css(col, { width: '', height: '', left: '', top: '' });

                // Clearing the last property leaves style="" behind, which is
                // an editor leftover like any other
                dom.dropEmptyStyle(col);
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
         * text blocks and containers, and whatever blocks a feature adds -
         * the sections plugin's sections. A content area is a block through
         * the text block around it while editing, and on its own before.
         */
        function blockSelector() {
            return ['.row', '.ge-text-block', '.ge-content', '[data-ge-container]']
                .concat(pluginHooks('blocks')).join(', ');
        }

        /** A selector every feature plugin may contribute to, under one name. */
        function pluginHooks(name) {
            return Object.keys(FEATURES).map(function(key) {
                return FEATURES[key][name] || null;
            }).filter(function(hook) { return hook !== null; });
        }

        /**
         * Whether a region will have a block dropped in it. Every block goes
         * everywhere unless a feature says otherwise: a section only on the
         * canvas, and only rows in a section.
         */
        function acceptsBlock(region, node) {
            var accepted = true;

            Object.keys(FEATURES).forEach(function(name) {
                var feature = FEATURES[name];
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
                // - the info tools excepted, which do nothing when clicked:
                // a text's drawer is small and made of little but tools, and
                // with those turned away as well there was nothing to hold
                ? '.ge-tools-drawer > a:not(.ge-text-info):not(.ge-element-info), .ge-details, ' +
                    'input, textarea, button, select, option'
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
         *
         * `lists` is an element or an array of them; `options.accepts`, when
         * given, is asked (list, item) with elements.
         */
        function sortable(lists, options) {
            var Sortable = sortableLibrary();

            lists = Array.isArray(lists) ? lists : (lists ? [lists] : []);
            if (!lists.length || !Sortable) { return; }

            var wholeDrawer = settings.drag_handle === 'drawer';
            var cancel = dragCancelSelector();
            var soloGroup = 0;

            lists.forEach(function(list) {
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
                        return from.options.group.name === group.name && options.accepts(to.el, dragged);
                    };
                }

                sortables.push(Sortable.create(list, Object.assign({
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
                        if (dom.closest(e.target, cancel, list)) { return true; }

                        return !item || item.parentNode !== list;
                    },

                    // A filtered pointerdown is still a click on a tool
                    preventOnFilter: false,

                    // The HTML5 drag and drop API cannot be driven by
                    // synthetic events, so the tests could not exist without
                    // this; it also gives one helper across browsers
                    forceFallback: true,

                    // The copy that follows the pointer is appended to the
                    // list the drag started in rather than to the body: it is
                    // positioned fixed either way, and inside the canvas it
                    // looks like what it is a copy of. On the body none of the
                    // editing styles reached it - its drawers came out
                    // unstyled, their settings panels open.
                    fallbackOnBody: false,

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
            if (!sortableLibrary()) {
                warnOnceHere('sortable_missing', t('error.sortable_missing'));
                return;
            }

            sortable(dom.all(canvas, '.row'), {
                draggable: '.column',
                group: 'column',
            });

            sortable([canvas].concat(dom.all(canvas, '.column')), {
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
                sortable(dom.all(canvas, regions.join(', ')), {
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
            var node = e.item;
            var from = positionOf(node);
            var subject = moveSubject(node);
            var move = { from: from, canceled: false };

            moves.set(node, move);

            operate(function() {
                var moving = emit('before-move', payloadFor(subject.kind, subject.node, {
                    parent: from.parent,
                    source: 'dragdrop',
                    from: from,
                }));

                if (!moving) { move.canceled = true; }
            });
        }

        /**
         * What a drag reports as moving. A text block is the editor's own
         * wrapper, so what moved is the content area inside it.
         */
        function moveSubject(item) {
            var node = dom.hasClass(item, 'ge-text-block') ? (dom.child(item, '.ge-content') || item) : item;

            return { kind: kindOf(node), node: node };
        }

        /** Put a node back where a refused drag found it. */
        function putBack(node, from) {
            var siblings = dom.children(from.parent).filter(function(child) {
                return child !== node && !dom.hasClass(child, 'ge-tools-drawer');
            });

            if (!siblings.length || from.index >= siblings.length) {
                from.parent.appendChild(node);
            } else {
                from.parent.insertBefore(node, siblings[from.index]);
            }
        }

        function sortEnd(e) {
            var node = e.item;
            var move = moves.get(node);
            var from = move ? move.from : positionOf(node);

            moves.delete(node);

            if (move && move.canceled) {
                putBack(node, from);
                return;
            }

            var to = positionOf(node);
            if (to.parent === from.parent && to.index === from.index) {
                return; // A drag that went nowhere is not a move
            }

            var container = dom.closest(node, '[data-ge-container]');
            var definition = CONTAINERS[containerTypeOf(container)];
            if (definition && definition.afterPaneMove) {
                definition.afterPaneMove(container, node, from);
            }

            // No init() here, unlike an add: the node brought its drawer
            // with it, and the drag is still being finished, so this is the
            // wrong moment to rebuild the lists it is using.
            var subject = moveSubject(node);

            operate(function() {
                emit('after-move', payloadFor(subject.kind, subject.node, {
                    parent: to.parent,
                    source: 'dragdrop',
                    from: from,
                    to: to,
                    container: container || undefined,
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

            dom.all(canvas, '.column').forEach(function(col) {
                if (dom.child(col, '.ge-resize-handle')) { return; }

                var drawer = dom.child(col, '.ge-tools-drawer');
                if (drawer) { drawer.appendChild(dom.element('span', { 'class': 'ge-resize-size' })); }

                resizeEdges().forEach(function(edge) {
                    var handle = dom.element('span', {
                        'class': 'ge-resize-handle ge-resize-' + edge,
                        'data-ge-edge': edge,
                    });
                    handle.addEventListener('pointerdown', startResizeDrag);
                    col.appendChild(handle);
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
            var handle = e.currentTarget;
            var col = handle.parentElement;
            var west = handle.getAttribute('data-ge-edge') === 'w';
            var startX = e.pageX;
            var startWidth = dom.outerWidth(col);

            e.preventDefault();

            if (!resizeStart(col)) { return; }

            dom.addClass(col, 'ge-resizing');
            if (e.pointerId !== undefined && handle.setPointerCapture) {
                handle.setPointerCapture(e.pointerId);
            }

            function widthAt(move) {
                var delta = move.pageX - startX;

                return Math.max(1, startWidth + (west ? -delta : delta));
            }

            function onMove(move) {
                col.style.width = widthAt(move) + 'px';
                resizeMove(col, widthAt(move));
            }

            function onUp(up) {
                handle.removeEventListener('pointermove', onMove);
                dom.off(handle, 'pointerup pointercancel', onUp);
                dom.removeClass(col, 'ge-resizing');
                resizeStop(col, widthAt(up));
            }

            handle.addEventListener('pointermove', onMove);
            dom.on(handle, 'pointerup pointercancel', onUp);
        }

        function removeResizable() {
            dom.all(canvas, '.ge-resize-handle').forEach(function(handle) { handle.remove(); });

            dom.all(canvas, '.ge-resize-size').forEach(function(readout) { readout.remove(); });
            stripPixelWidths(canvas);
        }

        /**
         * The units a pixel width comes to, snapped to whole ones and held
         * inside the same budget the tools obey. With balance 'next' the
         * column may grow into its neighbour, which is what dragging the
         * divider between two columns looks like it should do.
         */
        function snapUnits(col, pixels) {
            var units = Math.round(pixels / rowContentWidth(col.parentElement) * MAX_COL_SIZE);
            var next = balanceSibling(col);
            var nextSize = next ? currentSize(next) : null;

            // Measured when the drag started: the column is the width of the
            // pointer now, which is not what it was
            var resize = resizes.get(col);
            var own = resize ? resize.units : currentUnits(col);

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

            return dom.nextAll(col, '.column')[0] || null;
        }

        function resizeReadout(col, text) {
            var drawer = dom.child(col, '.ge-tools-drawer');
            var readout = drawer ? dom.child(drawer, '.ge-resize-size') : null;
            if (readout) { readout.textContent = text; }
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

            var resize = { from: from, units: currentUnits(col) };
            resizes.set(col, resize);
            resizeReadout(col, sizeLabel(resize.units));

            return true;
        }

        function resizeMove(col, width) {
            resizeReadout(col, sizeLabel(snapUnits(col, width)));
        }

        function resizeStop(col, width) {
            var resize = resizes.get(col);
            var units = snapUnits(col, width);

            resizes.delete(col);
            resizeReadout(col, '');
            stripPixelWidths(col);

            if (!resize) { return; }

            // A drag of a couple of pixels lands on the size it started from,
            // and is not a resize - not even of an equal or auto column,
            // which it would otherwise turn into a number
            if (units === resize.units) { return; }

            var plan = planSize(col, units);
            if (!plan) { return; }

            operate(function() {
                writeSize(col, plan);
                balanceAfterResize(col, units - resize.units);
                refreshUtilities(col);

                emit('after-resize', payloadFor('column', col, withCleared({
                    source: 'dragdrop',
                    from: resize.from,
                    to: plan.size,
                }, plan.cleared)));
            });
        }

        /**
         * The column after takes what the resized one gave or took, unless it
         * is equal or auto: those take what is left by themselves. It is part
         * of the same gesture, so it is not announced separately.
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
            sortables.forEach(function(sortableInstance) { sortableInstance.destroy(); });

            sortables = [];
        }

        function createRow() {
            return dom.element('div', { 'class': 'row' });
        }

        /**
         * Put a freshly created node where the caller asked for it, through
         * the add events, and bring the canvas up to date so the new markup
         * gets its controls. With no placement option the node stays
         * detached, and placing it and calling reset() is the host's job
         * (spec 1.2).
         *
         * The place is an element, or the first one a selector matches.
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

            var target = nodeFrom(options[placement]);
            if (!target) {
                warn(kind + ': ' + placement + ' matches no element; the ' + kind + ' is left detached');
                return node;
            }

            var parent = (placement === 'appendTo' || placement === 'prependTo')
                ? target
                : target.parentElement;

            var add = function() {
                return addNode(kind, node, function() {
                    if (placement === 'appendTo') {
                        target.appendChild(node);
                    } else if (placement === 'prependTo') {
                        target.insertBefore(node, target.firstChild);
                    } else if (placement === 'insertBefore') {
                        target.parentNode.insertBefore(node, target);
                    } else {
                        dom.insertAfter(node, target);
                    }
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
                row.appendChild(createColumn(size));
            });

            return place(row, 'row', options);
        }

        /**
         * A column of `size` units, optionally holding `options.content`.
         */
        function apiCreateColumn(size, options) {
            options = options || {};

            // Going into a row with row-cols, no size is a size: the row's share
            var into = nodeFrom(options.appendTo || options.prependTo || null);

            if (size === undefined && into && rowColsSource(into, leadingTier())) {
                size = null;
            } else if (!isUnits(size) && FLEX_SIZES.indexOf(size) === -1) {
                warn('createColumn: no column size given, using ' + MAX_COL_SIZE);
                size = MAX_COL_SIZE;
            }

            var column = createColumn(size, options.offset);
            if (options.content !== undefined) {
                column.appendChild(contentFor(options.content));
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
            container = nodeFrom(container);
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
         * A shallow frozen copy of the settings for the instance, so a host
         * can read what the editor is running with without changing it
         * behind the editor's back. Arrays are copied; the objects inside them
         * are the host's own and stay shared.
         */
        function settingsCopy() {
            var copy = {};

            Object.keys(settings).forEach(function(key) {
                var value = settings[key];
                copy[key] = Array.isArray(value) ? value.slice() : value;
            });

            return Object.freeze(copy);
        }

        /**
         * A column sized for the current view: its tier, or the base class in
         * the all view. `offset` indents it, within the same 12 unit budget.
         */
        function createColumn(size, offset) {
            // Empty: what goes in it is the next decision, and the tools of
            // the column and the toolbar are where it is made
            var column = dom.element('div', { 'class': 'column' });

            // The tier being edited, or the base class in the all view
            var tier = tiersFor(curView)[0];
            var wanted = clamp({ size: size, offset: offset || 0, leading: 'offset' });

            setSize(column, tier, wanted.size === null ? size : wanted.size);
            setOffset(column, tier, wanted.offset);

            return column;
        }

        /**
         * Run custom content filter on init and deinit. A filter is a
         * function, or the name of one on window, and gets the canvas and
         * whether this is init.
         */
        function runFilter(isInit) {
            if (!settings.custom_filter || !settings.custom_filter.length) { return; }

            var filters = typeof settings.custom_filter === 'string' || typeof settings.custom_filter === 'function'
                ? [settings.custom_filter]
                : settings.custom_filter;

            Array.prototype.forEach.call(filters, function(func) {
                if (typeof func == 'string') {
                    func = window[func];
                }

                func(canvas, isInit);
            });
        }

        /**
         * What a text is never made of: rows, containers, and whatever a
         * feature plugin says - the elements plugin's elements. Each is a
         * block of the column's, beside the texts.
         */
        function textCutter() {
            var cuts = ['.row', '[data-ge-container]'];

            Object.keys(FEATURES).forEach(function(name) {
                var feature = FEATURES[name];
                var cut = typeof feature.cuts === 'function' ? feature.cuts() : feature.cuts;
                if (cut) { cuts.push(cut); }
            });

            return cuts.join(', ');
        }

        /**
         * Take the blocks out of the text.
         *
         * Up to 5.x an element lived inside a content area, among the text
         * a rich text editor edited. From 6.0 it is a block of its own, so a
         * content area with one inside - markup 5.x saved - is cut there: the
         * text before stays in the content area, the element goes into the
         * column after it, and the text after goes into a new content area of
         * the same type. Only a content area's own children cut it, which is
         * where 5.x recognized elements; one inside a paragraph is text, as
         * it was. A part with nothing but whitespace is dropped, and the first
         * part that has something keeps the content area, id and classes and
         * all.
         *
         * On every init, and a no-op on markup 6.0 made: nothing to cut. A
         * content area its editor is open on is left for the next init.
         */
        function splitTexts(cutter) {
            dom.all(canvas, '.column > .ge-content, .column > .ge-text-block > .ge-content').forEach(function(area) {
                if (dom.hasClass(area, 'ge-rte-active') || !dom.children(area, cutter).length) { return; }

                var type = area.getAttribute('data-ge-content-type');
                var anchor = dom.hasClass(area.parentElement, 'ge-text-block') ? area.parentElement : area;
                var pieces = [];
                var run = [];

                Array.prototype.slice.call(area.childNodes).forEach(function(node) {
                    if (node.nodeType === 1 && node.matches(cutter)) {
                        pieces.push({ text: run }, { block: node });
                        run = [];
                    } else {
                        run.push(node);
                    }
                });
                pieces.push({ text: run });

                while (area.firstChild) { area.removeChild(area.firstChild); }

                var kept = false;
                var last = anchor;

                pieces.forEach(function(piece) {
                    var placed;

                    if (piece.block) {
                        placed = piece.block;
                    } else if (!hasContent(piece.text)) {
                        return;
                    } else if (kept) {
                        // Of the same type, or of none if it had none
                        placed = createDefaultContentWrapper(type);
                        piece.text.forEach(function(node) { placed.appendChild(node); });
                    } else {
                        // The content area itself, moved along if an
                        // element came before the first text
                        piece.text.forEach(function(node) { area.appendChild(node); });
                        placed = anchor;
                        kept = true;
                    }

                    if (placed !== last) { dom.insertAfter(placed, last); }
                    last = placed;
                });

                if (!kept) { anchor.remove(); }
            });
        }

        /** Whether a run of nodes has anything in it but whitespace. */
        function hasContent(nodes) {
            return nodes.some(function(node) {
                return node.nodeType === 1 || (node.nodeType === 3 && /\S/.test(node.nodeValue));
            });
        }

        /**
         * Wrap column content in <div class="ge-content"> where neccesary
         */
        function wrapContent(cutter) {
            dom.all(canvas, '.column').forEach(function(col) {
                var contents = [];

                dom.children(col).forEach(function(child) {
                    // The editor's own furniture is not content and not a
                    // boundary either. The resize handle used to be treated as
                    // content and wrapped into a content area of its own on
                    // the next init.
                    if (dom.is(child, '.ge-tools-drawer, .ge-resize-handle')) { return; }

                    // A container, or an element, sits in the column beside
                    // the content areas, not inside one, so it ends a run of
                    // loose content rather than joining it
                    if (dom.is(child, '.ge-content, .ge-text-block') || child.matches(cutter)) {
                        contents = doWrap(contents);
                    } else {
                        contents.push(child);
                    }
                });

                doWrap(contents);
            });
        }

        /**
         * Wrap a run of loose column content in a content area of no type -
         * the host's plain content - and hand back
         * an empty run: the caller has to forget what it just wrapped, or the
         * next boundary wraps the same nodes again and leaves the first
         * wrapper behind, empty.
         */
        function doWrap(contents) {
            if (contents.length) {
                var contentArea = dom.insertAfter(createDefaultContentWrapper(), contents[contents.length - 1]);
                contents.forEach(function(node) { contentArea.appendChild(node); });
            }

            return [];
        }

        /**
         * A content area of a text type, or with none the host's plain
         * content: a content area and nothing more.
         */
        function createDefaultContentWrapper(type) {
            var contentArea = dom.element('div', { 'class': 'ge-content' });

            if (type) {
                dom.addClass(contentArea, 'ge-content-type-' + type);
                contentArea.setAttribute('data-ge-content-type', type);
            }

            return contentArea;
        }

        /* --------------------------------------------------------------
         * Content blocks: a content area as a block of its own, with a drawer.
         *
         * The drawer cannot go inside the content area, as every other
         * block's does: what is inside may be a text editor's, which would
         * make the drawer editable text, copy it into its own document or
         * take it away on an undo. So while editing, each content area in a
         * column sits in a .ge-text-block beside its drawer, and that wrapper
         * is the block the column moves. deinit takes it off again: it is
         * never part of the markup.
         *
         * A content area with no type is the host's plain content, and its
         * drawer is the editor's: move and delete, nothing else. One whose
         * type a plugin declares is that plugin's text, and the plugin gives
         * it its drawer. One whose type nobody declares is a text whose
         * editor is not loaded: a block to move and delete, not to edit.
         * -------------------------------------------------------------- */

        function wrapTexts() {
            dom.all(canvas, '.column > .ge-content').forEach(function(area) {
                dom.wrap(area, dom.element('div', { 'class': 'ge-text-block' }));
            });

            dom.all(canvas, '.ge-text-block').forEach(function(textBlock) {
                if (dom.child(textBlock, '.ge-tools-drawer')) { return; }

                var area = dom.child(textBlock, '.ge-content');
                var type = area ? area.getAttribute('data-ge-content-type') : null;

                if (!type) {
                    createPlainControls(textBlock);
                } else if (!hasTextOwner(type)) {
                    createOrphanControls(textBlock, type);
                }
            });
        }

        /** After the drawers are gone, so a wrapper holds its content area and nothing else. */
        function unwrapTexts() {
            dom.all(canvas, '.ge-text-block').forEach(function(textBlock) {
                dom.unwrap(textBlock);
            });
        }

        /** The host's plain content: moved and deleted here, edited in the source. */
        function createPlainControls(textBlock) {
            var block = dom.child(textBlock, '.ge-content');
            var drawer = prependDrawer(textBlock, 'ge-tools-drawer ge-text-drawer ge-plain-drawer');
            dom.addClass(textBlock, 'ge-plain-block');

            createMoveTool(drawer);

            // The tools a feature plugin gives plain content, which is not
            // every plugin's drawerTools: no gear, no utilities, no copy
            Object.keys(FEATURES).forEach(function(name) {
                if (FEATURES[name].plainTools) { FEATURES[name].plainTools(drawer, block); }
            });

            createTool(drawer, t('tool.delete_plain'), 'ge-delete-plain', 'bi bi-trash', function() {
                deleteNode('plain', block, t('confirm.delete_plain'), function(removed) {
                    dom.slideUp(textBlock, function() {
                        textBlock.remove();
                        removed();
                    });
                });
            });
        }

        /**
         * A text whose editor is not loaded: still a block to move and delete,
         * and its drawer says why it cannot be edited.
         */
        function createOrphanControls(textBlock, type) {
            var block = dom.child(textBlock, '.ge-content');
            var drawer = prependDrawer(textBlock, 'ge-tools-drawer ge-text-drawer');

            createMoveTool(drawer);
            createTool(drawer, t('text.no_editor', { type: type }), 'ge-text-info ge-text-missing',
                'bi bi-exclamation-triangle');
            createTool(drawer, t('tool.delete_text'), 'ge-delete-text', 'bi bi-trash', function() {
                deleteNode('text', block, t('confirm.delete_text'), function(removed) {
                    dom.slideUp(textBlock, function() {
                        textBlock.remove();
                        removed();
                    });
                });
            });
        }

        /**
         * A detached content area holding `content` - html, or a node - as a
         * text of the first type offered, or the host's plain content when no
         * editor is offered.
         */
        function contentFor(content) {
            var offers = textOffers();
            var area = createDefaultContentWrapper(offers.length ? offers[0].type : null);

            if (content && content.nodeType) {
                area.appendChild(content);
            } else {
                dom.setHtml(area, content);
            }

            return area;
        }

        /**
         * Constrain the canvas to the view's preview width and make that
         * tier's classes the effective ones. The all view constrains nothing:
         * every tier is live, which is how the page will really render.
         */
        function switchLayout(view) {
            curView = view;

            VIEW_KEYS.forEach(function(key) {
                dom.toggleClass(canvas, 'ge-layout-' + key, key === view);
            });
            dom.one(layoutDropdown, 'button').textContent = t(labelKeyFor(view));
        }

        /** The view key a caller asked for, or null. */
        function viewKey(view) {
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

            settingsScope().forEach(function(scope) {
                dom.all(scope, '.ge-utilities').forEach(function(section) { renderUtilities(section); });
            });
            renderPluginFields(null);
            refreshPreviews(canvas);
            plugins('onViewChange', key);
            emit('view-change', { canvas: canvas, breakpoint: key, from: from, to: key });
        }

        function getView() {
            return curView;
        }

        /** A method a feature plugin contributes, or a warning that the plugin is not loaded. */
        function featureMethod(name, plugin, file) {
            return function() {
                if (!featureMethods[name]) {
                    warnOnceHere('plugin:' + plugin, name + ' needs the ' + plugin + ' plugin: ' +
                        'include dist/plugins/grideditor.' + file + '.js after the editor');
                    return null;
                }

                return featureMethods[name].apply(null, arguments);
            };
        }

        /**
         * The instance's own methods: the documented API. init and reset are
         * deferred when a handler calls them, so an operation in flight
         * finishes before the canvas is rebuilt. The ones that do something,
         * rather than answer something, hand back the instance, to chain.
         */
        function apiSetActiveTarget(value) {
            if (!settings.active_target) {
                warnOnceHere('active_target', 'setActiveTarget needs the active_target setting: without it, it does nothing');
                return;
            }
            if (value === null || value === undefined) { changeTarget(null); return; }

            var node = nodeFrom(value);
            if (!isTarget(node)) {
                var named = typeof value === 'string' ? value : (node ? '<' + node.tagName.toLowerCase() + '>' : String(value));
                warn('setActiveTarget: ' + named + ' is not a column or a region of the canvas');
                return;
            }

            changeTarget(node);
        }

        var own = {
            getHtml: getHtml,
            getPlainHtml: getPlainHtml,
            init: function() { defer(init); },
            reset: function() { defer(reset); },
            deinit: deinit,
            destroy: destroy,
            changeView: changeView,
            getView: getView,
            createRow: apiCreateRow,
            createColumn: apiCreateColumn,
            createText: function(type, options) {
                if (!featureMethods.createText) {
                    warnOnceHere('plugin:text', 'createText needs a text editor plugin: include ' +
                        'dist/plugins/grideditor.tinymce.js, or another editor\'s, after the editor');
                    return null;
                }

                return featureMethods.createText(type, options);
            },
            createElement: featureMethod('createElement', 'elements', 'elements'),
            createSection: featureMethod('createSection', 'sections', 'sections'),
            createContainer: apiCreateContainer,
            addTab: function(container, options) { return addPaneTo(container, 'tabs', options); },
            addAccordionItem: function(container, options) {
                return addPaneTo(container, 'accordion', options);
            },
            setLocale: setLocale,
            getUtility: getUtility,
            setUtility: setUtility,
            getActiveTarget: function() { return settings.active_target ? activeTarget : null; },
            setActiveTarget: apiSetActiveTarget,
        };

        Object.keys(own).forEach(function(name) {
            var value = !!(METHODS[name] && METHODS[name].value);

            instance[name] = function() {
                if (destroyed) {
                    warnOnceHere('destroyed:' + name, t('warning.destroyed', { method: name }));
                    if (name === 'getHtml') { return canvas.innerHTML; }
                    if (name === 'getPlainHtml') { return plainHtml(canvas.innerHTML); }
                    return value ? null : instance;
                }

                var result = own[name].apply(instance, arguments);
                return value ? result : instance;
            };
        });

        instance.canvas = canvas;
        instance.settings = settingsCopy();

        instances.set(canvas, instance);

        loadPlugins();
        // Again, with what the plugins filled in: the text editors'
        // content_types when the host gave none
        instance.settings = settingsCopy();
        setup();
        init();

        GridEditor._created.forEach(function(hook) { hook(instance); });
}

/**
 * What a module that builds on the editor - the jQuery adapter - is told:
 * each editor as it is made. Not the plugin contract; a plugin is handed
 * the editor through its factory.
 */
GridEditor._created = [];

/**
 * Container plugins: tabs, accordions, popups, and whatever a host writes.
 *
 * A plugin is a factory registered under the type it builds, called once per
 * editor with the handle described in docs/plugins.md. Loading its file is
 * what makes the type available; the `plugins` setting narrows that list.
 *
 *   GridEditor.containers.carousel = function(ge) {
 *       return { labelKey: ..., create: ..., mark: ..., unmark: ... };
 *   };
 */
GridEditor.containers = {};

/**
 * Feature plugins: a piece of the editor that is not a container type, in a
 * file of its own. Element level controls are one. Same bargain as a
 * container plugin - a factory under its name, called once per editor with
 * the handle in docs/plugins.md - and the same `plugins` setting decides
 * which of the loaded ones are used.
 */
GridEditor.features = {};

/**
 * Utility plugins: Bootstrap's responsive utility classes - order-md-2,
 * d-lg-none - edited per breakpoint. A plugin declares families of classes
 * and the editor reads them, writes them, puts them in the settings panel and
 * previews them in each view. Same factory, same `plugins` setting.
 *
 *   GridEditor.utilities.order = function(ge) {
 *       return { families: [{ name: 'order', prefix: 'order', values: [...] }] };
 *   };
 */
GridEditor.utilities = {};

/**
 * The text editors, by the content type each edits: what the text plugins
 * (tinymce, ckeditor, summernote, a host's own) register, and the text
 * feature, src/js/text/grideditor.text.js, reads.
 */
GridEditor.texts = {};

/** Translator for the plugins, which get settings and no instance. */
GridEditor.t = translate;

/** getPlainHtml for html that is not on a canvas, for the jQuery adapter. Not the public API. */
GridEditor._plainHtml = plainHtml;

/**
 * SortableJS and Bootstrap's javascript, for a page that imports them as
 * modules and so has no window.Sortable or window.bootstrap. Looked up
 * before the globals; only Bootstrap's Modal is used.
 */
GridEditor.Sortable = null;
GridEditor.bootstrap = null;

/** The version of the build, filled in by build/build.js. */
GridEditor.version = typeof __GRIDEDITOR_VERSION__ === 'undefined' ? 'dev' : __GRIDEDITOR_VERSION__;

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
GridEditor.locales = {
    en: {
        'tool.move': 'Move',
        'tool.settings': 'Settings',
        'tool.add_row': 'Add row',
        'tool.delete_text': 'Remove text',
        'tool.delete_plain': 'Remove content',
        'tool.convert_type': 'Edit as {editor} text',
        'text.no_editor': 'No text editor "{type}" is loaded: this text can be moved and deleted, not edited',
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
        'tool.more': 'More',
        'group.rows': 'Rows',
        'group.content': 'Content',
        'group.elements': 'Elements',
        'group.select': 'Add',
        'panel.title': '{kind} settings',
        'panel.close': 'Close',
        'panel.done': 'Done',
        'panel.id': 'Id',
        'panel.classes': 'Classes',
        'panel.section_general': 'Id and classes',
        'panel.kind_row': 'Row',
        'panel.kind_column': 'Column',
        'panel.kind_element': 'Element',
        'panel.kind_section': 'Section',
        'panel.kind_tab': 'Tab',
        'panel.kind_accordion_item': 'Accordion item',
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
        'confirm.delete_text': 'Delete this text?',
        'confirm.delete_plain': 'Delete this content?',
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
        'warning.already_editing': 'This element already has an editor: that one is handed back, with the options it was made with.',
        'warning.destroyed': '{method}() was called on an editor that has been destroyed, and does nothing.',
        'warning.duplicate_build': 'grideditor.js was loaded twice: the first GridEditor is kept.',
        'warning.adapter_no_jquery': 'grideditor.jquery.js needs jQuery 4, and there is no jQuery on the page: the jQuery API is not there.',
        'error.tinymce_missing': 'tinyMCE not available! Make sure you loaded the tinyMCE js file.',
        'error.ckeditor_missing': 'CKEditor 5 not available! Make sure you loaded its ckeditor5.umd.js file.',
        'error.summernote_missing': 'Summernote not available! Make sure you loaded jQuery and the Summernote js file.',
    },
};

export { GridEditor };
export default GridEditor;
