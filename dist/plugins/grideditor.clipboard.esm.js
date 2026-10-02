// src/js/plugins/grideditor.clipboard.js
import { GridEditor } from "../grideditor.esm.js";

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
function parse(html) {
  var template = document.createElement("template");
  template.innerHTML = html;
  return Array.prototype.slice.call(template.content.childNodes);
}
function create(html) {
  var nodes = parse(html.trim());
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1) {
      return nodes[i];
    }
  }
  return null;
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
var REFERENCES = [
  "data-bs-target",
  "data-bs-parent",
  "href",
  "aria-controls",
  "aria-labelledby",
  "aria-describedby",
  "for",
  "data-ge-popup-id",
  "data-ge-popup-target"
];
var GENERATED_ID = /^ge-([a-z][a-z-]*?)-\d+-[a-z0-9]+$/;
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
GridEditor.features.clipboard = function(ge) {
  var shown = null;
  var listening = false;
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
  function copy(node, kind) {
    var html = ge.nodeHtml(node);
    write({ version: VERSION, category: categoryOf(kind), kind, html });
    ge.emit("after-copy", ge.payloadFor(kind, node, { source: "tool" }));
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
  function paste(target, categories) {
    var clip = read();
    if (!fits(clip, categories)) {
      return;
    }
    ge.place(fresh(clip.html), clip.kind, { appendTo: target, source: "paste" });
  }
  function fresh(html) {
    var node = create(html);
    var renamed = {};
    var taken = function(id) {
      return !!document.getElementById(id) || Object.keys(renamed).some(function(old) {
        return renamed[old] === id;
      });
    };
    selfAndAll(node, "[id]").forEach(function(element) {
      var id = element.id;
      if (!document.getElementById(id)) {
        return;
      }
      var generated = GENERATED_ID.exec(id);
      var next;
      if (generated) {
        do {
          next = ge.containerId(generated[1]);
        } while (taken(next));
      } else {
        var n = 2;
        while (taken(id + "-" + n)) {
          n++;
        }
        next = id + "-" + n;
      }
      renamed[id] = next;
      element.id = next;
    });
    if (!Object.keys(renamed).length) {
      return node;
    }
    selfAndAll(node, "*").forEach(function(element) {
      REFERENCES.forEach(function(name) {
        var value = element.getAttribute(name);
        if (value === null) {
          return;
        }
        if (name === "href" && value.charAt(0) !== "#") {
          return;
        }
        var rewritten = value.split(/(\s+)/).map(function(token) {
          if (renamed[token]) {
            return renamed[token];
          }
          if (token.charAt(0) === "#" && renamed[token.slice(1)]) {
            return "#" + renamed[token.slice(1)];
          }
          return token;
        }).join("");
        if (rewritten !== value) {
          element.setAttribute(name, rewritten);
        }
      });
    });
    return node;
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
      // What the button showed, even if another tab has copied
      // something else since
      create: function() {
        return fresh(shown.html);
      }
    });
  });
  return {
    drawerTools: function(drawer, node, kind) {
      if (categoryOf(kind)) {
        ge.createTool(drawer, ge.t("tool.copy"), "ge-copy", "bi bi-copy", function() {
          copy(node, kind);
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
    },
    onDeinit: function() {
      document.removeEventListener(CHANGE, refresh);
      listening = false;
    },
    // Nothing of its own on the canvas: the tools are in the drawers
    cleanMarkup: function() {
    }
  };
};
