(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/dom.js
  function all(root, selector) {
    return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
  }
  function one(root, selector) {
    return root ? root.querySelector(selector) : null;
  }
  function closest(node, selector, stopAt) {
    var found = node && node.nodeType === 1 ? node.closest(selector) : null;
    if (found && stopAt && found !== stopAt && !stopAt.contains(found)) {
      return null;
    }
    return found;
  }
  function parse(html) {
    var template = document.createElement("template");
    template.innerHTML = html;
    return Array.prototype.slice.call(template.content.childNodes);
  }
  function create(html) {
    var nodes = parse(html.trim());
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) {
        return nodes[i];
      }
    }
    return null;
  }
  function element(tag, attributes, text) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function(name) {
      var value = attributes[name];
      if (value !== null && value !== void 0 && value !== false) {
        node.setAttribute(name, value);
      }
    });
    if (text !== void 0 && text !== null) {
      node.textContent = text;
    }
    return node;
  }
  function addClass(node, names) {
    split(names).forEach(function(name) {
      node.classList.add(name);
    });
    return node;
  }
  function removeClass(node, names) {
    split(names).forEach(function(name) {
      node.classList.remove(name);
    });
    return node;
  }
  function toggleClass(node, names, state) {
    split(names).forEach(function(name) {
      if (state === void 0) {
        node.classList.toggle(name);
      } else {
        node.classList.toggle(name, !!state);
      }
    });
    return node;
  }
  function hasClass(node, name) {
    return !!node && node.nodeType === 1 && node.classList.contains(name);
  }
  function split(names) {
    return String(names || "").split(/\s+/).filter(Boolean);
  }
  function dropEmptyClass(node) {
    if (!node.getAttribute("class")) {
      node.removeAttribute("class");
    }
    return node;
  }
  function delegate(root, types, selector, handler, options) {
    var listener = function(event) {
      var match = closest(event.target, selector, root);
      if (match && root.contains(match)) {
        return handler.call(match, event);
      }
      return void 0;
    };
    split(types).forEach(function(type) {
      root.addEventListener(type, listener, options);
    });
    return listener;
  }

  // src/js/triggers/triggers.js
  function triggersFor(ge, kind, idAttribute, targetAttribute, toggle) {
    var triggerClass = "ge-" + kind + "-trigger";
    var orphanClass = "ge-" + kind + "-orphan";
    var listening = null;
    var STATE_ATTRIBUTES = ["style", "aria-hidden", "aria-modal", "role"];
    var STATE_CLASSES = ["show", "showing", "hiding"];
    var before = /* @__PURE__ */ new Map();
    var dismisses = [];
    var saved = /* @__PURE__ */ new Map();
    var phases = /* @__PURE__ */ new Map();
    var watching = null;
    var pending = /* @__PURE__ */ new Map();
    var PHASES = { show: "opening", shown: "open", hide: "closing" };
    function idOf(container) {
      return container.getAttribute(idAttribute);
    }
    function targetOf(container) {
      var id = idOf(container);
      return all(container, "[id]").filter(function(node) {
        return node.id === id;
      })[0] || null;
    }
    function targets() {
      return all(ge.canvas, "[" + idAttribute + "]").map(targetOf).filter(Boolean);
    }
    function exists(id, root) {
      return all(root || ge.canvas, "[" + idAttribute + "]").some(function(container) {
        return idOf(container) === id;
      });
    }
    function wire() {
      all(ge.canvas, "[" + targetAttribute + "]").forEach(function(trigger) {
        addClass(trigger, triggerClass);
        var wanted = trigger.getAttribute(targetAttribute);
        trigger.removeAttribute("data-bs-toggle");
        trigger.removeAttribute("data-bs-target");
        if (exists(wanted)) {
          removeClass(trigger, orphanClass);
          return;
        }
        var column = trigger.closest(".column");
        var nearby = column ? all(column, "[" + idAttribute + "]") : [];
        if (nearby.length === 1) {
          trigger.setAttribute(targetAttribute, idOf(nearby[0]));
          removeClass(trigger, orphanClass);
          return;
        }
        addClass(trigger, orphanClass);
        ge.operate(function() {
          ge.emit(kind + "-orphan", ge.payloadFor(kind, trigger, {
            parent: trigger.parentElement,
            source: "api",
            missing: wanted
          }));
        });
      });
    }
    function arm(root) {
      all(root, "[" + targetAttribute + "]").forEach(function(trigger) {
        var wanted = trigger.getAttribute(targetAttribute);
        if (!exists(wanted, root)) {
          return;
        }
        trigger.setAttribute("data-bs-toggle", toggle);
        trigger.setAttribute("data-bs-target", "#" + wanted);
      });
    }
    function disarm() {
      all(ge.canvas, "[" + targetAttribute + "]").forEach(function(trigger) {
        trigger.removeAttribute("data-bs-toggle");
        trigger.removeAttribute("data-bs-target");
      });
    }
    function write(root) {
      root = root || ge.canvas;
      all(root, "[" + targetAttribute + "]").forEach(function(trigger) {
        removeClass(trigger, orphanClass);
        dropEmptyClass(trigger);
      });
      arm(root);
      var quiet = /* @__PURE__ */ new Map();
      before.forEach(function(state, target) {
        quiet.set(target.id, state);
      });
      pending.forEach(function(state, target) {
        quiet.set(target.id, state);
      });
      if (!quiet.size) {
        return;
      }
      all(root, "[id]").forEach(function(node) {
        if (quiet.has(node.id)) {
          putState(node, quiet.get(node.id));
        }
      });
    }
    function stateOf(target) {
      var state = { classes: STATE_CLASSES.filter(function(name) {
        return hasClass(target, name);
      }) };
      STATE_ATTRIBUTES.forEach(function(name) {
        state[name] = target.getAttribute(name);
      });
      return state;
    }
    function putState(target, state) {
      STATE_CLASSES.forEach(function(name) {
        toggleClass(target, name, state.classes.indexOf(name) !== -1);
      });
      STATE_ATTRIBUTES.forEach(function(name) {
        target.getAttribute(name);
        if (state[name] === null) {
          target.removeAttribute(name);
        } else {
          target.setAttribute(name, state[name]);
        }
      });
    }
    function startPreview() {
      dismisses = [];
      targets().forEach(function(target) {
        if (!before.has(target)) {
          before.set(target, stateOf(target));
        }
        all(target, '[data-ge-bs-dismiss="' + toggle + '"]').forEach(function(dismiss) {
          ge.resumeToggles(dismiss);
          dismisses.push(dismiss);
        });
      });
      arm(ge.canvas);
      if (watching) {
        watching.abort();
      }
      watching = new AbortController();
      ["show", "shown", "hide", "hidden"].forEach(function(name) {
        ge.canvas.addEventListener(name + ".bs." + toggle, function(e) {
          if (!before.has(e.target)) {
            return;
          }
          if (name === "hidden") {
            phases.delete(e.target);
          } else {
            phases.set(e.target, PHASES[name]);
          }
        }, { signal: watching.signal });
      });
    }
    function component() {
      var bootstrap = window.bootstrap;
      var name = toggle.charAt(0).toUpperCase() + toggle.slice(1);
      return bootstrap && bootstrap[name] && bootstrap[name].getInstance ? bootstrap[name] : null;
    }
    function closer(target) {
      var Component = component();
      var instance = Component ? Component.getInstance(target) : null;
      if (instance) {
        return function() {
          instance.hide();
        };
      }
      var dismiss = one(target, '[data-bs-dismiss="' + toggle + '"], [data-ge-bs-dismiss="' + toggle + '"]');
      if (!dismiss) {
        return null;
      }
      return function() {
        ge.resumeToggles(dismiss);
        dismiss.click();
        ge.suspendToggles(dismiss);
      };
    }
    function endPreview() {
      if (watching) {
        watching.abort();
      }
      watching = null;
      before.forEach(function(state, target) {
        var phase = phases.get(target);
        var close = phase && phase !== "closing" ? closer(target) : null;
        var restore = function() {
          pending.delete(target);
          putState(target, state);
        };
        if (!phase || phase !== "closing" && !close) {
          restore();
          return;
        }
        pending.set(target, state);
        target.addEventListener("hidden.bs." + toggle, restore, { once: true });
        if (phase === "opening") {
          target.addEventListener("shown.bs." + toggle, close, { once: true });
        } else if (phase === "open") {
          close();
        }
      });
      before = /* @__PURE__ */ new Map();
      phases = /* @__PURE__ */ new Map();
      dismisses.forEach(function(dismiss) {
        ge.suspendToggles(dismiss);
      });
      dismisses = [];
      disarm();
    }
    return {
      write,
      // Triggers are markup the host owns, anywhere in the canvas, so they
      // are looked at whenever the canvas is initialized rather than only
      // when a container is touched
      onInit: function() {
        wire();
        if (listening) {
          listening.abort();
        }
        listening = new AbortController();
        delegate(ge.canvas, "click", "." + triggerClass + ", [" + targetAttribute + "]", function(e) {
          if (hasClass(ge.canvas, "ge-editing")) {
            e.preventDefault();
          }
        }, { signal: listening.signal });
        if (ge.previewing()) {
          var live = new Map(saved);
          saved = /* @__PURE__ */ new Map();
          startPreview();
          live.forEach(function(state, target) {
            if (ge.canvas.contains(target)) {
              putState(target, state);
            }
          });
        }
      },
      onDeinit: function() {
        if (listening) {
          listening.abort();
        }
        listening = null;
        if (ge.previewing()) {
          before.forEach(function(state, target) {
            saved.set(target, stateOf(target));
          });
        }
        write();
      },
      onPreviewChange: function(previewing) {
        if (previewing) {
          startPreview();
        } else {
          endPreview();
        }
      }
    };
  }

  // src/js/plugins/grideditor.popup.js
  Object.assign(GridEditor.locales.en, {
    "container.add_popup": "Popup",
    "container.popup_title": "Title",
    "container.popup_trigger": "Open",
    "tool.toggle_popup": "Fold this popup away while editing"
  });
  GridEditor.containers.popup = function(ge) {
    var triggers = triggersFor(ge, "popup", "data-ge-popup-id", "data-ge-popup-target", "modal");
    return {
      labelKey: "container.add_popup",
      paneKind: "popup",
      // Where rows go: the popup's body
      regionOf: function(container) {
        return one(container, ".modal-body");
      },
      // The ids a copy of a popup has to rename together
      references: ["data-ge-popup-id", "data-ge-popup-target"],
      onInit: triggers.onInit,
      onDeinit: triggers.onDeinit,
      // The preview pressed, the triggers open the real thing; let go, it closes
      onPreviewChange: triggers.onPreviewChange,
      // What onDeinit and unmark do, on a copy of the canvas
      cleanMarkup: function(root) {
        var definition = this;
        triggers.write(root);
        all(root, '[data-ge-container="popup"]').forEach(function(container) {
          definition.unmark(container);
        });
      },
      create: function(options) {
        var id = ge.containerId("popup");
        var container = element("div", { "data-ge-container": "popup", "data-ge-popup-id": id });
        if (options.trigger !== false) {
          container.appendChild(element("button", {
            type: "button",
            "class": "btn btn-primary ge-popup-trigger",
            "data-ge-popup-target": id
          }, options.trigger_label || ge.t("container.popup_trigger")));
        }
        var modal = container.appendChild(element("div", {
          "class": "modal fade",
          tabindex: "-1",
          "aria-hidden": "true",
          id
        }));
        var dialog = modal.appendChild(element("div", { "class": "modal-dialog" }));
        if (options.size) {
          addClass(dialog, "modal-" + options.size);
        }
        var content = dialog.appendChild(element("div", { "class": "modal-content" }));
        var header = content.appendChild(element("div", { "class": "modal-header" }));
        header.appendChild(element("h5", { "class": "modal-title" })).appendChild(element(
          "span",
          { "class": "ge-pane-label" },
          options.title || ge.t("container.popup_title")
        ));
        header.appendChild(create('<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'));
        content.appendChild(element("div", { "class": "modal-body" })).appendChild(ge.defaultRegion());
        return container;
      },
      mark: function(container) {
        all(container, "[data-bs-dismiss]").forEach(function(dismiss) {
          ge.suspendToggles(dismiss);
        });
        all(container, ".modal-title").forEach(function(title) {
          ge.makeLabelEditable(ge.labelIn(title));
        });
      },
      unmark: function(container) {
        ge.resumeToggles(container);
        removeClass(container, "ge-popup-collapsed");
        ge.unwrapLabels(container);
      },
      /** A page of unfolded modals stays workable if they can be folded away. */
      tools: function(drawer, container) {
        ge.createTool(
          drawer,
          ge.t("tool.toggle_popup"),
          "ge-toggle-popup",
          "bi bi-chevron-bar-contract",
          function() {
            toggleClass(container, "ge-popup-collapsed");
          }
        );
      }
    };
  };
})();
