(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/grideditor.jquery.js
  var $ = window.jQuery;
  var english = function(key, params) {
    return GridEditor.t({ locale: "en" }, key, params);
  };
  var warned = {};
  function warnOnce(key, message) {
    if (warned[key]) {
      return;
    }
    warned[key] = true;
    if (window.console && window.console.warn) {
      window.console.warn("grid-editor: " + message);
    }
  }
  if (!$ || !$.fn) {
    warnOnce("no-jquery", english("warning.adapter_no_jquery"));
  } else {
    install();
  }
  function install() {
    var METHODS = {
      getHtml: { value: true },
      getPlainHtml: { value: true },
      init: {},
      deinit: {},
      reset: {},
      destroy: {},
      changeView: {},
      getView: { value: true },
      createRow: { value: true },
      createColumn: { value: true },
      createElement: { value: true },
      createText: { value: true },
      createSection: { value: true },
      createContainer: { value: true },
      addTab: { value: true },
      addAccordionItem: { value: true },
      setLocale: {},
      getUtility: { value: true },
      setUtility: { value: true },
      getActiveTarget: { value: true },
      setActiveTarget: {}
    };
    var TOOL_SETTINGS = [
      "row_tools",
      "col_tools",
      "element_tools",
      "container_tools",
      "tab_tools",
      "accordion_tools",
      "text_tools"
    ];
    function isElement(value) {
      return !!value && value.nodeType === 1;
    }
    function unwrap(value) {
      if (value instanceof $) {
        return value[0] || null;
      }
      return value;
    }
    function unwrapArgument(value) {
      if (value instanceof $) {
        return unwrap(value);
      }
      if (value && typeof value === "object" && !Array.isArray(value) && !isElement(value)) {
        var copy = {};
        Object.keys(value).forEach(function(key) {
          copy[key] = unwrap(value[key]);
        });
        return copy;
      }
      return value;
    }
    function wrapResult(value) {
      return isElement(value) ? $(value) : value;
    }
    var wrappedPayloads = /* @__PURE__ */ new WeakMap();
    function wrapPayload(payload) {
      if (!payload || typeof payload !== "object") {
        return payload;
      }
      if (wrappedPayloads.has(payload)) {
        return wrappedPayloads.get(payload);
      }
      var copy = Object.assign({}, payload);
      ["node", "parent", "canvas"].forEach(function(key) {
        if (key in payload) {
          copy[key] = $(payload[key] || []);
        }
      });
      if (payload.container) {
        copy.container = $(payload.container);
      }
      if (Array.isArray(payload.nodes)) {
        copy.node = $(payload.nodes);
      }
      ["from", "to"].forEach(function(key) {
        var position = payload[key];
        if (position && typeof position === "object" && "parent" in position) {
          copy[key] = Object.assign({}, position, { parent: $(position.parent || []) });
        }
      });
      wrappedPayloads.set(payload, copy);
      return copy;
    }
    var dispatch = $.event.dispatch;
    $.event.dispatch = function(nativeEvent) {
      if (arguments.length === 1 && nativeEvent instanceof window.CustomEvent && typeof nativeEvent.type === "string" && nativeEvent.type.indexOf("grideditor:") === 0) {
        return dispatch.call(this, nativeEvent, wrapPayload(nativeEvent.detail));
      }
      return dispatch.apply(this, arguments);
    };
    function jqueryHandler(handler) {
      return function(event) {
        return handler.call(this, $.event.fix(event));
      };
    }
    function adaptTool(tool) {
      if (!tool || !tool.on) {
        return tool;
      }
      var on;
      if (typeof tool.on === "function") {
        on = jqueryHandler(tool.on);
      } else {
        on = {};
        Object.keys(tool.on).forEach(function(name) {
          on[name] = jqueryHandler(tool.on[name]);
        });
      }
      return Object.assign({}, tool, { on });
    }
    function adaptFilter(filter) {
      return function(canvas, isInit) {
        var func = typeof filter === "string" ? window[filter] : filter;
        return func($(canvas), isInit);
      };
    }
    function adaptOptions(options) {
      options = Object.assign({}, options || {});
      if (options.callbacks) {
        var callbacks = {};
        Object.keys(options.callbacks).forEach(function(name) {
          var callback = options.callbacks[name];
          callbacks[name] = typeof callback === "function" ? function(payload) {
            return callback(wrapPayload(payload));
          } : callback;
        });
        options.callbacks = callbacks;
      }
      if (options.custom_filter && options.custom_filter.length) {
        var filters = typeof options.custom_filter === "string" || typeof options.custom_filter === "function" ? [options.custom_filter] : Array.prototype.slice.call(options.custom_filter);
        options.custom_filter = filters.map(adaptFilter);
      }
      TOOL_SETTINGS.forEach(function(name) {
        if (Array.isArray(options[name])) {
          options[name] = options[name].map(adaptTool);
        }
      });
      options.source_textarea = unwrap(options.source_textarea);
      return options;
    }
    function handleFor(instance) {
      var handle = { canvas: $(instance.canvas) };
      Object.keys(METHODS).forEach(function(name) {
        handle[name] = function() {
          var result = instance[name].apply(instance, Array.prototype.map.call(arguments, unwrapArgument));
          return result === instance ? void 0 : wrapResult(result);
        };
      });
      Object.defineProperty(handle, "settings", {
        enumerable: true,
        get: function() {
          return instance.settings;
        }
      });
      return handle;
    }
    GridEditor._created.push(function(instance) {
      $.data(instance.canvas, "grideditor", handleFor(instance));
      var destroy = instance.destroy;
      instance.destroy = function() {
        var result = destroy.apply(this, arguments);
        $.removeData(instance.canvas, "grideditor");
        return result;
      };
    });
    function dispatchMethod(set, name, args) {
      var descriptor = METHODS[name];
      if (!descriptor) {
        warnOnce("method:" + name, 'unknown method "' + name + '"');
        return set;
      }
      args = args.map(unwrapArgument);
      if (descriptor.value) {
        var element = set.first();
        if (!element.length) {
          return null;
        }
        var instance = GridEditor.get(element[0]);
        if (!instance) {
          if (name === "getHtml") {
            return element.html();
          }
          if (name === "getPlainHtml") {
            return GridEditor._plainHtml(element.html());
          }
          return null;
        }
        return wrapResult(instance[name].apply(instance, args));
      }
      set.each(function() {
        var found = GridEditor.get(this);
        if (found) {
          found[name].apply(found, args);
        }
      });
      return set;
    }
    $.fn.gridEditor = function(optionsOrMethod) {
      if (typeof optionsOrMethod == "string") {
        return dispatchMethod(this, optionsOrMethod, Array.prototype.slice.call(arguments, 1));
      }
      var options = adaptOptions(optionsOrMethod);
      this.each(function() {
        GridEditor.create(this, options);
      });
      return this;
    };
    $.fn.gridEditor.locales = GridEditor.locales;
    $.fn.gridEditor.t = GridEditor.t;
  }
})();
