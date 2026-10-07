/**
 * The jQuery API of grid-editor 6, on top of the plain DOM editor.
 *
 * A page written for 6.x - one that calls $(el).gridEditor(...), listens
 * with $(el).on('grideditor:...') and reads jQuery objects out of the
 * payloads - loads jQuery 4 and this file after grideditor.js, and runs
 * unchanged:
 *
 *   <script src="jquery.min.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/grideditor.jquery.min.js"></script>
 *   <script src="dist/plugins/grideditor.tabs.min.js"></script>
 *
 * What it keeps is the host's side of 6.x. Plugins are not: they register
 * on GridEditor, and the plugin contract hands out elements.
 *
 * Every value 6.x gave host code as a jQuery object is one again: the event
 * payloads and the callbacks' arguments, what the create* methods return,
 * the handle $(el).data('grideditor') gives, the canvas custom_filter gets,
 * and the event a host tool's handler gets. What the host hands in may be a
 * jQuery object wherever 6.x took one.
 */
import { GridEditor } from './grideditor.js';

var $ = window.jQuery;

var english = function(key, params) { return GridEditor.t({ locale: 'en' }, key, params); };

var warned = {};

function warnOnce(key, message) {
    if (warned[key]) { return; }
    warned[key] = true;
    if (window.console && window.console.warn) { window.console.warn('grid-editor: ' + message); }
}

if (!$ || !$.fn) {
    warnOnce('no-jquery', english('warning.adapter_no_jquery'));
} else {
    install();
}

function install() {

    /**
     * Every method 6.x dispatched, and which hand back something other than
     * the jQuery set: those run against the first element only, and do not
     * chain.
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
        getSelected:      { value: true },
        setSelected:      {},
    };

    /** The *_tools settings, whose handlers 6.x bound with jQuery. */
    var TOOL_SETTINGS = ['row_tools', 'col_tools', 'element_tools', 'container_tools',
        'tab_tools', 'accordion_tools', 'text_tools'];

    function isElement(value) {
        return !!value && value.nodeType === 1;
    }

    /** What the host handed in, as the editor takes it: a jQuery object is its first element. */
    function unwrap(value) {
        if (value instanceof $) { return value[0] || null; }
        return value;
    }

    /** An argument, and the options object an argument may be, unwrapped one level down. */
    function unwrapArgument(value) {
        if (value instanceof $) { return unwrap(value); }

        if (value && typeof value === 'object' && !Array.isArray(value) && !isElement(value)) {
            var copy = {};
            Object.keys(value).forEach(function(key) { copy[key] = unwrap(value[key]); });
            return copy;
        }

        return value;
    }

    /** What the editor handed back, as 6.x did: an element is a jQuery object. */
    function wrapResult(value) {
        return isElement(value) ? $(value) : value;
    }

    /**
     * A payload as 6.x built it: its nodes jQuery objects, and an empty set
     * where there is no node - a detached node's parent. The same payload
     * wraps to the same object, so every listener of one notification sees
     * one payload, as they did.
     */
    var wrappedPayloads = new WeakMap();

    function wrapPayload(payload) {
        if (!payload || typeof payload !== 'object') { return payload; }
        if (wrappedPayloads.has(payload)) { return wrappedPayloads.get(payload); }

        var copy = Object.assign({}, payload);

        ['node', 'parent', 'canvas'].forEach(function(key) {
            if (key in payload) { copy[key] = $(payload[key] || []); }
        });
        if (payload.container) { copy.container = $(payload.container); }
        // edit-html writes any number of nodes, which 6.x gave as one set
        if (Array.isArray(payload.nodes)) { copy.node = $(payload.nodes); }
        ['from', 'to'].forEach(function(key) {
            var position = payload[key];
            if (position && typeof position === 'object' && 'parent' in position) {
                copy[key] = Object.assign({}, position, { parent: $(position.parent || []) });
            }
        });

        wrappedPayloads.set(payload, copy);
        return copy;
    }

    /**
     * The events, as jQuery handlers had them: (event, payload).
     *
     * The editor dispatches DOM events, which jQuery hands its handlers with
     * no second argument. Its dispatcher is where every one of them passes,
     * delegated ones too, so that is where the payload goes back in: once,
     * for each handler, and preventDefault() on the jQuery event is
     * preventDefault() on the editor's.
     */
    var dispatch = $.event.dispatch;
    $.event.dispatch = function(nativeEvent) {
        if (arguments.length === 1 && nativeEvent instanceof window.CustomEvent &&
                typeof nativeEvent.type === 'string' && nativeEvent.type.indexOf('grideditor:') === 0) {
            return dispatch.call(this, nativeEvent, wrapPayload(nativeEvent.detail));
        }

        return dispatch.apply(this, arguments);
    };

    /** A handler of a host's tool, given a jQuery event as 6.x gave it. */
    function jqueryHandler(handler) {
        return function(event) {
            return handler.call(this, $.event.fix(event));
        };
    }

    function adaptTool(tool) {
        if (!tool || !tool.on) { return tool; }

        var on;
        if (typeof tool.on === 'function') {
            on = jqueryHandler(tool.on);
        } else {
            on = {};
            Object.keys(tool.on).forEach(function(name) { on[name] = jqueryHandler(tool.on[name]); });
        }

        return Object.assign({}, tool, { on: on });
    }

    /** A custom_filter, as a function of a jQuery canvas; a name is looked up when it runs. */
    function adaptFilter(filter) {
        return function(canvas, isInit) {
            var func = typeof filter === 'string' ? window[filter] : filter;
            return func($(canvas), isInit);
        };
    }

    /** The host's 6.x options, as the editor takes them. */
    function adaptOptions(options) {
        options = Object.assign({}, options || {});

        if (options.callbacks) {
            var callbacks = {};
            Object.keys(options.callbacks).forEach(function(name) {
                var callback = options.callbacks[name];
                callbacks[name] = typeof callback === 'function'
                    ? function(payload) { return callback(wrapPayload(payload)); }
                    : callback;
            });
            options.callbacks = callbacks;
        }

        if (options.custom_filter && options.custom_filter.length) {
            var filters = typeof options.custom_filter === 'string' || typeof options.custom_filter === 'function'
                ? [options.custom_filter]
                : Array.prototype.slice.call(options.custom_filter);
            options.custom_filter = filters.map(adaptFilter);
        }

        TOOL_SETTINGS.forEach(function(name) {
            if (Array.isArray(options[name])) { options[name] = options[name].map(adaptTool); }
        });

        options.source_textarea = unwrap(options.source_textarea);

        return options;
    }

    /**
     * The handle $(el).data('grideditor') gave in 6.x: the same methods, with
     * jQuery going in and coming out, and the canvas as a jQuery object.
     */
    function handleFor(instance) {
        var handle = { canvas: $(instance.canvas) };

        Object.keys(METHODS).forEach(function(name) {
            handle[name] = function() {
                var result = instance[name].apply(instance, Array.prototype.map.call(arguments, unwrapArgument));
                return result === instance ? undefined : wrapResult(result);
            };
        });

        Object.defineProperty(handle, 'settings', {
            enumerable: true,
            get: function() { return instance.settings; },
        });

        return handle;
    }

    /**
     * Every editor gets its 6.x handle, whoever made it: $(el).gridEditor()
     * or new GridEditor(el). It goes with the editor.
     */
    GridEditor._created.push(function(instance) {
        $.data(instance.canvas, 'grideditor', handleFor(instance));

        var destroy = instance.destroy;
        instance.destroy = function() {
            var result = destroy.apply(this, arguments);
            $.removeData(instance.canvas, 'grideditor');
            return result;
        };
    });

    function dispatchMethod(set, name, args) {
        var descriptor = METHODS[name];

        if (!descriptor) {
            warnOnce('method:' + name, 'unknown method "' + name + '"');
            return set;
        }

        args = args.map(unwrapArgument);

        if (descriptor.value) {
            var element = set.first();
            if (!element.length) { return null; }

            var instance = GridEditor.get(element[0]);
            if (!instance) {
                if (name === 'getHtml') { return element.html(); }
                if (name === 'getPlainHtml') { return GridEditor._plainHtml(element.html()); }
                return null;
            }

            return wrapResult(instance[name].apply(instance, args));
        }

        set.each(function() {
            var found = GridEditor.get(this);
            if (found) { found[name].apply(found, args); }
        });

        return set;
    }

    /**
     * $(el).gridEditor(options): an editor on each element that has none.
     * $(el).gridEditor('method', ...): a method, 6.x style.
     */
    $.fn.gridEditor = function(optionsOrMethod) {
        if (typeof optionsOrMethod == 'string') {
            return dispatchMethod(this, optionsOrMethod, Array.prototype.slice.call(arguments, 1));
        }

        var options = adaptOptions(optionsOrMethod);

        this.each(function() {
            GridEditor.create(this, options);
        });

        return this;
    };

    // Strings are the same thing in both: a 6.x locale file loads unchanged
    $.fn.gridEditor.locales = GridEditor.locales;
    $.fn.gridEditor.t = GridEditor.t;
}
