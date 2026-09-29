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
    return Array.prototype.filter.call(node.children, function(each) {
      return !selector || each.matches(selector);
    });
  }
  function child(node, selector) {
    return children(node, selector)[0] || null;
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
  function fadeOut(node, duration, done) {
    animateAway(node, function(style) {
      return [{ opacity: style.opacity }, { opacity: 0 }];
    }, duration, done);
  }

  // src/js/plugins/grideditor.tabs.js
  Object.assign(GridEditor.locales.en, {
    "container.add_tabs": "Tabs",
    "container.add_tab": "Add tab",
    "container.tab_label": "Tab {number}",
    "confirm.delete_tab": "Delete this tab and everything in it?",
    "container.tabs_section": "Tabs",
    "container.tabs_style": "Style",
    "container.tabs_style_tabs": "Tabs",
    "container.tabs_style_pills": "Pills",
    "container.tabs_style_underline": "Underline",
    "container.tabs_width": "Width",
    "container.tabs_width_natural": "Natural",
    "container.tabs_width_fill": "Fill",
    "container.tabs_width_justified": "Justified",
    "container.tabs_align": "Alignment",
    "container.tabs_align_start": "Start",
    "container.tabs_align_center": "Center",
    "container.tabs_align_end": "End",
    "container.tabs_layout": "Layout",
    "container.tabs_layout_horizontal": "Horizontal",
    "container.tabs_layout_vertical": "Vertical",
    "container.tabs_layout_vertical_from": "Vertical from {breakpoint}"
  });
  var STYLES = { tabs: "nav-tabs", pills: "nav-pills", underline: "nav-underline" };
  var WIDTHS = { natural: null, fill: "nav-fill", justified: "nav-justified" };
  var ALIGNS = { start: null, center: "justify-content-center", end: "justify-content-end" };
  var DEFAULTS = { variant: "tabs", width: "natural", align: "start", vertical: false };
  var FIELDS = {
    variant: { labelKey: "container.tabs_style", choices: [
      { value: "tabs", labelKey: "container.tabs_style_tabs" },
      { value: "pills", labelKey: "container.tabs_style_pills" },
      { value: "underline", labelKey: "container.tabs_style_underline" }
    ] },
    width: { labelKey: "container.tabs_width", choices: [
      { value: "natural", labelKey: "container.tabs_width_natural" },
      { value: "fill", labelKey: "container.tabs_width_fill" },
      { value: "justified", labelKey: "container.tabs_width_justified" }
    ] },
    align: { labelKey: "container.tabs_align", choices: [
      { value: "start", labelKey: "container.tabs_align_start" },
      { value: "center", labelKey: "container.tabs_align_center" },
      { value: "end", labelKey: "container.tabs_align_end" }
    ] },
    vertical: { labelKey: "container.tabs_layout" }
  };
  var fieldCounter = 0;
  var LAYOUT_ATTR = "data-ge-tabs-layout";
  function classValues(map) {
    return Object.keys(map).map(function(key) {
      return map[key];
    }).filter(Boolean);
  }
  GridEditor.containers.tabs = function(ge) {
    var sections = [];
    function stripOf(container) {
      return child(container, ".nav");
    }
    function fromBreakpoints() {
      return ge.breakpoints.slice(1);
    }
    function infix(vertical) {
      return vertical === true ? "" : "-" + vertical;
    }
    function verticalClasses(vertical) {
      var at = infix(vertical);
      return {
        container: ["d" + at + "-flex", "align-items" + at + "-start"],
        strip: ["flex" + at + "-column", "me" + at + "-3"]
      };
    }
    function verticals() {
      return [true].concat(fromBreakpoints());
    }
    function read(container) {
      var strip = stripOf(container);
      var has = function(node, name) {
        return !!node && hasClass(node, name);
      };
      var found = function(map, fallback) {
        return Object.keys(map).filter(function(key) {
          return map[key] && has(strip, map[key]);
        })[0] || fallback;
      };
      var vertical = verticals().filter(function(each) {
        var classes = verticalClasses(each);
        return has(container, classes.container[0]) && has(strip, classes.strip[0]);
      })[0];
      return {
        variant: found(STYLES, "tabs"),
        width: found(WIDTHS, "natural"),
        align: found(ALIGNS, "start"),
        vertical: vertical === void 0 ? false : vertical
      };
    }
    function write(container, key, value) {
      var strip = stripOf(container);
      if (!strip) {
        return;
      }
      if (key === "variant") {
        removeClass(strip, classValues(STYLES).join(" "));
        addClass(strip, STYLES[value]);
      }
      if (key === "width" || key === "vertical") {
        removeClass(strip, classValues(WIDTHS).join(" "));
        if (key === "width" && WIDTHS[value]) {
          addClass(strip, WIDTHS[value]);
        }
      }
      if (key === "align" || key === "vertical" || key === "width" && value !== "natural") {
        removeClass(strip, classValues(ALIGNS).join(" "));
        if (key === "align" && ALIGNS[value]) {
          addClass(strip, ALIGNS[value]);
        }
      }
      if (key === "vertical") {
        verticals().forEach(function(each) {
          var classes = verticalClasses(each);
          removeClass(container, classes.container.join(" "));
          removeClass(strip, classes.strip.join(" "));
        });
        strip.removeAttribute("aria-orientation");
        if (value !== false) {
          var layout = verticalClasses(value);
          addClass(container, layout.container.join(" "));
          addClass(strip, layout.strip.join(" "));
          strip.setAttribute("aria-orientation", "vertical");
        }
      }
      dropEmptyClass(container);
    }
    function valuesOf(key) {
      if (key === "variant") {
        return Object.keys(STYLES);
      }
      if (key === "width") {
        return Object.keys(WIDTHS);
      }
      if (key === "align") {
        return Object.keys(ALIGNS);
      }
      return [false].concat(verticals());
    }
    function chosen(options, key) {
      var setting = ge.settings.tabs || {};
      var value = options[key] !== void 0 ? options[key] : setting[key];
      if (value === void 0) {
        return DEFAULTS[key];
      }
      if (valuesOf(key).indexOf(value) !== -1) {
        return value;
      }
      ge.warn("tabs: " + JSON.stringify(value) + " is not a " + key + ", which takes " + JSON.stringify(valuesOf(key)) + ": " + JSON.stringify(DEFAULTS[key]) + " is used");
      return DEFAULTS[key];
    }
    function layoutHere(container) {
      var vertical = read(container).vertical;
      if (vertical === false) {
        return null;
      }
      if (ge.view() === "all") {
        container.removeAttribute(LAYOUT_ATTR);
        return /flex$/.test(getComputedStyle(container).display) ? "vertical" : "horizontal";
      }
      if (vertical === true) {
        return "vertical";
      }
      return ge.breakpoints.indexOf(ge.view()) >= ge.breakpoints.indexOf(vertical) ? "vertical" : "horizontal";
    }
    function markLayout(container) {
      var layout = layoutHere(container);
      if (layout) {
        container.setAttribute(LAYOUT_ATTR, layout);
      } else {
        container.removeAttribute(LAYOUT_ATTR);
      }
    }
    function select(labelKey, options, onChange) {
      var box = element("div", { "class": "ge-tabs-variant" });
      var id = "ge-tabs-variant-" + ++fieldCounter;
      box.appendChild(element("label", { "class": "form-label", "for": id }, ge.t(labelKey)));
      var field = box.appendChild(element("select", { "class": "form-select form-select-sm", id }));
      options.forEach(function(option) {
        field.appendChild(element("option", { value: option.value }, option.label));
      });
      field.addEventListener("change", function() {
        onChange(field.value);
      });
      return { box, field };
    }
    function createSection(container) {
      var body = element("div", { "class": "ge-tabs-variants" });
      var fields = {};
      function change(key, value) {
        write(container, key, value);
        markLayout(container);
        render();
      }
      function options(key) {
        return FIELDS[key].choices.map(function(choice) {
          return { value: choice.value, label: ge.t(choice.labelKey) };
        });
      }
      ["variant", "width", "align"].forEach(function(key) {
        fields[key] = select(FIELDS[key].labelKey, options(key), function(value) {
          change(key, value);
        });
      });
      fields.vertical = select(FIELDS.vertical.labelKey, [
        { value: "false", label: ge.t("container.tabs_layout_horizontal") },
        { value: "true", label: ge.t("container.tabs_layout_vertical") }
      ].concat(fromBreakpoints().map(function(key) {
        return { value: key, label: ge.t("container.tabs_layout_vertical_from", { breakpoint: key }) };
      })), function(value) {
        change("vertical", value === "true" ? true : value === "false" ? false : value);
      });
      ["variant", "width", "align", "vertical"].forEach(function(key) {
        fields[key].box.setAttribute("data-ge-tabs-variant", key);
        body.appendChild(fields[key].box);
      });
      function render() {
        var values = read(container);
        fields.variant.field.value = values.variant;
        fields.width.field.value = values.width;
        fields.align.field.value = values.align;
        fields.vertical.field.value = String(values.vertical);
        fields.width.field.disabled = values.vertical !== false;
        fields.align.field.disabled = values.vertical !== false || values.width !== "natural";
      }
      render();
      sections.push({ container, element: body, render });
      return body;
    }
    function addTabTo(container, options) {
      options = options || {};
      var strip = stripOf(container);
      var content = one(container, ":scope > .tab-content");
      var id = ge.containerId("tab");
      var number = children(strip, ".nav-item").length + 1;
      var tab = strip.appendChild(element("li", { "class": "nav-item ge-tab", role: "presentation" }));
      var button = tab.appendChild(element("button", {
        "class": "nav-link",
        type: "button",
        role: "tab",
        "data-bs-toggle": "tab",
        "data-bs-target": "#" + id,
        "aria-controls": id
      }));
      button.appendChild(element(
        "span",
        { "class": "ge-pane-label" },
        options.label || ge.t("container.tab_label", { number })
      ));
      var pane = content.appendChild(element("div", {
        "class": "tab-pane fade",
        role: "tabpanel",
        tabindex: "0",
        id
      }));
      pane.appendChild(ge.defaultRegion());
      if (options.activate || number === 1) {
        activatePane(container, pane);
      }
      return pane;
    }
    function activatePane(container, pane) {
      var id = pane.getAttribute("id");
      all(container, ":scope > .tab-content > .tab-pane").forEach(function(each) {
        removeClass(each, "show active");
      });
      addClass(pane, "show active");
      all(stripOf(container) || container, ".nav-link").forEach(function(button) {
        var active = button.getAttribute("data-bs-target") === "#" + id;
        toggleClass(button, "active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    function paneOf(container, tab) {
      var link = one(tab, ".nav-link");
      var target = link ? link.getAttribute("data-bs-target") : null;
      return target ? one(container, target) : null;
    }
    return {
      labelKey: "container.add_tabs",
      // A tab strip sorts its own tabs, and the panes follow them. No
      // group: a tab belongs to the strip it was made in.
      onSortable: function(sortable) {
        sortable(all(ge.canvas, ".ge-container-tabs").map(stripOf).filter(Boolean), {
          draggable: ".ge-tab"
        });
      },
      addPaneKey: "container.add_tab",
      paneKind: "tab",
      create: function(options) {
        var container = element("div", { "data-ge-container": "tabs" });
        var labels = options.labels || [];
        var count = options.tabs || labels.length || 2;
        container.appendChild(element("ul", { "class": "nav nav-tabs", role: "tablist" }));
        container.appendChild(element("div", { "class": "tab-content" }));
        ["variant", "width", "align", "vertical"].forEach(function(key) {
          write(container, key, chosen(options, key));
        });
        for (var i = 0; i < count; i++) {
          addTabTo(container, { label: labels[i] });
        }
        return container;
      },
      addPane: addTabTo,
      mark: function(container) {
        all(container, ":scope > .tab-content > .tab-pane").forEach(function(pane) {
          addClass(pane, "ge-tab-pane");
        });
        children(stripOf(container) || container, ".nav-item").forEach(function(tab) {
          addClass(tab, "ge-tab");
          var link = one(tab, ".nav-link");
          if (link) {
            ge.makeLabelEditable(ge.labelIn(link));
          }
          if (child(tab, ".ge-tools-drawer")) {
            return;
          }
          ge.createPaneControls(
            tab,
            "tab",
            ge.settings.tab_tools,
            ge.t("confirm.delete_tab"),
            function(removed) {
              var pane = paneOf(container, tab);
              var wasActive = hasClass(pane, "active");
              fadeOut(tab, 200, function() {
                if (pane) {
                  pane.remove();
                }
                removed();
                var first = one(container, ":scope > .tab-content > .tab-pane");
                if (wasActive && first) {
                  activatePane(container, first);
                }
              });
            }
          );
        });
      },
      unmark: function(container) {
        ge.resumeToggles(container);
        container.removeAttribute(LAYOUT_ATTR);
        all(container, ".ge-tab-pane").forEach(function(pane) {
          removeClass(pane, "ge-tab-pane");
        });
        ge.unwrapLabels(container);
      },
      panelSection: function(node, kind) {
        if (kind !== "tabs" || !stripOf(node)) {
          return null;
        }
        return { labelKey: "container.tabs_section", body: createSection(node) };
      },
      // After a view change or a change of classes: the layout marks and the
      // sections follow
      onRefresh: function(scope) {
        selfAndAll(scope, '[data-ge-container="tabs"]').forEach(markLayout);
        sections = sections.filter(function(entry) {
          return entry.element.isConnected;
        });
        sections.forEach(function(entry) {
          if (entry.container === scope || scope.contains(entry.container)) {
            entry.render();
          }
        });
      },
      onDeinit: function() {
        sections = [];
      },
      /** Panes read in tab order, whatever order they were dropped in. */
      afterPaneMove: function(container) {
        var content = one(container, ":scope > .tab-content");
        children(stripOf(container) || container, ".nav-item").forEach(function(tab) {
          var pane = paneOf(container, tab);
          if (pane) {
            content.appendChild(pane);
          }
        });
      }
    };
  };
})();
