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
  function is(node, selector) {
    return !!node && node.nodeType === 1 && node.matches(selector);
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

  // src/js/plugins/grideditor.history.js
  Object.assign(GridEditor.locales.en, {
    "history.undo": "Undo",
    "history.redo": "Redo"
  });
  var DEFAULT_MAX = 50;
  var DEFAULT_DELAY = 500;
  var FURNITURE = ".ge-tools-drawer, .ge-drop-marker";
  var BUSY = ".ge-drag-chosen, .ge-drag-placeholder, .ge-drag-helper, .ge-resizing";
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
      key = { KeyZ: "z", KeyY: "y" }[e.code] || "";
    }
    return key === "z" || key === "y" ? key : null;
  }
  function typing() {
    var focus = document.activeElement;
    return !!focus && (is(focus, "input, textarea, select") || focus.isContentEditable);
  }
  function contentOf(parent) {
    return children(parent).filter(function(child) {
      return !is(child, FURNITURE);
    });
  }
  GridEditor.features.history = function(ge) {
    var options = optionsFrom(ge.settings.history || {});
    var stack = [];
    var index = -1;
    var shown = { canUndo: false, canRedo: false };
    var timer = null;
    var observer = null;
    var observing = false;
    var initiated = false;
    var started = false;
    var sourceOpen = false;
    var destroyed = false;
    function optionsFrom(given) {
      var result = {
        shortcuts: given.shortcuts === void 0 ? true : given.shortcuts,
        buttons: given.buttons === void 0 ? true : given.buttons,
        max: given.max === void 0 ? DEFAULT_MAX : given.max,
        delay: given.delay === void 0 ? DEFAULT_DELAY : given.delay
      };
      ["shortcuts", "buttons"].forEach(function(name) {
        if (typeof result[name] !== "boolean") {
          ge.warn("history." + name + " is true or false: true is used");
          result[name] = true;
        }
      });
      if (!Number.isInteger(result.max) || result.max < 1) {
        ge.warn("history.max must be a whole number of steps, 1 or more: " + DEFAULT_MAX + " is used");
        result.max = DEFAULT_MAX;
      }
      if (!Number.isInteger(result.delay) || result.delay < 0) {
        ge.warn("history.delay must be a whole number of milliseconds, 0 or more: " + DEFAULT_DELAY + " is used");
        result.delay = DEFAULT_DELAY;
      }
      return result;
    }
    function observe() {
      observer.observe(ge.canvas, { subtree: true, childList: true, attributes: true, characterData: true });
      observing = true;
    }
    function stopObserving() {
      if (observer) {
        observer.disconnect();
      }
      observing = false;
    }
    function read() {
      var watching = observing;
      if (watching) {
        stopObserving();
      }
      var html = ge.snapshotHtml();
      if (watching) {
        observe();
      }
      return html;
    }
    function editing() {
      return hasClass(ge.canvas, "ge-editing");
    }
    function busy() {
      return hasClass(ge.canvas, "ge-dropping") || !!one(ge.canvas, BUSY);
    }
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(commit, options.delay);
    }
    function pending() {
      return timer !== null && read() !== stack[index];
    }
    function commit() {
      window.clearTimeout(timer);
      timer = null;
      if (!started || destroyed || sourceOpen) {
        return;
      }
      if (busy()) {
        schedule();
        return;
      }
      var html = read();
      if (html === stack[index]) {
        return;
      }
      stack.splice(index + 1);
      stack.push(html);
      if (stack.length > options.max + 1) {
        stack.shift();
      }
      index = stack.length - 1;
      notify();
    }
    function notify() {
      var now = { canUndo: index > 0, canRedo: index < stack.length - 1 };
      var changed = now.canUndo !== shown.canUndo || now.canRedo !== shown.canRedo;
      shown = now;
      paint();
      if (changed) {
        ge.emit("history-change", { canvas: ge.canvas, canUndo: now.canUndo, canRedo: now.canRedo });
      }
    }
    function paint() {
      ge.toolbarItems("history").forEach(function(button) {
        var off = button.getAttribute("data-ge-item") === "0" ? !shown.canUndo : !shown.canRedo;
        toggleClass(button, "disabled", off);
        if (off) {
          button.setAttribute("aria-disabled", "true");
        } else {
          button.removeAttribute("aria-disabled");
        }
      });
    }
    function pathOf(node) {
      if (!node || node === ge.canvas || !ge.canvas.contains(node)) {
        return null;
      }
      var path = [];
      for (var at = node; at !== ge.canvas; at = at.parentElement) {
        path.unshift(contentOf(at.parentElement).indexOf(at));
      }
      return path;
    }
    function resolve(path) {
      if (!path) {
        return null;
      }
      var node = ge.canvas;
      for (var i = 0; i < path.length && node; i++) {
        node = contentOf(node)[path[i]];
      }
      return node || null;
    }
    function go(step, source) {
      if (!started || destroyed || sourceOpen || !editing() || busy()) {
        return false;
      }
      commit();
      var to = index + step;
      if (to < 0 || to >= stack.length) {
        return false;
      }
      var target = pathOf(ge.getActiveTarget());
      stopObserving();
      index = to;
      ge.setHtml(stack[index]);
      stack[index] = ge.snapshotHtml();
      var node = resolve(target);
      if (node) {
        ge.setActiveTarget(node);
      }
      observe();
      notify();
      ge.emit(step < 0 ? "after-undo" : "after-redo", { canvas: ge.canvas, html: stack[index], source });
      return true;
    }
    function onKeydown(e) {
      if (lastEditor !== ge || e.altKey || !(e.ctrlKey || e.metaKey)) {
        return;
      }
      var key = shortcutKey(e);
      if (!key || key === "y" && e.shiftKey) {
        return;
      }
      if (!editing() || typing() || ge.panelOpen()) {
        return;
      }
      if (go(key === "y" || e.shiftKey ? 1 : -1, "shortcut")) {
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
    function start() {
      if (destroyed) {
        return;
      }
      stack = [read()];
      index = 0;
      observer = new MutationObserver(schedule);
      observe();
      started = true;
      notify();
    }
    return {
      toolbar: function() {
        if (!options.buttons) {
          return [];
        }
        return [
          {
            labelKey: "history.undo",
            iconClass: "bi bi-arrow-counterclockwise",
            className: "ge-history-undo",
            align: "end",
            disabled: function() {
              return !shown.canUndo;
            },
            action: function() {
              go(-1, "tool");
            }
          },
          {
            labelKey: "history.redo",
            iconClass: "bi bi-arrow-clockwise",
            className: "ge-history-redo",
            align: "end",
            disabled: function() {
              return !shown.canRedo;
            },
            action: function() {
              go(1, "tool");
            }
          }
        ];
      },
      onInit: function() {
        if (options.shortcuts) {
          listenForShortcuts(true);
        }
        if (initiated) {
          return;
        }
        initiated = true;
        Promise.resolve().then(start);
      },
      // A canvas out of editing leaves the keys to the page: it is read again when it is back
      onDeinit: function() {
        listenForShortcuts(false);
      },
      onSourceOpen: function() {
        sourceOpen = true;
      },
      onSourceClose: function() {
        sourceOpen = false;
      },
      onDestroy: function() {
        destroyed = true;
        window.clearTimeout(timer);
        timer = null;
        stopObserving();
        listenForShortcuts(false);
        if (lastEditor === ge) {
          lastEditor = null;
        }
        stack = [];
      },
      // Nothing of its own on the canvas
      cleanMarkup: function() {
      },
      methods: {
        undo: function() {
          return go(-1, "api");
        },
        redo: function() {
          return go(1, "api");
        },
        // A change waiting for its step counts: it is what an undo would undo
        canUndo: function() {
          return started && !destroyed && (index > 0 || pending());
        },
        // ... and it ends what could be redone
        canRedo: function() {
          return started && !destroyed && index < stack.length - 1 && !pending();
        },
        // What is there is the first step, with nothing before it or after it
        clearHistory: function() {
          if (!started || destroyed) {
            return false;
          }
          window.clearTimeout(timer);
          timer = null;
          stack = [sourceOpen ? stack[index] : read()];
          index = 0;
          notify();
          return true;
        }
      }
    };
  };
})();
