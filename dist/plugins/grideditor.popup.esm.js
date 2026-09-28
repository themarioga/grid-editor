// src/js/plugins/grideditor.popup.js
import { GridEditor } from "../grideditor.esm.js";

// src/js/dom.js
function all(root, selector) {
  return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
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
function split(names) {
  return String(names || "").split(/\s+/).filter(Boolean);
}
function dropEmptyClass(node) {
  if (!node.getAttribute("class")) {
    node.removeAttribute("class");
  }
  return node;
}

// src/js/plugins/grideditor.popup.js
Object.assign(GridEditor.locales.en, {
  "container.add_popup": "Popup",
  "container.popup_title": "Title",
  "container.popup_trigger": "Open",
  "tool.toggle_popup": "Fold this popup away while editing"
});
GridEditor.containers.popup = function(ge) {
  function popupIdOf(container) {
    return container.getAttribute("data-ge-popup-id");
  }
  function popupExists(id) {
    return all(ge.canvas, "[data-ge-popup-id]").some(function(popup) {
      return popupIdOf(popup) === id;
    });
  }
  function wirePopupTriggers() {
    all(ge.canvas, "[data-ge-popup-target]").forEach(function(trigger) {
      addClass(trigger, "ge-popup-trigger");
      var wanted = trigger.getAttribute("data-ge-popup-target");
      trigger.removeAttribute("data-bs-toggle");
      trigger.removeAttribute("data-bs-target");
      if (popupExists(wanted)) {
        removeClass(trigger, "ge-popup-orphan");
        return;
      }
      var column = trigger.closest(".column");
      var nearby = column ? all(column, "[data-ge-popup-id]") : [];
      if (nearby.length === 1) {
        trigger.setAttribute("data-ge-popup-target", popupIdOf(nearby[0]));
        removeClass(trigger, "ge-popup-orphan");
        return;
      }
      addClass(trigger, "ge-popup-orphan");
      ge.operate(function() {
        ge.emit("popup-orphan", ge.payloadFor("popup", trigger, {
          parent: trigger.parentElement,
          source: "api",
          missing: wanted
        }));
      });
    });
  }
  function writePopupTriggerAttributes() {
    all(ge.canvas, "[data-ge-popup-target]").forEach(function(trigger) {
      var wanted = trigger.getAttribute("data-ge-popup-target");
      removeClass(trigger, "ge-popup-orphan");
      dropEmptyClass(trigger);
      if (!popupExists(wanted)) {
        return;
      }
      trigger.setAttribute("data-bs-toggle", "modal");
      trigger.setAttribute("data-bs-target", "#" + wanted);
    });
  }
  return {
    labelKey: "container.add_popup",
    paneKind: "popup",
    // Triggers are markup the host owns, anywhere in the canvas, so they
    // are looked at whenever the canvas is initialized rather than only
    // when a popup is touched
    onInit: wirePopupTriggers,
    onDeinit: writePopupTriggerAttributes,
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
