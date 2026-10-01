(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/dom.js
  function one(root, selector) {
    return root ? root.querySelector(selector) : null;
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
  function hasClass(node, name) {
    return !!node && node.nodeType === 1 && node.classList.contains(name);
  }
  function split(names) {
    return String(names || "").split(/\s+/).filter(Boolean);
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
  function slideUp(node, duration, done) {
    if (typeof duration === "function") {
      done = duration;
      duration = void 0;
    }
    node.style.overflow = "hidden";
    animateAway(node, function(style) {
      return [
        {
          height: style.height,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom
        },
        { height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px" }
      ];
    }, duration, function() {
      node.style.removeProperty("overflow");
      if (done) {
        done();
      }
    });
  }

  // src/js/plugins/grideditor.sections.js
  Object.assign(GridEditor.locales.en, {
    "section.add": "Section",
    "section.width": "Width",
    "section.fixed": "Fixed",
    "section.fluid": "Full width",
    "section.from": "Fixed from {breakpoint}",
    "tool.add_row_to_section": "Add row",
    "tool.delete_section": "Remove section",
    "confirm.delete_section": "Delete this section and everything in it?"
  });
  var WIDTHS = {
    fixed: "container",
    fluid: "container-fluid",
    sm: "container-sm",
    md: "container-md",
    lg: "container-lg",
    xl: "container-xl",
    xxl: "container-xxl"
  };
  var ORDER = ["fixed", "sm", "md", "lg", "xl", "xxl", "fluid"];
  GridEditor.features.sections = function(ge) {
    var options = Object.assign({ widths: ORDER }, ge.settings.sections);
    function widthOf(section) {
      var found = null;
      Object.keys(WIDTHS).forEach(function(width) {
        if (!found && hasClass(section, WIDTHS[width])) {
          found = width;
        }
      });
      return found;
    }
    function isSection(node) {
      return node.parentElement === ge.canvas && widthOf(node) !== null;
    }
    function sections() {
      return children(ge.canvas).filter(isSection);
    }
    function label(width) {
      if (width === "fixed") {
        return ge.t("section.fixed");
      }
      if (width === "fluid") {
        return ge.t("section.fluid");
      }
      return ge.t("section.from", { breakpoint: width });
    }
    function setWidth(section, width, source) {
      var from = widthOf(section);
      if (from === width || !WIDTHS[width]) {
        return false;
      }
      return ge.operate(function() {
        var payload = ge.payloadFor("section", section, {
          family: "section",
          breakpoint: "all",
          tiers: [],
          from,
          to: width,
          source: source || "api"
        });
        if (!ge.emit("before-utility", payload)) {
          var select = one(ge.detailsOf(section), ".ge-section-width select");
          if (select) {
            select.value = from;
          }
          return false;
        }
        removeClass(section, WIDTHS[from]);
        addClass(section, WIDTHS[width]);
        ge.emit("after-utility", payload);
        return true;
      });
    }
    function widthField(section) {
      var select = element("select", { "class": "form-select form-select-sm" });
      var current = widthOf(section);
      var offered = options.widths.indexOf(current) === -1 ? options.widths.concat([current]) : options.widths;
      ORDER.forEach(function(width) {
        if (offered.indexOf(width) === -1) {
          return;
        }
        select.appendChild(element("option", { value: width }, label(width)));
      });
      select.value = current;
      select.addEventListener("change", function() {
        setWidth(section, this.value, "panel");
      });
      var field = element("label", { "class": "ge-utility ge-section-width" });
      field.appendChild(element("span", { "class": "ge-utility-label" }, ge.t("section.width")));
      field.appendChild(select);
      return field;
    }
    function createControls(section) {
      var drawer = element("div", { "class": "ge-tools-drawer ge-section-drawer" });
      section.insertBefore(drawer, section.firstChild);
      ge.createMoveTool(drawer);
      ge.addSettingsTool(drawer, section, ge.settings.section_classes || []).appendChild(widthField(section));
      ge.createTool(drawer, ge.t("tool.delete_section"), "ge-delete-section", "bi bi-trash", function() {
        ge.deleteNode("section", section, ge.t("confirm.delete_section"), function(removed) {
          slideUp(section, removed);
        });
      });
      ge.createTool(drawer, ge.t("tool.add_row_to_section"), "ge-add-row", "bi bi-plus-circle", function() {
        ge.place(ge.rowFromLayout([12]), "row", { appendTo: section });
      });
    }
    function mark() {
      sections().forEach(function(section) {
        addClass(section, "ge-section");
        if (!child(section, ".ge-tools-drawer")) {
          createControls(section);
        }
      });
    }
    function unmark() {
      children(ge.canvas, ".ge-section").forEach(function(section) {
        removeClass(section, "ge-section");
      });
    }
    function createSection(settings) {
      settings = settings || {};
      var section = element("div", { "class": WIDTHS[settings.width] || WIDTHS.fixed });
      (settings.rows || [[12]]).forEach(function(layout) {
        section.appendChild(ge.rowFromLayout(layout));
      });
      return ge.place(section, "section", settings);
    }
    return {
      methods: {
        createSection
      },
      kindOf: function(node) {
        return hasClass(node, "ge-section") ? "section" : null;
      },
      // A section is a block the canvas moves, and a region rows move in
      blocks: ".ge-section",
      regions: ".ge-section",
      /** A section goes on the canvas and nowhere else, and holds rows and nothing else. */
      accepts: function(region, node) {
        if (hasClass(node, "ge-section") || isSectionMade(node)) {
          return region === ge.canvas;
        }
        if (hasClass(region, "ge-section")) {
          return hasClass(node, "row");
        }
        return true;
      },
      toolbar: [{
        labelKey: "section.add",
        kind: "section",
        group: "content",
        create: function() {
          return createSection();
        }
      }],
      onInit: mark,
      onDeinit: unmark
    };
    function isSectionMade(node) {
      return !node.parentElement && widthOf(node) !== null;
    }
  };
})();
