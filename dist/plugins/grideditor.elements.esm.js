// src/js/plugins/grideditor.elements.js
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
function is(node, selector) {
  return !!node && node.nodeType === 1 && node.matches(selector);
}
function parse(html) {
  var template = document.createElement("template");
  template.innerHTML = html;
  return Array.prototype.slice.call(template.content.childNodes);
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
function hide(node) {
  node.style.display = "none";
  return node;
}
function visible(node) {
  return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
}
var DEFAULT_DURATION = 400;
function animateAway(node, frames, duration, done) {
  duration = duration === void 0 ? DEFAULT_DURATION : duration;
  var finish = function() {
    hide(node);
    if (done) {
      done();
    }
  };
  if (!visible(node) || !node.animate || duration <= 0) {
    window.setTimeout(finish, 0);
    return;
  }
  var animation = node.animate(frames(getComputedStyle(node)), {
    duration,
    easing: "ease-in-out"
  });
  var called = false;
  var once = function() {
    if (called) {
      return;
    }
    called = true;
    finish();
  };
  animation.onfinish = once;
  animation.oncancel = once;
}
function shrinkAway(node, duration, done, width) {
  node.style.overflow = "hidden";
  animateAway(node, function(style) {
    var from = { opacity: style.opacity, height: style.height };
    var to = { opacity: 0, height: "0px" };
    if (width) {
      from.width = style.width;
      to.width = "0px";
    }
    return [from, to];
  }, duration, function() {
    node.style.removeProperty("overflow");
    if (done) {
      done();
    }
  });
}

// src/js/plugins/grideditor.elements.js
Object.assign(GridEditor.locales.en, {
  "tool.delete_element": "Remove element",
  "tool.element_info": "Element: {name}",
  "confirm.delete_element": "Delete element?"
});
var NOT_ELEMENTS = ".row, .ge-content, .ge-text-block, [data-ge-container], .ge-tools-drawer, .ge-resize-handle";
GridEditor.features.elements = function(ge) {
  var warnedIntoText = false;
  var types = validTypes();
  function elementsEnabled() {
    if (ge.settings.elements.enabled !== "auto") {
      return !!ge.settings.elements.enabled;
    }
    return ge.settings.elements.auto || types.length > 0 || !!ge.canvas.querySelector(ge.settings.elements.selector);
  }
  function validTypes() {
    return (ge.settings.elements.types || []).filter(function(type, index) {
      var named = type && typeof type.type === "string" && type.type.trim() !== "";
      var html = type && (typeof type.html === "function" || typeof type.html === "string" && type.html.trim() !== "");
      if (!named || !html) {
        ge.warn("elements.types[" + index + "]: a type needs a type name and its html, as a string or a function; it is left off the toolbar.");
      }
      return named && html;
    });
  }
  function typeItem(type) {
    var mismatched = false;
    return {
      // Asked again whenever the toolbar is built, so setLocale
      // translates a labelKey
      label: function() {
        return labelOf(type);
      },
      iconClass: type.iconClass,
      group: type.group || "elements",
      kind: "element",
      inColumn: true,
      create: function() {
        var element2 = makeElement(type);
        if (element2 && !mismatched && !ge.settings.elements.auto && !element2.matches(ge.settings.elements.selector)) {
          mismatched = true;
          ge.warn('elements.types "' + type.type + '": what it makes does not match elements.selector "' + ge.settings.elements.selector + '", so it will not be an element once the editor looks again.');
        }
        return element2;
      }
    };
  }
  function labelOf(type) {
    if (type.labelKey) {
      return ge.t(type.labelKey);
    }
    return type.label || type.type;
  }
  function makeElement(type) {
    var made;
    try {
      made = typeof type.html === "function" ? type.html() : type.html;
    } catch (error) {
      ge.warn('elements.types "' + type.type + '": its html function threw (' + error.message + "); nothing was added.");
      return null;
    }
    var nodes = typeof made === "string" ? parse(made) : made && made.nodeType ? [made] : [];
    nodes = nodes.filter(function(node) {
      return node.nodeType !== 3 || node.textContent.trim() !== "";
    });
    if (!nodes.length) {
      ge.warn('elements.types "' + type.type + '": its html came out empty; nothing was added.');
      return null;
    }
    var element2 = nodes.length === 1 && nodes[0].nodeType === 1 ? nodes[0] : element("div");
    if (element2 !== nodes[0] || nodes.length > 1) {
      fill(element2, nodes);
    }
    element2.setAttribute("data-ge-element", type.type);
    if (!element2.hasAttribute("data-ge-label")) {
      element2.setAttribute("data-ge-label", labelOf(type));
    }
    return element2;
  }
  function isElement(node) {
    return ge.settings.elements.auto ? !node.matches(NOT_ELEMENTS) : node.matches(ge.settings.elements.selector);
  }
  function markElements() {
    if (!elementsEnabled()) {
      return;
    }
    all(ge.canvas, ".column").forEach(function(column) {
      children(column).forEach(function(element2) {
        if (!hasClass(element2, "ge-element") && !isElement(element2)) {
          return;
        }
        addClass(element2, "ge-element");
        if (!child(element2, ".ge-tools-drawer")) {
          createElementControls(element2);
        }
      });
    });
  }
  function unmarkElements() {
    all(ge.canvas, ".ge-element").forEach(function(element2) {
      removeClass(element2, "ge-element");
      dropEmptyClass(element2);
    });
  }
  function createElementControls(element2) {
    var drawer = element("div", { "class": "ge-tools-drawer ge-element-drawer" });
    element2.insertBefore(drawer, element2.firstChild);
    ge.createMoveTool(drawer);
    ge.createTool(
      drawer,
      ge.t("tool.element_info", { name: elementName(element2) }),
      "ge-element-info",
      "bi bi-info-circle"
    );
    ge.addSettingsTool(drawer, element2, ge.settings.element_classes);
    ge.settings.element_tools.forEach(function(hostTool) {
      ge.createTool(
        drawer,
        hostTool.title || "",
        hostTool.className || "",
        hostTool.iconClass || "bi bi-wrench",
        hostTool.on
      );
    });
    ge.createTool(drawer, ge.t("tool.delete_element"), "ge-delete-element", "bi bi-trash", function() {
      ge.deleteNode("element", element2, ge.t("confirm.delete_element"), function(removed) {
        shrinkAway(element2, 300, removed);
      });
    });
  }
  function elementName(element2) {
    var type = element2.getAttribute("data-ge-element");
    var label = element2.getAttribute("data-ge-label");
    if (label && type) {
      return label + " (" + type + ")";
    }
    return label || type || element2.tagName.toLowerCase();
  }
  function placementBesideText(options) {
    var placed = Object.assign({}, options);
    [["appendTo", "insertAfter"], ["prependTo", "insertBefore"]].forEach(function(pair) {
      var target = options[pair[0]] !== void 0 ? nodeFrom(options[pair[0]]) : null;
      if (!target || !target.matches(".ge-content")) {
        return;
      }
      if (!warnedIntoText) {
        warnedIntoText = true;
        ge.warn("createElement: an element is a block of the column since 6.0, not part of a content area's text; it goes beside the content area. Place it in a column instead.");
      }
      delete placed[pair[0]];
      placed[pair[1]] = hasClass(target.parentElement, "ge-text-block") ? target.parentElement : target;
    });
    return placed;
  }
  function elementsOff() {
    return ge.settings.elements.enabled === false;
  }
  function nodeFrom(node) {
    if (typeof node === "string") {
      return document.querySelector(node);
    }
    return node && node.nodeType === 1 ? node : null;
  }
  function fill(element2, content) {
    if (content === void 0 || content === null) {
      return;
    }
    if (typeof content === "string") {
      parse(content).forEach(function(node) {
        element2.appendChild(node);
      });
    } else if (content.nodeType) {
      element2.appendChild(content);
    } else if (typeof content.length === "number") {
      Array.prototype.slice.call(content).forEach(function(node) {
        element2.appendChild(node);
      });
    }
  }
  function apiCreateElement(content, options) {
    options = options || {};
    var element2 = element("div", {
      "class": "ge-element",
      "data-ge-element": options.type || "element"
    });
    fill(element2, content);
    if (options.label !== void 0) {
      element2.setAttribute("data-ge-label", options.label);
    }
    return ge.place(element2, "element", placementBesideText(options));
  }
  return {
    methods: {
      createElement: apiCreateElement
    },
    // A button for each type the host offers, in the elements category
    // unless the type names another
    toolbar: elementsOff() ? [] : types.map(typeItem),
    /** A node this plugin marked is an element, whatever else it is. */
    kindOf: function(node) {
      return hasClass(node, "ge-element") ? "element" : null;
    },
    /**
     * An element cuts the text it sits in: 5.x's markup, or markup a host
     * wrote the same way, has it inside a content area, and it comes out.
     */
    cuts: function() {
      if (!elementsEnabled()) {
        return null;
      }
      return ge.settings.elements.auto ? "*" : ge.settings.elements.selector;
    },
    // A block the columns move, beside the texts, the rows and the
    // containers - and only the columns
    blocks: ".ge-element",
    accepts: function(region, node) {
      if (hasClass(node, "ge-element")) {
        return is(region, ".column");
      }
      return true;
    },
    onInit: markElements,
    onDeinit: unmarkElements
  };
};
