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
    "confirm.delete_tab": "Delete this tab and everything in it?"
  });
  GridEditor.containers.tabs = function(ge) {
    function addTabTo(container, options) {
      options = options || {};
      var strip = one(container, ":scope > .nav-tabs");
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
      all(container, ":scope > .nav-tabs .nav-link").forEach(function(button) {
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
        sortable(all(ge.canvas, ".ge-container-tabs > .nav-tabs"), {
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
        all(container, ":scope > .nav-tabs > .nav-item").forEach(function(tab) {
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
        all(container, ".ge-tab-pane").forEach(function(pane) {
          removeClass(pane, "ge-tab-pane");
        });
        ge.unwrapLabels(container);
      },
      /** Panes read in tab order, whatever order they were dropped in. */
      afterPaneMove: function(container) {
        var content = one(container, ":scope > .tab-content");
        all(container, ":scope > .nav-tabs > .nav-item").forEach(function(tab) {
          var pane = paneOf(container, tab);
          if (pane) {
            content.appendChild(pane);
          }
        });
      }
    };
  };
})();
