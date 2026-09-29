// src/js/plugins/grideditor.tinymce.js
import { GridEditor as GridEditor2 } from "../grideditor.esm.js";

// src/js/dom.js
function all(root, selector) {
  return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
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
function closest(node, selector, stopAt) {
  var found = node && node.nodeType === 1 ? node.closest(selector) : null;
  if (found && stopAt && found !== stopAt && !stopAt.contains(found)) {
    return null;
  }
  return found;
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
function setHtml(node, html) {
  node.innerHTML = html === void 0 || html === null ? "" : String(html);
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
function delegate(root, types, selector, handler, options) {
  var listener = function(event) {
    var match = closest(event.target, selector, root);
    if (match && root.contains(match)) {
      return handler.call(match, event);
    }
    return void 0;
  };
  split(types).forEach(function(type) {
    root.addEventListener(type, listener, options);
  });
  return listener;
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

// src/js/text/grideditor.text.js
import { GridEditor } from "../grideditor.esm.js";
if (!GridEditor.features.text) {
  let attributesOf = function(element2) {
    var found = {};
    Array.prototype.slice.call(element2.attributes).forEach(function(attribute) {
      found[attribute.name] = attribute.value;
    });
    return found;
  }, classesIn = function(value) {
    return (value || "").split(/\s+/).filter(function(name) {
      return name !== "" && !EDITOR_CLASS.test(name);
    });
  }, restoreAttributes = function(block, before, ready, open) {
    var result = Object.assign({}, before);
    Object.keys(Object.assign({}, ready, open)).forEach(function(name) {
      if (name === "class" || EDITOR_ATTRIBUTE.test(name) || ready[name] === open[name]) {
        return;
      }
      if (open[name] === void 0) {
        delete result[name];
      } else {
        result[name] = open[name];
      }
    });
    var readyClasses = classesIn(ready["class"]);
    var openClasses = classesIn(open["class"]);
    var classes = classesIn(before["class"]).filter(function(name) {
      return openClasses.indexOf(name) !== -1 || readyClasses.indexOf(name) === -1;
    });
    openClasses.forEach(function(name) {
      if (readyClasses.indexOf(name) === -1 && classes.indexOf(name) === -1) {
        classes.push(name);
      }
    });
    if (classes.length) {
      result["class"] = classes.join(" ");
    } else {
      delete result["class"];
    }
    Object.keys(attributesOf(block)).forEach(function(name) {
      block.removeAttribute(name);
    });
    Object.keys(result).forEach(function(name) {
      block.setAttribute(name, result[name]);
    });
  }, textFeature = function(ge) {
    var settings = ge.settings;
    var TEXTS = {};
    var warned = {};
    Object.keys(GridEditor.texts).forEach(function(type) {
      TEXTS[type] = GridEditor.texts[type](ge);
    });
    if (!Array.isArray(settings.content_types)) {
      settings.content_types = Object.keys(TEXTS);
    }
    if (!Array.isArray(settings.text_tools)) {
      settings.text_tools = [];
    }
    if (!Array.isArray(settings.text_classes)) {
      settings.text_classes = [];
    }
    function offeredTexts() {
      return settings.content_types.filter(function(type) {
        return !!TEXTS[type];
      });
    }
    function textLabel(type) {
      var text = TEXTS[type];
      return text && text.labelKey ? ge.t(text.labelKey) : type;
    }
    function makeText(type, content) {
      var text = TEXTS[type];
      var block = element("div", {
        "class": "ge-content ge-content-type-" + type,
        "data-ge-content-type": type
      });
      if (content && content.nodeType) {
        block.appendChild(content);
      } else {
        setHtml(block, content !== void 0 ? content : text && text.initialContent || "");
      }
      return block;
    }
    function apiCreateText(type, options) {
      if (type && typeof type === "object") {
        options = type;
        type = void 0;
      }
      options = options || {};
      type = type || offeredTexts()[0];
      if (!type || !TEXTS[type]) {
        if (!warned["createText:" + type]) {
          warned["createText:" + type] = true;
          ge.warn('createText: no text editor "' + type + '" is loaded; load its plugin and name it in content_types');
        }
        return null;
      }
      return ge.place(makeText(type, options.content), "text", options);
    }
    function isOurs(block) {
      return !!TEXTS[block.getAttribute("data-ge-content-type")];
    }
    function startText(block) {
      if (hasClass(block, "ge-rte-active")) {
        return;
      }
      if (!visible(block)) {
        return;
      }
      var text = TEXTS[block.getAttribute("data-ge-content-type")];
      if (!text) {
        return;
      }
      if (text.available && !text.available()) {
        if (text.missingKey) {
          console.error(ge.t(text.missingKey));
        }
        return;
      }
      readBefore.set(block, attributesOf(block));
      readReady.delete(block);
      addClass(block, "ge-rte-active");
      text.start([block]);
    }
    function onClick() {
      startText(this);
    }
    function closeText(block) {
      var text = TEXTS[block.getAttribute("data-ge-content-type")];
      var before = readBefore.get(block);
      var open = before ? attributesOf(block) : null;
      if (text) {
        text.stop([block]);
      }
      removeClass(block, "ge-rte-active");
      if (before) {
        restoreAttributes(block, before, readReady.get(block) || before, open);
        readBefore.delete(block);
        readReady.delete(block);
      }
    }
    function createTextControls(textBlock) {
      var block = child(textBlock, ".ge-content");
      var type = block.getAttribute("data-ge-content-type");
      var drawer = element("div", { "class": "ge-tools-drawer ge-text-drawer" });
      textBlock.insertBefore(drawer, textBlock.firstChild);
      ge.createMoveTool(drawer);
      var details = ge.addSettingsTool(drawer, block, settings.text_classes);
      var general = child(details, ".ge-details-general");
      var editor = element("div", { "class": "ge-field ge-text-editor" });
      editor.appendChild(element("span", { "class": "ge-field-label" }, ge.t("panel.editor")));
      editor.appendChild(element("span", { "class": "ge-field-value" }, textLabel(type)));
      general.insertBefore(editor, general.firstChild);
      settings.text_tools.forEach(function(hostTool) {
        ge.createTool(
          drawer,
          hostTool.title || "",
          hostTool.className || "",
          hostTool.iconClass || "bi bi-wrench",
          hostTool.on
        );
      });
      ge.createTool(drawer, ge.t("tool.delete_text"), "ge-delete-text", "bi bi-trash", function() {
        ge.deleteNode("text", block, ge.t("confirm.delete_text"), function(removed) {
          closeText(block);
          slideUp(textBlock, function() {
            textBlock.remove();
            removed();
          });
        });
      });
    }
    function markTexts() {
      all(ge.canvas, ".ge-text-block").forEach(function(textBlock) {
        if (child(textBlock, ".ge-tools-drawer")) {
          return;
        }
        var block = child(textBlock, ".ge-content");
        if (!block || !isOurs(block)) {
          return;
        }
        createTextControls(textBlock);
      });
    }
    var texts = offeredTexts();
    var clicks = null;
    return {
      methods: {
        createText: apiCreateText
      },
      /**
       * The types this plugin edits, for the core: every editor loaded
       * is the owner of its texts, and the ones offered are what the
       * host's plain content can be made.
       */
      textTypes: function() {
        var offered = offeredTexts();
        var others = Object.keys(TEXTS).filter(function(type) {
          return offered.indexOf(type) === -1;
        });
        return offered.concat(others).map(function(type) {
          var text = TEXTS[type];
          return {
            type,
            label: textLabel(type),
            offered: offered.indexOf(type) !== -1,
            available: text.available ? function() {
              return text.available();
            } : null,
            missingKey: text.missingKey,
            edit: function(block) {
              var textBlock = block.parentElement;
              if (hasClass(textBlock, "ge-text-block") && !child(textBlock, ".ge-tools-drawer")) {
                createTextControls(textBlock);
              }
              startText(block);
            }
          };
        });
      },
      // A text block of each editor offered. Like a container, it goes
      // into a row of its own when clicked, or where it is dropped
      toolbar: texts.map(function(type) {
        return {
          label: function() {
            return texts.length > 1 ? ge.t("text.add_type", { editor: textLabel(type) }) : ge.t("text.add");
          },
          iconClass: TEXTS[type].iconClass,
          className: "ge-add-text-button",
          kind: "text",
          inColumn: true,
          create: function() {
            return makeText(type);
          }
        };
      }),
      onInit: function() {
        markTexts();
        if (clicks) {
          ge.canvas.removeEventListener("click", clicks);
        }
        clicks = delegate(ge.canvas, "click", ".ge-content", onClick);
      },
      // While the drawers and the text blocks are still there, as the
      // editors left them
      onBeforeDeinit: function() {
        all(ge.canvas, ".ge-content").forEach(function(block) {
          if (isOurs(block)) {
            closeText(block);
          }
        });
      },
      onDeinit: function() {
        if (clicks) {
          ge.canvas.removeEventListener("click", clicks);
        }
        clicks = null;
      },
      // The first time only: an undo says ready again, and by then the
      // host may have changed the content area itself
      onContentReady: function(area) {
        if (readBefore.has(area) && !readReady.has(area)) {
          readReady.set(area, attributesOf(area));
        }
      }
    };
  };
  Object.assign(GridEditor.locales.en, {
    "text.add": "Text",
    "text.add_type": "Text ({editor})",
    "panel.editor": "Editor",
    "panel.kind_text": "Text"
  });
  readBefore = /* @__PURE__ */ new WeakMap();
  readReady = /* @__PURE__ */ new WeakMap();
  EDITOR_CLASS = /^(mce-|cke|ck-|note-)|^(ck|active|ge-rte-active)$/;
  EDITOR_ATTRIBUTE = /^(data-mce-|contenteditable$|spellcheck$)/;
  textFeature.always = true;
  GridEditor.features.text = textFeature;
}
var readBefore;
var readReady;
var EDITOR_CLASS;
var EDITOR_ATTRIBUTE;

// src/js/plugins/grideditor.tinymce.js
Object.assign(GridEditor2.locales.en, {
  "text.tinymce": "tinyMCE"
});
function cleanUp(contentArea) {
  removeClass(contentArea, "active ge-rte-active");
  ["id", "style", "spellcheck", "contenteditable", "data-mce-style"].forEach(function(name) {
    contentArea.removeAttribute(name);
  });
}
var INITIAL_CONTENT = "<p>Lorem ipsum dolores</p>";
var editors = /* @__PURE__ */ new WeakMap();
var pendingRemove = /* @__PURE__ */ new WeakSet();
GridEditor2.texts.tinymce = function(ge) {
  return {
    labelKey: "text.tinymce",
    initialContent: INITIAL_CONTENT,
    missingKey: "error.tinymce_missing",
    available: function() {
      return !!window.tinymce;
    },
    start: function(contentAreas) {
      var settings = ge.settings;
      var userConfig = settings.tinymce && settings.tinymce.config ? settings.tinymce.config : {};
      contentAreas.forEach(function(contentArea) {
        if (hasClass(contentArea, "active")) {
          return;
        }
        if (contentArea.innerHTML == INITIAL_CONTENT) {
          contentArea.innerHTML = "";
        }
        addClass(contentArea, "active");
        var configuration = Object.assign({
          // tinyMCE's own "Upgrade" badge in the menubar. Off by
          // default because an inline editor here is a column of
          // someone's page, not tinyMCE's own interface; a host that
          // wants it back passes promotion: true.
          promotion: false
        }, userConfig, {
          target: contentArea,
          inline: true,
          init_instance_callback: function(editor) {
            if (pendingRemove.has(contentArea)) {
              pendingRemove.delete(contentArea);
              editor.remove();
              cleanUp(contentArea);
              return;
            }
            editors.set(contentArea, editor);
            ge.textReady(contentArea);
            editor.on("Undo Redo", function() {
              ge.textReady(contentArea);
            });
            window.requestAnimationFrame(function() {
              if (editor.removed || !editor.ui || !editor.ui.show) {
                return;
              }
              editor.ui.show();
            });
            editor.on("focus", function() {
              window.requestAnimationFrame(function() {
                if (editor.removed || !editor.ui || !editor.ui.show) {
                  return;
                }
                editor.ui.show();
              });
            });
            editor.focus();
            if (userConfig.init_instance_callback) {
              userConfig.init_instance_callback.call(this, editor);
            }
          }
        });
        delete configuration.selector;
        window.tinymce.init(configuration);
      });
    },
    stop: function(contentAreas) {
      contentAreas.filter(function(contentArea) {
        return hasClass(contentArea, "active");
      }).forEach(function(contentArea) {
        var editor = editors.get(contentArea);
        if (editor) {
          editors.delete(contentArea);
          editor.remove();
        } else {
          pendingRemove.add(contentArea);
        }
        cleanUp(contentArea);
      });
    }
  };
};
