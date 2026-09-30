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
    return Array.prototype.filter.call(node.children, function(each2) {
      return !selector || each2.matches(selector);
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

  // src/js/inline-style/spacing.js
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
  function spacingPart(ge, given) {
    var options = Object.assign({ values: VALUES, scale: SCALE }, given);
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
    function group2(node, key, labelText) {
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
    var NODES3 = ".row, .column, .ge-element, [data-ge-container]";
    function mark2(scope) {
      selfAndAll(scope, NODES3).forEach(function(node) {
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
        box.appendChild(group2(node, "p", ge.t("utility.padding")));
        box.appendChild(group2(node, "m", ge.t("utility.margin")));
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
      onRefresh: mark2
    };
  }

  // src/js/inline-style/textalign.js
  Object.assign(GridEditor.locales.en, {
    "utility.text_align": "Text alignment",
    "utility.text_start": "Start",
    "utility.text_center": "Center",
    "utility.text_end": "End"
  });
  var CSS = { start: "left", center: "center", end: "right" };
  function textalignPart(ge) {
    function label(value) {
      if (value === "start") {
        return ge.t("utility.text_start");
      }
      if (value === "center") {
        return ge.t("utility.text_center");
      }
      return ge.t("utility.text_end");
    }
    return {
      families: [{
        name: "text-align",
        prefix: "text",
        values: ["start", "center", "end"],
        appliesTo: ["row", "column", "text", "element", "container"],
        labelKey: "utility.text_align",
        label,
        /**
         * With no class applying here, the node aligns as its parent
         * does - or as the host's css says - which only the browser can
         * tell, so it is asked with the classes out of the way. Parents
         * are previewed before their children, so the parent's answer is
         * already the view's.
         */
        preview: function(value, node) {
          return { "text-align": value === null ? ge.bareStyle(node, "text-align", "text-align") : CSS[value] };
        }
      }]
    };
  }

  // src/js/inline-style/display.js
  Object.assign(GridEditor.locales.en, {
    "utility.display": "Display",
    "utility.visibility_hidden": "Hidden",
    "tool.hide_in_view": "Hide in this view",
    "tool.show_in_view": "Show in this view",
    "badge.hidden_in": "Hidden at {breakpoints}"
  });
  var VALUES2 = ["none", "inline", "inline-block", "block", "grid", "inline-grid", "flex", "inline-flex"];
  var CLASS_PATTERN = new RegExp("(?:^|\\s)d-(?:(?:sm|md|lg|xl|xxl)-)?(?:" + VALUES2.join("|") + ")(?:\\s|$)");
  var NONE_PATTERN = /^d-(?:(?:sm|md|lg|xl|xxl)-)?none$/;
  var NODES = ".row, .column, .ge-content, .ge-element, [data-ge-container]";
  var SHOWN_ATTR = "data-ge-display";
  function displayPart(ge, given) {
    var options = Object.assign({ drawer: true }, given);
    function choices(kind) {
      if (kind === "row") {
        return ["none", "flex"];
      }
      if (kind === "text" || kind === "plain") {
        return ["none", "block"];
      }
      return VALUES2;
    }
    function shownByDefault(kind) {
      return kind === "row" ? "flex" : "block";
    }
    function applies(node, kind) {
      return kind === "row" || kind === "column" || kind === "element" || kind === "text" || kind === "plain" || is(node, "[data-ge-container]");
    }
    function hiddenAt(node, view) {
      return ge.getUtility(node, "display", view) === "none";
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
    function shownBelow(node, view) {
      for (var i = ge.breakpoints.indexOf(view) - 1; i >= 0; i--) {
        var value = ge.getUtility(node, "display", ge.breakpoints[i]);
        if (value === null) {
          return null;
        }
        if (value !== "none") {
          return value;
        }
      }
      return null;
    }
    function toggle2(node, kind) {
      var hide2 = !hiddenHere(node);
      var value;
      if (ge.view() === "all") {
        value = hide2 ? "none" : null;
      } else if (hide2) {
        value = hiddenBelow(node) ? null : "none";
      } else {
        value = hiddenBelow(node) ? shownBelow(node, ge.view()) || shownByDefault(kind) : null;
      }
      ge.setUtility(node, "display", value, { source: "tool" });
    }
    function shownAs(node) {
      var original = node.getAttribute("class");
      node.setAttribute("class", original.split(/\s+/).filter(function(name) {
        return !NONE_PATTERN.test(name);
      }).join(" "));
      var display = getComputedStyle(node).display;
      node.setAttribute("class", original);
      return display !== "none" && VALUES2.indexOf(display) !== -1 ? display : "block";
    }
    function mark2(scope) {
      selfAndAll(scope, NODES).forEach(function(node) {
        var kind = ge.kindOf(node);
        var carries = applies(node, kind) && CLASS_PATTERN.test(node.getAttribute("class") || "");
        var tiers = carries ? hiddenTiers(node) : [];
        var here = carries && hiddenHere(node);
        var partly = carries && ge.view() === "all" && tiers.length > 0 && !here;
        node.removeAttribute(SHOWN_ATTR);
        if (carries && getComputedStyle(node).display === "none") {
          node.setAttribute(SHOWN_ATTR, shownAs(node));
        }
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
      all(ge.canvas, ".ge-hidden-in-view, [data-ge-hidden-in], [" + SHOWN_ATTR + "]").forEach(function(node) {
        removeClass(node, "ge-hidden-in-view");
        node.removeAttribute("data-ge-hidden-in");
        node.removeAttribute(SHOWN_ATTR);
        dropEmptyClass(node);
      });
    }
    return {
      families: [{
        name: "display",
        prefix: "d",
        values: VALUES2,
        appliesTo: ["row", "column", "text", "element", "container"],
        labelKey: "utility.display",
        choices: function(node, kind) {
          return choices(kind);
        },
        label: function(value) {
          return value === "none" ? ge.t("utility.visibility_hidden") : value;
        },
        /**
         * What the view being edited displays the node as. Hidden is
         * shown the way the breakpoints below show it, since the canvas
         * keeps a hidden node, faded; with no class applying, it is what
         * the node is without any.
         */
        preview: function(value, node) {
          if (value === "none") {
            value = shownBelow(node, ge.view());
          }
          return { display: value === null ? ge.bareStyle(node, "display", "display") : value };
        }
      }],
      drawerTools: function(drawer, node, kind) {
        if (!options.drawer || !applies(node, kind)) {
          return;
        }
        ge.createTool(drawer, ge.t("tool.hide_in_view"), "ge-visibility-tool", "bi bi-eye", function() {
          toggle2(node, kind);
        });
      },
      onRefresh: mark2,
      onDeinit: unmark
    };
  }

  // src/js/inline-style/flex.js
  Object.assign(GridEditor.locales.en, {
    "utility.flex_direction": "Direction",
    "utility.flex_wrap": "Wrap",
    "utility.justify_content": "Justify columns",
    "utility.align_items": "Align columns",
    "utility.align_content": "Align lines",
    "utility.gap": "Gap",
    "utility.row_gap": "Row gap",
    "utility.column_gap": "Column gap",
    "utility.flex_fill": "Fill",
    "utility.flex_grow": "Grow",
    "utility.flex_shrink": "Shrink"
  });
  var FLEX = {
    start: "flex-start",
    end: "flex-end",
    center: "center",
    between: "space-between",
    around: "space-around",
    evenly: "space-evenly",
    baseline: "baseline",
    stretch: "stretch"
  };
  var GAPS = ["0", "1", "2", "3", "4", "5"];
  var SCALE2 = ["0", ".25rem", ".5rem", "1rem", "1.5rem", "3rem"];
  var CONTAINERS = ["row", "column", "element", "container"];
  var ITEMS = ["column", "element", "container"];
  function flexPart(ge, spacing2) {
    var scale = spacing2 && spacing2.scale || SCALE2;
    function family(definition) {
      var property = definition.property || definition.name;
      return Object.assign({
        prefix: definition.name,
        panel: false,
        preview: function(value, node) {
          var styles = {};
          styles[property] = value === null ? ge.bareStyle(node, definition.name, property) : definition.css(value);
          return styles;
        }
      }, definition);
    }
    function alignment(definition) {
      return family(Object.assign({
        appliesTo: CONTAINERS,
        preview: function(value) {
          var styles = {};
          styles[definition.name] = value === null ? "normal" : FLEX[value];
          return styles;
        }
      }, definition));
    }
    function gap(definition) {
      return family(Object.assign({
        values: GAPS,
        appliesTo: ITEMS,
        css: function(value) {
          return scale[value];
        }
      }, definition));
    }
    function same(value) {
      return value;
    }
    return {
      families: [
        family({
          name: "flex-direction",
          prefix: "flex",
          labelKey: "utility.flex_direction",
          values: ["row", "row-reverse", "column", "column-reverse"],
          appliesTo: CONTAINERS,
          css: same
        }),
        family({
          name: "flex-wrap",
          prefix: "flex",
          labelKey: "utility.flex_wrap",
          values: ["wrap", "nowrap", "wrap-reverse"],
          appliesTo: CONTAINERS,
          css: same
        }),
        alignment({
          name: "justify-content",
          labelKey: "utility.justify_content",
          values: ["start", "center", "end", "between", "around", "evenly"]
        }),
        alignment({
          name: "align-items",
          labelKey: "utility.align_items",
          values: ["start", "center", "end", "baseline", "stretch"]
        }),
        alignment({
          name: "align-content",
          labelKey: "utility.align_content",
          values: ["start", "center", "end", "between", "around", "stretch"]
        }),
        gap({ name: "gap", labelKey: "utility.gap" }),
        gap({ name: "row-gap", labelKey: "utility.row_gap" }),
        gap({ name: "column-gap", labelKey: "utility.column_gap" }),
        family({
          name: "flex-fill",
          prefix: "flex",
          property: "flex",
          labelKey: "utility.flex_fill",
          values: ["fill"],
          appliesTo: ITEMS,
          css: function() {
            return "1 1 auto";
          }
        }),
        family({
          name: "flex-grow",
          prefix: "flex",
          labelKey: "utility.flex_grow",
          values: ["grow-0", "grow-1"],
          appliesTo: ITEMS,
          css: function(value) {
            return value.slice(-1);
          }
        }),
        family({
          name: "flex-shrink",
          prefix: "flex",
          labelKey: "utility.flex_shrink",
          values: ["shrink-0", "shrink-1"],
          appliesTo: ITEMS,
          css: function(value) {
            return value.slice(-1);
          }
        })
      ]
    };
  }

  // src/js/inline-style/float.js
  Object.assign(GridEditor.locales.en, {
    "utility.float": "Float",
    "utility.float_start": "Start",
    "utility.float_end": "End",
    "utility.float_none": "None"
  });
  var CSS2 = { start: "left", end: "right", none: "none" };
  function floatPart(ge) {
    function label(value) {
      if (value === "start") {
        return ge.t("utility.float_start");
      }
      if (value === "end") {
        return ge.t("utility.float_end");
      }
      return ge.t("utility.float_none");
    }
    return {
      families: [{
        name: "float",
        prefix: "float",
        values: ["start", "end", "none"],
        appliesTo: ["element"],
        labelKey: "utility.float",
        label,
        /** With no class applying here, whatever the host's css floats it as. */
        preview: function(value, node) {
          return { float: value === null ? ge.bareStyle(node, "float", "float") : CSS2[value] };
        }
      }]
    };
  }

  // src/js/inline-style/sticky.js
  Object.assign(GridEditor.locales.en, {
    "utility.sticky": "Sticky"
  });
  var STUCK = {
    top: { position: "sticky", top: "0", "z-index": "1020" },
    bottom: { position: "sticky", bottom: "0", "z-index": "1020" }
  };
  function stickyPart(ge) {
    return {
      families: [{
        name: "sticky",
        prefix: "sticky",
        values: ["top", "bottom"],
        appliesTo: ["row", "column", "element", "container"],
        labelKey: "utility.sticky",
        panel: false,
        /** With no class applying here, where the node is without one. */
        preview: function(value, node) {
          if (value !== null) {
            return STUCK[value];
          }
          return { position: ge.bareStyle(node, "sticky", "position") };
        }
      }]
    };
  }

  // src/js/inline-style/drawerflow.js
  var NODES2 = ".row, .column, .ge-element, [data-ge-container]";
  var OUT_CLASS = "ge-drawer-out";
  var OUT_ATTR = "data-ge-drawer-out";
  var GAP = 5;
  var LAYS_OUT = /^(?:inline-)?(?:flex|grid)$/;
  function drawerflowPart(ge) {
    var sheet = null;
    var heights = {};
    var observer = null;
    function rule(room) {
      if (heights[room]) {
        return;
      }
      heights[room] = true;
      if (!sheet) {
        sheet = document.head.appendChild(element("style", { "data-ge-drawer-flow": "" }));
      }
      var node = ".ge-canvas.ge-editing [" + OUT_ATTR + '="' + room + '"]';
      sheet.appendChild(document.createTextNode(
        node + " { border-top-width: " + room + "px !important; }\n" + node + " > .ge-tools-drawer { top: -" + room + "px; }\n"
      ));
    }
    function laysOut(node) {
      var style = getComputedStyle(node);
      if (!LAYS_OUT.test(style.display)) {
        return false;
      }
      return !(hasClass(node, "row") && style.flexDirection === "row" && style.flexWrap === "wrap");
    }
    function measure(node, drawer) {
      var room = Math.ceil(drawer.offsetHeight) + GAP;
      rule(room);
      node.setAttribute(OUT_ATTR, String(room));
    }
    function watch(drawer) {
      if (typeof ResizeObserver === "undefined") {
        return;
      }
      if (!observer) {
        observer = new ResizeObserver(function(entries) {
          entries.forEach(function(entry) {
            var node = entry.target.parentNode;
            if (node && hasClass(node, OUT_CLASS)) {
              measure(node, entry.target);
            }
          });
        });
      }
      observer.observe(drawer);
    }
    function mark2(scope) {
      selfAndAll(scope, NODES2).forEach(function(node) {
        var drawer = child(node, ".ge-tools-drawer");
        if (!drawer) {
          return;
        }
        if (laysOut(node)) {
          addClass(node, OUT_CLASS);
          measure(node, drawer);
          watch(drawer);
        } else if (hasClass(node, OUT_CLASS)) {
          removeClass(node, OUT_CLASS);
          node.removeAttribute(OUT_ATTR);
          dropEmptyClass(node);
          if (observer) {
            observer.unobserve(drawer);
          }
        }
      });
    }
    function unmark() {
      if (observer) {
        observer.disconnect();
      }
      observer = null;
      all(ge.canvas, "." + OUT_CLASS).forEach(function(node) {
        removeClass(node, OUT_CLASS);
        node.removeAttribute(OUT_ATTR);
        dropEmptyClass(node);
      });
      if (sheet) {
        sheet.remove();
      }
      sheet = null;
      heights = {};
    }
    return {
      families: [],
      onRefresh: mark2,
      onDeinit: unmark
    };
  }

  // src/js/inline-style/sections.js
  var COLORS = ["primary", "secondary", "success", "danger", "warning", "info", "light", "dark"];
  var SIDES2 = ["top", "end", "bottom", "start"];
  var OPACITIES = ["10", "25", "50", "75", "100"];
  function each(prefix, values, suffix) {
    return values.map(function(value) {
      return prefix + value + (suffix || "");
    });
  }
  function group(classes, exclusive, notOn, onlyOn) {
    return { classes, exclusive: exclusive !== false, notOn: notOn || [], onlyOn: onlyOn || null };
  }
  function prop(name, options) {
    return {
      name,
      labelKey: options.labelKey,
      type: options.type || "text",
      values: options.values || null,
      notOn: options.notOn || []
    };
  }
  var NOT_ON_COLUMN = ["column"];
  var ONLY_ON_ELEMENT = ["element"];
  var SECTIONS = [
    {
      key: "size",
      labelKey: "inline_style.section_size",
      properties: [
        prop("width", { labelKey: "inline_style.prop_width", notOn: NOT_ON_COLUMN }),
        prop("height", { labelKey: "inline_style.prop_height", notOn: NOT_ON_COLUMN }),
        prop("min-width", { labelKey: "inline_style.prop_min_width" }),
        prop("min-height", { labelKey: "inline_style.prop_min_height" }),
        prop("max-width", { labelKey: "inline_style.prop_max_width" }),
        prop("max-height", { labelKey: "inline_style.prop_max_height" })
      ],
      catalog: [
        group(each("w-", ["25", "50", "75", "100", "auto"]), true, NOT_ON_COLUMN),
        group(each("h-", ["25", "50", "75", "100", "auto"]), true, NOT_ON_COLUMN),
        group(["mw-100", "mh-100", "vw-100", "vh-100", "min-vw-100", "min-vh-100"], false, NOT_ON_COLUMN),
        group(["img-fluid", "img-thumbnail"], false, [], ONLY_ON_ELEMENT),
        group(each("object-fit-", ["contain", "cover", "fill", "scale", "none"]), true, [], ONLY_ON_ELEMENT)
      ],
      parts: []
    },
    {
      key: "spacing",
      labelKey: "inline_style.section_spacing",
      properties: [
        prop("margin-top", { labelKey: "inline_style.prop_margin_top" }),
        prop("margin-right", { labelKey: "inline_style.prop_margin_right" }),
        prop("margin-bottom", { labelKey: "inline_style.prop_margin_bottom" }),
        prop("margin-left", { labelKey: "inline_style.prop_margin_left" }),
        prop("padding-top", { labelKey: "inline_style.prop_padding_top" }),
        prop("padding-right", { labelKey: "inline_style.prop_padding_right" }),
        prop("padding-bottom", { labelKey: "inline_style.prop_padding_bottom" }),
        prop("padding-left", { labelKey: "inline_style.prop_padding_left" })
      ],
      catalog: [],
      parts: ["spacing"]
    },
    {
      key: "border",
      labelKey: "inline_style.section_border",
      properties: [
        prop("border-width", { labelKey: "inline_style.prop_border_width" }),
        prop("border-style", { labelKey: "inline_style.prop_border_style", type: "select", values: ["none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"] }),
        prop("border-color", { labelKey: "inline_style.prop_border_color", type: "color" }),
        prop("border-radius", { labelKey: "inline_style.prop_border_radius" }),
        prop("box-shadow", { labelKey: "inline_style.prop_box_shadow", type: "shadow" })
      ],
      catalog: [
        group(["border", "border-0"].concat(each("border-", SIDES2), each("border-", SIDES2, "-0")), false),
        group(each("border-", ["1", "2", "3", "4", "5"])),
        group(each("border-", COLORS.concat(["black", "white"])).concat(each("border-", COLORS, "-subtle"))),
        group(each("border-opacity-", OPACITIES)),
        group(["rounded"].concat(each("rounded-", ["0", "1", "2", "3", "4", "5", "circle", "pill"]))),
        group(each("rounded-", SIDES2), false),
        group(["shadow-none", "shadow-sm", "shadow", "shadow-lg"])
      ],
      parts: []
    },
    {
      key: "background",
      labelKey: "inline_style.section_background",
      properties: [
        prop("background-color", { labelKey: "inline_style.prop_background_color", type: "color" }),
        prop("background-image", { labelKey: "inline_style.prop_background_image", type: "url" }),
        prop("background-size", { labelKey: "inline_style.prop_background_size" }),
        prop("background-position", { labelKey: "inline_style.prop_background_position" }),
        prop("background-repeat", { labelKey: "inline_style.prop_background_repeat", type: "select", values: ["repeat", "no-repeat", "repeat-x", "repeat-y", "space", "round"] })
      ],
      catalog: [
        group(each("bg-", COLORS.concat(["body", "body-secondary", "body-tertiary", "white", "black", "transparent"])).concat(each("bg-", COLORS, "-subtle"), each("text-bg-", COLORS))),
        group(["bg-gradient"], false),
        group(each("bg-opacity-", OPACITIES))
      ],
      parts: []
    },
    {
      key: "text",
      labelKey: "inline_style.section_text",
      properties: [
        prop("color", { labelKey: "inline_style.prop_color", type: "color" }),
        prop("font-size", { labelKey: "inline_style.prop_font_size" }),
        prop("text-align", { labelKey: "inline_style.prop_text_align", type: "select", values: ["start", "center", "end", "left", "right", "justify"] }),
        prop("text-shadow", { labelKey: "inline_style.prop_text_shadow", type: "shadow" })
      ],
      catalog: [
        group(each("text-", COLORS.concat(["body", "body-secondary", "body-tertiary", "white", "black"])).concat(each("text-", COLORS, "-emphasis"), ["text-body-emphasis"])),
        group(each("text-opacity-", ["25", "50", "75", "100"])),
        group(each("fs-", ["1", "2", "3", "4", "5", "6"])),
        group(each("text-decoration-", ["none", "underline", "line-through"]))
      ],
      parts: ["textalign"]
    },
    {
      key: "typography",
      labelKey: "inline_style.section_typography",
      properties: [
        prop("font-family", { labelKey: "inline_style.prop_font_family" }),
        prop("font-weight", { labelKey: "inline_style.prop_font_weight", type: "select", values: ["100", "200", "300", "400", "500", "600", "700", "800", "900", "normal", "bold", "lighter", "bolder"] }),
        prop("font-style", { labelKey: "inline_style.prop_font_style", type: "select", values: ["normal", "italic", "oblique"] }),
        prop("line-height", { labelKey: "inline_style.prop_line_height" }),
        prop("letter-spacing", { labelKey: "inline_style.prop_letter_spacing" }),
        prop("text-transform", { labelKey: "inline_style.prop_text_transform", type: "select", values: ["none", "uppercase", "lowercase", "capitalize"] }),
        prop("text-decoration", { labelKey: "inline_style.prop_text_decoration", type: "select", values: ["none", "underline", "line-through", "overline"] })
      ],
      catalog: [
        group(each("fw-", ["lighter", "light", "normal", "medium", "semibold", "bold", "bolder"])),
        group(each("fst-", ["italic", "normal"])),
        group(each("lh-", ["1", "sm", "base", "lg"])),
        group(each("text-", ["lowercase", "uppercase", "capitalize"])),
        group(["font-monospace"], false),
        group(["text-wrap", "text-nowrap"]),
        group(["text-break"], false)
      ],
      parts: []
    },
    {
      key: "display",
      labelKey: "inline_style.section_display",
      properties: [
        prop("display", { labelKey: "inline_style.prop_display", type: "select", values: ["none", "block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid"] }),
        prop("opacity", { labelKey: "inline_style.prop_opacity" }),
        prop("overflow", { labelKey: "inline_style.prop_overflow", type: "select", values: ["visible", "hidden", "auto", "scroll", "clip"] }),
        prop("visibility", { labelKey: "inline_style.prop_visibility", type: "select", values: ["visible", "hidden"] })
      ],
      catalog: [
        group(each("opacity-", ["0", "25", "50", "75", "100"])),
        group(each("overflow-", ["auto", "hidden", "visible", "scroll"])),
        group(["visible", "invisible"])
      ],
      parts: ["display"]
    },
    {
      key: "flex",
      labelKey: "inline_style.section_flex",
      properties: [],
      catalog: [
        group(["vstack", "hstack"], true, ["row"])
      ],
      parts: ["flex"]
    },
    {
      key: "position",
      labelKey: "inline_style.section_position",
      properties: [
        prop("position", { labelKey: "inline_style.prop_position", type: "select", values: ["static", "relative", "absolute", "fixed", "sticky"] }),
        prop("top", { labelKey: "inline_style.prop_top", notOn: NOT_ON_COLUMN }),
        prop("right", { labelKey: "inline_style.prop_right", notOn: NOT_ON_COLUMN }),
        prop("bottom", { labelKey: "inline_style.prop_bottom", notOn: NOT_ON_COLUMN }),
        prop("left", { labelKey: "inline_style.prop_left", notOn: NOT_ON_COLUMN }),
        prop("z-index", { labelKey: "inline_style.prop_z_index" })
      ],
      catalog: [
        group(each("position-", ["static", "relative", "absolute", "fixed", "sticky"])),
        group(each("top-", ["0", "50", "100"])),
        group(each("bottom-", ["0", "50", "100"])),
        group(each("start-", ["0", "50", "100"])),
        group(each("end-", ["0", "50", "100"])),
        group(["translate-middle", "translate-middle-x", "translate-middle-y"]),
        group(["z-n1", "z-0", "z-1", "z-2", "z-3"]),
        group(["fixed-top", "fixed-bottom"])
      ],
      parts: ["float", "sticky"]
    },
    {
      key: "custom",
      labelKey: "inline_style.section_custom",
      properties: [],
      catalog: [],
      parts: [],
      custom: true
    }
  ];
  function section(key) {
    return SECTIONS.filter(function(each_) {
      return each_.key === key;
    })[0] || null;
  }
  function offeredOn(item, kind) {
    if (item.onlyOn && item.onlyOn.indexOf(kind) === -1) {
      return false;
    }
    return item.notOn.indexOf(kind) === -1;
  }
  var BREAKPOINT = "(?:(?:sm|md|lg|xl|xxl)-)?";
  var SPACER = "(?:[0-5]|auto)";
  var COLOR = "(?:" + COLORS.join("|") + "|black|white)";
  var BG = "(?:" + COLORS.join("|") + "|body|body-secondary|body-tertiary|white|black|transparent)";
  var TEXT_COLOR = "(?:" + COLORS.join("|") + "|body|body-secondary|body-tertiary|white|black|muted|black-50|white-50)";
  var BORDER = "border(?:-(?:top|end|bottom|start))?(?:-0)?";
  var SUBTLE = "(?:" + COLORS.join("|") + ")-subtle";
  var EMPHASIS = "(?:" + COLORS.join("|") + "|body)-emphasis";
  var TEXT_BG = "text-bg-(?:" + COLORS.join("|") + ")";
  var STICKY = "sticky-" + BREAKPOINT;
  function spacing(key, side) {
    var sides = { top: "[ty]?", bottom: "[by]?", left: "[sx]?", right: "[ex]?" }[side];
    return new RegExp("^" + key + sides + "-" + BREAKPOINT + SPACER + "$");
  }
  var SETS = {
    "width": /^(?:w-(?:25|50|75|100|auto)|vw-100)$/,
    "height": /^(?:h-(?:25|50|75|100|auto)|vh-100)$/,
    "max-width": /^mw-100$/,
    "max-height": /^mh-100$/,
    "min-width": /^min-vw-100$/,
    "min-height": /^min-vh-100$/,
    "margin-top": spacing("m", "top"),
    "margin-right": spacing("m", "right"),
    "margin-bottom": spacing("m", "bottom"),
    "margin-left": spacing("m", "left"),
    "padding-top": spacing("p", "top"),
    "padding-right": spacing("p", "right"),
    "padding-bottom": spacing("p", "bottom"),
    "padding-left": spacing("p", "left"),
    "border-width": new RegExp("^(?:" + BORDER + "|border-[1-5])$"),
    "border-style": new RegExp("^" + BORDER + "$"),
    "border-color": new RegExp("^(?:" + BORDER + "|border-" + COLOR + "|border-" + SUBTLE + ")$"),
    "border-radius": /^rounded(?:-(?:[0-5]|circle|pill|top|end|bottom|start))?$/,
    "box-shadow": /^shadow(?:-(?:none|sm|lg))?$/,
    "background-color": new RegExp("^(?:bg-" + BG + "|bg-" + SUBTLE + "|" + TEXT_BG + ")$"),
    "background-image": /^bg-gradient$/,
    "color": new RegExp("^(?:text-" + TEXT_COLOR + "|text-" + EMPHASIS + "|" + TEXT_BG + ")$"),
    "font-size": /^fs-[1-6]$/,
    "text-align": new RegExp("^text-" + BREAKPOINT + "(?:start|center|end)$"),
    "text-decoration": /^text-decoration-(?:none|underline|line-through)$/,
    "font-family": /^font-monospace$/,
    "font-weight": /^fw-(?:lighter|light|normal|medium|semibold|bold|bolder)$/,
    "font-style": /^fst-(?:italic|normal)$/,
    "line-height": /^lh-(?:1|sm|base|lg)$/,
    "text-transform": /^text-(?:lowercase|uppercase|capitalize)$/,
    "display": new RegExp("^(?:d-" + BREAKPOINT + "(?:none|inline|inline-block|block|grid|inline-grid|table|table-row|table-cell|flex|inline-flex)|vstack|hstack)$"),
    "opacity": /^opacity-(?:0|25|50|75|100)$/,
    "overflow": /^overflow-(?:auto|hidden|visible|scroll)$/,
    "visibility": /^(?:visible|invisible)$/,
    "position": new RegExp("^(?:position-(?:static|relative|absolute|fixed|sticky)|fixed-(?:top|bottom)|" + STICKY + "(?:top|bottom))$"),
    "top": new RegExp("^(?:top-(?:0|50|100)|fixed-top|" + STICKY + "top)$"),
    "bottom": new RegExp("^(?:bottom-(?:0|50|100)|fixed-bottom|" + STICKY + "bottom)$"),
    "left": /^start-(?:0|50|100)$/,
    "right": /^end-(?:0|50|100)$/,
    "z-index": /^z-(?:n1|[0-3])$/
  };
  function overriding(property, classes) {
    var pattern2 = SETS[property];
    if (!pattern2) {
      return null;
    }
    return classes.filter(function(name) {
      return pattern2.test(name);
    })[0] || null;
  }

  // src/js/inline-style/options.js
  function resolveSections(ge, given) {
    var resolved = {};
    Object.keys(given || {}).forEach(function(key) {
      if (!section(key)) {
        ge.warn('inline_style.sections: there is no "' + key + '" section: ignored');
      }
    });
    SECTIONS.forEach(function(each2) {
      var option = given && given[each2.key] !== void 0 ? given[each2.key] : true;
      if (option === false) {
        return;
      }
      var own = each2.properties.map(function(property) {
        return property.name;
      });
      var properties = each2.properties;
      var catalog = true;
      if (option && typeof option === "object") {
        if (Array.isArray(option.properties)) {
          option.properties.forEach(function(name) {
            if (own.indexOf(name) === -1) {
              ge.warn("inline_style.sections." + each2.key + ': "' + name + '" is not one of its properties: ignored');
            }
          });
          properties = option.properties.filter(function(name) {
            return own.indexOf(name) !== -1;
          }).map(function(name) {
            return each2.properties[own.indexOf(name)];
          });
        }
        if (option.catalog === false) {
          catalog = false;
        }
      }
      resolved[each2.key] = { section: each2, properties, catalog };
    });
    return resolved;
  }
  function resolveOptions(ge) {
    var style = ge.settings.inline_style || {};
    return {
      sections: resolveSections(ge, style.sections),
      spacing: style.spacing,
      visibility: style.visibility
    };
  }

  // src/js/inline-style/fields.js
  var renderers = /* @__PURE__ */ new WeakMap();
  var fieldCounter = 0;
  function classesOf(node) {
    return (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
  }
  function write(ge, node, property, raw) {
    var text = String(raw === null || raw === void 0 ? "" : raw).trim();
    var important = /\s*!\s*important\s*$/i.exec(text);
    var priority;
    if (important) {
      text = text.slice(0, important.index).trim();
      priority = "important";
    }
    return ge.setHostStyle(node, property, text, priority);
  }
  function mark(input, ok, ge) {
    toggleClass(input, "is-invalid", !ok);
    if (ok) {
      input.removeAttribute("title");
    } else {
      input.setAttribute("title", ge.t("inline_style.invalid"));
    }
  }
  function fill(input, value) {
    if (!hasClass(input, "is-invalid")) {
      input.value = value;
    }
  }
  function textInput(className) {
    return element("input", { type: "text", "class": "form-control form-control-sm " + (className || "") });
  }
  var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  function pickable(value) {
    var match = HEX.exec(value.trim());
    if (!match) {
      return null;
    }
    var hex = match[1];
    if (hex.length === 3) {
      hex = hex.split("").map(function(c) {
        return c + c;
      }).join("");
    }
    return "#" + hex.toLowerCase();
  }
  function colorControl(onValue) {
    var box = element("div", { "class": "input-group input-group-sm ge-inline-style-color" });
    var picker = box.appendChild(element("input", { type: "color", "class": "form-control form-control-color" }));
    var text = box.appendChild(textInput());
    picker.addEventListener("input", function() {
      removeClass(text, "is-invalid");
      text.value = picker.value;
      onValue(picker.value, text);
    });
    text.addEventListener("change", function() {
      var hex = pickable(text.value);
      if (hex) {
        picker.value = hex;
      }
      onValue(text.value, text);
    });
    return {
      element: box,
      set: function(value) {
        fill(text, value);
        var hex = pickable(value);
        if (hex) {
          picker.value = hex;
        }
      }
    };
  }
  var URL_VALUE = /^url\(\s*(["']?)(.*)\1\s*\)$/i;
  function shownUrl(value) {
    var match = URL_VALUE.exec(value.trim());
    if (!match) {
      return value;
    }
    return match[1] ? match[2].replace(/\\(["\\])/g, "$1") : match[2];
  }
  function urlValue(text) {
    text = text.trim();
    if (text === "" || /^(?:none|inherit|initial|unset|revert)$/i.test(text) || /^[a-z-]+\(/i.test(text)) {
      return text;
    }
    return 'url("' + text.replace(/(["\\])/g, "\\$1") + '")';
  }
  function tokens(value) {
    var list = [];
    var depth = 0;
    var current = "";
    for (var i = 0; i < value.length; i++) {
      var c = value.charAt(i);
      if (c === "(") {
        depth++;
      }
      if (c === ")") {
        depth--;
      }
      if (depth === 0 && (c === " " || c === ",")) {
        if (current) {
          list.push(current);
        }
        if (c === ",") {
          list.push(",");
        }
        current = "";
      } else {
        current += c;
      }
    }
    if (current) {
      list.push(current);
    }
    return list;
  }
  var LENGTH = /^-?(?:\d*\.)?\d+(?:[a-z%]+)?$/i;
  var SHADOW_PARTS = [
    { name: "x", labelKey: "inline_style.shadow_x" },
    { name: "y", labelKey: "inline_style.shadow_y" },
    { name: "blur", labelKey: "inline_style.shadow_blur" },
    { name: "spread", labelKey: "inline_style.shadow_spread" }
  ];
  function parseShadow(value, box) {
    value = value.trim();
    if (value === "") {
      return { inset: false, lengths: [], color: "" };
    }
    if (/var\(/i.test(value)) {
      return null;
    }
    var list = tokens(value);
    if (list.indexOf(",") !== -1) {
      return null;
    }
    var inset = false;
    var lengths = [];
    var colors = [];
    list.forEach(function(token) {
      if (box && token.toLowerCase() === "inset") {
        inset = true;
      } else if (LENGTH.test(token)) {
        lengths.push(token);
      } else {
        colors.push(token);
      }
    });
    if (colors.length > 1 || lengths.length < 2 || lengths.length > (box ? 4 : 3)) {
      return null;
    }
    if (colors.length && /^(?:none|inherit|initial|unset|revert)$/i.test(colors[0])) {
      return null;
    }
    return { inset, lengths, color: colors[0] || "" };
  }
  function composeShadow(parts, box) {
    var lengths = parts.lengths.slice();
    for (var i = lengths.length - 1; i >= 0; i--) {
      if (lengths[i] === "" && lengths.slice(i + 1).some(Boolean)) {
        lengths[i] = "0";
      }
    }
    lengths = lengths.filter(Boolean);
    if (!lengths.length && !parts.color && !parts.inset) {
      return "";
    }
    while (lengths.length < 2) {
      lengths.push("0");
    }
    return (box && parts.inset ? "inset " : "") + lengths.join(" ") + (parts.color ? " " + parts.color : "");
  }
  function shadowControl(ge, node, property, changed) {
    var box = property === "box-shadow";
    var holder = element("div", { "class": "ge-inline-style-shadow" });
    var textMode = false;
    function writeValue(value, input) {
      var ok = write(ge, node, property, value);
      mark(input, ok, ge);
      if (ok) {
        changed();
      }
      return ok;
    }
    function builder(parts) {
      holder.innerHTML = "";
      var grid = holder.appendChild(element("div", { "class": "ge-inline-style-shadow-builder" }));
      var names = box ? SHADOW_PARTS : SHADOW_PARTS.slice(0, 3);
      var inputs = names.map(function(part, i) {
        var cell = grid.appendChild(element("label", { "class": "ge-inline-style-shadow-part" }));
        cell.appendChild(element("span", { "class": "ge-inline-style-shadow-label" }, ge.t(part.labelKey)));
        var input = cell.appendChild(textInput("ge-inline-style-shadow-" + part.name));
        input.value = parts.lengths[i] || "";
        return input;
      });
      var colorCell = grid.appendChild(element("label", { "class": "ge-inline-style-shadow-part ge-inline-style-shadow-color" }));
      colorCell.appendChild(element("span", { "class": "ge-inline-style-shadow-label" }, ge.t("inline_style.shadow_color")));
      var color = colorControl(function() {
        update();
      });
      colorCell.appendChild(color.element);
      color.set(parts.color);
      var inset = null;
      if (box) {
        var insetCell = grid.appendChild(element("label", { "class": "form-check ge-inline-style-shadow-inset" }));
        inset = insetCell.appendChild(element("input", { type: "checkbox", "class": "form-check-input" }));
        insetCell.appendChild(element("span", { "class": "form-check-label" }, ge.t("inline_style.shadow_inset")));
        inset.checked = parts.inset;
        inset.addEventListener("change", function() {
          update();
        });
      }
      inputs.forEach(function(input) {
        input.addEventListener("change", function() {
          update();
        });
      });
      var toText = holder.appendChild(element("a", { href: "#", "class": "ge-inline-style-shadow-mode" }, ge.t("inline_style.shadow_text_mode")));
      toText.addEventListener("click", function(e) {
        e.preventDefault();
        textMode = true;
        render();
      });
      function update() {
        var value = composeShadow({
          inset: inset ? inset.checked : false,
          lengths: inputs.map(function(input) {
            return input.value.trim();
          }),
          color: one(color.element, 'input[type="text"]').value.trim()
        }, box);
        writeValue(value, inputs[0]);
      }
    }
    function text(value) {
      holder.innerHTML = "";
      var input = holder.appendChild(textInput("ge-inline-style-shadow-text"));
      input.value = value;
      input.addEventListener("change", function() {
        if (input.value.trim() === "") {
          if (writeValue("", input)) {
            textMode = false;
            render();
          }
          return;
        }
        writeValue(input.value, input);
      });
    }
    var shown = null;
    function render() {
      if (holder.querySelector(".is-invalid")) {
        return;
      }
      var value = ge.hostStyle(node, property).value;
      var parts = parseShadow(value, box);
      if (value === shown && holder.firstChild && textMode === !!holder.querySelector(".ge-inline-style-shadow-text")) {
        return;
      }
      shown = value;
      if (textMode || !parts) {
        textMode = !!value || textMode;
        text(value);
      } else {
        builder(parts);
      }
    }
    return { element: holder, render, value: function() {
      return ge.hostStyle(node, property).value;
    } };
  }
  function createStyleField(ge, node, property, changed) {
    var field = element("div", { "class": "ge-inline-style-field", "data-ge-inline-style-property": property.name });
    var label = field.appendChild(element("label", { "class": "ge-inline-style-label" }, ge.t(property.labelKey)));
    var render;
    function current() {
      return ge.hostStyle(node, property.name).value;
    }
    function commit(value, input2) {
      var ok = write(ge, node, property.name, value);
      mark(input2, ok, ge);
      if (ok) {
        changed();
      }
    }
    if (property.type === "select") {
      var select = field.appendChild(element("select", { "class": "form-select form-select-sm" }));
      select.addEventListener("change", function() {
        commit(select.value, select);
      });
      render = function() {
        var value = current();
        var values = property.values.slice();
        if (value && values.indexOf(value) === -1) {
          values.push(value);
        }
        select.innerHTML = "";
        select.appendChild(element("option", { value: "" }, ""));
        values.forEach(function(each2) {
          select.appendChild(element("option", { value: each2 }, each2));
        });
        select.value = value;
      };
    } else if (property.type === "color") {
      var color = colorControl(function(value, input2) {
        commit(value, input2);
      });
      field.appendChild(color.element);
      render = function() {
        color.set(current());
      };
    } else if (property.type === "url") {
      var url = field.appendChild(textInput());
      url.addEventListener("change", function() {
        commit(urlValue(url.value), url);
      });
      render = function() {
        fill(url, shownUrl(current()));
      };
    } else if (property.type === "shadow") {
      var shadow = shadowControl(ge, node, property.name, changed);
      field.appendChild(shadow.element);
      render = shadow.render;
    } else {
      var input = field.appendChild(textInput());
      input.addEventListener("change", function() {
        commit(input.value, input);
      });
      render = function() {
        fill(input, current());
      };
    }
    var control = field.querySelector("input, select");
    if (control) {
      control.id = "ge-inline-style-field-" + ++fieldCounter;
      label.setAttribute("for", control.id);
    }
    field.appendChild(element("small", { "class": "ge-inline-style-note ge-inline-style-overridden" }));
    renderers.set(field, function() {
      render();
      var winner = current() ? overriding(property.name, classesOf(node)) : null;
      var note = child(field, ".ge-inline-style-overridden");
      note.textContent = winner ? ge.t("inline_style.overridden", { "class": winner }) : "";
      toggle(note, !!winner);
    });
    renderStyleField(field);
    return field;
  }
  function renderStyleField(field) {
    var render = renderers.get(field);
    if (render) {
      render();
    }
  }

  // src/js/inline-style/catalog.js
  function classesOf2(node) {
    return (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
  }
  function choose(ge, node, group2, name) {
    var details = ge.detailsOf(node);
    var input = details ? one(details, ".ge-classes") : null;
    if (!input) {
      return;
    }
    var on = classesOf2(node).indexOf(name) !== -1;
    var list = input.value.split(/\s+/).filter(Boolean).filter(function(each2) {
      if (each2 === name) {
        return false;
      }
      return !(group2.exclusive && !on && group2.classes.indexOf(each2) !== -1);
    });
    if (!on) {
      list.push(name);
    }
    input.value = list.join(" ");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function createCatalog(ge, node, kind, groups) {
    var offered = groups.filter(function(group2) {
      return offeredOn(group2, kind);
    });
    if (!offered.length) {
      return null;
    }
    var box = element("div", { "class": "ge-inline-style-catalog" });
    box.appendChild(element("span", { "class": "ge-inline-style-label" }, ge.t("inline_style.catalog")));
    offered.forEach(function(group2) {
      var row = box.appendChild(element("div", { "class": "ge-inline-style-chips" }));
      group2.classes.forEach(function(name) {
        var chip = row.appendChild(element("button", {
          type: "button",
          "class": "btn btn-sm btn-outline-secondary ge-inline-style-chip",
          "data-ge-class": name,
          "aria-pressed": "false"
        }, name));
        chip.addEventListener("click", function() {
          choose(ge, node, group2, name);
        });
      });
    });
    renderCatalog(box, node);
    return box;
  }
  function renderCatalog(box, node) {
    var classes = classesOf2(node);
    all(box, ".ge-inline-style-chip").forEach(function(chip) {
      var on = classes.indexOf(chip.getAttribute("data-ge-class")) !== -1;
      toggleClass(chip, "active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // src/js/inline-style/custom.js
  function longhands(property) {
    var probe = document.createElement("div").style;
    var list = [];
    probe.setProperty(property, "initial");
    for (var i = 0; i < probe.length; i++) {
      list.push(probe[i]);
    }
    return list.length ? list : [property];
  }
  function declaration(cssText) {
    var style = document.createElement("div").style;
    style.cssText = cssText;
    return style;
  }
  function createCustom(ge, node, properties, changed) {
    var covered = {};
    properties.forEach(function(property) {
      longhands(property).forEach(function(longhand) {
        covered[longhand] = true;
      });
    });
    var box = element("div", { "class": "ge-inline-style-custom" });
    var textarea = box.appendChild(element("textarea", {
      "class": "form-control form-control-sm font-monospace ge-inline-style-custom-css",
      rows: "4",
      spellcheck: "false",
      "aria-label": ge.t("inline_style.section_custom")
    }));
    function free() {
      var style = declaration(ge.hostStyle(node));
      var rest = document.createElement("div").style;
      for (var i = 0; i < style.length; i++) {
        var name = style[i];
        if (!covered[name]) {
          rest.setProperty(name, style.getPropertyValue(name), style.getPropertyPriority(name));
        }
      }
      return rest;
    }
    textarea.addEventListener("change", function() {
      var before = free();
      var wanted = declaration(textarea.value);
      var i;
      for (i = 0; i < before.length; i++) {
        if (wanted.getPropertyValue(before[i]) === "") {
          ge.setHostStyle(node, before[i], "");
        }
      }
      for (i = 0; i < wanted.length; i++) {
        ge.setHostStyle(node, wanted[i], wanted.getPropertyValue(wanted[i]), wanted.getPropertyPriority(wanted[i]));
      }
      render();
      changed();
    });
    function render() {
      if (document.activeElement === textarea) {
        return;
      }
      textarea.value = free().cssText.replace(/; /g, ";\n");
    }
    render();
    return { element: box, render };
  }

  // src/js/inline-style/accordion.js
  function takesInlineStyle(node, kind) {
    if (kind === "row" || kind === "column" || kind === "element" || kind === "section") {
      return true;
    }
    if (is(node, "[data-ge-container]")) {
      return true;
    }
    return !!child(node, ".ge-tools-drawer.ge-pane-drawer");
  }
  function familyApplies(family, node, kind) {
    if (kind === "plain") {
      kind = "text";
    }
    if (family.appliesTo.indexOf(kind) !== -1) {
      return true;
    }
    return family.appliesTo.indexOf("container") !== -1 && is(node, "[data-ge-container]");
  }
  function partContent(ge, part, node, kind) {
    if (part.panel) {
      return part.panel(node, kind);
    }
    var fields = part.families.filter(function(family) {
      return familyApplies(family, node, kind);
    }).map(function(family) {
      return ge.utilityField(node, family.name);
    });
    if (fields.length < 2) {
      return fields[0] || null;
    }
    var box = element("div", { "class": "ge-inline-style-part-fields" });
    fields.forEach(function(field) {
      box.appendChild(field);
    });
    return box;
  }
  function createAccordion(ge, node, kind, context) {
    var inline = takesInlineStyle(node, kind);
    var accordion = element("div", { "class": "accordion ge-inline-style" });
    var fields = [];
    var catalogs = [];
    var notes = [];
    var custom = null;
    var customItem = null;
    var changed = function() {
      render();
    };
    function item(key, labelKey) {
      var entry = accordion.appendChild(element("div", { "class": "accordion-item", "data-ge-inline-style-section": key }));
      var header = entry.appendChild(element("h2", { "class": "accordion-header" }));
      var button = header.appendChild(element("button", {
        type: "button",
        "class": "accordion-button collapsed",
        "aria-expanded": "false"
      }, ge.t(labelKey)));
      var collapse = entry.appendChild(element("div", { "class": "accordion-collapse collapse" }));
      var body = collapse.appendChild(element("div", { "class": "accordion-body" }));
      button.addEventListener("click", function() {
        var opening = !hasClass(collapse, "show");
        context.state.open = opening ? key : null;
        context.opened(context.state.open);
      });
      return { entry, body };
    }
    function toggle2(entry, shown) {
      toggleClass(one(entry, ".accordion-collapse"), "show", shown);
      var button = one(entry, ".accordion-button");
      toggleClass(button, "collapsed", !shown);
      button.setAttribute("aria-expanded", shown ? "true" : "false");
    }
    Object.keys(context.sections).forEach(function(key) {
      var resolved = context.sections[key];
      var section2 = resolved.section;
      if (section2.custom) {
        if (inline) {
          customItem = item(key, section2.labelKey);
        }
        return;
      }
      var parts = section2.parts.map(function(name) {
        return context.parts[name] ? partContent(ge, context.parts[name], node, kind) : null;
      }).filter(Boolean);
      var properties = inline ? resolved.properties.filter(function(property) {
        return offeredOn(property, kind);
      }) : [];
      var catalog = inline && resolved.catalog ? createCatalog(ge, node, kind, section2.catalog) : null;
      if (!parts.length && !properties.length && !catalog) {
        return;
      }
      var body = item(key, section2.labelKey).body;
      parts.forEach(function(part) {
        body.appendChild(addClass(part, "ge-inline-style-part"));
      });
      if (properties.length) {
        var note = body.appendChild(element("small", { "class": "ge-inline-style-note ge-inline-style-all-sizes" }, ge.t("inline_style.all_sizes")));
        notes.push(note);
        var grid = body.appendChild(element("div", { "class": "ge-inline-style-fields" }));
        properties.forEach(function(property) {
          var field = createStyleField(ge, node, property, changed);
          fields.push(field);
          grid.appendChild(field);
        });
      }
      if (catalog) {
        catalogs.push(catalog);
        body.appendChild(catalog);
      }
    });
    if (customItem) {
      custom = createCustom(ge, node, fields.map(function(field) {
        return field.getAttribute("data-ge-inline-style-property");
      }), changed);
      customItem.body.appendChild(custom.element);
      accordion.appendChild(customItem.entry);
    }
    if (!accordion.children.length) {
      return null;
    }
    function open(key) {
      all(accordion, ".accordion-item").forEach(function(entry) {
        toggle2(entry, entry.getAttribute("data-ge-inline-style-section") === key);
      });
    }
    open(context.state.open);
    function render() {
      fields.forEach(renderStyleField);
      catalogs.forEach(function(catalog) {
        renderCatalog(catalog, node);
      });
      if (custom) {
        custom.render();
      }
      notes.forEach(function(note) {
        toggle(note, ge.view() !== "all");
      });
    }
    render();
    return { element: accordion, render, open };
  }

  // src/js/plugins/grideditor.inline-style.js
  Object.assign(GridEditor.locales.en, {
    "inline_style.section_title": "Style",
    "inline_style.dialog_title": "Style: {kind}",
    "inline_style.section_size": "Size",
    "inline_style.section_spacing": "Spacing",
    "inline_style.section_border": "Border",
    "inline_style.section_background": "Background",
    "inline_style.section_text": "Text",
    "inline_style.section_typography": "Typography",
    "inline_style.section_display": "Display",
    "inline_style.section_flex": "Flex",
    "inline_style.section_position": "Position",
    "inline_style.section_custom": "Custom css",
    "inline_style.all_sizes": "Applies to every size",
    "inline_style.overridden": "The class {class} takes priority over this value",
    "inline_style.invalid": "Not a value this property takes",
    "inline_style.catalog": "Bootstrap classes",
    "inline_style.shadow_x": "X",
    "inline_style.shadow_y": "Y",
    "inline_style.shadow_blur": "Blur",
    "inline_style.shadow_spread": "Spread",
    "inline_style.shadow_color": "Color",
    "inline_style.shadow_inset": "Inset",
    "inline_style.shadow_text_mode": "Edit as text",
    "inline_style.prop_width": "Width",
    "inline_style.prop_height": "Height",
    "inline_style.prop_min_width": "Min width",
    "inline_style.prop_min_height": "Min height",
    "inline_style.prop_max_width": "Max width",
    "inline_style.prop_max_height": "Max height",
    "inline_style.prop_margin_top": "Margin top",
    "inline_style.prop_margin_right": "Margin right",
    "inline_style.prop_margin_bottom": "Margin bottom",
    "inline_style.prop_margin_left": "Margin left",
    "inline_style.prop_padding_top": "Padding top",
    "inline_style.prop_padding_right": "Padding right",
    "inline_style.prop_padding_bottom": "Padding bottom",
    "inline_style.prop_padding_left": "Padding left",
    "inline_style.prop_border_width": "Border width",
    "inline_style.prop_border_style": "Border style",
    "inline_style.prop_border_color": "Border color",
    "inline_style.prop_border_radius": "Border radius",
    "inline_style.prop_box_shadow": "Shadow",
    "inline_style.prop_background_color": "Background color",
    "inline_style.prop_background_image": "Background image",
    "inline_style.prop_background_size": "Background size",
    "inline_style.prop_background_position": "Background position",
    "inline_style.prop_background_repeat": "Background repeat",
    "inline_style.prop_color": "Color",
    "inline_style.prop_font_size": "Font size",
    "inline_style.prop_text_align": "Text align",
    "inline_style.prop_text_shadow": "Text shadow",
    "inline_style.prop_font_family": "Font family",
    "inline_style.prop_font_weight": "Font weight",
    "inline_style.prop_font_style": "Font style",
    "inline_style.prop_line_height": "Line height",
    "inline_style.prop_letter_spacing": "Letter spacing",
    "inline_style.prop_text_transform": "Text transform",
    "inline_style.prop_text_decoration": "Text decoration",
    "inline_style.prop_display": "Display",
    "inline_style.prop_opacity": "Opacity",
    "inline_style.prop_overflow": "Overflow",
    "inline_style.prop_visibility": "Visibility",
    "inline_style.prop_position": "Position",
    "inline_style.prop_top": "Top",
    "inline_style.prop_right": "Right",
    "inline_style.prop_bottom": "Bottom",
    "inline_style.prop_left": "Left",
    "inline_style.prop_z_index": "Z-index"
  });
  var PARTS = ["spacing", "textalign", "display", "flex", "float", "sticky", "drawerflow"];
  GridEditor.utilities["inline-style"] = function(ge) {
    var options = resolveOptions(ge);
    var parts = {
      spacing: spacingPart(ge, options.spacing),
      textalign: textalignPart(ge),
      display: displayPart(ge, options.visibility),
      flex: flexPart(ge, options.spacing),
      float: floatPart(ge),
      sticky: stickyPart(ge),
      drawerflow: drawerflowPart(ge)
    };
    var accordions = [];
    var context = {
      sections: options.sections,
      parts,
      state: { open: null },
      opened: function(key) {
        accordions.forEach(function(entry) {
          entry.accordion.open(key);
        });
      }
    };
    function each2(hook) {
      return function() {
        var args = arguments;
        PARTS.forEach(function(name) {
          if (parts[name][hook]) {
            parts[name][hook].apply(null, args);
          }
        });
      };
    }
    var partsRefresh = each2("onRefresh");
    return {
      // The parts' families, edited in the sections rather than in Responsive
      families: PARTS.reduce(function(all2, name) {
        return all2.concat(parts[name].families.map(function(family) {
          return Object.assign({}, family, { panel: false });
        }));
      }, []),
      panelSection: function(node, kind) {
        var accordion = createAccordion(ge, node, kind, context);
        if (!accordion) {
          return null;
        }
        accordions.push({ node, accordion });
        return { labelKey: "inline_style.section_title", titleKey: "inline_style.dialog_title", body: accordion.element };
      },
      preview: function(node, kind, breakpoint) {
        return parts.spacing.preview(node, kind, breakpoint);
      },
      // After a write, a change of classes or of view: the accordions of
      // the nodes it touched follow
      onRefresh: function(scope) {
        partsRefresh(scope);
        accordions = accordions.filter(function(entry) {
          return entry.accordion.element.isConnected;
        });
        accordions.forEach(function(entry) {
          if (entry.node === scope || scope.contains(entry.node)) {
            entry.accordion.render();
          }
        });
      },
      drawerTools: each2("drawerTools"),
      onDeinit: function() {
        each2("onDeinit")();
        accordions = [];
      }
    };
  };
})();
