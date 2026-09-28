// src/js/plugins/grideditor.spacing.js
import { GridEditor } from "../grideditor.esm.js";

// src/js/dom.js
function all(root, selector) {
  return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
}
function selfAndAll(root, selector) {
  if (!root) {
    return [];
  }
  var found = all(root, selector);
  if (root.nodeType === 1 && root.matches(selector)) {
    found.unshift(root);
  }
  return found;
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
function hasClass(node, name) {
  return !!node && node.nodeType === 1 && node.classList.contains(name);
}
function css(node, styles) {
  Object.keys(styles).forEach(function(property) {
    var value = styles[property];
    if (typeof value === "number" && !UNITLESS[property]) {
      value = value + "px";
    }
    node.style.setProperty(property, value === null || value === void 0 ? "" : String(value));
  });
  return node;
}
var UNITLESS = { opacity: true, "z-index": true, "flex-grow": true, "flex-shrink": true, order: true };
var defaultDisplays = {};
function defaultDisplay(node) {
  var tag = node.nodeName;
  if (!defaultDisplays[tag]) {
    var probe = document.body.appendChild(document.createElement(tag));
    defaultDisplays[tag] = getComputedStyle(probe).display;
    probe.remove();
    if (defaultDisplays[tag] === "none") {
      defaultDisplays[tag] = "block";
    }
  }
  return defaultDisplays[tag];
}
function show(node) {
  node.style.removeProperty("display");
  if (getComputedStyle(node).display === "none") {
    node.style.display = defaultDisplay(node);
  }
  return node;
}
function hide(node) {
  node.style.display = "none";
  return node;
}
function toggle(node, state) {
  if (state === void 0) {
    state = !visible(node);
  }
  return state ? show(node) : hide(node);
}
function visible(node) {
  return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
}

// src/js/plugins/grideditor.spacing.js
Object.assign(GridEditor.locales.en, {
  "utility.padding": "Padding",
  "utility.margin": "Margin",
  "utility.side_all": "All sides",
  "utility.side_x": "Left and right",
  "utility.side_y": "Top and bottom",
  "utility.side_t": "Top",
  "utility.side_b": "Bottom",
  "utility.side_s": "Start",
  "utility.side_e": "End",
  "utility.spacing_gutter": "A column's side padding is its gutter: changing it changes the gutter"
});
var VALUES = ["0", "1", "2", "3", "4", "5"];
var SCALE = ["0", ".25rem", ".5rem", "1rem", "1.5rem", "3rem"];
var SIDES = ["", "x", "y", "t", "e", "b", "s"];
var SET = {
  "": ["top", "right", "bottom", "left"],
  x: ["left", "right"],
  y: ["top", "bottom"],
  t: ["top"],
  e: ["right"],
  b: ["bottom"],
  s: ["left"]
};
var INFIXES = ["", "sm", "md", "lg", "xl", "xxl"];
var PROPERTIES = { p: "padding", m: "margin" };
function pattern(key) {
  return new RegExp("^" + key + "[xytbse]?-(?:(?:sm|md|lg|xl|xxl)-)?(?:[0-5]|auto)$");
}
GridEditor.utilities.spacing = function(ge) {
  var options = Object.assign({ values: VALUES, scale: SCALE }, ge.settings.utilities.spacing);
  var patterns = { p: pattern("p"), m: pattern("m") };
  function applies(node, kind) {
    return kind === "row" || kind === "column" || kind === "element" || is(node, "[data-ge-container]");
  }
  function classes(node) {
    return (node.getAttribute("class") || "").split(/\s+/);
  }
  function carries(node, key) {
    return classes(node).some(function(name) {
      return patterns[key].test(name);
    });
  }
  function source(node, family, tier) {
    var names = classes(node);
    var values = family.charAt(0) === "m" ? VALUES.concat(["auto"]) : VALUES;
    for (var i = tier; i >= 0; i--) {
      for (var v = 0; v < values.length; v++) {
        var name = family + (INFIXES[i] ? "-" + INFIXES[i] : "") + "-" + values[v];
        if (names.indexOf(name) !== -1) {
          return { tier: i, value: values[v] };
        }
      }
    }
    return null;
  }
  function without(node, key) {
    var original = node.getAttribute("class");
    var style;
    var bare = {};
    node.setAttribute("class", classes(node).filter(function(name) {
      return !patterns[key].test(name);
    }).join(" "));
    style = getComputedStyle(node);
    ["top", "right", "bottom", "left"].forEach(function(side) {
      bare[side] = style.getPropertyValue(PROPERTIES[key] + "-" + side);
    });
    if (original === null) {
      node.removeAttribute("class");
    } else {
      node.setAttribute("class", original);
    }
    return bare;
  }
  function sides(node, key, breakpoint) {
    var tier = ge.breakpoints.indexOf(breakpoint);
    var winners = {};
    var styles = {};
    var neutral = null;
    SIDES.forEach(function(side, order) {
      var found = source(node, key + side, tier);
      if (!found) {
        return;
      }
      SET[side].forEach(function(set) {
        var current = winners[set];
        if (!current || found.tier > current.tier || found.tier === current.tier && order > current.order) {
          winners[set] = { tier: found.tier, order, value: found.value };
        }
      });
    });
    ["top", "right", "bottom", "left"].forEach(function(set) {
      var winner = winners[set];
      if (!winner) {
        neutral = neutral || without(node, key);
        styles[PROPERTIES[key] + "-" + set] = neutral[set];
      } else {
        styles[PROPERTIES[key] + "-" + set] = winner.value === "auto" ? "auto" : options.scale[winner.value];
      }
    });
    return styles;
  }
  function startingSide(node, key) {
    var names = classes(node).filter(function(name) {
      return patterns[key].test(name);
    });
    var found = SIDES.filter(function(side) {
      return names.some(function(name) {
        return name.indexOf(key + side + "-") === 0;
      });
    });
    return found.length ? found[0] : "";
  }
  function sideLabel(side) {
    switch (side) {
      case "x":
        return ge.t("utility.side_x");
      case "y":
        return ge.t("utility.side_y");
      case "t":
        return ge.t("utility.side_t");
      case "b":
        return ge.t("utility.side_b");
      case "s":
        return ge.t("utility.side_s");
      case "e":
        return ge.t("utility.side_e");
      default:
        return ge.t("utility.side_all");
    }
  }
  function group(node, key, labelText) {
    var box = element("div", { "class": "ge-spacing-group", "data-ge-spacing": key });
    var side = element("select", { "class": "ge-spacing-side form-select form-select-sm" });
    box.appendChild(element("span", { "class": "ge-utility-label" }, labelText));
    SIDES.forEach(function(value) {
      side.appendChild(element("option", { value }, sideLabel(value)));
    });
    var field = ge.utilityField(node, key + startingSide(node, key));
    side.value = field.getAttribute("data-ge-family").slice(1);
    side.addEventListener("change", function() {
      var next = ge.utilityField(node, key + this.value);
      field.replaceWith(next);
      field = next;
    });
    box.appendChild(side);
    box.appendChild(field);
    return box;
  }
  var NODES = ".row, .column, .ge-element, [data-ge-container]";
  function mark(scope) {
    selfAndAll(scope, NODES).forEach(function(node) {
      var drawer = child(node, ".ge-tools-drawer");
      if (!drawer || !applies(node, ge.kindOf(node))) {
        return;
      }
      if (carries(node, "p")) {
        var style = getComputedStyle(node);
        css(drawer, {
          "margin-top": "-" + style.paddingTop,
          "margin-left": "-" + style.paddingLeft,
          "margin-right": "-" + style.paddingRight,
          width: "calc(100% + " + style.paddingLeft + " + " + style.paddingRight + ")"
        });
      } else {
        css(drawer, { "margin-top": "", "margin-left": "", "margin-right": "", width: "" });
      }
      if (hasClass(node, "column")) {
        var padded = classes(node).some(function(name) {
          return /^p[xse]?-/.test(name) && patterns.p.test(name);
        });
        all(drawer, ".ge-spacing-gutter").forEach(function(note) {
          toggle(note, padded);
        });
      }
    });
  }
  function families(key, labelKey) {
    var values = key === "m" ? VALUES.concat(["auto"]) : VALUES;
    var offered = options.values.concat(key === "m" ? ["auto"] : []);
    return SIDES.map(function(side) {
      return {
        name: key + side,
        prefix: key + side,
        values,
        appliesTo: ["row", "column", "text", "element", "container"],
        labelKey,
        panel: false,
        choices: function() {
          return values.filter(function(value) {
            return offered.indexOf(value) !== -1;
          });
        }
      };
    });
  }
  return {
    families: families("p", "utility.padding").concat(families("m", "utility.margin")),
    panel: function(node, kind) {
      if (!applies(node, kind)) {
        return null;
      }
      var box = element("div", { "class": "ge-spacing" });
      box.appendChild(group(node, "p", ge.t("utility.padding")));
      box.appendChild(group(node, "m", ge.t("utility.margin")));
      if (kind === "column") {
        box.appendChild(element("small", { "class": "ge-spacing-gutter" }, ge.t("utility.spacing_gutter")));
      }
      return box;
    },
    preview: function(node, kind, breakpoint) {
      if (!applies(node, kind)) {
        return {};
      }
      var styles = {};
      ["p", "m"].forEach(function(key) {
        if (carries(node, key)) {
          Object.assign(styles, sides(node, key, breakpoint));
        }
      });
      return styles;
    },
    onRefresh: mark
  };
};
