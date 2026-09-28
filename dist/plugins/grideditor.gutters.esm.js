// src/js/plugins/grideditor.gutters.js
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

// src/js/plugins/grideditor.gutters.js
Object.assign(GridEditor.locales.en, {
  "utility.gutters": "Gutters",
  "utility.gutters_x": "Horizontal gutters",
  "utility.gutters_y": "Vertical gutters"
});
var VALUES = ["0", "1", "2", "3", "4", "5"];
var SCALE = ["0", ".25rem", ".5rem", "1rem", "1.5rem", "3rem"];
var DEFAULT_X = "1.5rem";
var DEFAULT_Y = "0";
var INFIXES = ["", "sm", "md", "lg", "xl", "xxl"];
var CLASS_PATTERN = /(?:^|\s)g[xy]?-(?:(?:sm|md|lg|xl|xxl)-)?[0-5](?:\s|$)/;
GridEditor.utilities.gutters = function(ge) {
  var options = Object.assign({ scale: SCALE }, ge.settings.utilities.gutters);
  var listening = null;
  function source(row, prefix, tier) {
    var classes = (row.getAttribute("class") || "").split(/\s+/);
    for (var i = tier; i >= 0; i--) {
      for (var value = VALUES.length - 1; value >= 0; value--) {
        var name = prefix + (INFIXES[i] ? "-" + INFIXES[i] : "") + "-" + value;
        if (classes.indexOf(name) !== -1) {
          return { tier: i, value };
        }
      }
    }
    return null;
  }
  function axis(row, prefix, fallback) {
    var tier = ge.breakpoints.indexOf(ge.view());
    var winner = [source(row, "g", tier), source(row, prefix, tier)].filter(Boolean).sort(function(a, b) {
      return b.tier - a.tier || b.value - a.value;
    })[0];
    return winner ? options.scale[winner.value] : fallback;
  }
  function preview(axes) {
    return function(value, row) {
      var styles = {};
      if (axes.indexOf("x") !== -1) {
        styles["--bs-gutter-x"] = axis(row, "gx", DEFAULT_X);
      }
      if (axes.indexOf("y") !== -1) {
        styles["--bs-gutter-y"] = axis(row, "gy", DEFAULT_Y);
      }
      return styles;
    };
  }
  function afterUtility(e) {
    var payload = e.detail;
    if (payload.family !== "g") {
      return;
    }
    ["gx", "gy"].forEach(function(family) {
      ge.setUtility(payload.node, family, null, { view: payload.breakpoint, source: payload.source });
    });
  }
  function mark(scope) {
    selfAndAll(scope, ".row").forEach(function(row) {
      toggleClass(row, "ge-gutters", CLASS_PATTERN.test(row.getAttribute("class") || ""));
    });
  }
  return {
    families: [
      {
        name: "g",
        prefix: "g",
        values: VALUES,
        appliesTo: ["row"],
        labelKey: "utility.gutters",
        preview: preview(["x", "y"])
      },
      {
        name: "gx",
        prefix: "gx",
        values: VALUES,
        appliesTo: ["row"],
        labelKey: "utility.gutters_x",
        preview: preview(["x"])
      },
      {
        name: "gy",
        prefix: "gy",
        values: VALUES,
        appliesTo: ["row"],
        labelKey: "utility.gutters_y",
        preview: preview(["y"])
      }
    ],
    onInit: function() {
      if (listening) {
        ge.canvas.removeEventListener("grideditor:after-utility", listening);
      }
      listening = afterUtility;
      ge.canvas.addEventListener("grideditor:after-utility", listening);
    },
    onRefresh: mark,
    onDeinit: function() {
      if (listening) {
        ge.canvas.removeEventListener("grideditor:after-utility", listening);
      }
      listening = null;
      all(ge.canvas, ".ge-gutters").forEach(function(row) {
        removeClass(row, "ge-gutters");
      });
    }
  };
};
