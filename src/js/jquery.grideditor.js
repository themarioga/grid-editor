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
    createContainer:  { value: true, unimplemented: true },
    addTab:           { value: true, unimplemented: true },
    addAccordionItem: { value: true, unimplemented: true },
    setLocale:        { unimplemented: true },
};

/**
 * Where a create* call may put the node it just made. The first one given
 * wins, and giving none leaves the node detached for the host to place.
 */
var PLACEMENTS = ['appendTo', 'prependTo', 'insertAfter', 'insertBefore'];

/**
 * The layout modes, in the order the dropdown lists them, which is also the
 * order 2.x callers passed as a numeric index to switch between them. Every
 * column class the editor writes comes from this table.
 */
var LAYOUT_MODES = [
    { key: 'lg', colClass: 'col-lg-', cssClass: 'ge-layout-desktop', label: 'Desktop' },
    { key: 'sm', colClass: 'col-sm-', cssClass: 'ge-layout-tablet', label: 'Tablet' },
    { key: 'xs', colClass: 'col-', cssClass: 'ge-layout-phone', label: 'Phone' },
];

var warned = {};

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
            'row_classes'       : [{ label: 'Example class', cssClass: 'example-class'}],
            'col_classes'       : [{ label: 'Example class', cssClass: 'example-class'}],
            'col_tools'         : [], /* Example:
                                        [ {
                                            title: 'Set background image',
                                            iconClass: 'glyphicon-picture',
                                            on: { click: function() {} }
                                        } ]
                                    */
            'row_tools'         : [],
            'custom_filter'     : '',
            'content_types'     : ['tinymce'],
            'valid_col_sizes'   : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            'source_textarea'   : ''
        }, optionsOrMethod);


        // Elems
        var canvas,
            mainControls,
            wrapper, // controls wrapper
            addRowGroup,
            layoutDropdown,
            htmlTextArea
        ;
        var colClasses = LAYOUT_MODES.map(function(mode) { return mode.colClass; });
        var curColClassIndex = 0; // Index of the column class we are manipulating currently
        var MAX_COL_SIZE = 12;
        var warnedHere = {}; // Deprecations are worth saying once per instance, not once per call

        function warnOnceHere(key, message) {
            if (warnedHere[key]) { return; }
            warnedHere[key] = true;
            warn(message);
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

        setup();
        init();

        function setup() {
            /* Setup canvas */
            canvas = baseElem.addClass('ge-canvas');
            
            htmlTextArea = $('<textarea class="ge-html-output"/>').insertBefore(canvas);

            /* Create main controls*/
            mainControls = $('<div class="ge-mainControls" />').insertBefore(htmlTextArea);
            wrapper = $('<div class="ge-wrapper ge-top" />').appendTo(mainControls);

            // Add row
            addRowGroup = $('<div class="ge-addRowGroup btn-group" />').appendTo(wrapper);
            $.each(settings.new_row_layouts, function(j, layout) {
                var btn = $('<a class="btn btn-sm btn-primary" />')
                    .attr('title', 'Add row ' + layout.join('-'))
                    .on('click', function() {
                        var row = createRow().appendTo(canvas);
                        layout.forEach(function(i) {
                            createColumn(i).appendTo(row);
                        });
                        init();
                        if (row[0].scrollIntoView) { row[0].scrollIntoView({behavior: 'smooth'}); }
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

            // Buttons on right
            layoutDropdown = $('<div class="dropdown pull-right ge-layout-mode">' +
                '<button type="button" class="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown">Desktop</button>' +
                    '<div class="dropdown-menu" role="menu">' +
                        '<a class="dropdown-item" data-width="auto" title="Desktop">Desktop</a>' +
                        '<a class="dropdown-item" title="Tablet">Tablet' +
                        '<a class="dropdown-item" title="Phone">Phone</a>' +
                    '</div>' +
                '</div>')
                .on('click', 'a', function() {
                    // Through changeView, so the dropdown and the method are
                    // one path rather than two that have to agree
                    changeView(LAYOUT_MODES[$(this).index()].key);
                })
                .appendTo(wrapper)
            ;
            var btnGroup = $('<div class="btn-group pull-right"/>')
                .appendTo(wrapper)
            ;
            var htmlButton = $('<button title="Edit Source Code" type="button" class="btn btn-sm btn-primary gm-edit-mode"><i class="bi bi-code-slash"></i></button>')
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
            var previewButton = $('<button title="Preview" type="button" class="btn btn-sm btn-primary gm-preview"><i class="bi bi-eye-fill"></i></button>')
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

            // Make controls fixed on scroll
            $(window).on('scroll', onScroll);

            /* Init RTE on click */
            canvas.on('click', '.ge-content', initRTE);
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
            addAllColClasses();
            wrapContent();
            createRowControls();
            createColControls();
            makeSortable();
            switchLayout(curColClassIndex);
        }

        function deinit() {
            canvas.removeClass('ge-editing');
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
            canvas.find('.ge-tools-drawer').remove();
            removeSortable();
            runFilter(false);
        }
        
        /**
         * The markup as a host would save it: no drawers, no editor, no
         * sortables. The canvas goes back to editing afterwards.
         */
        function getHtml() {
            deinit();
            var html = canvas.html();
            init();
            return html;
        }

        function destroy() {
            deinit();
            mainControls.remove();
            htmlTextArea.remove();
            $(window).off('scroll', onScroll);
            canvas.off('click', '.ge-content', initRTE);
            canvas.removeData('grideditor');
        }

        function deprecatedRemove() {
            warnOnceHere('remove', 'remove() is deprecated and will be removed in a later ' +
                'release. Use destroy(), which does the same thing.');
            destroy();
        }

        function createRowControls() {
            canvas.find('.row').each(function() {
                var row = $(this);
                if (row.find('> .ge-tools-drawer').length) { return; }

                var drawer = $('<div class="ge-tools-drawer" />').prependTo(row);
                createTool(drawer, 'Move', 'ge-move', 'bi bi-arrows-move');
                createTool(drawer, 'Settings', '', 'bi bi-gear-fill', function() {
                    details.toggle();
                });
                settings.row_tools.forEach(function(t) {
                    createTool(drawer, t.title || '', t.className || '', t.iconClass || 'bi bi-wrench', t.on);
                });
                createTool(drawer, 'Remove row', '', 'bi bi-trash', function() {
                    if (window.confirm('Delete row?')) {
                        row.slideUp(function() {
                            row.remove();
                        });
                    }
                });
                createTool(drawer, 'Add column', 'ge-add-column', 'bi bi-plus-circle', function() {
                    row.append(createColumn(3));
                    init();
                });

                var details = createDetails(row, settings.row_classes).appendTo(drawer);
            });
        }

        function createColControls() {
            canvas.find('.column').each(function() {
                var col = $(this);
                if (col.find('> .ge-tools-drawer').length) { return; }

                var drawer = $('<div class="ge-tools-drawer" />').prependTo(col);

                createTool(drawer, 'Move', 'ge-move', 'bi bi-arrows-move');

                createTool(drawer, 'Make column narrower\n(hold shift for min)', 'ge-decrease-col-width', 'bi bi-dash-lg', function(e) {
                    var colSizes = settings.valid_col_sizes;
                    var curColClass = colClasses[curColClassIndex];
                    var curColSizeIndex = colSizes.indexOf(getColSize(col, curColClass));
                    var newSize = colSizes[clamp(curColSizeIndex - 1, 0, colSizes.length - 1)];
                    if (e.shiftKey) {
                        newSize = colSizes[0];
                    }
                    setColSize(col, curColClass, Math.max(newSize, 1));
                });

                createTool(drawer, 'Make column wider\n(hold shift for max)', 'ge-increase-col-width', 'bi bi-plus-lg', function(e) {
                    var colSizes = settings.valid_col_sizes;
                    var curColClass = colClasses[curColClassIndex];
                    var curColSizeIndex = colSizes.indexOf(getColSize(col, curColClass));
                    var newColSizeIndex = clamp(curColSizeIndex + 1, 0, colSizes.length - 1);
                    var newSize = colSizes[newColSizeIndex];
                    if (e.shiftKey) {
                        newSize = getColSize(col) + getColumnSpare(col.parent());
                    }
                    setColSize(col, curColClass, Math.min(newSize, MAX_COL_SIZE));
                });

                createTool(drawer, 'Settings', '', 'bi bi-gear-fill', function() {
                    details.toggle();
                });
                
                settings.col_tools.forEach(function(t) {
                    createTool(drawer, t.title || '', t.className || '', t.iconClass || 'bi bi-wrench', t.on);
                });

                createTool(drawer, 'Remove col', '', 'bi bi-trash', function() {
                    if (window.confirm('Delete column?')) {
                        col.animate({
                            opacity: 'hide',
                            width: 'hide',
                            height: 'hide'
                        }, 400, function() {
                            col.remove();
                        });
                    }
                });

                createTool(drawer, 'Add row', 'ge-add-row', 'bi bi-plus-circle', function() {
                    var row = createRow();
                    col.append(row);
                    row.append(createColumn(6)).append(createColumn(6));
                    init();
                });

                var details = createDetails(col, settings.col_classes).appendTo(drawer);
            });
        }

        function getColumnSpare(row) {
            return MAX_COL_SIZE - getColumnSizes(row);
        }

        function getColumnSizes(row) {
            var layout = colClasses[curColClassIndex];
            var size = 0;
            row.find('> [class*="' + layout + '"]').each(function(){
                size += getColSize($(this));
            });
            return size;
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

        function createDetails(container, cssClasses) {
            var detailsDiv = $('<div class="ge-details" />');

            $('<input class="ge-id" />')
                .attr('placeholder', 'id')
                .val(container.attr('id'))
                .attr('title', 'Set a unique identifier')
                .appendTo(detailsDiv)
                .change(function() {
                    container.attr('id', this.value);
                })
            ;

            var classGroup = $('<div class="btn-group" />').appendTo(detailsDiv);
            cssClasses.forEach(function(rowClass) {
                var btn = $('<a class="btn btn-sm btn-default" />')
                    .html(rowClass.label)
                    .attr('title', rowClass.title ? rowClass.title : 'Toggle "' + rowClass.label + '" styling')
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

        function addAllColClasses() {
            canvas.find('.column, div[class*="col-"]').each(function() {
                var col = $(this);

                var size = 2;
                var sizes = getColSizes(col);
                if (sizes.length) {
                    size = sizes[0].size;
                }

                var elemClass = col.attr('class');
                colClasses.forEach(function(colClass) {
                    if (elemClass.indexOf(colClass) == -1) {
                        col.addClass(colClass + size);
                    }
                });

                col.addClass('column');
            });
        }

        /**
         * Return the column size for colClass, or a size from a different
         * class if it was not found.
         * Returns null if no size whatsoever was found.
         */
        function getColSize(col, colClass) {
            var sizes = getColSizes(col);
            for (var i = 0; i < sizes.length; i++) {
                if (sizes[i].colClass == colClass) {
                    return sizes[i].size;
                }
            }
            if (sizes.length) {
                return sizes[0].size;
            }
            return null;
        }

        function getColSizes(col) {
            var result = [];
            colClasses.forEach(function(colClass) {
                var re = new RegExp(colClass + '(\\d+)', 'i');
                if (re.test(col.attr('class'))) {
                    result.push({
                        colClass: colClass,
                        size: parseInt(re.exec(col.attr('class'))[1])
                    });
                }
            });
            return result;
        }

        function setColSize(col, colClass, size) {
            var re = new RegExp('(' + colClass + '(\\d+))', 'i');
            var reResult = re.exec(col.attr('class'));
            if (reResult && parseInt(reResult[2]) !== size) {
                col.switchClass(reResult[1], colClass + size, 50);
            } else {
                col.addClass(colClass + size);
            }
        }

        function makeSortable() {
            canvas.find('.row').sortable({
                items: '> .column',
                connectWith: '.ge-canvas .row',
                handle: '> .ge-tools-drawer .ge-move',
                start: sortStart,
                tolerance: 'pointer',
                helper: 'clone',
            });
            canvas.add(canvas.find('.column')).sortable({
                items: '> .row, > .ge-content',
                connectWith: '.ge-canvas, .ge-canvas .column',
                handle: '> .ge-tools-drawer .ge-move',
                start: sortStart,
                helper: 'clone',
            });

            function sortStart(e, ui) {
                ui.placeholder.css({ height: ui.item.outerHeight()});
            }
        }

        function removeSortable() {
            // Only where a sortable was actually made: deinit() is a public
            // method now, and jQuery UI throws when asked to destroy a widget
            // that is not there, so calling deinit() twice would fail.
            canvas.add(canvas.find('.column')).add(canvas.find('.row')).each(function() {
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
         * Put a freshly created node where the caller asked for it, and reset
         * the canvas so the new markup gets its controls. With no placement
         * option the node stays detached, and placing it and calling reset()
         * is the host's job (spec 1.2).
         */
        function place(node, options) {
            var placement = null;

            PLACEMENTS.forEach(function(name) {
                if (placement === null && options && options[name] !== undefined) {
                    placement = name;
                }
            });

            if (placement === null) { return node; }

            node[placement](options[placement]);
            // TODO (3.0): fire before-add and after-add here once the event
            // bus exists, and return null when a before-add handler cancels.
            reset();
            return node;
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

            return place(row, options);
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

            var column = createColumn(size);
            if (options.content !== undefined) {
                column.find('.ge-content').html(options.content);
            }
            // options.offset arrives with the sizing core (spec 5.1), which is
            // the one place allowed to write offset classes.

            return place(column, options);
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

            return place(element, options);
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

        function createColumn(size) {
            var rte = getRTE(settings.content_types[0]);
            return $('<div/>')
                .addClass(colClasses.map(function(c) { return c + size; }).join(' '))
                .append(createDefaultContentWrapper().html(
                    rte ? rte.initialContent : '')
                )
            ;
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
                    if (child.is('.row, .ge-tools-drawer, .ge-content')) {
                        doWrap(contents);
                    } else {
                        contents = contents.add(child);
                    }
                });
                doWrap(contents);
            });
        }
        function doWrap(contents) {
            if (contents.length) {
                var container = createDefaultContentWrapper().insertAfter(contents.last());
                contents.appendTo(container);
                contents = $();
            }
        }

        function createDefaultContentWrapper() {
            return $('<div/>')
                .addClass('ge-content ge-content-type-' + settings.content_types[0])
                .attr('data-ge-content-type', settings.content_types[0])
            ;
        }

        function switchLayout(colClassIndex) {
            curColClassIndex = colClassIndex;

            LAYOUT_MODES.forEach(function(mode, i) {
                canvas.toggleClass(mode.cssClass, i == colClassIndex);
            });
            layoutDropdown.find('button').text(LAYOUT_MODES[colClassIndex].label);
        }

        /**
         * The layout mode index for a breakpoint key, or for the numeric index
         * 2.x callers used. Null for anything this build does not have.
         */
        function layoutModeIndex(view) {
            if (typeof view == 'number') {
                warnOnceHere('changeView-index', 'changeView(' + view + '): layout modes are ' +
                    'identified by breakpoint key now, so pass ' +
                    JSON.stringify(LAYOUT_MODES.map(function(mode) { return mode.key; })) + '. ' +
                    'Numeric indexes still work but will be dropped.');
                return LAYOUT_MODES[view] ? view : null;
            }

            for (var i = 0; i < LAYOUT_MODES.length; i++) {
                if (LAYOUT_MODES[i].key === view) { return i; }
            }

            return null;
        }

        function changeView(view) {
            var index = layoutModeIndex(view);

            if (index === null) {
                warn('changeView(' + JSON.stringify(view) + '): no such layout mode');
                return;
            }

            switchLayout(index);
        }

        function getView() {
            return LAYOUT_MODES[curColClassIndex].key;
        }
        
        function getRTE(type) {
            return $.fn.gridEditor.RTEs[type];
        }
        
        function clamp(input, min, max) {
            return Math.min(max, Math.max(min, input));
        }

        /**
         * The instance handle, documented API as of 3.0: the methods the
         * plugin dispatches, plus the settings and the canvas. A host holding
         * this can call several methods without dispatching each one.
         */
        var handle = {
            getHtml: getHtml,
            init: init,
            deinit: deinit,
            reset: reset,
            destroy: destroy,
            remove: deprecatedRemove,
            changeView: changeView,
            getView: getView,
            createRow: apiCreateRow,
            createColumn: apiCreateColumn,
            createElement: apiCreateElement,
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

    });

    return self;

};

$.fn.gridEditor.RTEs = {};

})( jQuery );