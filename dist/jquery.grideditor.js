/**
 * Frontwise grid editor plugin.
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
    createContainer:  { value: true },
    addTab:           { value: true },
    addAccordionItem: { value: true },
    setLocale:        {},
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
 */
var BREAKPOINTS = [
    { key: 'xs', colPrefix: 'col-', offsetPrefix: 'offset-', min: 0, preview: 400, labelKey: 'view.xs' },
    { key: 'sm', colPrefix: 'col-sm-', offsetPrefix: 'offset-sm-', min: 576, preview: 576, labelKey: 'view.sm' },
    { key: 'md', colPrefix: 'col-md-', offsetPrefix: 'offset-md-', min: 768, preview: 768, labelKey: 'view.md' },
    { key: 'lg', colPrefix: 'col-lg-', offsetPrefix: 'offset-lg-', min: 992, preview: 992, labelKey: 'view.lg' },
    { key: 'xl', colPrefix: 'col-xl-', offsetPrefix: 'offset-xl-', min: 1200, preview: 1200, labelKey: 'view.xl' },
    { key: 'xxl', colPrefix: 'col-xxl-', offsetPrefix: 'offset-xxl-', min: 1400, preview: null, labelKey: 'view.xxl' },
];

/**
 * The view that edits every tier at once. It is the default, and the one most
 * pages want: a layout that needs no per-device tuning is written once and
 * lands on all six prefixes.
 */
var ALL_VIEW = 'all';
var ALL_VIEW_LABEL_KEY = 'view.all';

/** Every view key the dropdown can offer, in the order it offers them. */
var VIEW_KEYS = [ALL_VIEW].concat(BREAKPOINTS.map(function(tier) { return tier.key; }));

/** What the three layout mode indexes of 2.x meant. */
var LEGACY_VIEW_INDEXES = ['lg', 'sm', 'xs'];

var MAX_COL_SIZE = 12;
var MAX_COL_OFFSET = 11;

function breakpoint(key) {
    for (var i = 0; i < BREAKPOINTS.length; i++) {
        if (BREAKPOINTS[i].key === key) { return BREAKPOINTS[i]; }
    }
    return null;
}

/** The tiers a view writes to: one, or all six in the all view. */
function tiersFor(view) {
    if (view === ALL_VIEW) { return BREAKPOINTS.slice(); }

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
        handles: 'e', // Which edges carry a handle, as jQuery UI names them
        balance: 'next', // 'next' takes the units out of the following column
    },
};

var warned = {};

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
            'container_tools'   : [], // Host tools on container drawers
            'tab_tools'         : [], // Host tools on tab drawers
            'accordion_tools'   : [], // Host tools on accordion item drawers
            'plugins'           : null, // Container plugins to use; null means every one loaded
            'elements'          : NESTED_SETTINGS.elements, // Element level controls, below the column
            'custom_filter'     : '',
            'content_types'     : ['tinymce'],
            'valid_col_sizes'   : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            'valid_col_offsets' : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'add_column'        : NESTED_SETTINGS.add_column, // The add column tool
            'layout_modes'      : VIEW_KEYS.slice(), // Which views the dropdown offers
            'default_view'      : ALL_VIEW,
            'resize'            : NESTED_SETTINGS.resize, // Resizing a column by dragging its edge
            'resizable_options' : {}, // Merged into every jQuery UI resizable
            'source_textarea'   : '',
            'locale'            : 'en', // Code of a locale in $.fn.gridEditor.locales
            'locale_strings'    : {}, // Overrides for individual keys
            'callbacks'         : {}, // before_*/after_* functions, the events by another route
            'confirm_delete'    : true, // Ask before deleting a row or a column
            'sortable_options'  : {} // Merged into every jQuery UI sortable
        }, optionsOrMethod);

        // Merged rather than replaced, so `elements: { auto: true }` keeps the
        // default selector instead of losing it
        $.each(NESTED_SETTINGS, function(name, defaults) {
            settings[name] = $.extend({}, defaults, settings[name]);
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
         * Resize a column through the events, writing the tiers the current
         * view covers: one in a per-breakpoint view, all six in the all view.
         *
         * The budget is checked per tier and the whole change is refused if
         * any tier has no room, so a resize never half lands.
         */
        /**
         * What resizing this column to `size` would write, or null when the
         * budget refuses it or there is nothing to change.
         *
         * Refused rather than quietly clamped: the offset is something the
         * user set, and a tool that rewrites it is a tool that lies. The plan
         * covers every tier the view writes, so a resize never half lands.
         */
        function planSize(col, size) {
            var tiers = tiersFor(curView);
            var wanted = tiers.map(function(tier) {
                return clamp({ size: size, offset: getEffectiveOffset(col, tier) || 0 });
            });

            if (wanted.some(function(request) { return request.refused; })) { return null; }

            var unchanged = tiers.every(function(tier, i) {
                return getSize(col, tier) === wanted[i].size;
            });
            if (unchanged) { return null; }

            return { tiers: tiers, sizes: wanted, size: wanted[0].size };
        }

        function writeSize(col, plan) {
            plan.tiers.forEach(function(tier, i) { setSize(col, tier, plan.sizes[i].size); });
            stripPixelWidths(col);
        }

        /** Resize a column from a tool, announcing it either side. */
        function resizeColumn(col, size, source) {
            var from = currentSize(col);
            var plan = planSize(col, size);

            if (!plan) { return false; }

            return operate(function() {
                var payload = payloadFor('column', col, { source: source, from: from, to: plan.size });

                if (!emit('before-resize', payload)) { return false; }

                writeSize(col, plan);
                emit('after-resize', payload);

                return true;
            });
        }

        /**
         * Indent a column, shrinking it when the budget needs it: the offset
         * is what the user asked for, so it is the one that gets its way.
         */
        function indentColumn(col, offset, source) {
            var tiers = tiersFor(curView);
            var from = currentOffset(col);

            offset = Math.min(Math.max(offset, 0), MAX_COL_OFFSET);

            var unchanged = tiers.every(function(tier) {
                return (getOffset(col, tier) || 0) === offset;
            });
            if (unchanged) { return false; }

            return operate(function() {
                var payload = payloadFor('column', col, {
                    source: source,
                    from: from,
                    to: offset,
                });

                if (!emit('before-indent', payload)) { return false; }

                tiers.forEach(function(tier) {
                    var was = getEffectiveSize(col, tier);
                    var wanted = clamp({ size: was, offset: offset, leading: 'offset' });

                    setOffset(col, tier, wanted.offset);

                    // Only where the budget actually forced the column to give
                    // way; otherwise an indent would write size classes for
                    // tiers nobody asked it to touch
                    if (wanted.size !== null && wanted.size !== was) {
                        setSize(col, tier, wanted.size);
                    }
                });

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
                markElements();
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
                var btn = $('<a class="btn btn-sm btn-primary" />')
                    .attr('title', t('row.add', { layout: layout.join('-') }))
                    // What this button makes, in the markup rather than in
                    // jQuery data: a drag works on a clone of it
                    .attr('data-ge-toolbar', 'row')
                    .attr('data-ge-layout', layout.join(','))
                    .on('click', function() {
                        var row = createRow();
                        layout.forEach(function(i) {
                            createColumn(i).appendTo(row);
                        });

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

                var layoutName = layout.join(' - ');
                var icon = '<div class="row ge-row-icon">';
                layout.forEach(function(i) {
                    icon += '<div class="column col-' + i + '"/>';
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
            if (!toolbarDrags()) { return; }

            mainControls.find('[data-ge-toolbar]').draggable({
                helper: function() { return $(this).clone().addClass('ge-toolbar-helper'); },
                appendTo: 'body',
                zIndex: 1000,
                cursorAt: { top: 14, left: 14 },

                start: function() { canvas.addClass('ge-dropping'); },
                drag: function(e) { showDropMarker(e.pageX, e.pageY); },

                stop: function(e) {
                    var where = dropPlaceAt(e.pageX, e.pageY);

                    canvas.removeClass('ge-dropping');
                    hideDropMarker();

                    if (where) { insertFromToolbar($(this), where); }
                },
            });
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

            var region = $(under).closest('.column, .ge-canvas');
            if (!region.length || (region[0] !== canvas[0] && !canvas[0].contains(region[0]))) {
                return null;
            }

            var before = null;

            region.children('.row, .ge-content, [data-ge-container]').each(function() {
                if (before) { return; }

                var box = this.getBoundingClientRect();
                if (y < box.top + box.height / 2) { before = $(this); }
            });

            return { region: region, before: before };
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

        function rowFromLayout(layout) {
            var row = createRow();

            (layout || '').split(',').forEach(function(size) {
                if (size !== '') { createColumn(parseInt(size, 10)).appendTo(row); }
            });

            return row;
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
            containerPlugins('onInit');
            markElements();
            makeSortable();
            makeResizable();
            switchLayout(curView);
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
            containerPlugins('onDeinit');
            unmarkContainers();
            unmarkElements();
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

        /* --------------------------------------------------------------
         * Element level controls.
         *
         * An element is a node inside a content area that the editor treats
         * as one movable, deletable thing instead of as rich text. Which
         * nodes those are is the host's decision: it marks them, or it turns
         * elements.auto on and every child of a content area counts.
         * -------------------------------------------------------------- */

        function elementsEnabled() {
            if (settings.elements.enabled !== 'auto') { return !!settings.elements.enabled; }

            return settings.elements.auto || canvas.find(settings.elements.selector).length > 0;
        }

        /** The elements of one content area: its marked children, or all of them. */
        function elementsIn(contentArea) {
            return settings.elements.auto
                ? contentArea.children()
                : contentArea.children(settings.elements.selector);
        }

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
        function markElements() {
            if (!elementsEnabled()) { return; }

            canvas.find('.ge-content').each(function() {
                elementsIn($(this)).each(function() {
                    var element = $(this).addClass('ge-element').attr('contenteditable', 'false');

                    if (element.find('> .ge-tools-drawer').length) { return; }

                    createElementControls(element);
                });
            });
        }

        function unmarkElements() {
            canvas.find('.ge-element').each(function() {
                var element = $(this).removeClass('ge-element').removeAttr('contenteditable');

                // A host element that had no class of its own should not come
                // back from getHtml carrying an empty one
                if (!element.attr('class')) { element.removeAttr('class'); }
            });
        }

        function createElementControls(element) {
            // data-mce-bogus="all" is how tinyMCE is told that a node is the
            // editor's furniture rather than content: it leaves the subtree
            // alone and keeps it out of what it serializes. Without it the
            // drawer's tools are inline elements with no text, which is
            // exactly what its cleanup removes, so an element inside an open
            // editor would lose its move and delete tools.
            var drawer = $('<div class="ge-tools-drawer ge-element-drawer" />')
                .attr('data-mce-bogus', 'all')
                .prependTo(element)
            ;

            createMoveTool(drawer);
            createTool(drawer, t('tool.element_info', { name: elementName(element) }),
                'ge-element-info', 'bi bi-info-circle');

            settings.element_tools.forEach(function(hostTool) {
                createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });

            createTool(drawer, t('tool.delete_element'), 'ge-delete-element', 'bi bi-trash', function() {
                deleteNode('element', element, t('confirm.delete_element'), function(removed) {
                    element.animate({ opacity: 'hide', height: 'hide' }, 300, removed);
                });
            });
        }

        /**
         * What the info tool calls this element: its label, its type, or both.
         * An element found by elements.auto has neither, so it is named after
         * its tag, which is the only thing it has said about itself.
         */
        function elementName(element) {
            var type = element.attr('data-ge-element');
            var label = element.attr('data-ge-label');

            if (label && type) { return label + ' (' + type + ')'; }

            return label || type || element[0].tagName.toLowerCase();
        }

        /**
         * The container plugins this editor is using: the ones registered by
         * the files the page loaded, narrowed by the plugins setting.
         *
         * Each is a factory, called once here with the handle it works
         * through. Everything a plugin needs from the editor goes through
         * that handle, because the closure it runs outside of is not
         * something it can see.
         */
        function loadContainerPlugins() {
            var api = containerApi();

            $.each($.fn.gridEditor.containers, function(type, factory) {
                if (settings.plugins && settings.plugins.indexOf(type) === -1) { return; }

                CONTAINERS[type] = factory(api);
            });

            (settings.plugins || []).forEach(function(type) {
                if (CONTAINERS[type]) { return; }

                warnOnceHere('plugin:' + type, 'the "' + type + '" container plugin is not ' +
                    'loaded: include dist/plugins/grideditor.' + type + '.js after the editor');
            });
        }

        /** What a container plugin is handed. See docs/plugins.md. */
        function containerApi() {
            return {
                canvas: canvas,
                settings: settings,
                t: t,
                warn: warn,
                containerId: containerId,
                defaultRegion: defaultRegion,
                createTool: createTool,
                createPaneControls: createPaneControls,
                makeLabelEditable: makeLabelEditable,
                labelIn: labelIn,
                unwrapLabels: unwrapLabels,
                suspendToggles: suspendToggles,
                resumeToggles: resumeToggles,
                emit: emit,
                payloadFor: payloadFor,
                operate: operate,
            };
        }

        /** Run a hook every loaded plugin may have, in registration order. */
        function containerPlugins(hook) {
            $.each(CONTAINERS, function(type, definition) {
                if (definition[hook]) { definition[hook](); }
            });
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

        var CONTAINERS = {}; // The plugins in use, by the type each one builds
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
        }

        /**
         * A pane drawer: small, inline, and made the same way for every
         * container type so a tab and an accordion item behave alike.
         */
        function createPaneControls(pane, kind, hostTools, confirmText, remove) {
            var drawer = $('<div class="ge-tools-drawer ge-pane-drawer" />').prependTo(pane);

            createMoveTool(drawer);

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

            // The drawer it hangs off is raised while it is open: every
            // drawer sits above jQuery UI's handles, so without this the
            // drawer of the column below takes the clicks meant for the picker
            tool.closest('.ge-tools-drawer').addClass('ge-picker-open');

            sizePicker = $('<div class="ge-size-picker" />').appendTo(tool);

            settings.valid_col_sizes.forEach(function(size) {
                $('<a class="ge-size" />')
                    .attr('data-ge-size', size)
                    .attr('title', t('tool.column_size', { size: size }))
                    .toggleClass('ge-size-tight', size > room)
                    .text(size)
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
                createTool(drawer, t('tool.settings'), 'ge-settings', 'bi bi-gear-fill', function() {
                    details.toggle();
                });
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

                    addColumnTo(row, settings.add_column.size);
                });

                attachSizePicker(drawer.find('> .ge-add-column'), row);

                var details = createDetails(row, settings.row_classes).appendTo(drawer);
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
                        : stepThrough(settings.valid_col_sizes, currentSize(col), -1),
                        'tool');
                });

                createTool(drawer, t('tool.column_wider'), 'ge-increase-col-width', 'bi bi-plus-lg', function(e) {
                    resizeColumn(col, e.shiftKey ? widestFor(col) : stepThrough(settings.valid_col_sizes, currentSize(col), 1), 'tool');
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

                createTool(drawer, t('tool.settings'), 'ge-settings', 'bi bi-gear-fill', function() {
                    details.toggle();
                });
                
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

                var details = createDetails(col, settings.col_classes).appendTo(drawer);
            });
        }

        /**
         * The tier the tools read when they need one number.
         *
         * In a per-breakpoint view that is the tier being edited. In the all
         * view it is the widest tier, because the canvas is not constrained
         * there and the widest tier is what the user is looking at: clicking
         * "narrower" on a column authored as col-lg-6 should take it to 5,
         * not to 11 because no xs class was ever written.
         */
        function leadingTier() {
            return curView === ALL_VIEW ? BREAKPOINTS[BREAKPOINTS.length - 1] : breakpoint(curView);
        }

        function currentSize(col) {
            var size = getEffectiveSize(col, leadingTier());
            return size === null ? MAX_COL_SIZE : size;
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
            return values.reduce(function(a, b) { return Math.min(a, b); }, MAX_COL_SIZE);
        }

        function largest(values) {
            return values.reduce(function(a, b) { return Math.max(a, b); }, 0);
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
            var room = spare(col.parent(), leadingTier(), col) - currentSize(col);

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
                    })
                    .appendTo(classGroup)
                ;
            });

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
            canvas.find('.column, div[class*="col-"]').each(function() {
                var col = $(this).addClass('column');

                if (sizedTiers(col).length) { return; }

                setSize(col, BREAKPOINTS[0], MAX_COL_SIZE);
            });
        }

        /* --------------------------------------------------------------
         * The sizing core.
         *
         * Everything that reads or writes a size or an offset class goes
         * through here: the width and indent tools, drag resize,
         * createColumn and the getHtml cleanup. One place owns the class
         * names, the 12 unit budget and what an absent class means.
         * -------------------------------------------------------------- */

        /** The units a column is given at one tier, or null if that tier says nothing. */
        function getSize(col, tier) {
            return readUnits(col, tier.colPrefix);
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

        function setSize(col, tier, units) {
            writeUnits(col, tier.colPrefix, units);
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

                used += (getEffectiveSize(sibling, tier) || 0) + (getEffectiveOffset(sibling, tier) || 0);
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

            if (size === null) { return { size: null, offset: offset, refused: false }; }

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
         * Drag resize leaves an inline pixel width behind, and jQuery UI adds
         * its own. Neither belongs in the markup a host saves, or in the
         * canvas once the size class has been written.
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

        function makeSortable() {
            var wholeDrawer = settings.drag_handle === 'drawer';

            var shared = {
                handle: wholeDrawer ? '> .ge-tools-drawer' : '> .ge-tools-drawer .ge-move',

                // With the whole drawer as the handle, the tools inside it are
                // still tools: a drag starting on one would swallow its click,
                // and the settings panel has fields to type in
                cancel: wholeDrawer
                    ? '.ge-tools-drawer > a, .ge-details, input, textarea, button, select, option'
                    : 'input, textarea, button, select, option',

                start: sortStart,
                stop: sortStop,
                helper: 'clone',
            };

            canvas.find('.row').sortable($.extend({
                items: '> .column',
                connectWith: '.ge-canvas .row',
                tolerance: 'pointer',
            }, shared, settings.sortable_options));

            canvas.add(canvas.find('.column')).sortable($.extend({
                items: '> .row, > .ge-content',
                connectWith: '.ge-canvas, .ge-canvas .column',
            }, shared, settings.sortable_options));

            // A tab strip sorts its own tabs, and the panes follow them
            canvas.find('.ge-container-tabs > .nav-tabs').sortable($.extend({
                items: '> .ge-tab',
            }, shared, settings.sortable_options));

            // Accordion items sort within their accordion and into any other
            canvas.find('.ge-container-accordion > .accordion').sortable($.extend({
                items: '> .ge-accordion-item',
                connectWith: '.ge-canvas .ge-container-accordion > .accordion',
            }, shared, settings.sortable_options));

            // Elements move within a content area and between them, with
            // their own drawer as the handle
            if (elementsEnabled()) {
                canvas.find('.ge-content').sortable($.extend({
                    items: '> .ge-element',
                    connectWith: '.ge-canvas .ge-content',
                }, shared, settings.sortable_options));
            }

            /**
             * jQuery UI cannot refuse a drag once it has started, so a
             * canceled before-move is remembered here and undone on drop
             * (spec 2.4). The node carries the mark, because with connected
             * lists the drop is not always reported by the list that started
             * the drag.
             */
            function sortStart(e, ui) {
                ui.placeholder.css({ height: ui.item.outerHeight()});

                var node = ui.item;
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

            function sortStop(e, ui) {
                var node = ui.item;
                var from = node.data('ge-move-from') || positionOf(node);

                node.removeData('ge-move-from');

                if (node.data('ge-move-canceled')) {
                    node.removeData('ge-move-canceled');
                    $(this).sortable('cancel');
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
                // with it, and jQuery UI is still finishing the drag, so this
                // is the wrong moment to rebuild the widgets it is using.
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
                if (col.data('ui-resizable')) { return; }

                $('<span class="ge-resize-size" />').appendTo(col.find('> .ge-tools-drawer'));

                col.resizable($.extend({
                    handles: settings.resize.handles,
                    start: resizeStart,
                    resize: resizeMove,
                    stop: resizeStop,
                }, settings.resizable_options));
            });
        }

        function removeResizable() {
            canvas.find('.column').each(function() {
                var col = $(this);
                if (col.data('ui-resizable')) { col.resizable('destroy'); }
            });

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
            var row = col.parent();
            var style = window.getComputedStyle(row[0]);
            var content = row[0].clientWidth -
                parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

            var units = Math.round(pixels / content * MAX_COL_SIZE);
            var next = balanceSibling(col);

            // With a sibling to balance against, the drag may take that
            // column's units but not its last one. Without one, the row is
            // allowed to wrap - that is what balance false means - so the only
            // limit is the column's own budget against its indent.
            var room = next
                ? currentSize(col) + currentSize(next) - smallest(settings.valid_col_sizes)
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
         * A canceled before-resize refuses the drag.
         *
         * jQuery UI's resizable ignores false from its start handler - unlike
         * draggable, and unlike what the spec assumed - so the refusal is
         * carried on the column and every step of the drag returns false,
         * which the widget does honour. Nothing is written and the column ends
         * where it began.
         */
        function resizeStart(e, ui) {
            var col = $(this);
            var from = currentSize(col);

            var allowed = operate(function() {
                return emit('before-resize', payloadFor('column', col, {
                    source: 'dragdrop',
                    from: from,
                    to: null, // Not known until the pointer stops
                }));
            });

            if (!allowed) {
                col.data('ge-resize-refused', true);
                return false;
            }

            col.data('ge-resize-from', from);
            resizeReadout(col, sizeLabel(from));

            return undefined;
        }

        function resizeMove(e, ui) {
            var col = $(this);

            if (col.data('ge-resize-refused')) { return false; }

            resizeReadout(col, sizeLabel(snapUnits(col, ui.size.width)));

            return undefined;
        }

        function resizeStop(e, ui) {
            var col = $(this);
            var from = col.data('ge-resize-from');
            var units = snapUnits(col, ui.size.width);

            col.removeData('ge-resize-from');
            resizeReadout(col, '');
            stripPixelWidths(col);

            if (col.data('ge-resize-refused') || from === undefined) {
                col.removeData('ge-resize-refused');
                return;
            }

            // A drag of a couple of pixels lands on the size it started from,
            // and is not a resize
            if (units === from) { return; }

            var plan = planSize(col, units);
            if (!plan) { return; }

            operate(function() {
                writeSize(col, plan);
                balanceAfterResize(col, plan.size - from);

                emit('after-resize', payloadFor('column', col, {
                    source: 'dragdrop',
                    from: from,
                    to: plan.size,
                }));
            });
        }

        /**
         * Move the delta into the following column, so a full row stays full.
         * It is part of the same gesture, so it is not announced separately.
         */
        function balanceAfterResize(col, delta) {
            var next = balanceSibling(col);
            if (!next || !delta) { return; }

            var plan = planSize(next, currentSize(next) - delta);
            if (plan) { writeSize(next, plan); }
        }

        function removeSortable() {
            // Only where a sortable was actually made: deinit() is a public
            // method now, and jQuery UI throws when asked to destroy a widget
            // that is not there, so calling deinit() twice would fail.
            canvas.add(canvas.find('.column')).add(canvas.find('.row'))
                .add(canvas.find('.ge-content')).add(canvas.find('.nav-tabs'))
                .add(canvas.find('.accordion')).each(function() {
                var node = $(this);
                if (node.data('ui-sortable')) {
                    node.sortable('destroy');
                }
            });
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
                }, { parent: parent, source: 'api' });
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

            if (layout !== undefined && !Array.isArray(layout)) {
                warn('createRow: the layout is an array of column sizes, as in [8, 4]. ' +
                    'Making an empty row instead.');
                layout = [];
            }

            (layout || []).forEach(function(size) {
                createColumn(size).appendTo(row);
            });

            return place(row, 'row', options);
        }

        /**
         * A column of `size` units, optionally holding `options.content`.
         */
        function apiCreateColumn(size, options) {
            options = options || {};

            if (typeof size != 'number') {
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
        function apiCreateElement(content, options) {
            options = options || {};

            var element = $('<div class="ge-element" />')
                .attr('data-ge-element', options.type || 'element')
                .append(content)
            ;
            if (options.label !== undefined) {
                element.attr('data-ge-label', options.label);
            }

            return place(element, 'element', options);
        }

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
         * A column sized for the current view: one tier, or every tier in the
         * all view. `offset` indents it, within the same 12 unit budget.
         */
        function createColumn(size, offset) {
            var rte = getRTE(settings.content_types[0]);
            var column = $('<div class="column"/>')
                .append(createDefaultContentWrapper().html(rte ? rte.initialContent : ''))
            ;

            tiersFor(curView).forEach(function(tier) {
                var wanted = clamp({ size: size, offset: offset || 0, leading: 'offset' });

                setSize(column, tier, wanted.size === null ? size : wanted.size);
                setOffset(column, tier, wanted.offset);
            });

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
                    // boundary either. jQuery UI's resize handle used to be
                    // treated as content and wrapped into a content area of
                    // its own on the next init.
                    if (child.is('.ge-tools-drawer, .ui-resizable-handle')) { return; }

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

        function createDefaultContentWrapper() {
            return $('<div/>')
                .addClass('ge-content ge-content-type-' + settings.content_types[0])
                .attr('data-ge-content-type', settings.content_types[0])
            ;
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

            switchLayout(key);
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
            createElement: apiCreateElement,
            createContainer: apiCreateContainer,
            addTab: function(container, options) { return addPaneTo(container, 'tabs', options); },
            addAccordionItem: function(container, options) {
                return addPaneTo(container, 'accordion', options);
            },
            setLocale: setLocale,
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

        loadContainerPlugins();
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
        'tool.delete_row': 'Remove row',
        'tool.delete_column': 'Remove col',
        'tool.delete_element': 'Remove element',
        'tool.delete_container': 'Remove container',
        'tool.delete_pane': 'Remove pane',
        'tool.rename': 'Double click to rename',
        'tool.element_info': 'Element: {name}',
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
        'confirm.title': 'Confirm',
        'confirm.ok': 'Delete',
        'confirm.cancel': 'Cancel',
        'confirm.delete_row': 'Delete row?',
        'confirm.delete_column': 'Delete column?',
        'confirm.delete_element': 'Delete element?',
        'confirm.delete_container': 'Delete this container and everything in it?',
        'view.all': 'All sizes',
        'view.xs': 'Phone',
        'view.sm': 'Tablet',
        'view.md': 'Small desktop',
        'view.lg': 'Desktop',
        'view.xl': 'Large desktop',
        'view.xxl': 'Widescreen',
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
