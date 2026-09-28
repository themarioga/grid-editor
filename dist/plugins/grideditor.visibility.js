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
  function is(node, selector) {
    return !!node && node.nodeType === 1 && node.matches(selector);
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

  // src/js/plugins/grideditor.visibility.js
  Object.assign(GridEditor.locales.en, {
    "utility.visibility": "Visibility",
    "utility.visibility_hidden": "Hidden",
    "utility.visibility_shown": "Shown",
    "tool.hide_in_view": "Hide in this view",
    "tool.show_in_view": "Show in this view",
    "badge.hidden_in": "Hidden at {breakpoints}"
  });
  var CLASS_PATTERN = /(?:^|\s)d-(?:(?:sm|md|lg|xl|xxl)-)?(?:none|block|flex)(?:\s|$)/;
  var NODES = ".row, .column, .ge-content, .ge-element, [data-ge-container]";
  GridEditor.utilities.visibility = function(ge) {
    var options = Object.assign({ drawer: true }, ge.settings.utilities.visibility);
    function shown(kind) {
      return kind === "row" ? "flex" : "block";
    }
    function applies(node, kind) {
      return kind === "row" || kind === "column" || kind === "element" || kind === "text" || kind === "plain" || is(node, "[data-ge-container]");
    }
    function hiddenAt(node, view) {
      return ge.getUtility(node, "visibility", view) === "none";
    }
    function hiddenTiers(node) {
      return ge.breakpoints.filter(function(key) {
        return hiddenAt(node, key);
      });
    }
    function hiddenHere(node) {
      return ge.view() === "all" ? hiddenTiers(node).length === ge.breakpoints.length : hiddenAt(node, ge.view());
    }
    function hiddenBelow(node) {
      var index = ge.breakpoints.indexOf(ge.view());
      return index > 0 && hiddenAt(node, ge.breakpoints[index - 1]);
    }
    function toggle(node, kind) {
      var hide = !hiddenHere(node);
      var value;
      if (ge.view() === "all") {
        value = hide ? "none" : null;
      } else if (hide) {
        value = hiddenBelow(node) ? null : "none";
      } else {
        value = hiddenBelow(node) ? shown(kind) : null;
      }
      ge.setUtility(node, "visibility", value, { source: "tool" });
    }
    function mark(scope) {
      selfAndAll(scope, NODES).forEach(function(node) {
        var kind = ge.kindOf(node);
        var carries = applies(node, kind) && CLASS_PATTERN.test(node.getAttribute("class") || "");
        var tiers = carries ? hiddenTiers(node) : [];
        var here = carries && hiddenHere(node);
        var partly = carries && ge.view() === "all" && tiers.length > 0 && !here;
        toggleClass(node, "ge-visibility", carries);
        toggleClass(node, "ge-hidden-in-view", here);
        if (partly) {
          node.setAttribute("data-ge-hidden-in", ge.t("badge.hidden_in", { breakpoints: tiers.join(", ") }));
        } else {
          node.removeAttribute("data-ge-hidden-in");
        }
        children(node, ".ge-tools-drawer").forEach(function(drawer) {
          children(drawer, ".ge-visibility-tool").forEach(function(tool) {
            tool.setAttribute("title", here ? ge.t("tool.show_in_view") : ge.t("tool.hide_in_view"));
            all(tool, "i").forEach(function(icon) {
              icon.setAttribute("class", here ? "bi bi-eye-slash" : "bi bi-eye");
            });
          });
        });
      });
    }
    function unmark() {
      all(ge.canvas, ".ge-visibility, .ge-hidden-in-view, [data-ge-hidden-in]").forEach(function(node) {
        removeClass(node, "ge-visibility ge-hidden-in-view");
        node.removeAttribute("data-ge-hidden-in");
        dropEmptyClass(node);
      });
    }
    return {
      families: [{
        name: "visibility",
        prefix: "d",
        values: ["none", "block", "flex"],
        appliesTo: ["row", "column", "text", "element", "container"],
        labelKey: "utility.visibility",
        /** Hidden, or shown the way this kind of node is shown. */
        choices: function(node, kind) {
          return ["none", shown(kind)];
        },
        label: function(value) {
          return value === "none" ? ge.t("utility.visibility_hidden") : ge.t("utility.visibility_shown");
        }
      }],
      drawerTools: function(drawer, node, kind) {
        if (!options.drawer || !applies(node, kind)) {
          return;
        }
        ge.createTool(drawer, ge.t("tool.hide_in_view"), "ge-visibility-tool", "bi bi-eye", function() {
          toggle(node, kind);
        });
      },
      onRefresh: mark,
      onDeinit: unmark
    };
  };
})();
