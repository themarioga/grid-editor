// src/js/plugins/grideditor.offcanvas.js
import { GridEditor } from "../grideditor.esm.js";

// src/js/dom.js
function all(root, selector) {
  return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
}
function children(node, selector) {
  if (!node) {
    return [];
  }
  return Array.prototype.filter.call(node.children, function(each) {
    return !selector || each.matches(selector);
  });
}
function child(node, selector) {
  return children(node, selector)[0] || null;
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
  function idOf(container) {
    return container.getAttribute(idAttribute);
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
  function write(root) {
    root = root || ge.canvas;
    all(root, "[" + targetAttribute + "]").forEach(function(trigger) {
      var wanted = trigger.getAttribute(targetAttribute);
      removeClass(trigger, orphanClass);
      dropEmptyClass(trigger);
      if (!exists(wanted, root)) {
        return;
      }
      trigger.setAttribute("data-bs-toggle", toggle);
      trigger.setAttribute("data-bs-target", "#" + wanted);
    });
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
    },
    onDeinit: function() {
      if (listening) {
        listening.abort();
      }
      listening = null;
      write();
    }
  };
}

// src/js/plugins/grideditor.offcanvas.js
Object.assign(GridEditor.locales.en, {
  "container.add_offcanvas": "Offcanvas",
  "container.offcanvas_title": "Title",
  "container.offcanvas_trigger": "Open",
  "tool.toggle_offcanvas": "Fold this offcanvas away while editing",
  "container.offcanvas_section": "Offcanvas",
  "container.offcanvas_placement": "Placement",
  "container.offcanvas_start": "Start",
  "container.offcanvas_end": "End",
  "container.offcanvas_top": "Top",
  "container.offcanvas_bottom": "Bottom",
  "container.offcanvas_backdrop": "Backdrop",
  "container.offcanvas_backdrop_yes": "Yes",
  "container.offcanvas_backdrop_no": "No",
  "container.offcanvas_backdrop_static": "Static",
  "container.offcanvas_scroll": "Allow body scroll",
  "container.offcanvas_keyboard": "Close with Esc",
  "container.offcanvas_responsive": "Responsive",
  "container.offcanvas_responsive_never": "Always offcanvas",
  "container.offcanvas_responsive_from": "Inline from {breakpoint}",
  "container.offcanvas_dark": "Dark theme"
});
var DEFAULTS = {
  placement: "start",
  backdrop: true,
  scroll: false,
  keyboard: true,
  responsive: null,
  dark: false
};
var KEYS = ["placement", "backdrop", "scroll", "keyboard", "responsive", "dark"];
var PLACEMENTS = ["start", "end", "top", "bottom"];
var BACKDROPS = [true, false, "static"];
var LABELS = {
  placement: { labelKey: "container.offcanvas_placement" },
  backdrop: { labelKey: "container.offcanvas_backdrop" },
  responsive: { labelKey: "container.offcanvas_responsive" },
  scroll: { labelKey: "container.offcanvas_scroll" },
  keyboard: { labelKey: "container.offcanvas_keyboard" },
  dark: { labelKey: "container.offcanvas_dark" }
};
var PLACEMENT_CHOICES = [
  { value: "start", labelKey: "container.offcanvas_start" },
  { value: "end", labelKey: "container.offcanvas_end" },
  { value: "top", labelKey: "container.offcanvas_top" },
  { value: "bottom", labelKey: "container.offcanvas_bottom" }
];
var BACKDROP_CHOICES = [
  { value: "true", labelKey: "container.offcanvas_backdrop_yes" },
  { value: "false", labelKey: "container.offcanvas_backdrop_no" },
  { value: "static", labelKey: "container.offcanvas_backdrop_static" }
];
var fieldCounter = 0;
GridEditor.containers.offcanvas = function(ge) {
  var RESPONSIVE = ge.breakpoints.filter(function(key) {
    return key !== "xs";
  });
  var sections = [];
  var triggers = triggersFor(ge, "offcanvas", "data-ge-offcanvas-id", "data-ge-offcanvas-target", "offcanvas");
  var CHECKS = {
    placement: function(value) {
      return PLACEMENTS.indexOf(value) !== -1;
    },
    backdrop: function(value) {
      return BACKDROPS.indexOf(value) !== -1;
    },
    responsive: function(value) {
      return value === null || RESPONSIVE.indexOf(value) !== -1;
    }
  };
  function isValid(key, value) {
    return CHECKS[key] ? CHECKS[key](value) : typeof value === "boolean";
  }
  function takes(key) {
    if (key === "placement") {
      return JSON.stringify(PLACEMENTS);
    }
    if (key === "backdrop") {
      return JSON.stringify(BACKDROPS);
    }
    if (key === "responsive") {
      return JSON.stringify([null].concat(RESPONSIVE));
    }
    return "[true,false]";
  }
  function chosen(options, key) {
    var setting = ge.settings.offcanvas || {};
    var value = options[key] !== void 0 ? options[key] : setting[key];
    if (value === void 0) {
      return DEFAULTS[key];
    }
    if (isValid(key, value)) {
      return value;
    }
    ge.warn("offcanvas: " + JSON.stringify(value) + " is not a " + key + ", which takes " + takes(key) + ": " + JSON.stringify(DEFAULTS[key]) + " is used");
    return DEFAULTS[key];
  }
  function isPanelClass(name) {
    return name === "offcanvas" || /^offcanvas-/.test(name) && RESPONSIVE.indexOf(name.slice(10)) !== -1;
  }
  function isPanel(node) {
    return Array.prototype.some.call(node.classList, isPanelClass);
  }
  function panelOf(container) {
    var id = container.getAttribute("data-ge-offcanvas-id");
    var own = children(container);
    return own.filter(function(node) {
      return id && node.id === id;
    })[0] || own.filter(isPanel)[0] || null;
  }
  function triggerOf(container) {
    return child(container, "[data-ge-offcanvas-target]");
  }
  function dropTriggerMarks(root) {
    all(root, ".ge-offcanvas-trigger").forEach(function(trigger) {
      removeClass(trigger, "ge-offcanvas-trigger");
      dropEmptyClass(trigger);
    });
  }
  function hideClass(responsive) {
    return "d-" + responsive + "-none";
  }
  function read(container) {
    var panel = panelOf(container);
    var backdrop = panel.getAttribute("data-bs-backdrop");
    var responsive = null;
    Array.prototype.forEach.call(panel.classList, function(name) {
      if (name !== "offcanvas" && isPanelClass(name)) {
        responsive = name.slice(10);
      }
    });
    return {
      placement: PLACEMENTS.filter(function(place) {
        return hasClass(panel, "offcanvas-" + place);
      })[0] || "start",
      backdrop: backdrop === "false" ? false : backdrop === "static" ? "static" : true,
      scroll: panel.getAttribute("data-bs-scroll") === "true",
      keyboard: panel.getAttribute("data-bs-keyboard") !== "false",
      responsive,
      dark: panel.getAttribute("data-bs-theme") === "dark"
    };
  }
  function setAttribute(panel, name, value) {
    if (value === null) {
      panel.removeAttribute(name);
    } else {
      panel.setAttribute(name, value);
    }
  }
  function write(container, key, value) {
    var panel = panelOf(container);
    if (key === "placement") {
      PLACEMENTS.forEach(function(place) {
        removeClass(panel, "offcanvas-" + place);
      });
      addClass(panel, "offcanvas-" + value);
    }
    if (key === "backdrop") {
      setAttribute(panel, "data-bs-backdrop", value === true ? null : String(value));
    }
    if (key === "scroll") {
      setAttribute(panel, "data-bs-scroll", value ? "true" : null);
    }
    if (key === "keyboard") {
      setAttribute(panel, "data-bs-keyboard", value ? null : "false");
    }
    if (key === "responsive") {
      var before = read(container).responsive;
      var trigger = triggerOf(container);
      var rest = Array.prototype.filter.call(panel.classList, function(name) {
        return !isPanelClass(name);
      });
      panel.className = [value === null ? "offcanvas" : "offcanvas-" + value].concat(rest).join(" ");
      if (trigger) {
        if (before !== null) {
          removeClass(trigger, hideClass(before));
        }
        if (value !== null) {
          addClass(trigger, hideClass(value));
        }
        dropEmptyClass(trigger);
      }
    }
    if (key === "dark") {
      if (value) {
        panel.setAttribute("data-bs-theme", "dark");
      } else if (panel.getAttribute("data-bs-theme") === "dark") {
        panel.removeAttribute("data-bs-theme");
      }
    }
  }
  function nextId() {
    return "ge-offcanvas-option-" + ++fieldCounter;
  }
  function field(labelKey, control, id) {
    var box = element("div", { "class": "ge-offcanvas-option mb-2" });
    box.appendChild(element("label", { "class": "form-label", "for": id }, ge.t(labelKey)));
    box.appendChild(control);
    return box;
  }
  function checkbox(labelKey, onChange) {
    var id = nextId();
    var box = element("div", { "class": "form-check" });
    var input = box.appendChild(element("input", { "class": "form-check-input", type: "checkbox", id }));
    box.appendChild(element("label", { "class": "form-check-label", "for": id }, ge.t(labelKey)));
    input.addEventListener("change", function() {
      onChange(input.checked);
    });
    return { box, input };
  }
  function select(choices, onChange) {
    var id = nextId();
    var control = element("select", { "class": "form-select form-select-sm", id });
    choices.forEach(function(choice) {
      control.appendChild(element("option", { value: choice.value }, choice.label));
    });
    control.addEventListener("change", function() {
      onChange(control.value);
    });
    return { id, control };
  }
  function createSection(container) {
    var body = element("div", { "class": "ge-offcanvas-options" });
    function change(key, value) {
      write(container, key, value);
      render();
    }
    var translated = function(choice) {
      return { value: choice.value, label: ge.t(choice.labelKey) };
    };
    var selects = {
      placement: select(PLACEMENT_CHOICES.map(translated), function(value) {
        change("placement", value);
      }),
      backdrop: select(BACKDROP_CHOICES.map(translated), function(value) {
        change("backdrop", value === "static" ? "static" : value === "true");
      }),
      responsive: select([{ value: "", label: ge.t("container.offcanvas_responsive_never") }].concat(
        RESPONSIVE.map(function(key) {
          return { value: key, label: ge.t("container.offcanvas_responsive_from", { breakpoint: key }) };
        })
      ), function(value) {
        change("responsive", value === "" ? null : value);
      })
    };
    Object.keys(selects).forEach(function(key) {
      var box = field(LABELS[key].labelKey, selects[key].control, selects[key].id);
      box.setAttribute("data-ge-offcanvas-option", key);
      body.appendChild(box);
    });
    var inputs = {};
    ["scroll", "keyboard", "dark"].forEach(function(key) {
      var each = checkbox(LABELS[key].labelKey, function(on) {
        change(key, on);
      });
      inputs[key] = each.input;
      each.box.setAttribute("data-ge-offcanvas-option", key);
      body.appendChild(each.box);
    });
    function render() {
      var values = read(container);
      selects.placement.control.value = values.placement;
      selects.backdrop.control.value = String(values.backdrop);
      selects.responsive.control.value = values.responsive === null ? "" : values.responsive;
      Object.keys(inputs).forEach(function(key) {
        inputs[key].checked = values[key];
      });
    }
    render();
    sections.push({ node: container, element: body, render });
    return body;
  }
  return {
    labelKey: "container.add_offcanvas",
    paneKind: "offcanvas",
    // The ids a copy of an offcanvas has to rename together
    references: ["data-ge-offcanvas-id", "data-ge-offcanvas-target"],
    onInit: triggers.onInit,
    onDeinit: function() {
      sections = [];
      triggers.onDeinit();
      dropTriggerMarks(ge.canvas);
    },
    // What onDeinit and unmark do, on a copy of the canvas
    cleanMarkup: function(root) {
      var definition = this;
      triggers.write(root);
      dropTriggerMarks(root);
      all(root, '[data-ge-container="offcanvas"]').forEach(function(container) {
        definition.unmark(container);
      });
    },
    create: function(options) {
      options = options || {};
      var id = ge.containerId("offcanvas");
      var container = element("div", { "data-ge-container": "offcanvas", "data-ge-offcanvas-id": id });
      if (options.trigger !== false) {
        container.appendChild(element("button", {
          type: "button",
          "class": "btn btn-primary ge-offcanvas-trigger",
          "data-ge-offcanvas-target": id
        }, options.trigger_label || ge.t("container.offcanvas_trigger")));
      }
      var panel = container.appendChild(element("div", {
        "class": "offcanvas",
        tabindex: "-1",
        id,
        "aria-labelledby": id + "-label"
      }));
      var header = panel.appendChild(element("div", { "class": "offcanvas-header" }));
      header.appendChild(element("h5", { "class": "offcanvas-title", id: id + "-label" })).appendChild(element(
        "span",
        { "class": "ge-pane-label" },
        options.title || ge.t("container.offcanvas_title")
      ));
      header.appendChild(create('<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>'));
      panel.appendChild(element("div", { "class": "offcanvas-body" })).appendChild(ge.defaultRegion());
      KEYS.forEach(function(key) {
        write(container, key, chosen(options, key));
      });
      return container;
    },
    mark: function(container) {
      var header = child(panelOf(container), ".offcanvas-header");
      all(header, "[data-bs-dismiss]").forEach(function(dismiss) {
        ge.suspendToggles(dismiss);
      });
      all(header, ".offcanvas-title").forEach(function(title) {
        ge.makeLabelEditable(ge.labelIn(title));
      });
    },
    unmark: function(container) {
      var header = child(panelOf(container), ".offcanvas-header");
      if (header) {
        ge.resumeToggles(header);
        ge.unwrapLabels(header);
      }
      removeClass(container, "ge-offcanvas-collapsed");
    },
    /** A page of unfolded panels stays workable if they can be folded away. */
    tools: function(drawer, container) {
      ge.createTool(
        drawer,
        ge.t("tool.toggle_offcanvas"),
        "ge-toggle-offcanvas",
        "bi bi-chevron-bar-contract",
        function() {
          toggleClass(container, "ge-offcanvas-collapsed");
        }
      );
    },
    panelSection: function(node, kind) {
      if (kind === "offcanvas" && panelOf(node)) {
        return { labelKey: "container.offcanvas_section", body: createSection(node) };
      }
      return null;
    },
    // After a view change or a change of classes: the sections follow
    onRefresh: function(scope) {
      sections = sections.filter(function(entry) {
        return entry.element.isConnected;
      });
      sections.forEach(function(entry) {
        if (entry.node === scope || scope.contains(entry.node)) {
          entry.render();
        }
      });
    }
  };
};
