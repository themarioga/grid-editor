// src/js/plugins/grideditor.order.js
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

// src/js/plugins/grideditor.order.js
Object.assign(GridEditor.locales.en, {
  "utility.order": "Order",
  "utility.order_first": "First",
  "utility.order_last": "Last",
  "tool.order_earlier": "Earlier in this view",
  "tool.order_later": "Later in this view",
  "badge.order": "Order: {value}"
});
var VALUES = ["first", "0", "1", "2", "3", "4", "5", "last"];
var RANK = { first: -1, last: 6 };
var CLASS_PATTERN = /(?:^|\s)order-(?:(?:sm|md|lg|xl|xxl)-)?(?:first|last|[0-5])(?:\s|$)/;
GridEditor.utilities.order = function(ge) {
  var options = Object.assign({ drawer: true }, ge.settings.utilities.order);
  var warnedAboutDrag = false;
  var listening = null;
  function rank(value) {
    if (value === null) {
      return 0;
    }
    return RANK[value] !== void 0 ? RANK[value] : parseInt(value, 10);
  }
  function label(value) {
    if (value === "first") {
      return ge.t("utility.order_first");
    }
    if (value === "last") {
      return ge.t("utility.order_last");
    }
    return value;
  }
  function visualOrder(columns, read) {
    return columns.map(function(element, index) {
      return { element, index, rank: rank(read(element)) };
    }).sort(function(a, b) {
      return a.rank - b.rank || a.index - b.index;
    }).map(function(entry) {
      return entry.element;
    });
  }
  function sameOrder(a, b) {
    return a.every(function(element, index) {
      return element === b[index];
    });
  }
  function slots(count) {
    if (count <= 6) {
      return VALUES.slice(1, 1 + count);
    }
    if (count === 7) {
      return VALUES.slice(1);
    }
    if (count === 8) {
      return VALUES.slice();
    }
    return null;
  }
  function move(col, direction) {
    var view = ge.view();
    var columns = children(col.parentElement, ".column");
    var shown = visualOrder(columns, function(column) {
      return ge.getUtility(column, "order", view);
    });
    var from = shown.indexOf(col);
    var to = from + direction;
    if (to < 0 || to >= shown.length) {
      return;
    }
    shown.splice(to, 0, shown.splice(from, 1)[0]);
    var values = null;
    if (!sameOrder(shown, columns) || !inheritsMarkupOrder(columns, view)) {
      values = slots(shown.length);
      if (!values) {
        ge.warn("a row of " + shown.length + " columns cannot be reordered with Bootstrap's order classes, which have eight places");
        return;
      }
    }
    ge.operate(function() {
      shown.forEach(function(element, index) {
        ge.setUtility(element, "order", values ? values[index] : null, { source: "tool" });
      });
    });
  }
  function inheritsMarkupOrder(columns, view) {
    var index = ge.breakpoints.indexOf(view);
    if (index <= 0) {
      return true;
    }
    var below = ge.breakpoints[index - 1];
    return sameOrder(visualOrder(columns, function(column) {
      return ge.getUtility(column, "order", below);
    }), columns);
  }
  function ordered(row) {
    return children(row, ".column").some(function(element) {
      return ge.getUtility(element, "order", ge.view()) !== null;
    });
  }
  function mark(scope) {
    selfAndAll(scope, ".column").forEach(function(col) {
      var value = CLASS_PATTERN.test(col.getAttribute("class") || "") ? ge.getUtility(col, "order", ge.view()) : null;
      if (value === null) {
        col.removeAttribute("data-ge-order");
      } else {
        col.setAttribute("data-ge-order", ge.t("badge.order", { value: label(value) }));
      }
    });
  }
  function afterMove(e) {
    var payload = e.detail;
    if (warnedAboutDrag || payload.kind !== "column" || !payload.to) {
      return;
    }
    if (!ordered(payload.to.parent)) {
      return;
    }
    warnedAboutDrag = true;
    ge.warn("a column was dropped in a row whose columns carry order classes in this view: where it shows is set by those classes, not by where it sits in the markup");
  }
  return {
    families: [{
      name: "order",
      prefix: "order",
      values: VALUES,
      appliesTo: ["column"],
      labelKey: "utility.order",
      label,
      preview: function(value) {
        return { order: rank(value) };
      }
    }],
    drawerTools: function(drawer, node, kind) {
      if (!options.drawer || kind !== "column") {
        return;
      }
      ge.createTool(drawer, ge.t("tool.order_earlier"), "ge-order-earlier", "bi bi-chevron-left", function() {
        move(node, -1);
      });
      ge.createTool(drawer, ge.t("tool.order_later"), "ge-order-later", "bi bi-chevron-right", function() {
        move(node, 1);
      });
    },
    // init runs again whenever a node is added, without a deinit
    // between, so the listener is replaced rather than stacked
    onInit: function() {
      if (listening) {
        ge.canvas.removeEventListener("grideditor:after-move", listening);
      }
      listening = afterMove;
      ge.canvas.addEventListener("grideditor:after-move", listening);
    },
    onRefresh: mark,
    onDeinit: function() {
      if (listening) {
        ge.canvas.removeEventListener("grideditor:after-move", listening);
      }
      listening = null;
      all(ge.canvas, "[data-ge-order]").forEach(function(col) {
        col.removeAttribute("data-ge-order");
      });
    }
  };
};
