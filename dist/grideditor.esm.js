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
function closest(node, selector, stopAt) {
  var found = node && node.nodeType === 1 ? node.closest(selector) : null;
  if (found && stopAt && found !== stopAt && !stopAt.contains(found)) {
    return null;
  }
  return found;
}
function is(node, selector) {
  return !!node && node.nodeType === 1 && node.matches(selector);
}
function attached(node) {
  return !!node && document.documentElement.contains(node);
}
function nextAll(node, selector) {
  var found = [];
  for (var next = node.nextElementSibling; next; next = next.nextElementSibling) {
    if (!selector || next.matches(selector)) {
      found.push(next);
    }
  }
  return found;
}
function parentsUntil(node, stop) {
  var found = [];
  for (var parent = node.parentElement; parent && parent !== stop; parent = parent.parentElement) {
    found.push(parent);
  }
  return found;
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
function dropEmptyStyle(node) {
  if (!node.getAttribute("style")) {
    node.removeAttribute("style");
  }
  return node;
}
function attr(node, attributes) {
  Object.keys(attributes).forEach(function(name) {
    var value = attributes[name];
    if (value === null || value === void 0) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, value);
    }
  });
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
function outerWidth(node) {
  return node.getBoundingClientRect().width;
}
function outerHeight(node) {
  return node.getBoundingClientRect().height;
}
function contentHeight(node) {
  var style = getComputedStyle(node);
  return node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
}
function offset(node) {
  var box = node.getBoundingClientRect();
  return { top: box.top + window.pageYOffset, left: box.left + window.pageXOffset };
}
function insertAfter(node, reference) {
  reference.parentNode.insertBefore(node, reference.nextSibling);
  return node;
}
function unwrap(node) {
  var parent = node.parentNode;
  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  node.remove();
}
function wrap(node, wrapper) {
  node.parentNode.insertBefore(wrapper, node);
  wrapper.appendChild(node);
  return wrapper;
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
function on(target, types, handler, options) {
  split(types).forEach(function(type) {
    target.addEventListener(type, handler, options);
  });
  return handler;
}
function off(target, types, handler, options) {
  split(types).forEach(function(type) {
    target.removeEventListener(type, handler, options);
  });
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
function shrinkAway(node, duration, done, width) {
  node.style.overflow = "hidden";
  animateAway(node, function(style) {
    var from = { opacity: style.opacity, height: style.height };
    var to = { opacity: 0, height: "0px" };
    if (width) {
      from.width = style.width;
      to.width = "0px";
    }
    return [from, to];
  }, duration, function() {
    node.style.removeProperty("overflow");
    if (done) {
      done();
    }
  });
}

// src/js/grideditor.js
var METHODS = {
  getHtml: { value: true },
  getPlainHtml: { value: true },
  init: {},
  deinit: {},
  reset: {},
  destroy: {},
  changeView: {},
  getView: { value: true },
  createRow: { value: true },
  createColumn: { value: true },
  createElement: { value: true },
  createText: { value: true },
  createSection: { value: true },
  createContainer: { value: true },
  addTab: { value: true },
  addAccordionItem: { value: true },
  setLocale: {},
  getUtility: { value: true },
  setUtility: { value: true }
};
var PLACEMENTS = ["appendTo", "prependTo", "insertAfter", "insertBefore"];
var BREAKPOINTS = [
  { key: "xs", infix: "", colPrefix: "col-", offsetPrefix: "offset-", min: 0, preview: 400, labelKey: "view.xs" },
  { key: "sm", infix: "sm", colPrefix: "col-sm-", offsetPrefix: "offset-sm-", min: 576, preview: 576, labelKey: "view.sm" },
  { key: "md", infix: "md", colPrefix: "col-md-", offsetPrefix: "offset-md-", min: 768, preview: 768, labelKey: "view.md" },
  { key: "lg", infix: "lg", colPrefix: "col-lg-", offsetPrefix: "offset-lg-", min: 992, preview: 992, labelKey: "view.lg" },
  { key: "xl", infix: "xl", colPrefix: "col-xl-", offsetPrefix: "offset-xl-", min: 1200, preview: 1200, labelKey: "view.xl" },
  { key: "xxl", infix: "xxl", colPrefix: "col-xxl-", offsetPrefix: "offset-xxl-", min: 1400, preview: null, labelKey: "view.xxl" }
];
var ALL_VIEW = "all";
var ALL_VIEW_LABEL_KEY = "view.all";
var VIEW_KEYS = [ALL_VIEW].concat(BREAKPOINTS.map(function(tier) {
  return tier.key;
}));
var LEGACY_VIEW_INDEXES = ["lg", "sm", "xs"];
var MAX_COL_SIZE = 12;
var MAX_COL_OFFSET = 11;
var FLEX_SIZES = ["equal", "auto"];
var ROW_COLS_VALUES = ["1", "2", "3", "4", "5", "6", "auto"];
function rowColsClass(tier, value) {
  return "row-cols" + (tier.infix ? "-" + tier.infix : "") + "-" + value;
}
function isUnits(size) {
  return typeof size === "number";
}
function sizeClass(tier, size) {
  if (size === "equal") {
    return tier.infix ? "col-" + tier.infix : "col";
  }
  return tier.colPrefix + size;
}
function breakpoint(key) {
  for (var i = 0; i < BREAKPOINTS.length; i++) {
    if (BREAKPOINTS[i].key === key) {
      return BREAKPOINTS[i];
    }
  }
  return null;
}
function tiersFor(view) {
  if (view === ALL_VIEW) {
    return [BREAKPOINTS[0]];
  }
  var tier = breakpoint(view);
  return tier ? [tier] : [];
}
function labelKeyFor(view) {
  var tier = breakpoint(view);
  return tier ? tier.labelKey : ALL_VIEW_LABEL_KEY;
}
var NESTED_SETTINGS = {
  add_column: {
    size: 12,
    // What a click on the add column tool adds
    picker: true,
    // Holding it offers the sizes instead
    delay: 600
    // How long to hold, in milliseconds
  },
  elements: {
    enabled: "auto",
    // 'auto' turns them on when the page has any
    selector: "[data-ge-element]",
    // What the host marks an element with
    auto: false
    // Treat every child of a content area as an element
  },
  resize: {
    enabled: true,
    handles: "e",
    // Which edges carry a handle: 'e', 'w', or 'e, w'
    balance: "next"
    // 'next' takes the units out of the following column
  },
  drag: {
    delay: 0,
    // Milliseconds to hold before a drag starts
    touch_delay: 100,
    // The same for touch, where 0 eats the page's scrolling
    threshold: 3,
    // Pixels of movement before a gesture counts as a drag
    animation: 150,
    // Milliseconds of reordering animation, 0 for none
    scroll: true
    // Scroll the page when a drag reaches its edge
  }
};
var REMOVED_SETTINGS = {
  sortable_options: "drag",
  resizable_options: "resize"
};
var warned = {};
var editorCounter = 0;
var instances = /* @__PURE__ */ new WeakMap();
function translate(settings, key, params) {
  var locales = GridEditor.locales;
  var locale = locales[settings.locale] || {};
  var overrides = settings.locale_strings || {};
  var string = overrides[key];
  if (string === void 0) {
    string = locale[key];
  }
  if (string === void 0) {
    string = locales.en[key];
  }
  if (string === void 0) {
    warnOnce("locale:" + key, 'no string for "' + key + '" in any locale, showing the key');
    string = key;
  }
  return string.replace(/\{(\w+)\}/g, function(placeholder, name) {
    return params && params[name] !== void 0 ? params[name] : placeholder;
  });
}
function warn(message) {
  if (window.console && window.console.warn) {
    window.console.warn("grid-editor: " + message);
  }
}
function warnOnce(key, message) {
  if (warned[key]) {
    return;
  }
  warned[key] = true;
  warn(message);
}
function english(key, params) {
  return translate({ locale: "en" }, key, params);
}
function targetElement(target) {
  if (typeof target === "string") {
    var found = document.querySelector(target);
    if (!found) {
      throw new TypeError("grid-editor: no element matches " + JSON.stringify(target));
    }
    return found;
  }
  if (target && target.nodeType === 1) {
    return target;
  }
  throw new TypeError("grid-editor: the target is an element or a selector, not " + (target === null ? "null" : typeof target));
}
function nodeFrom(node) {
  if (typeof node === "string") {
    return document.querySelector(node);
  }
  return node && node.nodeType === 1 ? node : null;
}
function sortableLibrary() {
  return GridEditor.Sortable || window.Sortable || null;
}
function modalLibrary() {
  var bootstrap = GridEditor.bootstrap || window.bootstrap;
  return bootstrap && bootstrap.Modal ? bootstrap.Modal : null;
}
function plainHtml(html) {
  var root = document.implementation.createHTMLDocument("").body;
  root.innerHTML = html;
  var emptied = [];
  all(root, "*").forEach(function(node) {
    var marked = false;
    Array.prototype.slice.call(node.attributes).forEach(function(attribute) {
      if (attribute.name.indexOf("data-ge-") === 0) {
        node.removeAttribute(attribute.name);
        marked = true;
      }
    });
    var classes = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    var kept = classes.filter(function(name) {
      return name !== "column" && name.indexOf("ge-") !== 0;
    });
    if (kept.length !== classes.length) {
      marked = true;
    }
    if (kept.length) {
      node.setAttribute("class", kept.join(" "));
    } else {
      node.removeAttribute("class");
    }
    if (marked && node.tagName === "DIV" && !node.attributes.length) {
      emptied.push(node);
    }
  });
  emptied.forEach(function(div) {
    unwrap(div);
  });
  return root.innerHTML;
}
function GridEditor(target, options) {
  var element2 = targetElement(target);
  var existing = instances.get(element2);
  if (existing) {
    if (!doubleWarned.has(element2)) {
      doubleWarned.add(element2);
      warn(english("warning.already_editing"));
    }
    return existing;
  }
  if (!(this instanceof GridEditor)) {
    return new GridEditor(element2, options);
  }
  build(this, element2, options || {});
}
var doubleWarned = /* @__PURE__ */ new WeakSet();
GridEditor.create = function(target, options) {
  return new GridEditor(target, options);
};
GridEditor.get = function(target) {
  var element2 = nodeFrom(target);
  return element2 ? instances.get(element2) || null : null;
};
function build(instance, baseElem, optionsOrMethod) {
  var settings = Object.assign({
    "new_row_layouts": [
      // Column layouts for add row buttons
      [12],
      [6, 6],
      [4, 4, 4],
      [3, 3, 3, 3],
      [2, 2, 2, 2, 2, 2],
      [2, 8, 2],
      [4, 8],
      [8, 4]
    ],
    "row_classes": [],
    // Preset class toggles, on top of the classes field
    "col_classes": [],
    "col_tools": [],
    /* Example:
        [ {
            title: 'Set background image',
            iconClass: 'bi bi-image',
            on: { click: function(event) {} }
        } ]
    */
    "row_tools": [],
    "drag_handle": "tool",
    // 'tool' for the move tool, 'drawer' for the whole drawer
    "toolbar_drag": "auto",
    // Drag the toolbar's buttons onto the canvas. 'auto' follows drag_handle
    "element_tools": [],
    // Host tools on element drawers, same shape as row_tools
    "element_classes": [],
    // Preset class toggles on an element's settings panel
    // content_types, text_tools and text_classes are the text editor
    // plugins' settings since 6.0: see grideditor.text.js
    "container_classes": [],
    // The same, on a container's panel
    "pane_classes": [],
    // And on a tab's or an accordion item's
    "container_tools": [],
    // Host tools on container drawers
    "tab_tools": [],
    // Host tools on tab drawers
    "accordion_tools": [],
    // Host tools on accordion item drawers
    "plugins": null,
    // Plugins to use, of any kind; null means every one loaded
    "row_cols": true,
    // A row's "columns per row" field, row-cols-*
    "utilities": {},
    // Options for the utility plugins, by plugin name
    "elements": NESTED_SETTINGS.elements,
    // Element level controls, below the column
    "custom_filter": "",
    "valid_col_sizes": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, "equal", "auto"],
    "valid_col_offsets": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "add_column": NESTED_SETTINGS.add_column,
    // The add column tool
    "layout_modes": VIEW_KEYS.slice(),
    // Which views the dropdown offers
    "default_view": ALL_VIEW,
    "resize": NESTED_SETTINGS.resize,
    // Resizing a column by dragging its edge
    "source_textarea": "",
    "edit_source": true,
    // The toolbar's button to edit the canvas as html
    "locale": "en",
    // Code of a locale in GridEditor.locales
    "locale_strings": {},
    // Overrides for individual keys
    "callbacks": {},
    // before_*/after_* functions, the events by another route
    "confirm_delete": true,
    // Ask before deleting a row or a column
    "settings_panel": "offcanvas",
    // Where a node's settings open: 'offcanvas', 'popover', 'modal' or 'inline'
    "drag": NESTED_SETTINGS.drag
    // How a drag behaves, whatever drives it
  }, optionsOrMethod);
  Object.keys(NESTED_SETTINGS).forEach(function(name) {
    settings[name] = Object.assign({}, NESTED_SETTINGS[name], settings[name]);
  });
  Object.keys(REMOVED_SETTINGS).forEach(function(name) {
    if (optionsOrMethod && optionsOrMethod[name] !== void 0) {
      warn(translate(settings, "warning.setting_removed", {
        setting: name,
        replacement: REMOVED_SETTINGS[name]
      }));
    }
  });
  var canvas, mainControls, wrapper, addRowGroup, addContainerGroup, layoutDropdown, htmlTextArea;
  var curView = settings.default_view;
  var confirmDialog = null;
  var sizePicker = null;
  var sourceOpen = false;
  var dropMarker = null;
  var warnedHere = {};
  var sortables = [];
  var instanceId = ++editorCounter;
  var destroyed = false;
  var detailsFor = /* @__PURE__ */ new WeakMap();
  var moves = /* @__PURE__ */ new WeakMap();
  var resizes = /* @__PURE__ */ new WeakMap();
  var sectionNodes = /* @__PURE__ */ new WeakMap();
  var editableLabels = /* @__PURE__ */ new WeakSet();
  var lifetime = new AbortController();
  canvas = addClass(baseElem, "ge-canvas");
  function warnOnceHere(key, message) {
    if (warnedHere[key]) {
      return;
    }
    warnedHere[key] = true;
    warn(message);
  }
  function t(key, params) {
    return translate(settings, key, params);
  }
  function setLocale(code) {
    settings.locale = code;
    instance.settings = settingsCopy();
    removeConfirmModal();
    removeSettingsPanels();
    mainControls.remove();
    createMainControls();
    reset();
  }
  var operationDepth = 0;
  var deferredWork = [];
  function payloadFor(kind, node, extra) {
    return Object.assign({
      kind,
      node,
      parent: node.parentElement,
      canvas,
      breakpoint: getView(),
      source: "api"
    }, extra || {});
  }
  function emit(name, payload) {
    var names = [name];
    var generic = name.replace(/^(before|after)-add-.+$/, "$1-add");
    if (generic !== name) {
      names.push(generic);
    }
    var canceled = false;
    names.forEach(function(eventName) {
      var event = new CustomEvent("grideditor:" + eventName, {
        detail: payload,
        bubbles: true,
        cancelable: true
      });
      if (!canvas.dispatchEvent(event)) {
        canceled = true;
      }
    });
    names.forEach(function(eventName) {
      var callback = settings.callbacks[eventName.replace(/-/g, "_")];
      if (typeof callback == "function" && callback(payload) === false) {
        canceled = true;
      }
    });
    return !canceled;
  }
  function operate(body) {
    operationDepth++;
    try {
      return body();
    } finally {
      operationDepth--;
      if (operationDepth === 0) {
        while (deferredWork.length) {
          deferredWork.shift()();
        }
      }
    }
  }
  function defer(work) {
    if (operationDepth === 0) {
      work();
      return;
    }
    deferredWork.push(work);
  }
  function addNode(kind, node, insert, extra) {
    var name = addEventName(kind);
    return operate(function() {
      var payload = payloadFor(kind, node, extra);
      if (!emit("before-add-" + name, payload)) {
        return null;
      }
      insert();
      init();
      emit("after-add-" + name, payload);
      return node;
    });
  }
  function addEventName(kind) {
    return GridEditor.containers[kind] ? "container" : kind;
  }
  function askToDelete(message, whenConfirmed) {
    if (!settings.confirm_delete) {
      whenConfirmed();
      return;
    }
    var Modal = modalLibrary();
    if (!Modal) {
      if (window.confirm(message)) {
        whenConfirmed();
      }
      return;
    }
    var modal = confirmModal();
    var confirmed = false;
    one(modal, ".ge-confirm-message").textContent = message;
    one(modal, ".ge-confirm-ok").onclick = function() {
      confirmed = true;
      Modal.getInstance(modal).hide();
    };
    confirmHandlers.hidden = function() {
      if (confirmed) {
        whenConfirmed();
      }
    };
    confirmHandlers.shown = function() {
      one(modal, ".ge-confirm-ok").focus();
    };
    Modal.getOrCreateInstance(modal).show();
  }
  var confirmHandlers = { hidden: null, shown: null };
  function confirmModal() {
    if (confirmDialog) {
      return confirmDialog;
    }
    confirmDialog = create(
      '<div class="modal fade ge-confirm" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p class="ge-confirm-message"></p></div><div class="modal-footer"><button type="button" class="btn btn-secondary ge-confirm-cancel" data-bs-dismiss="modal"></button><button type="button" class="btn btn-danger ge-confirm-ok"></button></div></div></div></div>'
    );
    document.body.appendChild(confirmDialog);
    one(confirmDialog, ".modal-title").textContent = t("confirm.title");
    one(confirmDialog, ".btn-close").setAttribute("aria-label", t("confirm.cancel"));
    one(confirmDialog, ".ge-confirm-cancel").textContent = t("confirm.cancel");
    one(confirmDialog, ".ge-confirm-ok").textContent = t("confirm.ok");
    trackModal(confirmDialog);
    confirmDialog.addEventListener("hidden.bs.modal", function() {
      if (confirmHandlers.hidden) {
        confirmHandlers.hidden();
      }
    });
    confirmDialog.addEventListener("shown.bs.modal", function() {
      if (confirmHandlers.shown) {
        confirmHandlers.shown();
      }
    });
    return confirmDialog;
  }
  function removeConfirmModal() {
    if (!confirmDialog) {
      return;
    }
    confirmHandlers.hidden = null;
    confirmHandlers.shown = null;
    retireModal(confirmDialog);
    confirmDialog = null;
  }
  function retireModal(panel) {
    var Modal = modalLibrary();
    var modal = Modal ? Modal.getInstance(panel) : null;
    var gone = false;
    var finish = function() {
      if (gone) {
        return;
      }
      gone = true;
      if (modal) {
        modal.dispose();
      }
      panel.remove();
    };
    if (!modal || !modalMoving.get(panel) && !hasClass(panel, "show")) {
      finish();
      return;
    }
    panel.addEventListener("hidden.bs.modal", finish, { once: true });
    panel.addEventListener("shown.bs.modal", function() {
      modal.hide();
    }, { once: true });
    modal.hide();
  }
  var modalMoving = /* @__PURE__ */ new WeakMap();
  function trackModal(panel) {
    on(panel, "show.bs.modal hide.bs.modal", function() {
      modalMoving.set(panel, true);
    });
    on(panel, "shown.bs.modal hidden.bs.modal", function() {
      modalMoving.set(panel, false);
    });
  }
  function deleteNode(kind, node, message, animate) {
    operate(function() {
      var payload = payloadFor(kind, node, { source: "tool" });
      if (!emit("before-delete", payload)) {
        return;
      }
      askToDelete(message, function() {
        operate(function() {
          animate(function() {
            node.remove();
            operate(function() {
              init();
              emit("after-delete", payload);
            });
          });
        });
      });
    });
  }
  function planSize(col, size, view) {
    view = view || curView;
    if (view !== ALL_VIEW) {
      var tier = breakpoint(view);
      var wanted = clamp({ size, offset: getEffectiveOffset(col, tier) || 0 });
      if (wanted.refused || getSize(col, tier) === wanted.size) {
        return null;
      }
      return { writes: [{ tier, size: wanted.size }], cleared: null, size: wanted.size };
    }
    var refused = BREAKPOINTS.some(function(each) {
      return clamp({ size, offset: getEffectiveOffset(col, each) || 0 }).refused;
    });
    if (refused) {
      return null;
    }
    var base = BREAKPOINTS[0];
    var writes = [];
    var cleared = [];
    BREAKPOINTS.slice(1).forEach(function(each) {
      var own2 = getSize(col, each);
      if (own2 === null) {
        return;
      }
      writes.push({ tier: each, size: null });
      cleared.push({ breakpoint: each.key, value: own2 });
    });
    if (getSize(col, base) !== size) {
      writes.unshift({ tier: base, size });
    }
    return writes.length ? { writes, cleared, size } : null;
  }
  function writeSize(col, plan) {
    plan.writes.forEach(function(write) {
      setSize(col, write.tier, write.size);
    });
    stripPixelWidths(col);
  }
  function withCleared(extra, cleared) {
    if (cleared) {
      extra.cleared = cleared;
    }
    return extra;
  }
  function resizeColumn(col, size, source, view) {
    view = view || curView;
    var from = currentSize(col);
    var plan = planSize(col, size, view);
    if (!plan) {
      return false;
    }
    return operate(function() {
      var payload = payloadFor("column", col, withCleared({
        source,
        breakpoint: view,
        from,
        to: plan.size
      }, plan.cleared));
      if (!emit("before-resize", payload)) {
        refreshUtilities(col);
        return false;
      }
      writeSize(col, plan);
      refreshUtilities(col);
      emit("after-resize", payload);
      return true;
    });
  }
  function indentColumn(col, offset2, source) {
    var everywhere = curView === ALL_VIEW;
    var tier = everywhere ? BREAKPOINTS[0] : breakpoint(curView);
    var from = currentOffset(col);
    offset2 = Math.min(Math.max(offset2, 0), MAX_COL_OFFSET);
    var others = everywhere ? BREAKPOINTS.slice(1).filter(function(each) {
      return getOffset(col, each) !== null;
    }) : [];
    if ((getOffset(col, tier) || 0) === offset2 && !others.length) {
      return false;
    }
    return operate(function() {
      var payload = payloadFor("column", col, withCleared({
        source,
        from,
        to: offset2
      }, everywhere ? others.map(function(each) {
        return { breakpoint: each.key, value: getOffset(col, each) };
      }) : null));
      if (!emit("before-indent", payload)) {
        return false;
      }
      setOffset(col, tier, offset2);
      others.forEach(function(each) {
        setOffset(col, each, 0);
      });
      (everywhere ? BREAKPOINTS : [tier]).forEach(function(each) {
        var was = getEffectiveSize(col, each);
        if (!isUnits(was)) {
          return;
        }
        var wanted = clamp({ size: was, offset: offset2, leading: "offset" });
        if (wanted.size !== was) {
          setSize(col, each, wanted.size);
        }
      });
      refreshUtilities(col);
      emit("after-indent", payload);
      return true;
    });
  }
  function positionOf(node) {
    var parent = node.parentElement;
    return {
      parent,
      index: children(parent).filter(function(child2) {
        return !hasClass(child2, "ge-tools-drawer");
      }).indexOf(node)
    };
  }
  function kindOf(node) {
    var fromPlugin = null;
    Object.keys(FEATURES).forEach(function(name) {
      var feature = FEATURES[name];
      if (!fromPlugin && feature.kindOf) {
        fromPlugin = feature.kindOf(node);
      }
    });
    if (fromPlugin) {
      return fromPlugin;
    }
    if (node.getAttribute("data-ge-container")) {
      return node.getAttribute("data-ge-container");
    }
    if (hasClass(node, "ge-tab")) {
      return "tab";
    }
    if (hasClass(node, "ge-accordion-item")) {
      return "accordion-item";
    }
    if (hasClass(node, "row")) {
      return "row";
    }
    if (hasClass(node, "column")) {
      return "column";
    }
    if (hasClass(node, "ge-element")) {
      return "element";
    }
    if (hasClass(node, "ge-text-block")) {
      node = child(node, ".ge-content") || node;
    }
    if (hasClass(node, "ge-content")) {
      return node.getAttribute("data-ge-content-type") ? "text" : "plain";
    }
    return "node";
  }
  if (settings.source_textarea) {
    var sourceHtml = nodeFrom(settings.source_textarea).value;
    var probe = element("div");
    probe.innerHTML = sourceHtml;
    if (sourceHtml.length > 0 && !probe.querySelector(".row")) {
      sourceHtml = '<div class="row"><div class="col-lg-12">' + sourceHtml + "</div></div>";
    }
    setHtml(baseElem, sourceHtml);
  }
  if (baseElem.children.length && !baseElem.querySelector("div.row")) {
    var children2 = children(baseElem);
    var newRow = create('<div class="row"><div class="col-lg-12"></div></div>');
    baseElem.appendChild(newRow);
    children2.forEach(function(child2) {
      newRow.firstChild.appendChild(child2);
    });
  }
  function setup() {
    htmlTextArea = element("textarea", { "class": "ge-html-output" });
    canvas.parentNode.insertBefore(htmlTextArea, canvas);
    createMainControls();
    var signal = { signal: lifetime.signal };
    window.addEventListener("scroll", onScroll, signal);
    delegate(canvas, "click", ".ge-content", onContentClick, signal);
    delegate(canvas, "click", ".ge-popup-trigger, [data-ge-popup-target]", function(e) {
      if (hasClass(canvas, "ge-editing")) {
        e.preventDefault();
      }
    }, signal);
  }
  function textReady(block) {
    if (!is(block, ".ge-content") || !canvas.contains(block)) {
      return;
    }
    plugins("onContentReady", block);
    refreshPreviews(block);
  }
  function createMainControls() {
    mainControls = element("div", { "class": "ge-mainControls" });
    htmlTextArea.parentNode.insertBefore(mainControls, htmlTextArea);
    wrapper = mainControls.appendChild(element("div", { "class": "ge-wrapper ge-top" }));
    addRowGroup = wrapper.appendChild(element("div", { "class": "ge-addRowGroup btn-group" }));
    addContainerGroup = element("div", { "class": "ge-addContainerGroup btn-group ms-1" });
    settings.new_row_layouts.forEach(function(layout) {
      var grouped = !Array.isArray(layout);
      var btn = element("a", {
        "class": "btn btn-sm btn-primary",
        title: grouped ? t("row.add_row_cols", { columns: layout.columns, counts: rowColsText(layout.row_cols) }) : t("row.add", { layout: layout.join("-") }),
        // What this button makes, in the markup rather than in
        // memory: a drag works on a clone of it
        "data-ge-toolbar": "row",
        "data-ge-layout": grouped ? JSON.stringify(layout) : layout.join(",")
      });
      btn.addEventListener("click", function() {
        var row = rowFromLayoutValue(layout);
        var added = addNode("row", row, function() {
          canvas.appendChild(row);
        }, { parent: canvas, source: "tool" });
        if (added && row.scrollIntoView) {
          row.scrollIntoView({ behavior: "smooth" });
        }
      });
      addRowGroup.appendChild(btn);
      btn.appendChild(create('<i class="bi bi-plus"></i>'));
      var sizes = grouped ? rowColsIcon(layout) : layout;
      var icon = '<div class="row ge-row-icon">';
      sizes.forEach(function(size) {
        icon += '<div class="column ' + sizeClass(BREAKPOINTS[0], size) + '"></div>';
      });
      icon += "</div>";
      btn.appendChild(create(icon));
    });
    wrapper.appendChild(addContainerGroup);
    Object.keys(CONTAINERS).forEach(function(type) {
      var definition = CONTAINERS[type];
      var button = labelButton(
        element("a", { "class": "btn btn-sm btn-primary ge-add-container" }),
        t(definition.labelKey),
        definition.iconClass
      );
      attr(button, { "data-ge-toolbar": "container", "data-ge-container-type": type });
      button.addEventListener("click", function() {
        var row = createRow();
        var column = row.appendChild(createColumn(MAX_COL_SIZE));
        var container = column.appendChild(definition.create({}));
        addNode(type, container, function() {
          canvas.appendChild(row);
        }, { parent: canvas, source: "tool" });
      });
      addContainerGroup.appendChild(button);
    });
    var endItems = [];
    Object.keys(FEATURES).forEach(function(name) {
      (FEATURES[name].toolbar || []).forEach(function(item, index) {
        var button = featureButton(name, item, index);
        if (item.align === "end") {
          endItems.push(button);
        } else {
          addContainerGroup.appendChild(button);
        }
      });
    });
    layoutDropdown = create('<div class="dropdown pull-right ge-layout-mode"><button type="button" class="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown"></button><div class="dropdown-menu" role="menu"></div></div>');
    delegate(layoutDropdown, "click", "a", function() {
      changeView(this.getAttribute("data-ge-view"));
    });
    wrapper.appendChild(layoutDropdown);
    settings.layout_modes.forEach(function(view) {
      one(layoutDropdown, ".dropdown-menu").appendChild(element("a", {
        "class": "dropdown-item",
        "data-ge-view": view,
        title: t(labelKeyFor(view))
      }, t(labelKeyFor(view))));
    });
    one(layoutDropdown, "button").textContent = t(labelKeyFor(curView));
    var btnGroup = wrapper.appendChild(element("div", { "class": "btn-group pull-right" }));
    if (settings.edit_source) {
      var htmlButton = create('<button type="button" class="btn btn-sm btn-primary gm-edit-mode"><i class="bi bi-code-slash"></i></button>');
      htmlButton.setAttribute("title", t("tool.edit_source"));
      toggleClass(htmlButton, "active btn-danger", sourceOpen);
      htmlButton.addEventListener("click", function() {
        if (sourceOpen) {
          closeSource();
        } else {
          openSource();
        }
        toggleClass(htmlButton, "active btn-danger", sourceOpen);
      });
      btnGroup.appendChild(htmlButton);
    }
    var previewButton = create('<button type="button" class="btn btn-sm btn-primary gm-preview"><i class="bi bi-eye-fill"></i></button>');
    var endPreview = function() {
      if (!hasClass(previewButton, "active")) {
        addClass(canvas, "ge-editing");
      }
    };
    previewButton.setAttribute("title", t("tool.preview"));
    previewButton.addEventListener("mouseenter", function() {
      removeClass(canvas, "ge-editing");
    });
    previewButton.addEventListener("click", function() {
      toggleClass(previewButton, "active btn-danger");
      endPreview();
    });
    previewButton.addEventListener("mouseleave", endPreview);
    btnGroup.appendChild(previewButton);
    if (endItems.length) {
      var end = wrapper.appendChild(element("div", { "class": "pull-right ge-toolbar-end" }));
      endItems.forEach(function(button) {
        end.appendChild(button);
      });
    }
    makeToolbarDraggable();
  }
  function labelButton(button, label, iconClass) {
    button.setAttribute("title", label);
    if (iconClass) {
      button.appendChild(element("i", { "class": iconClass }));
      return button;
    }
    button.appendChild(create('<i class="bi bi-plus"></i>'));
    button.appendChild(element("span", {}, label));
    return button;
  }
  function featureButton(name, item, index) {
    var iconClass = item.iconClass || (item.align === "end" ? "bi bi-plus" : null);
    var label = typeof item.label === "function" ? item.label() : item.label || t(item.labelKey);
    var button = labelButton(element("a", { "class": "btn btn-sm btn-primary ge-add-container ge-add-feature" }), label, iconClass);
    addClass(button, item.className || "");
    attr(button, {
      "data-ge-toolbar": "feature",
      "data-ge-feature": name,
      "data-ge-item": index
    });
    button.addEventListener("click", function() {
      var made = item.create();
      var placed = item.inColumn ? inRowOfItsOwn(made) : made;
      var added = addNode(item.kind, made, function() {
        canvas.appendChild(placed);
      }, { parent: canvas, source: item.source || "tool" });
      if (added && item.inColumn && placed.scrollIntoView) {
        placed.scrollIntoView({ behavior: "smooth" });
      }
    });
    return button;
  }
  function toolbarDrags() {
    if (settings.toolbar_drag === "auto") {
      return settings.drag_handle === "drawer";
    }
    return !!settings.toolbar_drag;
  }
  function makeToolbarDraggable() {
    var buttons = all(mainControls, "[data-ge-toolbar]");
    buttons.forEach(function(button) {
      removeClass(button, "ge-palette-button");
      button.removeEventListener("pointerdown", startToolbarDrag);
    });
    if (!toolbarDrags()) {
      return;
    }
    buttons.forEach(function(button) {
      addClass(button, "ge-palette-button");
      button.addEventListener("pointerdown", startToolbarDrag);
    });
  }
  function startToolbarDrag(e) {
    var button = e.currentTarget;
    var startX = e.pageX;
    var startY = e.pageY;
    var helper = null;
    if (e.button) {
      return;
    }
    function far(move) {
      return Math.abs(move.pageX - startX) + Math.abs(move.pageY - startY) > settings.drag.threshold;
    }
    function onMove(move) {
      if (!helper) {
        if (!far(move)) {
          return;
        }
        helper = addClass(button.cloneNode(true), "ge-toolbar-helper");
        document.body.appendChild(helper);
        addClass(canvas, "ge-dropping");
      }
      css(helper, { left: move.pageX - 14, top: move.pageY - 14 });
      showDropMarker(move.pageX, move.pageY);
    }
    function onUp(up) {
      document.removeEventListener("pointermove", onMove);
      off(document, "pointerup pointercancel", onUp);
      if (!helper) {
        return;
      }
      helper.remove();
      removeClass(canvas, "ge-dropping");
      hideDropMarker();
      var swallow = function(click) {
        if (click.target !== button && !button.contains(click.target)) {
          return;
        }
        click.preventDefault();
        click.stopImmediatePropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(function() {
        window.removeEventListener("click", swallow, { capture: true });
      }, 0);
      var where = dropPlaceAt(up.pageX, up.pageY);
      if (where) {
        insertFromToolbar(button, where);
      }
    }
    document.addEventListener("pointermove", onMove);
    on(document, "pointerup pointercancel", onUp);
  }
  function dropPlaceAt(pageX, pageY) {
    var x = pageX - window.scrollX;
    var y = pageY - window.scrollY;
    var under = document.elementFromPoint(x, y);
    if (!under) {
      return null;
    }
    var region = closest(under, [".column", ".ge-canvas"].concat(pluginHooks("regions")).join(", "));
    if (!region || region !== canvas && !canvas.contains(region)) {
      return null;
    }
    var before = null;
    children(region, blockSelector()).forEach(function(block) {
      if (before) {
        return;
      }
      var box = block.getBoundingClientRect();
      if (y < box.top + box.height / 2) {
        before = block;
      }
    });
    return { region, before };
  }
  function insertFeatureFromToolbar(button, where) {
    var item = FEATURES[button.getAttribute("data-ge-feature")].toolbar[parseInt(button.getAttribute("data-ge-item"), 10)];
    var made = item.create();
    var placed = made;
    if (item.inColumn) {
      if (!is(where.region, ".column")) {
        placed = inRowOfItsOwn(made);
      }
    } else if (!acceptsBlock(where.region, made)) {
      var ancestors = where.region === canvas ? [] : parentsUntil(where.region, canvas).reverse().concat([where.region]);
      var top = ancestors[0] || null;
      where = { region: canvas, before: top ? top.nextElementSibling : null };
    }
    return addNode(item.kind, made, function() {
      if (where.before) {
        where.before.parentNode.insertBefore(placed, where.before);
      } else {
        where.region.appendChild(placed);
      }
    }, { parent: where.region, source: item.source || "dragdrop" });
  }
  function inRowOfItsOwn(node) {
    var row = createRow();
    row.appendChild(createColumn(MAX_COL_SIZE)).appendChild(node);
    return row;
  }
  function showDropMarker(pageX, pageY) {
    var where = dropPlaceAt(pageX, pageY);
    if (!where) {
      return hideDropMarker();
    }
    if (!dropMarker) {
      dropMarker = element("div", { "class": "ge-drop-marker" });
    }
    if (where.before) {
      where.before.parentNode.insertBefore(dropMarker, where.before);
    } else {
      where.region.appendChild(dropMarker);
    }
    return void 0;
  }
  function hideDropMarker() {
    if (dropMarker) {
      dropMarker.remove();
    }
  }
  function insertFromToolbar(button, where) {
    if (button.getAttribute("data-ge-toolbar") === "feature") {
      return insertFeatureFromToolbar(button, where);
    }
    var container = button.getAttribute("data-ge-toolbar") === "container";
    var type = button.getAttribute("data-ge-container-type");
    var made = container ? CONTAINERS[type].create({}) : rowFromLayout(button.getAttribute("data-ge-layout"));
    var placed = made;
    if (container && !is(where.region, ".column")) {
      placed = inRowOfItsOwn(made);
    }
    return addNode(container ? type : "row", made, function() {
      if (where.before) {
        where.before.parentNode.insertBefore(placed, where.before);
      } else {
        where.region.appendChild(placed);
      }
    }, { parent: where.region, source: "dragdrop" });
  }
  function widthFamily() {
    var values = [];
    for (var units = 1; units <= MAX_COL_SIZE; units++) {
      values.push(String(units));
    }
    return {
      name: "col",
      values: values.concat(FLEX_SIZES),
      appliesTo: ["column"],
      labelKey: "utility.col_width",
      className: function(key, value) {
        return sizeClass(breakpoint(key), parseSize(value));
      },
      choices: function() {
        return settings.valid_col_sizes.map(String);
      },
      label: function(value) {
        if (value === "equal") {
          return t("utility.col_equal");
        }
        if (value === "auto") {
          return t("utility.col_auto");
        }
        return value;
      },
      write: function(col, value, view, source) {
        return resizeColumn(col, value === null ? null : parseSize(value), source, view);
      },
      // With no size of its own, a column in a row with row-cols
      // takes its share from the row, which the field says
      blank: function(col, view) {
        var winner = view === ALL_VIEW ? null : rowColsWinner(col, breakpoint(view));
        return winner ? t("utility.col_from_row", { count: rowColsLabel(winner.value) }) : null;
      }
    };
  }
  function parseSize(size) {
    return /^\d+$/.test(String(size)) ? parseInt(size, 10) : size;
  }
  function rowFromLayout(layout) {
    if (/^\s*\{/.test(layout || "")) {
      return rowFromLayoutValue(JSON.parse(layout));
    }
    return rowFromLayoutValue((layout || "").split(",").filter(function(size) {
      return size !== "";
    }).map(parseSize));
  }
  function rowFromLayoutValue(layout) {
    var row = createRow();
    if (Array.isArray(layout)) {
      layout.forEach(function(size) {
        row.appendChild(createColumn(size));
      });
      return row;
    }
    Object.keys(layout.row_cols || {}).forEach(function(key) {
      var value = layout.row_cols[key];
      var tier = breakpoint(key);
      if (tier && ROW_COLS_VALUES.indexOf(String(value)) !== -1) {
        addClass(row, rowColsClass(tier, value));
      }
    });
    for (var i = 0; i < (layout.columns || 0); i++) {
      row.appendChild(createColumn(null));
    }
    return row;
  }
  function rowColsText(counts) {
    return BREAKPOINTS.filter(function(tier) {
      return counts && counts[tier.key] !== void 0;
    }).map(function(tier) {
      return (tier.infix ? tier.key + ": " : "") + counts[tier.key];
    }).join(", ");
  }
  function rowColsIcon(layout) {
    var widest = 1;
    Object.keys(layout.row_cols || {}).forEach(function(key) {
      var value = layout.row_cols[key];
      if (value !== "auto") {
        widest = Math.max(widest, parseInt(value, 10) || 1);
      }
    });
    return Array.apply(null, Array(Math.min(widest, layout.columns || widest))).map(function() {
      return "equal";
    });
  }
  function onScroll() {
    var scrollTop = window.pageYOffset;
    if (scrollTop > offset(mainControls).top && scrollTop < offset(canvas).top + contentHeight(canvas)) {
      if (hasClass(wrapper, "ge-top")) {
        css(wrapper, {
          left: offset(wrapper).left,
          width: outerWidth(wrapper)
        });
        removeClass(wrapper, "ge-top");
        addClass(wrapper, "ge-fixed");
      }
    } else {
      if (hasClass(wrapper, "ge-fixed")) {
        css(wrapper, { left: "", width: "" });
        removeClass(wrapper, "ge-fixed");
        addClass(wrapper, "ge-top");
      }
    }
  }
  function onContentClick() {
    var block = this;
    if (block.getAttribute("data-ge-content-type")) {
      return;
    }
    if (closeSizePicker()) {
      return;
    }
    if (!visible(block)) {
      return;
    }
    var offers = textOffers();
    if (!offers.length) {
      return;
    }
    if (offers.length === 1) {
      convertPlain(block, offers[0]);
    } else {
      openConvertPicker(block, offers);
    }
  }
  function convertPlain(block, offer) {
    if (offer.available && !offer.available()) {
      if (offer.missingKey) {
        console.error(t(offer.missingKey));
      }
      return false;
    }
    return operate(function() {
      var payload = payloadFor("plain", block, { source: "tool", from: "plain", to: offer.type });
      if (!emit("before-convert", payload)) {
        return false;
      }
      addClass(block, "ge-content-type-" + offer.type);
      block.setAttribute("data-ge-content-type", offer.type);
      var textBlock = block.parentElement;
      if (hasClass(textBlock, "ge-text-block")) {
        removeClass(textBlock, "ge-plain-block");
        children(textBlock, ".ge-tools-drawer").forEach(function(drawer) {
          drawer.remove();
        });
      }
      emit("after-convert", payload);
      offer.edit(block);
      return true;
    });
  }
  function openConvertPicker(block, offers) {
    var textBlock = hasClass(block.parentElement, "ge-text-block") ? block.parentElement : null;
    if (!textBlock) {
      return;
    }
    openPicker(child(textBlock, ".ge-tools-drawer"), offers.map(function(offer) {
      return {
        label: offer.label,
        title: t("tool.convert_type", { editor: offer.label }),
        attributes: { "data-ge-content-type": offer.type },
        choose: function() {
          convertPlain(block, offer);
        }
      };
    }), "ge-text-picker ge-convert-picker", textBlock);
  }
  function openPicker(anchor, choices, className, hover) {
    closeSizePicker();
    if (!anchor) {
      return;
    }
    var drawer = closest(anchor, ".ge-tools-drawer");
    if (drawer) {
      addClass(drawer, "ge-picker-open");
    }
    sizePicker = anchor.appendChild(addClass(element("div", { "class": "ge-size-picker" }), className || ""));
    choices.forEach(function(choice) {
      var button = attr(element("a", { "class": "ge-size ge-size-flex" }), choice.attributes || {});
      button.setAttribute("title", choice.title || choice.label);
      button.textContent = choice.label;
      button.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeSizePicker();
        choice.choose();
      });
      sizePicker.appendChild(button);
    });
    withdrawOnLeave(hover || anchor);
  }
  function withdrawOnLeave(node) {
    node.addEventListener("mouseleave", function() {
      window.setTimeout(function() {
        if (sizePicker && !sizePicker.matches(":hover")) {
          closeSizePicker();
        }
      }, 400);
    }, { once: true });
  }
  function textTypes() {
    var owners = {};
    var entries = [];
    Object.keys(FEATURES).forEach(function(name) {
      var feature = FEATURES[name];
      if (!feature.textTypes) {
        return;
      }
      (feature.textTypes() || []).forEach(function(entry) {
        if (owners[entry.type]) {
          if (owners[entry.type] !== name) {
            warnOnceHere("text-type:" + entry.type, 'the "' + name + '" plugin declares the text type "' + entry.type + '", which the "' + owners[entry.type] + '" plugin already declares: ignored');
          }
          return;
        }
        owners[entry.type] = name;
        entries.push(entry);
      });
    });
    return entries;
  }
  function textOffers() {
    return textTypes().filter(function(entry) {
      return entry.offered !== false;
    });
  }
  function hasTextOwner(type) {
    return textTypes().some(function(entry) {
      return entry.type === type;
    });
  }
  function reset() {
    deinit();
    init();
  }
  function openSource() {
    deinit();
    htmlTextArea.style.height = 0.8 * document.documentElement.clientHeight + "px";
    htmlTextArea.value = canvas.innerHTML;
    show(htmlTextArea);
    hide(canvas);
    sourceOpen = true;
    plugins("onSourceOpen", htmlTextArea);
  }
  function closeSource() {
    plugins("onSourceClose", htmlTextArea);
    sourceOpen = false;
    setHtml(canvas, htmlTextArea.value);
    show(canvas);
    init();
    hide(htmlTextArea);
  }
  function init() {
    if (openSettingsState && !attached(openSettingsState.node)) {
      closeSettings();
    }
    runFilter(true);
    addClass(canvas, "ge-editing");
    toggleClass(canvas, "ge-drag-drawer", settings.drag_handle === "drawer");
    addAllColClasses();
    var cutter = textCutter();
    splitTexts(cutter);
    wrapContent(cutter);
    wrapTexts();
    createRowControls();
    createColControls();
    markContainers();
    plugins("onInit");
    makeSortable();
    makeResizable();
    switchLayout(curView);
    refreshPreviews(canvas);
  }
  function deinit() {
    closeSettings();
    removeClass(canvas, "ge-editing ge-drag-drawer ge-dropping");
    plugins("onBeforeDeinit");
    closeSizePicker();
    hideDropMarker();
    all(canvas, ".ge-tools-drawer").forEach(function(drawer) {
      drawer.remove();
    });
    unwrapTexts();
    plugins("onDeinit");
    clearPreviews(canvas);
    all(canvas, "[data-ge-row-cols]").forEach(function(row) {
      row.removeAttribute("data-ge-row-cols");
    });
    unmarkContainers();
    removeSortable();
    removeResizable();
    runFilter(false);
  }
  function getHtml() {
    deinit();
    stripPixelWidths(canvas);
    var html = canvas.innerHTML;
    init();
    return html;
  }
  function nodeHtml(node) {
    deinit();
    stripPixelWidths(node);
    var html = node.outerHTML;
    init();
    return html;
  }
  function getPlainHtml() {
    return plainHtml(getHtml());
  }
  function destroy() {
    if (sourceOpen) {
      closeSource();
    }
    deinit();
    removeConfirmModal();
    removeSettingsPanels();
    mainControls.remove();
    htmlTextArea.remove();
    lifetime.abort();
    instances.delete(canvas);
    destroyed = true;
  }
  function loadPlugins() {
    var api = pluginApi();
    registerFamily("grid", {}, widthFamily());
    if (settings.row_cols !== false) {
      registerFamily("grid", {}, rowColsFamily());
    }
    var wanted = function(name) {
      return !settings.plugins || settings.plugins.indexOf(name) !== -1;
    };
    var featureWanted = function(name, factory) {
      return factory.always === true || wanted(name);
    };
    Object.keys(GridEditor.containers).forEach(function(type) {
      if (wanted(type)) {
        CONTAINERS[type] = GridEditor.containers[type](api);
      }
    });
    Object.keys(GridEditor.features).forEach(function(name) {
      var factory = GridEditor.features[name];
      if (featureWanted(name, factory)) {
        FEATURES[name] = factory(api);
      }
    });
    Object.keys(GridEditor.utilities).forEach(function(name) {
      if (!wanted(name)) {
        return;
      }
      UTILITIES[name] = GridEditor.utilities[name](api);
      (UTILITIES[name].families || []).forEach(function(family) {
        registerFamily(name, UTILITIES[name], family);
      });
    });
    Object.keys(FEATURES).forEach(function(name) {
      var methods = FEATURES[name].methods || {};
      Object.keys(methods).forEach(function(method) {
        featureMethods[method] = methods[method];
      });
    });
    (settings.plugins || []).forEach(function(name) {
      if (CONTAINERS[name] || FEATURES[name] || UTILITIES[name]) {
        return;
      }
      warnOnceHere("plugin:" + name, 'the "' + name + '" plugin is not loaded: include dist/plugins/grideditor.' + name + ".js after the editor");
    });
  }
  function plugins(hook, argument) {
    [CONTAINERS, FEATURES, UTILITIES].forEach(function(registry) {
      Object.keys(registry).forEach(function(name) {
        if (registry[name][hook]) {
          registry[name][hook](argument);
        }
      });
    });
  }
  function pluginApi() {
    return {
      canvas,
      settings,
      t,
      warn,
      containerId,
      defaultRegion,
      createTool,
      createMoveTool,
      addSettingsTool,
      deleteNode,
      place,
      createPaneControls,
      makeLabelEditable,
      labelIn,
      unwrapLabels,
      suspendToggles,
      resumeToggles,
      emit,
      payloadFor,
      operate,
      kindOf,
      view: getView,
      viewTiers: function() {
        return tiersFor(curView).map(function(tier) {
          return tier.key;
        });
      },
      breakpoints: BREAKPOINTS.map(function(tier) {
        return tier.key;
      }),
      getUtility,
      setUtility,
      utilityField,
      bareStyle,
      rowFromLayout: rowFromLayoutValue,
      nodeHtml,
      // A text editor has rewritten a content area, so whatever the
      // editor and its plugins had put in there goes back in
      textReady,
      // A choice under a tool, offered by holding it
      attachPicker,
      openPicker,
      closePicker: closeSizePicker,
      // A node's settings panel, in its drawer or open outside it
      detailsOf,
      // A node's drawer: its first child, or for a content area the
      // one beside it in its text block
      drawerOf,
      toolbarItems: function(name) {
        return mainControls ? all(mainControls, '[data-ge-toolbar="feature"][data-ge-feature="' + name + '"]') : [];
      }
    };
  }
  function drawerOf(node) {
    if (hasClass(node, "ge-content")) {
      var textBlock = node.parentElement;
      return hasClass(textBlock, "ge-text-block") ? child(textBlock, ".ge-tools-drawer") : null;
    }
    return child(node, ".ge-tools-drawer");
  }
  var FAMILIES = {};
  var UTILITY_NODES = ".row, .column, .ge-content, .ge-element, [data-ge-container]";
  var PREVIEW_ATTR = "data-ge-preview";
  var utilitiesOpen = false;
  function registerFamily(pluginName, utility, family) {
    var name = family.name || family.prefix;
    if (FAMILIES[name]) {
      warn('the "' + pluginName + '" plugin declares the utility "' + name + '", which the "' + FAMILIES[name].plugin + '" plugin already declared: ignored');
      return;
    }
    FAMILIES[name] = {
      plugin: pluginName,
      family: Object.assign({}, family, {
        name,
        values: family.values.map(String),
        appliesTo: family.appliesTo || utility.appliesTo || ["row", "column"]
      })
    };
  }
  function familyNamed(name, method) {
    if (FAMILIES[name]) {
      return FAMILIES[name].family;
    }
    warnOnceHere("utility:" + name, method + "(" + JSON.stringify(name) + "): no loaded plugin declares that utility");
    return null;
  }
  function appliesTo(family, kind) {
    if (kind === "plain") {
      kind = "text";
    }
    if (family.appliesTo.indexOf(kind) !== -1) {
      return true;
    }
    return !!CONTAINERS[kind] && family.appliesTo.indexOf("container") !== -1;
  }
  function familiesFor(kind) {
    return Object.keys(FAMILIES).map(function(name) {
      return FAMILIES[name].family;
    }).filter(function(family) {
      return appliesTo(family, kind);
    });
  }
  function utilityClass(family, tier, value) {
    if (family.className) {
      return family.className(tier.key, value);
    }
    return family.prefix + (tier.infix ? "-" + tier.infix : "") + "-" + value;
  }
  function ownUtility(node, family, tier) {
    var classes = (node.getAttribute("class") || "").split(/\s+/);
    for (var i = 0; i < family.values.length; i++) {
      if (classes.indexOf(utilityClass(family, tier, family.values[i])) !== -1) {
        return family.values[i];
      }
    }
    return null;
  }
  function inheritedUtility(node, family, tier) {
    for (var i = BREAKPOINTS.indexOf(tier) - 1; i >= 0; i--) {
      var value = ownUtility(node, family, BREAKPOINTS[i]);
      if (value !== null) {
        return { tier: BREAKPOINTS[i], value };
      }
    }
    return null;
  }
  function effectiveUtility(node, family, tier) {
    var own2 = ownUtility(node, family, tier);
    if (own2 !== null) {
      return own2;
    }
    var inherited = inheritedUtility(node, family, tier);
    return inherited ? inherited.value : null;
  }
  function utilityTiers(node, family) {
    return BREAKPOINTS.map(function(tier) {
      return { tier, value: ownUtility(node, family, tier) };
    }).filter(function(entry) {
      return entry.value !== null;
    });
  }
  function writeUtility(node, family, tier, value) {
    family.values.forEach(function(candidate) {
      removeClass(node, utilityClass(family, tier, candidate));
    });
    if (value !== null) {
      addClass(node, utilityClass(family, tier, value));
    }
    dropEmptyClass(node);
  }
  function readUtility(node, family, view) {
    return view === ALL_VIEW ? ownUtility(node, family, BREAKPOINTS[0]) : effectiveUtility(node, family, breakpoint(view));
  }
  function planUtility(node, family, view, value) {
    if (view !== ALL_VIEW) {
      var tier = breakpoint(view);
      if (ownUtility(node, family, tier) === value) {
        return null;
      }
      return { writes: [{ tier, value }], cleared: [] };
    }
    var writes = [];
    var cleared = [];
    utilityTiers(node, family).forEach(function(entry) {
      if (entry.tier === BREAKPOINTS[0]) {
        return;
      }
      writes.push({ tier: entry.tier, value: null });
      cleared.push({ breakpoint: entry.tier.key, value: entry.value });
    });
    if (ownUtility(node, family, BREAKPOINTS[0]) !== value) {
      writes.unshift({ tier: BREAKPOINTS[0], value });
    }
    return writes.length ? { writes, cleared } : null;
  }
  function getUtility(node, name, view) {
    node = nodeFrom(node);
    var family = familyNamed(name, "getUtility");
    if (!family || !node) {
      return null;
    }
    var key = view === void 0 ? curView : viewKey(view);
    if (key === null) {
      warn("getUtility(" + JSON.stringify(view) + "): no such layout mode");
      return null;
    }
    return readUtility(node, family, key);
  }
  function setUtility(node, name, value, options) {
    options = typeof options == "string" ? { view: options } : options || {};
    node = nodeFrom(node);
    var family = familyNamed(name, "setUtility");
    if (!family || !node) {
      return false;
    }
    var view = options.view === void 0 ? curView : viewKey(options.view);
    if (view === null) {
      warn("setUtility(" + JSON.stringify(options.view) + "): no such layout mode");
      return false;
    }
    value = value === null || value === void 0 || value === "" ? null : String(value);
    if (value !== null && family.values.indexOf(value) === -1) {
      warn("setUtility: " + JSON.stringify(value) + ' is not a value of "' + name + '", which takes ' + JSON.stringify(family.values));
      return false;
    }
    var kind = kindOf(node);
    if (!appliesTo(family, kind)) {
      warn('setUtility: "' + name + '" does not apply to a ' + kind);
      return false;
    }
    if (family.write) {
      return family.write(node, value, view, options.source || "api");
    }
    var plan = planUtility(node, family, view, value);
    if (!plan) {
      return false;
    }
    return operate(function() {
      var payload = payloadFor(kind, node, {
        family: name,
        breakpoint: view,
        tiers: plan.writes.map(function(write) {
          return write.tier.key;
        }),
        from: readUtility(node, family, view),
        to: value,
        cleared: plan.cleared,
        source: options.source || "api"
      });
      if (!emit("before-utility", payload)) {
        refreshUtilities(node);
        return false;
      }
      plan.writes.forEach(function(write) {
        writeUtility(node, family, write.tier, write.value);
      });
      refreshUtilities(node);
      emit("after-utility", payload);
      return true;
    });
  }
  function bareStyle(node, name, property) {
    var family = familyNamed(name, "bareStyle");
    node = nodeFrom(node);
    if (!family || !node) {
      return null;
    }
    var original = node.getAttribute("class");
    BREAKPOINTS.forEach(function(tier) {
      writeUtility(node, family, tier, null);
    });
    var value = getComputedStyle(node).getPropertyValue(property);
    if (original === null) {
      node.removeAttribute("class");
    } else {
      node.setAttribute("class", original);
    }
    return value;
  }
  function refreshUtilities(node) {
    var details = detailsOf(node);
    if (details) {
      var classes = one(details, ".ge-classes");
      if (classes) {
        classes.value = hostClasses(node).join(" ");
      }
      children(details, ".ge-utilities").forEach(function(section) {
        renderUtilities(section);
      });
    }
    refreshPreviews(node);
  }
  function utilityNodes(scope) {
    return selfAndAll(scope, UTILITY_NODES);
  }
  function refreshPreviews(scope) {
    clearPreviews(scope);
    if (curView !== ALL_VIEW) {
      previewTier(scope, breakpoint(curView));
    }
    markRowCols(scope);
    plugins("onRefresh", scope);
  }
  function previewTier(scope, tier) {
    utilityNodes(scope).forEach(function(node) {
      var kind = kindOf(node);
      var styles = {};
      familiesFor(kind).forEach(function(family) {
        if (!family.preview || !utilityTiers(node, family).length) {
          return;
        }
        Object.assign(styles, family.preview(effectiveUtility(node, family, tier), node, kind));
      });
      if (kind === "column") {
        Object.assign(styles, rowColsPreview(node, tier));
      }
      Object.keys(UTILITIES).forEach(function(name) {
        var utility = UTILITIES[name];
        if (utility.preview) {
          Object.assign(styles, utility.preview(node, kind, tier.key));
        }
      });
      if (Object.keys(styles).length) {
        applyPreview(node, styles);
      }
    });
  }
  function applyPreview(node, styles) {
    var style = node.style;
    var was = {};
    Object.keys(styles).forEach(function(property) {
      was[property] = [style.getPropertyValue(property), style.getPropertyPriority(property)];
      style.setProperty(property, String(styles[property]), "important");
    });
    node.setAttribute(PREVIEW_ATTR, JSON.stringify(was));
  }
  function clearPreviews(scope) {
    selfAndAll(scope, "[" + PREVIEW_ATTR + "]").forEach(function(node) {
      var style = node.style;
      var was = {};
      try {
        was = JSON.parse(node.getAttribute(PREVIEW_ATTR)) || {};
      } catch (error) {
      }
      Object.keys(was).forEach(function(property) {
        var before = was[property];
        if (before && before[0]) {
          style.setProperty(property, before[0], before[1]);
        } else {
          style.removeProperty(property);
        }
      });
      node.removeAttribute(PREVIEW_ATTR);
      dropEmptyStyle(node);
    });
  }
  function createUtilitiesSection(node) {
    var kind = kindOf(node);
    var fields = familiesFor(kind).filter(function(family) {
      return family.panel !== false;
    }).map(function(family) {
      return createField(node, family);
    });
    Object.keys(UTILITIES).forEach(function(name) {
      var utility = UTILITIES[name];
      var own2 = utility.panel ? utility.panel(node, kind) : null;
      if (own2) {
        fields.push(own2);
      }
    });
    if (!fields.length) {
      return null;
    }
    var section = toggleClass(element("div", { "class": "ge-utilities" }), "ge-open", utilitiesOpen);
    sectionNodes.set(section, node);
    var toggle2 = section.appendChild(element("a", { "class": "ge-utilities-toggle" }));
    toggle2.addEventListener("click", function() {
      utilitiesOpen = !hasClass(section, "ge-open");
      settingsScope().forEach(function(scope) {
        all(scope, ".ge-utilities").forEach(function(each) {
          toggleClass(each, "ge-open", utilitiesOpen);
        });
      });
    });
    var body = section.appendChild(element("div", { "class": "ge-utilities-body" }));
    fields.forEach(function(field) {
      body.appendChild(field);
    });
    renderUtilities(section);
    return section;
  }
  function createField(node, family) {
    var field = element("label", { "class": "ge-utility", "data-ge-family": family.name });
    field.appendChild(element(
      "span",
      { "class": "ge-utility-label" },
      family.labelKey ? t(family.labelKey) : family.name
    ));
    var select = field.appendChild(element("select", { "class": "form-select form-select-sm" }));
    select.addEventListener("change", function() {
      setUtility(node, family.name, this.value, { source: "panel" });
    });
    field.appendChild(element("small", { "class": "ge-utility-note" }));
    return field;
  }
  function utilityField(node, name) {
    var family = familyNamed(name, "utilityField");
    if (!family) {
      return null;
    }
    var field = createField(node, family);
    renderField(field, node);
    return field;
  }
  function renderUtilities(section) {
    var node = sectionNodes.get(section);
    children(section, ".ge-utilities-toggle").forEach(function(toggle2) {
      toggle2.textContent = t("utility.section", { view: t(labelKeyFor(curView)) });
    });
    all(section, ".ge-utility").forEach(function(field) {
      renderField(field, node);
    });
  }
  function renderField(field, node) {
    var family = FAMILIES[field.getAttribute("data-ge-family")].family;
    var select = child(field, "select");
    var choices = family.choices ? family.choices(node, kindOf(node)) : family.values;
    var own2, blank, note = "";
    select.innerHTML = "";
    if (curView === ALL_VIEW) {
      own2 = ownUtility(node, family, BREAKPOINTS[0]);
      blank = t("utility.default");
      var varies = utilityTiers(node, family).filter(function(entry) {
        return entry.tier !== BREAKPOINTS[0];
      });
      if (varies.length) {
        note = t("utility.varies", {
          breakpoints: varies.map(function(entry) {
            return entry.tier.key;
          }).join(", ")
        });
      }
    } else {
      var tier = breakpoint(curView);
      var inherited = inheritedUtility(node, family, tier);
      own2 = ownUtility(node, family, tier);
      blank = inherited ? t("utility.inherit", { value: labelOf(family, inherited.value), breakpoint: inherited.tier.key }) : t("utility.default");
      var custom = family.blank ? family.blank(node, curView) : null;
      if (custom && own2 === null) {
        blank = custom;
      }
    }
    if (own2 !== null && choices.indexOf(own2) === -1) {
      choices = choices.concat([own2]);
    }
    select.appendChild(element("option", { value: "" }, blank));
    choices.forEach(function(value) {
      select.appendChild(element("option", { value }, labelOf(family, value)));
    });
    select.value = own2 === null ? "" : own2;
    var noteNode = child(field, ".ge-utility-note");
    noteNode.textContent = note;
    toggle(noteNode, note !== "");
  }
  function labelOf(family, value) {
    return family.label ? family.label(value) : value;
  }
  var CONTAINERS = {};
  var FEATURES = {};
  var UTILITIES = {};
  var featureMethods = {};
  var containerCounter = 0;
  function containerId(type) {
    containerCounter++;
    return "ge-" + type + "-" + containerCounter + "-" + Math.random().toString(36).slice(2, 6);
  }
  function defaultRegion() {
    var row = createRow();
    row.appendChild(createColumn(MAX_COL_SIZE));
    return row;
  }
  function containerTypeOf(container) {
    return container ? container.getAttribute("data-ge-container") : null;
  }
  function markContainers() {
    all(canvas, "[data-ge-container]").forEach(function(container) {
      var type = containerTypeOf(container);
      var definition = CONTAINERS[type];
      if (!definition) {
        warnOnceHere("container:" + type, 'unknown container type "' + type + '"');
        return;
      }
      addClass(container, "ge-container ge-container-" + type);
      definition.mark(container);
      if (!child(container, ".ge-tools-drawer")) {
        createContainerControls(container, type, definition);
      }
    });
  }
  function unmarkContainers() {
    all(canvas, "[data-ge-container]").forEach(function(container) {
      var definition = CONTAINERS[containerTypeOf(container)];
      if (definition) {
        definition.unmark(container);
      }
      removeClass(container, "ge-container ge-container-" + containerTypeOf(container));
      dropEmptyClass(container);
    });
  }
  function prependDrawer(node, className) {
    var drawer = element("div", { "class": className });
    node.insertBefore(drawer, node.firstChild);
    return drawer;
  }
  function hostTools(drawer, tools) {
    (tools || []).forEach(function(hostTool) {
      createTool(
        drawer,
        hostTool.title || "",
        hostTool.className || "",
        hostTool.iconClass || "bi bi-wrench",
        hostTool.on
      );
    });
  }
  function createContainerControls(container, type, definition) {
    var drawer = prependDrawer(container, "ge-tools-drawer ge-container-drawer");
    createMoveTool(drawer);
    addSettingsTool(drawer, container, settings.container_classes);
    hostTools(drawer, settings.container_tools);
    if (definition.tools) {
      definition.tools(drawer, container);
    }
    createTool(drawer, t("tool.delete_container"), "ge-delete-container", "bi bi-trash", function() {
      deleteNode(type, container, t("confirm.delete_container"), function(removed) {
        slideUp(container, removed);
      });
    });
    if (definition.addPane) {
      createTool(drawer, t(definition.addPaneKey), "ge-add-pane", "bi bi-plus-circle", function() {
        var pane = definition.addPane(container, {});
        addNode(definition.paneKind, pane, function() {
        }, {
          parent: container,
          source: "tool",
          container
        });
      });
    }
  }
  function createPaneControls(pane, kind, tools, confirmText, remove) {
    var drawer = prependDrawer(pane, "ge-tools-drawer ge-pane-drawer");
    createMoveTool(drawer);
    addSettingsTool(drawer, pane, settings.pane_classes);
    hostTools(drawer, tools);
    createTool(drawer, t("tool.delete_pane"), "ge-delete-pane", "bi bi-trash", function() {
      deleteNode(kind, pane, confirmText, function(removed) {
        remove(removed);
      });
    });
    return drawer;
  }
  function suspendToggles(scope) {
    if (!scope) {
      return;
    }
    selfAndAll(scope, "[data-bs-toggle], [data-bs-dismiss]").forEach(function(node) {
      ["toggle", "dismiss"].forEach(function(name) {
        var value = node.getAttribute("data-bs-" + name);
        if (value === null) {
          return;
        }
        node.setAttribute("data-ge-bs-" + name, value);
        node.removeAttribute("data-bs-" + name);
      });
    });
  }
  function resumeToggles(scope) {
    if (!scope) {
      return;
    }
    selfAndAll(scope, "[data-ge-bs-toggle], [data-ge-bs-dismiss]").forEach(function(node) {
      ["toggle", "dismiss"].forEach(function(name) {
        var value = node.getAttribute("data-ge-bs-" + name);
        if (value === null) {
          return;
        }
        node.setAttribute("data-bs-" + name, value);
        node.removeAttribute("data-ge-bs-" + name);
      });
    });
  }
  function makeLabelEditable(label) {
    if (editableLabels.has(label)) {
      return;
    }
    var toggle2 = closest(label, "[data-bs-toggle], [data-ge-bs-toggle]");
    editableLabels.add(label);
    label.setAttribute("title", t("tool.rename"));
    label.addEventListener("dblclick", function(e) {
      e.preventDefault();
      e.stopPropagation();
      suspendToggles(toggle2);
      label.setAttribute("contenteditable", "true");
      label.focus();
      window.getSelection().selectAllChildren(label);
    });
    label.addEventListener("keydown", function(e) {
      if (label.getAttribute("contenteditable") !== "true") {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        label.blur();
      }
    });
    label.addEventListener("blur", function() {
      label.removeAttribute("contenteditable");
      resumeToggles(toggle2);
    });
  }
  function labelIn(button) {
    var label = child(button, ".ge-pane-label");
    if (!label) {
      label = element("span", { "class": "ge-pane-label" }, button.textContent.trim());
      button.innerHTML = "";
      button.appendChild(label);
    }
    return label;
  }
  function unwrapLabels(scope) {
    all(scope, ".ge-pane-label").forEach(function(label) {
      editableLabels.delete(label);
      unwrap(label);
    });
  }
  function addColumnTo(row, size) {
    var column = createColumn(size);
    return addNode("column", column, function() {
      row.appendChild(column);
    }, { parent: row, source: "tool" });
  }
  function attachSizePicker(tool, row) {
    if (!settings.add_column.picker || !tool) {
      return;
    }
    attachPicker(tool, function() {
      openSizePicker(tool, row);
    });
  }
  function attachPicker(tool, open) {
    var timer = null;
    var cancel = function() {
      window.clearTimeout(timer);
      timer = null;
    };
    on(tool, "mouseenter mousedown", function() {
      if (timer || sizePicker) {
        return;
      }
      timer = window.setTimeout(function() {
        timer = null;
        open();
      }, settings.add_column.delay);
    });
    on(tool, "mouseleave mouseup", cancel);
  }
  function openSizePicker(tool, row) {
    closeSizePicker();
    var room = spare(row, leadingTier());
    var drawer = closest(tool, ".ge-tools-drawer");
    if (drawer) {
      addClass(drawer, "ge-picker-open");
    }
    sizePicker = tool.appendChild(element("div", { "class": "ge-size-picker" }));
    settings.valid_col_sizes.forEach(function(size) {
      var choice = element("a", {
        "class": "ge-size",
        "data-ge-size": size,
        title: sizeTitle(size)
      }, isUnits(size) ? size : sizeClass(BREAKPOINTS[0], size));
      toggleClass(choice, "ge-size-tight", isUnits(size) && size > room);
      toggleClass(choice, "ge-size-flex", !isUnits(size));
      choice.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeSizePicker();
        addColumnTo(row, size);
      });
      sizePicker.appendChild(choice);
    });
    withdrawOnLeave(tool);
  }
  function sizeTitle(size) {
    if (size === "equal") {
      return t("tool.column_equal");
    }
    if (size === "auto") {
      return t("tool.column_auto");
    }
    return t("tool.column_size", { size });
  }
  function closeSizePicker() {
    if (!sizePicker) {
      return false;
    }
    var drawer = closest(sizePicker, ".ge-tools-drawer");
    if (drawer) {
      removeClass(drawer, "ge-picker-open");
    }
    sizePicker.remove();
    sizePicker = null;
    return true;
  }
  function createRowControls() {
    all(canvas, ".row").forEach(function(row) {
      if (child(row, ".ge-tools-drawer")) {
        return;
      }
      var drawer = prependDrawer(row, "ge-tools-drawer");
      createMoveTool(drawer);
      addSettingsTool(drawer, row, settings.row_classes);
      hostTools(drawer, settings.row_tools);
      createTool(drawer, t("tool.delete_row"), "ge-delete-row", "bi bi-trash", function() {
        deleteNode("row", row, t("confirm.delete_row"), function(removed) {
          slideUp(row, removed);
        });
      });
      createTool(drawer, t("tool.add_column"), "ge-add-column", "bi bi-plus-circle", function() {
        if (closeSizePicker()) {
          return;
        }
        addColumnTo(row, rowColsSource(row, leadingTier()) ? null : settings.add_column.size);
      });
      attachSizePicker(child(drawer, ".ge-add-column"), row);
    });
  }
  function createColControls() {
    all(canvas, ".column").forEach(function(col) {
      if (child(col, ".ge-tools-drawer")) {
        return;
      }
      var drawer = prependDrawer(col, "ge-tools-drawer");
      createMoveTool(drawer);
      createTool(drawer, t("tool.column_narrower"), "ge-decrease-col-width", "bi bi-dash-lg", function(e) {
        resizeColumn(
          col,
          e.shiftKey ? smallest(settings.valid_col_sizes) : stepThrough(settings.valid_col_sizes.filter(isUnits), currentUnits(col), -1),
          "tool"
        );
      });
      createTool(drawer, t("tool.column_wider"), "ge-increase-col-width", "bi bi-plus-lg", function(e) {
        resizeColumn(
          col,
          e.shiftKey ? widestFor(col) : stepThrough(settings.valid_col_sizes.filter(isUnits), currentUnits(col), 1),
          "tool"
        );
      });
      createTool(drawer, t("tool.indent_decrease"), "ge-decrease-col-offset", "bi bi-text-indent-right", function(e) {
        indentColumn(
          col,
          e.shiftKey ? smallest(settings.valid_col_offsets) : stepThrough(settings.valid_col_offsets, currentOffset(col), -1),
          "tool"
        );
      });
      createTool(drawer, t("tool.indent_increase"), "ge-increase-col-offset", "bi bi-text-indent-left", function(e) {
        indentColumn(col, e.shiftKey ? deepestFor(col) : stepThrough(settings.valid_col_offsets, currentOffset(col), 1), "tool");
      });
      addSettingsTool(drawer, col, settings.col_classes);
      hostTools(drawer, settings.col_tools);
      createTool(drawer, t("tool.delete_column"), "ge-delete-column", "bi bi-trash", function() {
        deleteNode("column", col, t("confirm.delete_column"), function(removed) {
          shrinkAway(col, 400, removed, true);
        });
      });
      createTool(drawer, t("tool.add_row"), "ge-add-row", "bi bi-plus-circle", function() {
        var row = createRow();
        addNode("row", row, function() {
          col.appendChild(row);
        }, { parent: col, source: "tool" });
      });
    });
  }
  function leadingTier() {
    return curView === ALL_VIEW ? BREAKPOINTS[BREAKPOINTS.length - 1] : breakpoint(curView);
  }
  function currentSize(col) {
    var tier = leadingTier();
    if (rowColsWinner(col, tier)) {
      return null;
    }
    var size = getEffectiveSize(col, tier);
    return size === null ? MAX_COL_SIZE : size;
  }
  function currentUnits(col) {
    var size = currentSize(col);
    if (isUnits(size)) {
      return size;
    }
    var units = Math.round(outerWidth(col) / rowContentWidth(col.parentElement) * MAX_COL_SIZE);
    return Math.min(Math.max(units, 1), MAX_COL_SIZE);
  }
  function rowContentWidth(row) {
    var style = window.getComputedStyle(row);
    return row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }
  function currentOffset(col) {
    return getEffectiveOffset(col, leadingTier()) || 0;
  }
  function stepThrough(values, from, direction) {
    var index = values.indexOf(from);
    if (index === -1) {
      return values.reduce(function(best, value) {
        return Math.abs(value - from) < Math.abs(best - from) ? value : best;
      }, values[0]);
    }
    return values[Math.min(Math.max(index + direction, 0), values.length - 1)];
  }
  function smallest(values) {
    return values.filter(isUnits).reduce(function(a, b) {
      return Math.min(a, b);
    }, MAX_COL_SIZE);
  }
  function largest(values) {
    return values.filter(isUnits).reduce(function(a, b) {
      return Math.max(a, b);
    }, 0);
  }
  function widestFor(col) {
    var room = spare(col.parentElement, leadingTier(), col) - currentOffset(col);
    return Math.min(largest(settings.valid_col_sizes), Math.max(room, 1));
  }
  function deepestFor(col) {
    var room = spare(col.parentElement, leadingTier(), col) - currentUnits(col);
    return Math.min(largest(settings.valid_col_offsets), Math.max(room, 0));
  }
  function createMoveTool(drawer) {
    if (settings.drag_handle === "drawer") {
      return null;
    }
    return createTool(drawer, t("tool.move"), "ge-move", "bi bi-arrows-move");
  }
  function createTool(drawer, title, className, iconClass, eventHandlers) {
    var tool = element("a", { title, "class": className });
    tool.appendChild(element("i", { "class": iconClass }));
    drawer.appendChild(tool);
    if (typeof eventHandlers == "function") {
      tool.addEventListener("click", eventHandlers);
    }
    if (eventHandlers && typeof eventHandlers == "object") {
      Object.keys(eventHandlers).forEach(function(name) {
        on(tool, name, eventHandlers[name]);
      });
    }
    return tool;
  }
  function hostClasses(node) {
    return (node.getAttribute("class") || "").split(/\s+/).filter(function(name) {
      return name !== "" && !isEditorClass(name);
    });
  }
  function isEditorClass(name) {
    if (name === "row" || name === "column") {
      return true;
    }
    if (/^(ge-|ui-)/.test(name)) {
      return true;
    }
    if (/^col(-(sm|md|lg|xl|xxl))?(-auto)?$/.test(name)) {
      return true;
    }
    return BREAKPOINTS.some(function(tier) {
      return new RegExp("^(" + tier.colPrefix + "|" + tier.offsetPrefix + ")\\d+$").test(name);
    });
  }
  function setHostClasses(node, value) {
    hostClasses(node).forEach(function(name) {
      removeClass(node, name);
    });
    value.split(/\s+/).forEach(function(name) {
      if (name !== "") {
        addClass(node, name);
      }
    });
    dropEmptyClass(node);
  }
  function addSettingsTool(drawer, node, presets) {
    var details = createDetails(node, presets || []);
    detailsFor.set(node, details);
    createTool(drawer, t("tool.settings"), "ge-settings", "bi bi-gear-fill", function() {
      toggleSettings(node, details, this);
    });
    var kind = kindOf(node);
    Object.keys(UTILITIES).forEach(function(name) {
      if (UTILITIES[name].drawerTools) {
        UTILITIES[name].drawerTools(drawer, node, kind);
      }
    });
    Object.keys(FEATURES).forEach(function(name) {
      if (FEATURES[name].drawerTools) {
        FEATURES[name].drawerTools(drawer, node, kind);
      }
    });
    return drawer.appendChild(details);
  }
  function createDetails(container, cssClasses) {
    var detailsDiv = element("div", { "class": "ge-details" });
    var general = detailsDiv.appendChild(element("div", { "class": "ge-details-general" }));
    var field = function(label) {
      var holder = element("label", { "class": "ge-field" });
      holder.appendChild(element("span", { "class": "ge-field-label" }, label));
      return general.appendChild(holder);
    };
    var id = element("input", {
      "class": "ge-id form-control form-control-sm",
      placeholder: t("tool.id_placeholder"),
      title: t("tool.id_title")
    });
    id.value = container.getAttribute("id") || "";
    field(t("panel.id")).appendChild(id);
    id.addEventListener("change", function() {
      if (this.value === "") {
        container.removeAttribute("id");
      } else {
        container.setAttribute("id", this.value);
      }
    });
    var classes = element("input", {
      "class": "ge-classes form-control form-control-sm",
      placeholder: t("tool.classes_placeholder"),
      title: t("tool.classes_title")
    });
    classes.value = hostClasses(container).join(" ");
    field(t("panel.classes")).appendChild(classes);
    classes.addEventListener("change", function() {
      setHostClasses(container, this.value);
      refreshUtilities(container);
    });
    var classGroup = general.appendChild(element("div", { "class": "btn-group btn-group-sm ge-presets", role: "group" }));
    cssClasses.forEach(function(rowClass) {
      var on2 = hasClass(container, rowClass.cssClass);
      var btn = element("a", {
        role: "button",
        "class": "btn btn-sm btn-outline-secondary",
        title: rowClass.title ? rowClass.title : t("tool.toggle_class", { label: rowClass.label }),
        "aria-pressed": on2 ? "true" : "false"
      });
      btn.innerHTML = rowClass.label;
      toggleClass(btn, "active", on2);
      btn.addEventListener("click", function() {
        toggleClass(btn, "active");
        btn.setAttribute("aria-pressed", hasClass(btn, "active") ? "true" : "false");
        toggleClass(container, rowClass.cssClass, hasClass(btn, "active"));
        refreshUtilities(container);
      });
      classGroup.appendChild(btn);
    });
    var utilities = createUtilitiesSection(container);
    if (utilities) {
      detailsDiv.appendChild(utilities);
    }
    return detailsDiv;
  }
  var PANEL_MODES = ["offcanvas", "popover", "modal", "inline"];
  var settingsPanels = {};
  var openSettingsState = null;
  var modalState = /* @__PURE__ */ new WeakMap();
  function panelMode() {
    if (PANEL_MODES.indexOf(settings.settings_panel) !== -1) {
      return settings.settings_panel;
    }
    warnOnceHere("settings_panel", 'settings_panel "' + settings.settings_panel + '" is not one of ' + PANEL_MODES.join(", ") + ": using offcanvas");
    return "offcanvas";
  }
  function detailsOf(node) {
    return node && detailsFor.get(node) || null;
  }
  function settingsScope() {
    return openSettingsState && openSettingsState.mode !== "inline" ? [canvas, openSettingsState.details] : [canvas];
  }
  function toggleSettings(node, details, gear) {
    var mode = panelMode();
    if (mode === "inline") {
      toggle(details);
      return;
    }
    var same = openSettingsState && openSettingsState.details === details;
    closeSettings();
    if (!same) {
      openSettings(mode, node, details, gear);
    }
  }
  function openSettings(mode, node, details, gear) {
    var panel = settingsPanel(mode);
    var listening = new AbortController();
    openSettingsState = {
      mode,
      node,
      details,
      home: details.parentElement,
      next: details.nextElementSibling,
      gear,
      listening
    };
    one(panel, ".ge-settings-title").textContent = t("panel.title", { kind: kindLabel(node) });
    one(panel, ".ge-settings-body").appendChild(details);
    show(details);
    addClass(node, "ge-settings-target");
    var signal = { signal: listening.signal };
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        closeSettings();
      }
    }, signal);
    if (mode === "offcanvas") {
      var narrow = window.innerWidth < 576;
      toggleClass(panel, "offcanvas-end", !narrow);
      toggleClass(panel, "offcanvas-bottom", narrow);
      removeClass(panel, "hiding");
      panel.getBoundingClientRect();
      addClass(panel, "show");
    } else if (mode === "popover") {
      placePopover(panel, gear);
      on(window, "scroll resize", function() {
        placePopover(panel, gear);
      }, signal);
      if (window.ResizeObserver) {
        openSettingsState.observer = new window.ResizeObserver(function() {
          placePopover(panel, gear);
        });
        openSettingsState.observer.observe(details);
      }
      on(document, "mousedown touchstart", function(e) {
        if (!panel.contains(e.target) && !gear.contains(e.target)) {
          closeSettings();
        }
      }, signal);
    } else {
      showModal(panel);
    }
  }
  function closeSettings() {
    var open = openSettingsState;
    if (!open) {
      return;
    }
    openSettingsState = null;
    var panel = settingsPanels[open.mode];
    open.listening.abort();
    if (open.observer) {
      open.observer.disconnect();
    }
    if (open.mode === "offcanvas") {
      removeClass(panel, "show");
      addClass(panel, "hiding");
      window.setTimeout(function() {
        removeClass(panel, "hiding");
      }, 300);
    } else if (open.mode === "popover") {
      hide(panel);
    } else {
      hideModal(panel);
    }
    removeClass(open.node, "ge-settings-target");
    open.details.style.removeProperty("display");
    dropEmptyStyle(open.details);
    if (open.home && attached(open.home)) {
      if (open.next && open.next.parentElement === open.home) {
        open.home.insertBefore(open.details, open.next);
      } else {
        open.home.appendChild(open.details);
      }
    } else {
      open.details.remove();
    }
  }
  function settingsPanel(mode) {
    if (settingsPanels[mode]) {
      return settingsPanels[mode];
    }
    var closeButton = function() {
      return element("button", {
        type: "button",
        "class": "btn-close ge-settings-close",
        "aria-label": t("panel.close")
      });
    };
    var panel;
    if (mode === "offcanvas") {
      panel = create('<div class="offcanvas offcanvas-end ge-settings-panel ge-settings-offcanvas" tabindex="-1" role="dialog"><div class="offcanvas-header"><h5 class="offcanvas-title ge-settings-title"></h5></div><div class="offcanvas-body ge-settings-body"></div></div>');
      one(panel, ".offcanvas-header").appendChild(closeButton());
    } else if (mode === "popover") {
      panel = create('<div class="popover bs-popover-bottom ge-settings-panel ge-settings-popover" role="dialog"><div class="popover-arrow"></div><div class="popover-header"><span class="ge-settings-title"></span></div><div class="popover-body ge-settings-body"></div></div>');
      one(panel, ".popover-header").appendChild(closeButton());
      hide(panel);
    } else {
      panel = create('<div class="modal fade ge-settings-panel ge-settings-modal" tabindex="-1" role="dialog" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title ge-settings-title"></h5></div><div class="modal-body ge-settings-body"></div><div class="modal-footer"></div></div></div></div>');
      one(panel, ".modal-header").appendChild(closeButton());
      one(panel, ".modal-footer").appendChild(element("button", {
        type: "button",
        "class": "btn btn-primary ge-settings-close"
      }, t("panel.done")));
    }
    delegate(panel, "click", ".ge-settings-close", function(e) {
      e.preventDefault();
      closeSettings();
    });
    settingsPanels[mode] = document.body.appendChild(panel);
    return panel;
  }
  function removeSettingsPanels() {
    closeSettings();
    Object.keys(settingsPanels).forEach(function(mode) {
      if (mode === "modal") {
        retireModal(settingsPanels[mode]);
      } else {
        settingsPanels[mode].remove();
      }
    });
    if (settingsBackdrop) {
      settingsBackdrop.remove();
      settingsBackdrop = null;
    }
    settingsPanels = {};
  }
  function placePopover(panel, gear) {
    if (!attached(gear)) {
      return;
    }
    show(panel);
    var tool = gear.getBoundingClientRect();
    var gap = 8;
    var body = child(panel, ".popover-body");
    body.style.removeProperty("max-height");
    var width = outerWidth(panel);
    var height = outerHeight(panel);
    var roomBelow = window.innerHeight - tool.bottom - 2 * gap;
    var roomAbove = tool.top - 2 * gap;
    var below = height <= roomBelow || roomBelow >= roomAbove;
    var room = below ? roomBelow : roomAbove;
    if (height > room) {
      css(body, { "max-height": Math.max(120, room - (height - outerHeight(body))) });
      height = outerHeight(panel);
    }
    var top = below ? tool.bottom + gap : tool.top - gap - height;
    var left = Math.max(gap, Math.min(tool.left + tool.width / 2 - 24, window.innerWidth - width - gap));
    toggleClass(panel, "bs-popover-bottom", below);
    toggleClass(panel, "bs-popover-top", !below);
    css(panel, { top: top + window.pageYOffset, left: left + window.pageXOffset });
    css(child(panel, ".popover-arrow"), {
      left: Math.max(gap, Math.min(tool.left + tool.width / 2 - left - 8, width - 24))
    });
  }
  var settingsBackdrop = null;
  function showModal(panel) {
    var Modal = modalLibrary();
    if (!Modal) {
      settingsBackdrop = element("div", { "class": "modal-backdrop fade show ge-settings-backdrop" });
      settingsBackdrop.addEventListener("click", function() {
        closeSettings();
      });
      document.body.appendChild(settingsBackdrop);
      addClass(panel, "show");
      panel.style.display = "block";
      panel.removeAttribute("aria-hidden");
      return;
    }
    var modal = Modal.getOrCreateInstance(panel);
    var state = modalState.get(panel);
    if (!state) {
      state = { wanted: null, busy: false };
      modalState.set(panel, state);
      trackModal(panel);
      panel.addEventListener("hide.bs.modal", function() {
        if (state.wanted === "open") {
          state.wanted = "closed";
          state.busy = true;
        }
      });
      panel.addEventListener("shown.bs.modal", function() {
        state.busy = false;
        if (state.wanted === "closed") {
          hideModal(panel);
        }
      });
      panel.addEventListener("hidden.bs.modal", function() {
        state.busy = false;
        if (state.wanted === "open") {
          showModal(panel);
        } else if (openSettingsState && openSettingsState.mode === "modal") {
          closeSettings();
        }
      });
    }
    state.wanted = "open";
    if (!state.busy) {
      state.busy = true;
      modal.show();
    }
  }
  function hideModal(panel) {
    var Modal = modalLibrary();
    if (!Modal) {
      if (settingsBackdrop) {
        settingsBackdrop.remove();
        settingsBackdrop = null;
      }
      removeClass(panel, "show");
      panel.style.removeProperty("display");
      panel.setAttribute("aria-hidden", "true");
      return;
    }
    var state = modalState.get(panel) || { wanted: null, busy: false };
    state.wanted = "closed";
    if (!state.busy && hasClass(panel, "show")) {
      state.busy = true;
      Modal.getOrCreateInstance(panel).hide();
    }
  }
  function kindLabel(node) {
    var kind = kindOf(node);
    if (CONTAINERS[kind] && CONTAINERS[kind].labelKey) {
      return t(CONTAINERS[kind].labelKey);
    }
    switch (kind) {
      case "row":
        return t("panel.kind_row");
      case "column":
        return t("panel.kind_column");
      case "text":
        return t("panel.kind_text");
      case "element":
        return t("panel.kind_element");
      case "section":
        return t("panel.kind_section");
      case "tab":
        return t("panel.kind_tab");
      case "accordion-item":
        return t("panel.kind_accordion_item");
      default:
        return kind;
    }
  }
  function addAllColClasses() {
    all(canvas, '.column, div[class*="col-"], div.col').forEach(function(col) {
      addClass(col, "column");
      if (sizedTiers(col).length || hasRowCols(col.parentElement)) {
        return;
      }
      setSize(col, BREAKPOINTS[0], MAX_COL_SIZE);
    });
  }
  function hasRowCols(row) {
    return hasClass(row, "row") && BREAKPOINTS.some(function(tier) {
      return ROW_COLS_VALUES.some(function(value) {
        return hasClass(row, rowColsClass(tier, value));
      });
    });
  }
  function rowColsSource(row, tier) {
    if (!hasClass(row, "row")) {
      return null;
    }
    for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
      for (var v = 0; v < ROW_COLS_VALUES.length; v++) {
        if (hasClass(row, rowColsClass(BREAKPOINTS[i], ROW_COLS_VALUES[v]))) {
          return { tier: i, value: ROW_COLS_VALUES[v] };
        }
      }
    }
    return null;
  }
  function columnSource(col, tier) {
    for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
      var size = getSize(col, BREAKPOINTS[i]);
      if (size !== null) {
        return { tier: i, size };
      }
    }
    return null;
  }
  function rowColsWinner(col, tier) {
    var row = rowColsSource(col.parentElement, tier);
    if (!row) {
      return null;
    }
    var own2 = columnSource(col, tier);
    if (!own2 || row.tier > own2.tier) {
      return row;
    }
    return row.tier === own2.tier && own2.size === "equal" ? row : null;
  }
  function rowColsUnits(winner) {
    return winner.value === "auto" ? 0 : MAX_COL_SIZE / parseInt(winner.value, 10);
  }
  function rowColsPreview(col, tier) {
    var winner = rowColsWinner(col, tier);
    if (winner) {
      return {
        flex: "0 0 auto",
        width: winner.value === "auto" ? "auto" : 100 / parseInt(winner.value, 10) + "%",
        "max-width": "100%"
      };
    }
    if (hasRowCols(col.parentElement) && !columnSource(col, tier)) {
      return { flex: "0 0 auto", width: "100%", "max-width": "100%" };
    }
    return {};
  }
  function markRowCols(scope) {
    selfAndAll(scope, ".row").forEach(function(row) {
      var source = settings.row_cols === false ? null : curView === ALL_VIEW ? rowColsSource(row, BREAKPOINTS[0]) || null : rowColsSource(row, breakpoint(curView));
      if (!source) {
        row.removeAttribute("data-ge-row-cols");
      } else {
        row.setAttribute("data-ge-row-cols", rowColsLabel(source.value));
      }
    });
  }
  function rowColsLabel(value) {
    return value === "auto" ? t("badge.row_cols_auto") : t("badge.row_cols", { count: value });
  }
  function rowColsFamily() {
    return {
      name: "row-cols",
      prefix: "row-cols",
      values: ROW_COLS_VALUES,
      appliesTo: ["row"],
      labelKey: "utility.row_cols"
    };
  }
  function getSize(col, tier) {
    var units = readUnits(col, tier.colPrefix);
    if (units !== null) {
      return units;
    }
    if (hasClass(col, sizeClass(tier, "auto"))) {
      return "auto";
    }
    if (hasClass(col, sizeClass(tier, "equal"))) {
      return "equal";
    }
    return null;
  }
  function getOffset(col, tier) {
    return readUnits(col, tier.offsetPrefix);
  }
  function getEffectiveSize(col, tier) {
    return readEffective(col, tier, getSize);
  }
  function getEffectiveOffset(col, tier) {
    return readEffective(col, tier, getOffset);
  }
  function readEffective(col, tier, read) {
    for (var i = BREAKPOINTS.indexOf(tier); i >= 0; i--) {
      var units = read(col, BREAKPOINTS[i]);
      if (units !== null) {
        return units;
      }
    }
    return null;
  }
  function readUnits(col, prefix) {
    var match = new RegExp("(?:^|\\s)" + prefix + "(\\d+)(?:\\s|$)").exec(col.getAttribute("class") || "");
    return match ? parseInt(match[1], 10) : null;
  }
  function writeUnits(col, prefix, units) {
    var classes = (col.getAttribute("class") || "").split(/\s+/).filter(function(name) {
      return name !== "" && !new RegExp("^" + prefix + "\\d+$").test(name);
    });
    if (units !== null) {
      classes.push(prefix + units);
    }
    col.setAttribute("class", classes.join(" "));
  }
  function setSize(col, tier, size) {
    writeUnits(col, tier.colPrefix, null);
    FLEX_SIZES.forEach(function(flex) {
      removeClass(col, sizeClass(tier, flex));
    });
    if (size !== null && size !== void 0) {
      addClass(col, sizeClass(tier, size));
    }
  }
  function setOffset(col, tier, units) {
    writeUnits(col, tier.offsetPrefix, units ? units : null);
  }
  function sizedTiers(col) {
    return BREAKPOINTS.filter(function(tier) {
      return getSize(col, tier) !== null;
    });
  }
  function spare(row, tier, ignore) {
    var used = 0;
    children(row, ".column").forEach(function(sibling) {
      if (ignore && sibling === ignore) {
        return;
      }
      var winner = rowColsWinner(sibling, tier);
      var size = winner ? rowColsUnits(winner) : getEffectiveSize(sibling, tier);
      used += (isUnits(size) ? size : 0) + (getEffectiveOffset(sibling, tier) || 0);
    });
    return MAX_COL_SIZE - used;
  }
  function clamp(request) {
    var size = request.size === null || request.size === void 0 ? null : request.size;
    var offset2 = request.offset === null || request.offset === void 0 ? 0 : request.offset;
    offset2 = Math.min(Math.max(offset2, 0), MAX_COL_OFFSET);
    if (size === null || !isUnits(size)) {
      return { size, offset: offset2, refused: false };
    }
    size = Math.min(Math.max(size, 1), MAX_COL_SIZE);
    if (size + offset2 <= MAX_COL_SIZE) {
      return { size, offset: offset2, refused: false };
    }
    if (request.leading === "offset") {
      return { size: MAX_COL_SIZE - offset2, offset: offset2, refused: false };
    }
    return { size: null, offset: offset2, refused: true };
  }
  function stripPixelWidths(scope) {
    selfAndAll(scope, ".column").forEach(function(col) {
      css(col, { width: "", height: "", left: "", top: "" });
      dropEmptyStyle(col);
    });
  }
  function groupName(name) {
    return "ge-" + name + "-" + instanceId;
  }
  function blockSelector() {
    return [".row", ".ge-text-block", ".ge-content", "[data-ge-container]"].concat(pluginHooks("blocks")).join(", ");
  }
  function pluginHooks(name) {
    return Object.keys(FEATURES).map(function(key) {
      return FEATURES[key][name] || null;
    }).filter(function(hook) {
      return hook !== null;
    });
  }
  function acceptsBlock(region, node) {
    var accepted = true;
    Object.keys(FEATURES).forEach(function(name) {
      var feature = FEATURES[name];
      if (accepted && feature.accepts && feature.accepts(region, node) === false) {
        accepted = false;
      }
    });
    return accepted;
  }
  function dragCancelSelector() {
    return settings.drag_handle === "drawer" ? ".ge-tools-drawer > a:not(.ge-text-info):not(.ge-element-info), .ge-details, input, textarea, button, select, option" : "input, textarea, button, select, option";
  }
  function sortable(lists, options) {
    var Sortable = sortableLibrary();
    lists = Array.isArray(lists) ? lists : lists ? [lists] : [];
    if (!lists.length || !Sortable) {
      return;
    }
    var wholeDrawer = settings.drag_handle === "drawer";
    var cancel = dragCancelSelector();
    var soloGroup = 0;
    lists.forEach(function(list) {
      var group = options.group ? { name: groupName(options.group) } : { name: groupName(options.draggable + "-" + ++soloGroup), pull: false, put: false };
      if (options.group && options.accepts) {
        group.put = function(to, from, dragged) {
          return from.options.group.name === group.name && options.accepts(to.el, dragged);
        };
      }
      sortables.push(Sortable.create(list, Object.assign({
        group,
        draggable: options.draggable,
        handle: wholeDrawer ? ".ge-tools-drawer" : ".ge-tools-drawer .ge-move",
        /**
         * Two refusals in one, because SortableJS asks once.
         *
         * A tool or a form field never starts a drag, as the
         * cancel list said before. And only a direct child of
         * this list moves: the selector is matched against every
         * descendant, so without this the canvas would pick up a
         * row nested three columns down and drag that.
         */
        filter: function(e, item) {
          if (closest(e.target, cancel, list)) {
            return true;
          }
          return !item || item.parentNode !== list;
        },
        // A filtered pointerdown is still a click on a tool
        preventOnFilter: false,
        // The HTML5 drag and drop API cannot be driven by
        // synthetic events, so the tests could not exist without
        // this; it also gives one helper across browsers
        forceFallback: true,
        // The copy that follows the pointer is appended to the
        // list the drag started in rather than to the body: it is
        // positioned fixed either way, and inside the canvas it
        // looks like what it is a copy of. On the body none of the
        // editing styles reached it - its drawers came out
        // unstyled, their settings panels open.
        fallbackOnBody: false,
        ghostClass: "ge-drag-placeholder",
        chosenClass: "ge-drag-chosen",
        dragClass: "ge-drag-helper",
        fallbackClass: "ge-drag-helper",
        animation: settings.drag.animation,
        // One delay, which applies to both gestures or to touch
        // alone: a touch drag that starts instantly takes the
        // page's scrolling with it, a mouse drag has no such
        // problem, and asking for `delay` means asking for both
        delay: settings.drag.delay || settings.drag.touch_delay,
        delayOnTouchOnly: !settings.drag.delay,
        touchStartThreshold: settings.drag.threshold,
        scroll: settings.drag.scroll,
        onStart: sortStart,
        onEnd: sortEnd
      }, options.options || {})));
    });
  }
  function makeSortable() {
    if (!sortableLibrary()) {
      warnOnceHere("sortable_missing", t("error.sortable_missing"));
      return;
    }
    sortable(all(canvas, ".row"), {
      draggable: ".column",
      group: "column"
    });
    sortable([canvas].concat(all(canvas, ".column")), {
      draggable: blockSelector(),
      group: "block",
      accepts: acceptsBlock
    });
    var regions = pluginHooks("regions");
    if (regions.length) {
      sortable(all(canvas, regions.join(", ")), {
        draggable: ">" + blockSelector(),
        group: "block",
        accepts: acceptsBlock
      });
    }
    plugins("onSortable", sortable);
  }
  function sortStart(e) {
    var node = e.item;
    var from = positionOf(node);
    var subject = moveSubject(node);
    var move = { from, canceled: false };
    moves.set(node, move);
    operate(function() {
      var moving = emit("before-move", payloadFor(subject.kind, subject.node, {
        parent: from.parent,
        source: "dragdrop",
        from
      }));
      if (!moving) {
        move.canceled = true;
      }
    });
  }
  function moveSubject(item) {
    var node = hasClass(item, "ge-text-block") ? child(item, ".ge-content") || item : item;
    return { kind: kindOf(node), node };
  }
  function putBack(node, from) {
    var siblings = children(from.parent).filter(function(child2) {
      return child2 !== node && !hasClass(child2, "ge-tools-drawer");
    });
    if (!siblings.length || from.index >= siblings.length) {
      from.parent.appendChild(node);
    } else {
      from.parent.insertBefore(node, siblings[from.index]);
    }
  }
  function sortEnd(e) {
    var node = e.item;
    var move = moves.get(node);
    var from = move ? move.from : positionOf(node);
    moves.delete(node);
    if (move && move.canceled) {
      putBack(node, from);
      return;
    }
    var to = positionOf(node);
    if (to.parent === from.parent && to.index === from.index) {
      return;
    }
    var container = closest(node, "[data-ge-container]");
    var definition = CONTAINERS[containerTypeOf(container)];
    if (definition && definition.afterPaneMove) {
      definition.afterPaneMove(container, node, from);
    }
    var subject = moveSubject(node);
    operate(function() {
      emit("after-move", payloadFor(subject.kind, subject.node, {
        parent: to.parent,
        source: "dragdrop",
        from,
        to,
        container: container || void 0
      }));
    });
  }
  function makeResizable() {
    if (!settings.resize.enabled) {
      return;
    }
    all(canvas, ".column").forEach(function(col) {
      if (child(col, ".ge-resize-handle")) {
        return;
      }
      var drawer = child(col, ".ge-tools-drawer");
      if (drawer) {
        drawer.appendChild(element("span", { "class": "ge-resize-size" }));
      }
      resizeEdges().forEach(function(edge) {
        var handle = element("span", {
          "class": "ge-resize-handle ge-resize-" + edge,
          "data-ge-edge": edge
        });
        handle.addEventListener("pointerdown", startResizeDrag);
        col.appendChild(handle);
      });
    });
  }
  function resizeEdges() {
    return String(settings.resize.handles).split(",").map(function(edge) {
      return edge.trim();
    }).filter(function(edge) {
      return edge === "e" || edge === "w";
    });
  }
  function startResizeDrag(e) {
    var handle = e.currentTarget;
    var col = handle.parentElement;
    var west = handle.getAttribute("data-ge-edge") === "w";
    var startX = e.pageX;
    var startWidth = outerWidth(col);
    e.preventDefault();
    if (!resizeStart(col)) {
      return;
    }
    addClass(col, "ge-resizing");
    if (e.pointerId !== void 0 && handle.setPointerCapture) {
      handle.setPointerCapture(e.pointerId);
    }
    function widthAt(move) {
      var delta = move.pageX - startX;
      return Math.max(1, startWidth + (west ? -delta : delta));
    }
    function onMove(move) {
      col.style.width = widthAt(move) + "px";
      resizeMove(col, widthAt(move));
    }
    function onUp(up) {
      handle.removeEventListener("pointermove", onMove);
      off(handle, "pointerup pointercancel", onUp);
      removeClass(col, "ge-resizing");
      resizeStop(col, widthAt(up));
    }
    handle.addEventListener("pointermove", onMove);
    on(handle, "pointerup pointercancel", onUp);
  }
  function removeResizable() {
    all(canvas, ".ge-resize-handle").forEach(function(handle) {
      handle.remove();
    });
    all(canvas, ".ge-resize-size").forEach(function(readout) {
      readout.remove();
    });
    stripPixelWidths(canvas);
  }
  function snapUnits(col, pixels) {
    var units = Math.round(pixels / rowContentWidth(col.parentElement) * MAX_COL_SIZE);
    var next = balanceSibling(col);
    var nextSize = next ? currentSize(next) : null;
    var resize = resizes.get(col);
    var own2 = resize ? resize.units : currentUnits(col);
    var room = next && isUnits(nextSize) ? own2 + nextSize - smallest(settings.valid_col_sizes) : MAX_COL_SIZE - currentOffset(col);
    return Math.min(
      Math.max(units, smallest(settings.valid_col_sizes)),
      Math.max(room, smallest(settings.valid_col_sizes)),
      largest(settings.valid_col_sizes)
    );
  }
  function balanceSibling(col) {
    if (settings.resize.balance !== "next") {
      return null;
    }
    return nextAll(col, ".column")[0] || null;
  }
  function resizeReadout(col, text) {
    var drawer = child(col, ".ge-tools-drawer");
    var readout = drawer ? child(drawer, ".ge-resize-size") : null;
    if (readout) {
      readout.textContent = text;
    }
  }
  function sizeLabel(units) {
    return (curView === ALL_VIEW ? BREAKPOINTS[0].colPrefix : leadingTier().colPrefix) + units;
  }
  function resizeStart(col) {
    var from = currentSize(col);
    var allowed = operate(function() {
      return emit("before-resize", payloadFor("column", col, {
        source: "dragdrop",
        from,
        to: null
        // Not known until the pointer stops
      }));
    });
    if (!allowed) {
      return false;
    }
    var resize = { from, units: currentUnits(col) };
    resizes.set(col, resize);
    resizeReadout(col, sizeLabel(resize.units));
    return true;
  }
  function resizeMove(col, width) {
    resizeReadout(col, sizeLabel(snapUnits(col, width)));
  }
  function resizeStop(col, width) {
    var resize = resizes.get(col);
    var units = snapUnits(col, width);
    resizes.delete(col);
    resizeReadout(col, "");
    stripPixelWidths(col);
    if (!resize) {
      return;
    }
    if (units === resize.units) {
      return;
    }
    var plan = planSize(col, units);
    if (!plan) {
      return;
    }
    operate(function() {
      writeSize(col, plan);
      balanceAfterResize(col, units - resize.units);
      refreshUtilities(col);
      emit("after-resize", payloadFor("column", col, withCleared({
        source: "dragdrop",
        from: resize.from,
        to: plan.size
      }, plan.cleared)));
    });
  }
  function balanceAfterResize(col, delta) {
    var next = balanceSibling(col);
    if (!next || !delta) {
      return;
    }
    var size = currentSize(next);
    if (!isUnits(size)) {
      return;
    }
    var plan = planSize(next, size - delta);
    if (plan) {
      writeSize(next, plan);
      refreshUtilities(next);
    }
  }
  function removeSortable() {
    sortables.forEach(function(sortableInstance) {
      sortableInstance.destroy();
    });
    sortables = [];
  }
  function createRow() {
    return element("div", { "class": "row" });
  }
  function place(node, kind, options) {
    var placement = null;
    PLACEMENTS.forEach(function(name) {
      if (placement === null && options && options[name] !== void 0) {
        placement = name;
      }
    });
    if (placement === null) {
      return node;
    }
    var target = nodeFrom(options[placement]);
    if (!target) {
      warn(kind + ": " + placement + " matches no element; the " + kind + " is left detached");
      return node;
    }
    var parent = placement === "appendTo" || placement === "prependTo" ? target : target.parentElement;
    var add = function() {
      return addNode(kind, node, function() {
        if (placement === "appendTo") {
          target.appendChild(node);
        } else if (placement === "prependTo") {
          target.insertBefore(node, target.firstChild);
        } else if (placement === "insertBefore") {
          target.parentNode.insertBefore(node, target);
        } else {
          insertAfter(node, target);
        }
      }, { parent, source: options.source || "api" });
    };
    if (operationDepth > 0) {
      defer(add);
      return node;
    }
    return add();
  }
  function apiCreateRow(layout, options) {
    var row = createRow();
    if (layout !== void 0 && !Array.isArray(layout) && !(layout && layout.row_cols)) {
      warn("createRow: the layout is an array of column sizes, as in [8, 4], or { row_cols, columns }. Making an empty row instead.");
      layout = [];
    }
    if (layout && !Array.isArray(layout)) {
      row = rowFromLayoutValue(layout);
    }
    (Array.isArray(layout) ? layout : []).forEach(function(size) {
      row.appendChild(createColumn(size));
    });
    return place(row, "row", options);
  }
  function apiCreateColumn(size, options) {
    options = options || {};
    var into = nodeFrom(options.appendTo || options.prependTo || null);
    if (size === void 0 && into && rowColsSource(into, leadingTier())) {
      size = null;
    } else if (!isUnits(size) && FLEX_SIZES.indexOf(size) === -1) {
      warn("createColumn: no column size given, using " + MAX_COL_SIZE);
      size = MAX_COL_SIZE;
    }
    var column = createColumn(size, options.offset);
    if (options.content !== void 0) {
      column.appendChild(contentFor(options.content));
    }
    return place(column, "column", options);
  }
  function apiCreateContainer(type, options) {
    options = options || {};
    var definition = CONTAINERS[type];
    if (!definition) {
      warn('createContainer: no such container type "' + type + '"');
      return null;
    }
    return place(definition.create(options), type, options);
  }
  function addPaneTo(container, type, options) {
    container = nodeFrom(container);
    options = options || {};
    var definition = CONTAINERS[containerTypeOf(container)];
    if (!definition || containerTypeOf(container) !== type) {
      warn("this is not a " + type + " container");
      return null;
    }
    var pane = definition.addPane(container, options);
    return addNode(definition.paneKind, pane, function() {
    }, {
      parent: container,
      source: "api",
      container
    });
  }
  function settingsCopy() {
    var copy = {};
    Object.keys(settings).forEach(function(key) {
      var value = settings[key];
      copy[key] = Array.isArray(value) ? value.slice() : value;
    });
    return Object.freeze(copy);
  }
  function createColumn(size, offset2) {
    var column = element("div", { "class": "column" });
    var tier = tiersFor(curView)[0];
    var wanted = clamp({ size, offset: offset2 || 0, leading: "offset" });
    setSize(column, tier, wanted.size === null ? size : wanted.size);
    setOffset(column, tier, wanted.offset);
    return column;
  }
  function runFilter(isInit) {
    if (!settings.custom_filter || !settings.custom_filter.length) {
      return;
    }
    var filters = typeof settings.custom_filter === "string" || typeof settings.custom_filter === "function" ? [settings.custom_filter] : settings.custom_filter;
    Array.prototype.forEach.call(filters, function(func) {
      if (typeof func == "string") {
        func = window[func];
      }
      func(canvas, isInit);
    });
  }
  function textCutter() {
    var cuts = [".row", "[data-ge-container]"];
    Object.keys(FEATURES).forEach(function(name) {
      var feature = FEATURES[name];
      var cut = typeof feature.cuts === "function" ? feature.cuts() : feature.cuts;
      if (cut) {
        cuts.push(cut);
      }
    });
    return cuts.join(", ");
  }
  function splitTexts(cutter) {
    all(canvas, ".column > .ge-content, .column > .ge-text-block > .ge-content").forEach(function(area) {
      if (hasClass(area, "ge-rte-active") || !children(area, cutter).length) {
        return;
      }
      var type = area.getAttribute("data-ge-content-type");
      var anchor = hasClass(area.parentElement, "ge-text-block") ? area.parentElement : area;
      var pieces = [];
      var run = [];
      Array.prototype.slice.call(area.childNodes).forEach(function(node) {
        if (node.nodeType === 1 && node.matches(cutter)) {
          pieces.push({ text: run }, { block: node });
          run = [];
        } else {
          run.push(node);
        }
      });
      pieces.push({ text: run });
      while (area.firstChild) {
        area.removeChild(area.firstChild);
      }
      var kept = false;
      var last = anchor;
      pieces.forEach(function(piece) {
        var placed;
        if (piece.block) {
          placed = piece.block;
        } else if (!hasContent(piece.text)) {
          return;
        } else if (kept) {
          placed = createDefaultContentWrapper(type);
          piece.text.forEach(function(node) {
            placed.appendChild(node);
          });
        } else {
          piece.text.forEach(function(node) {
            area.appendChild(node);
          });
          placed = anchor;
          kept = true;
        }
        if (placed !== last) {
          insertAfter(placed, last);
        }
        last = placed;
      });
      if (!kept) {
        anchor.remove();
      }
    });
  }
  function hasContent(nodes) {
    return nodes.some(function(node) {
      return node.nodeType === 1 || node.nodeType === 3 && /\S/.test(node.nodeValue);
    });
  }
  function wrapContent(cutter) {
    all(canvas, ".column").forEach(function(col) {
      var contents = [];
      children(col).forEach(function(child2) {
        if (is(child2, ".ge-tools-drawer, .ge-resize-handle")) {
          return;
        }
        if (is(child2, ".ge-content, .ge-text-block") || child2.matches(cutter)) {
          contents = doWrap(contents);
        } else {
          contents.push(child2);
        }
      });
      doWrap(contents);
    });
  }
  function doWrap(contents) {
    if (contents.length) {
      var contentArea = insertAfter(createDefaultContentWrapper(), contents[contents.length - 1]);
      contents.forEach(function(node) {
        contentArea.appendChild(node);
      });
    }
    return [];
  }
  function createDefaultContentWrapper(type) {
    var contentArea = element("div", { "class": "ge-content" });
    if (type) {
      addClass(contentArea, "ge-content-type-" + type);
      contentArea.setAttribute("data-ge-content-type", type);
    }
    return contentArea;
  }
  function wrapTexts() {
    all(canvas, ".column > .ge-content").forEach(function(area) {
      wrap(area, element("div", { "class": "ge-text-block" }));
    });
    all(canvas, ".ge-text-block").forEach(function(textBlock) {
      if (child(textBlock, ".ge-tools-drawer")) {
        return;
      }
      var area = child(textBlock, ".ge-content");
      var type = area ? area.getAttribute("data-ge-content-type") : null;
      if (!type) {
        createPlainControls(textBlock);
      } else if (!hasTextOwner(type)) {
        createOrphanControls(textBlock, type);
      }
    });
  }
  function unwrapTexts() {
    all(canvas, ".ge-text-block").forEach(function(textBlock) {
      unwrap(textBlock);
    });
  }
  function createPlainControls(textBlock) {
    var block = child(textBlock, ".ge-content");
    var drawer = prependDrawer(textBlock, "ge-tools-drawer ge-text-drawer ge-plain-drawer");
    addClass(textBlock, "ge-plain-block");
    createMoveTool(drawer);
    Object.keys(FEATURES).forEach(function(name) {
      if (FEATURES[name].plainTools) {
        FEATURES[name].plainTools(drawer, block);
      }
    });
    createTool(drawer, t("tool.delete_plain"), "ge-delete-plain", "bi bi-trash", function() {
      deleteNode("plain", block, t("confirm.delete_plain"), function(removed) {
        slideUp(textBlock, function() {
          textBlock.remove();
          removed();
        });
      });
    });
  }
  function createOrphanControls(textBlock, type) {
    var block = child(textBlock, ".ge-content");
    var drawer = prependDrawer(textBlock, "ge-tools-drawer ge-text-drawer");
    createMoveTool(drawer);
    createTool(
      drawer,
      t("text.no_editor", { type }),
      "ge-text-info ge-text-missing",
      "bi bi-exclamation-triangle"
    );
    createTool(drawer, t("tool.delete_text"), "ge-delete-text", "bi bi-trash", function() {
      deleteNode("text", block, t("confirm.delete_text"), function(removed) {
        slideUp(textBlock, function() {
          textBlock.remove();
          removed();
        });
      });
    });
  }
  function contentFor(content) {
    var offers = textOffers();
    var area = createDefaultContentWrapper(offers.length ? offers[0].type : null);
    if (content && content.nodeType) {
      area.appendChild(content);
    } else {
      setHtml(area, content);
    }
    return area;
  }
  function switchLayout(view) {
    curView = view;
    VIEW_KEYS.forEach(function(key) {
      toggleClass(canvas, "ge-layout-" + key, key === view);
    });
    one(layoutDropdown, "button").textContent = t(labelKeyFor(view));
  }
  function viewKey(view) {
    if (typeof view == "number") {
      warnOnceHere("changeView-index", "changeView(" + view + "): layout modes are identified by breakpoint key now, so pass one of " + JSON.stringify(VIEW_KEYS) + ". Numeric indexes still work, but they mean what they meant in 2.x (" + LEGACY_VIEW_INDEXES.join(", ") + ") and will be dropped.");
      return LEGACY_VIEW_INDEXES[view] || null;
    }
    return VIEW_KEYS.indexOf(view) === -1 ? null : view;
  }
  function changeView(view) {
    var key = viewKey(view);
    if (key === null) {
      warn("changeView(" + JSON.stringify(view) + "): no such layout mode");
      return;
    }
    var from = curView;
    switchLayout(key);
    if (key === from) {
      return;
    }
    settingsScope().forEach(function(scope) {
      all(scope, ".ge-utilities").forEach(function(section) {
        renderUtilities(section);
      });
    });
    refreshPreviews(canvas);
    plugins("onViewChange", key);
    emit("view-change", { canvas, breakpoint: key, from, to: key });
  }
  function getView() {
    return curView;
  }
  function featureMethod(name, plugin, file) {
    return function() {
      if (!featureMethods[name]) {
        warnOnceHere("plugin:" + plugin, name + " needs the " + plugin + " plugin: include dist/plugins/grideditor." + file + ".js after the editor");
        return null;
      }
      return featureMethods[name].apply(null, arguments);
    };
  }
  var own = {
    getHtml,
    getPlainHtml,
    init: function() {
      defer(init);
    },
    reset: function() {
      defer(reset);
    },
    deinit,
    destroy,
    changeView,
    getView,
    createRow: apiCreateRow,
    createColumn: apiCreateColumn,
    createText: function(type, options) {
      if (!featureMethods.createText) {
        warnOnceHere("plugin:text", "createText needs a text editor plugin: include dist/plugins/grideditor.tinymce.js, or another editor's, after the editor");
        return null;
      }
      return featureMethods.createText(type, options);
    },
    createElement: featureMethod("createElement", "elements", "elements"),
    createSection: featureMethod("createSection", "sections", "sections"),
    createContainer: apiCreateContainer,
    addTab: function(container, options) {
      return addPaneTo(container, "tabs", options);
    },
    addAccordionItem: function(container, options) {
      return addPaneTo(container, "accordion", options);
    },
    setLocale,
    getUtility,
    setUtility
  };
  Object.keys(own).forEach(function(name) {
    var value = !!(METHODS[name] && METHODS[name].value);
    instance[name] = function() {
      if (destroyed) {
        warnOnceHere("destroyed:" + name, t("warning.destroyed", { method: name }));
        if (name === "getHtml") {
          return canvas.innerHTML;
        }
        if (name === "getPlainHtml") {
          return plainHtml(canvas.innerHTML);
        }
        return value ? null : instance;
      }
      var result = own[name].apply(instance, arguments);
      return value ? result : instance;
    };
  });
  instance.canvas = canvas;
  instance.settings = settingsCopy();
  instances.set(canvas, instance);
  loadPlugins();
  instance.settings = settingsCopy();
  setup();
  init();
  GridEditor._created.forEach(function(hook) {
    hook(instance);
  });
}
GridEditor._created = [];
GridEditor.containers = {};
GridEditor.features = {};
GridEditor.utilities = {};
GridEditor.texts = {};
GridEditor.t = translate;
GridEditor._plainHtml = plainHtml;
GridEditor.Sortable = null;
GridEditor.bootstrap = null;
GridEditor.version = false ? "dev" : "7.2.0";
GridEditor.locales = {
  en: {
    "tool.move": "Move",
    "tool.settings": "Settings",
    "tool.add_row": "Add row",
    "tool.delete_text": "Remove text",
    "tool.delete_plain": "Remove content",
    "tool.convert_type": "Edit as {editor} text",
    "text.no_editor": 'No text editor "{type}" is loaded: this text can be moved and deleted, not edited',
    "tool.add_column": "Add column\n(hold to choose the width)",
    "tool.column_size": "{size} of 12",
    "tool.column_equal": "Equal: shares what the row has left",
    "tool.column_auto": "Auto: as wide as its content",
    "tool.delete_row": "Remove row",
    "tool.delete_column": "Remove col",
    "tool.delete_container": "Remove container",
    "tool.delete_pane": "Remove pane",
    "tool.rename": "Double click to rename",
    "tool.column_narrower": "Make column narrower\n(hold shift for min)",
    "tool.column_wider": "Make column wider\n(hold shift for max)",
    "tool.indent_decrease": "Decrease indent\n(hold shift for none)",
    "tool.indent_increase": "Increase indent\n(hold shift for max)",
    "tool.edit_source": "Edit Source Code",
    "tool.preview": "Preview",
    "panel.title": "{kind} settings",
    "panel.close": "Close",
    "panel.done": "Done",
    "panel.id": "Id",
    "panel.classes": "Classes",
    "panel.kind_row": "Row",
    "panel.kind_column": "Column",
    "panel.kind_element": "Element",
    "panel.kind_section": "Section",
    "panel.kind_tab": "Tab",
    "panel.kind_accordion_item": "Accordion item",
    "tool.id_placeholder": "id",
    "tool.id_title": "Set a unique identifier",
    "tool.classes_placeholder": "classes",
    "tool.classes_title": "Css classes, separated by spaces",
    "tool.toggle_class": 'Toggle "{label}" styling',
    "row.add": "Add row {layout}",
    "row.add_row_cols": "Add a row of {columns} columns, {counts} per row",
    "confirm.title": "Confirm",
    "confirm.ok": "Delete",
    "confirm.cancel": "Cancel",
    "confirm.delete_row": "Delete row?",
    "confirm.delete_column": "Delete column?",
    "confirm.delete_text": "Delete this text?",
    "confirm.delete_plain": "Delete this content?",
    "confirm.delete_container": "Delete this container and everything in it?",
    "view.all": "All sizes",
    "view.xs": "Phone",
    "view.sm": "Tablet",
    "view.md": "Small desktop",
    "view.lg": "Desktop",
    "view.xl": "Large desktop",
    "view.xxl": "Widescreen",
    "utility.section": "Responsive: {view}",
    "utility.col_width": "Width",
    "utility.col_equal": "Equal",
    "utility.col_auto": "Auto",
    "utility.col_from_row": "From the row: {count}",
    "utility.row_cols": "Columns per row",
    "badge.row_cols": "{count} per row",
    "badge.row_cols_auto": "As wide as their content",
    "utility.default": "Default",
    "utility.inherit": "Inherit: {value} (from {breakpoint})",
    "utility.varies": "Changes at {breakpoints}; choosing here replaces that",
    "error.sortable_missing": "SortableJS not available! Make sure you loaded the Sortable js file; dragging is off without it.",
    "warning.setting_removed": "The {setting} setting was removed in 4.0. Use {replacement} instead.",
    "warning.already_editing": "This element already has an editor: that one is handed back, with the options it was made with.",
    "warning.destroyed": "{method}() was called on an editor that has been destroyed, and does nothing.",
    "warning.duplicate_build": "grideditor.js was loaded twice: the first GridEditor is kept.",
    "warning.plugin_6x": 'The "{name}" plugin is written for grid-editor 6 and is not loaded. Plugins register on GridEditor since 7.0: see UPGRADING.md.',
    "warning.adapter_no_jquery": "grideditor.jquery.js needs jQuery 4, and there is no jQuery on the page: the jQuery API is not there.",
    "error.tinymce_missing": "tinyMCE not available! Make sure you loaded the tinyMCE js file.",
    "error.ckeditor_missing": "CKEditor 5 not available! Make sure you loaded its ckeditor5.umd.js file: CKEditor 4 is no longer supported.",
    "error.summernote_missing": "Summernote not available! Make sure you loaded jQuery and the Summernote js file."
  }
};
var grideditor_default = GridEditor;
export {
  GridEditor,
  grideditor_default as default
};
