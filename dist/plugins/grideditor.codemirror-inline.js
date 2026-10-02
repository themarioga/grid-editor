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
  function is(node, selector) {
    return !!node && node.nodeType === 1 && node.matches(selector);
  }
  function attached(node) {
    return !!node && document.documentElement.contains(node);
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
  function insertAfter(node, reference) {
    reference.parentNode.insertBefore(node, reference.nextSibling);
    return node;
  }

  // src/js/plugins/grideditor.codemirror-inline.js
  Object.assign(GridEditor.locales.en, {
    "tool.edit_html": "Edit html",
    "codemirror.apply": "Apply",
    "codemirror.cancel": "Cancel"
  });
  var KINDS = ["row", "column", "text", "plain", "element", "section"];
  GridEditor.features["codemirror-inline"] = function(ge) {
    var open = [];
    function options() {
      var own = ge.settings.codemirror && ge.settings.codemirror.config || {};
      return Object.assign({
        mode: "htmlmixed",
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        indentUnit: 2,
        // As tall as what it holds, up to the css's limit
        viewportMargin: Infinity
      }, own);
    }
    function anchorOf(node) {
      var textBlock = node.parentElement;
      return hasClass(textBlock, "ge-text-block") ? textBlock : node;
    }
    function entryOf(node) {
      return open.filter(function(entry) {
        return entry.node === node;
      })[0] || null;
    }
    function editable(node, kind) {
      return KINDS.indexOf(kind) !== -1 || is(node, "[data-ge-container]");
    }
    function show(entry) {
      var anchor = addClass(anchorOf(entry.node), "ge-code-hidden");
      insertAfter(entry.wrapper, anchor);
      if (entry.editor) {
        entry.editor.refresh();
      }
    }
    function hide(entry) {
      entry.wrapper.remove();
      removeClass(anchorOf(entry.node), "ge-code-hidden");
      removeClass(entry.node, "ge-code-hidden");
    }
    function close(entry) {
      hide(entry);
      if (entry.editor) {
        entry.editor.toTextArea();
      }
      entry.wrapper.remove();
      open.splice(open.indexOf(entry), 1);
    }
    function openEditor(node) {
      if (entryOf(node)) {
        return;
      }
      var entry = {
        node,
        kind: ge.kindOf(node),
        // As getHtml gives it: no drawers, no editor open in it
        from: ge.nodeHtml(node),
        // A drawer, to the editor: never content, never a block to move
        wrapper: element("div", { "class": "ge-tools-drawer ge-code-inline" }),
        editor: null
      };
      entry.textarea = entry.wrapper.appendChild(element("textarea", { "class": "ge-code-inline-source" }));
      entry.textarea.value = entry.from;
      var bar = entry.wrapper.appendChild(element("div", { "class": "ge-code-inline-bar" }));
      var applyButton = bar.appendChild(element("button", {
        type: "button",
        "class": "btn btn-sm btn-primary ge-code-apply"
      }, ge.t("codemirror.apply")));
      applyButton.addEventListener("click", function() {
        apply(entry);
      });
      var cancelButton = bar.appendChild(element("button", {
        type: "button",
        "class": "btn btn-sm btn-outline-secondary ge-code-cancel"
      }, ge.t("codemirror.cancel")));
      cancelButton.addEventListener("click", function() {
        close(entry);
      });
      open.push(entry);
      show(entry);
      if (window.CodeMirror) {
        entry.editor = window.CodeMirror.fromTextArea(entry.textarea, options());
        addClass(entry.editor.getWrapperElement(), "ge-code-editor");
        entry.editor.focus();
      } else {
        entry.textarea.focus();
      }
    }
    function apply(entry) {
      var to = entry.editor ? entry.editor.getValue() : entry.textarea.value;
      var payload = ge.payloadFor(entry.kind, entry.node, { source: "tool", from: entry.from, to });
      if (!ge.emit("before-edit-html", payload)) {
        return;
      }
      close(entry);
      var instance = GridEditor.get(ge.canvas);
      instance.deinit();
      var made = parse(to);
      var parent = entry.node.parentElement;
      entry.node.replaceWith.apply(entry.node, made);
      instance.init();
      var written = made.filter(function(node) {
        return node.nodeType === 1;
      });
      var first = written[0] || null;
      ge.emit("after-edit-html", ge.payloadFor(entry.kind, first || entry.node, {
        node: first,
        nodes: written,
        parent: first ? first.parentElement : parent,
        source: "tool",
        from: entry.from,
        to
      }));
    }
    function tool(drawer, node) {
      ge.createTool(drawer, ge.t("tool.edit_html"), "ge-edit-html", "bi bi-code-slash", function() {
        openEditor(node);
      });
    }
    return {
      drawerTools: function(drawer, node, kind) {
        if (editable(node, kind)) {
          tool(drawer, node);
        }
      },
      // Plain content has no gear, and so none of the drawerTools: its
      // html is what there is to edit about it
      plainTools: tool,
      // Every deinit - getHtml's among them - takes the editors off the
      // canvas, whatever is in them, and every init puts them back where
      // their block is. A block that is gone takes its editor with it.
      onBeforeDeinit: function() {
        open.forEach(hide);
      },
      // On a copy of the canvas: the editors are drawers, which the core
      // takes off, and what they hid shows again. What is typed in one and
      // not applied is not the block's yet
      cleanMarkup: function(root) {
        all(root, ".ge-code-hidden").forEach(function(node) {
          removeClass(node, "ge-code-hidden");
        });
      },
      onInit: function() {
        open.slice().forEach(function(entry) {
          if (!attached(entry.node)) {
            if (entry.editor) {
              entry.editor.toTextArea();
            }
            entry.wrapper.remove();
            open.splice(open.indexOf(entry), 1);
            return;
          }
          show(entry);
        });
      }
    };
  };
})();
