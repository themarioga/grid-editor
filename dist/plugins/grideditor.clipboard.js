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

  // src/js/plugins/grideditor.clipboard.js
  Object.assign(GridEditor.locales.en, {
    "tool.copy": "Copy",
    "tool.cut": "Cut",
    "tool.paste": "Paste",
    "clipboard.paste_row": "Paste row",
    "clipboard.paste_section": "Paste section"
  });
  var STORAGE_ITEM = "grideditor.clipboard";
  var CHANGE = "grideditor-clipboard";
  var VERSION = 1;
  var memory = null;
  var TARGETS = {
    column: ["row", "text", "container", "element"],
    row: ["column"],
    section: ["row"]
  };
  function read() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_ITEM);
    } catch (error) {
      return memory;
    }
    if (raw === null) {
      return memory;
    }
    try {
      var clip = JSON.parse(raw);
      return clip && clip.version === VERSION && clip.html ? clip : null;
    } catch (error) {
      return null;
    }
  }
  function write(clip) {
    try {
      window.localStorage.setItem(STORAGE_ITEM, JSON.stringify(clip));
      memory = null;
    } catch (error) {
      memory = clip;
    }
    announce();
  }
  function announce() {
    document.dispatchEvent(new CustomEvent(CHANGE));
  }
  window.addEventListener("storage", function(e) {
    if (e.key === STORAGE_ITEM) {
      announce();
    }
  });
  var listeningEditors = [];
  var lastEditor = null;
  function track(e) {
    lastEditor = listeningEditors.filter(function(ge) {
      return ge.contains(e.target);
    })[0] || null;
  }
  document.addEventListener("pointerdown", track, true);
  document.addEventListener("focusin", track, true);
  function shortcutKey(e) {
    var key = (e.key || "").toLowerCase();
    if (!/^[a-z]$/.test(key)) {
      key = { KeyC: "c", KeyX: "x", KeyV: "v" }[e.code] || "";
    }
    return key === "c" || key === "x" || key === "v" ? key : null;
  }
  function typing() {
    var focus = document.activeElement;
    return !!focus && (is(focus, "input, textarea, select") || focus.isContentEditable);
  }
  function textSelected() {
    var selection = window.getSelection ? window.getSelection() : null;
    return !!selection && !selection.isCollapsed && selection.toString() !== "";
  }
  GridEditor.features.clipboard = function(ge) {
    var shown = null;
    var listening = false;
    var shortcuts = shortcutsSetting();
    function used(name) {
      return !ge.settings.plugins || ge.settings.plugins.indexOf(name) !== -1;
    }
    function available(clip) {
      if (clip.category === "container") {
        return !!GridEditor.containers[clip.kind] && used(clip.kind);
      }
      if (clip.category === "section") {
        return !!GridEditor.features.sections && used("sections");
      }
      if (clip.category === "element") {
        return !!GridEditor.features.elements && used("elements");
      }
      return true;
    }
    function fits(clip, categories) {
      return !!clip && categories.indexOf(clip.category) !== -1 && available(clip);
    }
    function categoryOf(kind) {
      if (GridEditor.containers[kind]) {
        return "container";
      }
      return ["row", "column", "section", "text", "element"].indexOf(kind) !== -1 ? kind : null;
    }
    function shortcutsSetting() {
      var wanted = (ge.settings.clipboard || {}).shortcuts;
      var target = !!ge.settings.active_target;
      if (wanted !== void 0 && typeof wanted !== "boolean") {
        ge.warn("clipboard.shortcuts is true or false: " + (target ? "on" : "off") + ", as with active_target, is used");
        wanted = void 0;
      }
      if (wanted === void 0) {
        return target;
      }
      if (wanted && !target) {
        ge.warn('clipboard.shortcuts needs active_target, or settings_panel "sidebar": without it, Ctrl+C, Ctrl+X and Ctrl+V do nothing');
        return false;
      }
      return wanted;
    }
    function keep(node, kind, source, removing) {
      write({ version: VERSION, category: categoryOf(kind), kind, html: ge.nodeHtml(node) });
      ge.emit("after-copy", ge.payloadFor(kind, node, { source: source || "tool", cut: removing }));
    }
    function copy(node, kind, source) {
      keep(node, kind, source, false);
      var tool = child(ge.drawerOf(node), ".ge-copy");
      if (!tool) {
        return;
      }
      var icon = one(tool, "i");
      addClass(tool, "ge-copied");
      if (icon) {
        icon.setAttribute("class", "bi bi-check2");
      }
      setTimeout(function() {
        removeClass(tool, "ge-copied");
        if (icon) {
          icon.setAttribute("class", "bi bi-copy");
        }
      }, 1200);
    }
    function cut(node, kind, source) {
      return ge.removeNode(node, {
        source: "cut",
        confirm: false,
        before: function() {
          keep(node, kind, source, true);
          var target = ge.getActiveTarget();
          if (source !== "tool" && !(target && node.contains(target))) {
            return;
          }
          var parent = node.parentElement;
          while (parent && parent !== ge.canvas && !ge.detailsOf(parent)) {
            parent = parent.parentElement;
          }
          ge.setActiveTarget(parent && parent !== ge.canvas ? parent : null);
        }
      });
    }
    function paste(target, categories) {
      var clip = read();
      if (!fits(clip, categories)) {
        return;
      }
      ge.place(ge.freshNode(clip.html), clip.kind, { appendTo: target, source: "paste" });
    }
    function pasteByShortcut() {
      var clip = read();
      if (!clip || !ge.getActiveTarget() || !available(clip)) {
        return false;
      }
      var made = ge.placeInTarget(ge.freshNode(clip.html), clip.kind, "paste");
      if (made && made.scrollIntoView) {
        made.scrollIntoView({ behavior: "smooth" });
      }
      return true;
    }
    function copyByShortcut() {
      if (textSelected()) {
        return false;
      }
      var node = ge.getActiveTarget();
      var kind = node && ge.kindOf(node);
      if (!kind || !categoryOf(kind)) {
        return false;
      }
      copy(node, kind, "shortcut");
      return true;
    }
    function cutByShortcut() {
      if (textSelected()) {
        return false;
      }
      var node = ge.getActiveTarget();
      var kind = node && ge.kindOf(node);
      if (!kind || !categoryOf(kind)) {
        return false;
      }
      return cut(node, kind, "shortcut");
    }
    function onKeydown(e) {
      if (lastEditor !== ge || e.repeat || e.shiftKey || e.altKey || !(e.ctrlKey || e.metaKey)) {
        return;
      }
      var key = shortcutKey(e);
      if (!key || !hasClass(ge.canvas, "ge-editing") || typing() || ge.panelOpen()) {
        return;
      }
      var acted = { c: copyByShortcut, x: cutByShortcut, v: pasteByShortcut }[key]();
      if (acted) {
        e.preventDefault();
      }
    }
    function listenForShortcuts(on) {
      var at = listeningEditors.indexOf(ge);
      if (on && at === -1) {
        listeningEditors.push(ge);
        document.addEventListener("keydown", onKeydown);
      } else if (!on && at !== -1) {
        listeningEditors.splice(at, 1);
        document.removeEventListener("keydown", onKeydown);
      }
    }
    function refresh() {
      var clip = read();
      all(ge.canvas, ".ge-paste").forEach(function(tool) {
        toggle(tool, fits(clip, tool.getAttribute("data-ge-paste").split(" ")));
      });
      ge.toolbarItems("clipboard").forEach(function(button) {
        var item = TOOLBAR[parseInt(button.getAttribute("data-ge-item"), 10)];
        toggle(button, fits(clip, [item.kind]));
      });
      shown = clip;
    }
    var TOOLBAR = [
      { kind: "row", labelKey: "clipboard.paste_row" },
      { kind: "section", labelKey: "clipboard.paste_section" }
    ].map(function(item) {
      return Object.assign(item, {
        iconClass: "bi bi-clipboard-plus",
        // On the right, as an icon: pasting is not one of the things
        // the add buttons make
        align: "end",
        source: "paste",
        // A toolbar built again - another plugin's buttons changed -
        // shows only what fits, as refresh would
        hidden: function() {
          return !fits(read(), [item.kind]);
        },
        // What the button showed, even if another tab has copied
        // something else since
        create: function() {
          return ge.freshNode(shown.html);
        }
      });
    });
    return {
      drawerTools: function(drawer, node, kind) {
        if (categoryOf(kind)) {
          ge.createTool(drawer, ge.t("tool.copy"), "ge-copy", "bi bi-copy", function() {
            copy(node, kind);
          });
          ge.createTool(drawer, ge.t("tool.cut"), "ge-cut", "bi bi-scissors", function(e) {
            e.stopPropagation();
            cut(node, kind, "tool");
          });
        }
        var categories = TARGETS[kind];
        if (!categories) {
          return;
        }
        var tool = ge.createTool(drawer, ge.t("tool.paste"), "ge-paste", "bi bi-clipboard-plus", function() {
          paste(node, categories);
        });
        tool.setAttribute("data-ge-paste", categories.join(" "));
        toggle(tool, fits(read(), categories));
      },
      toolbar: TOOLBAR,
      onInit: function() {
        refresh();
        if (!listening) {
          document.addEventListener(CHANGE, refresh);
          listening = true;
        }
        listenForShortcuts(shortcuts);
      },
      onDeinit: function() {
        document.removeEventListener(CHANGE, refresh);
        listening = false;
        listenForShortcuts(false);
      },
      onDestroy: function() {
        if (lastEditor === ge) {
          lastEditor = null;
        }
      },
      // Nothing of its own on the canvas: the tools are in the drawers
      cleanMarkup: function() {
      }
    };
  };
})();
