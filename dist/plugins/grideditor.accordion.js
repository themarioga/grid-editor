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

  // src/js/plugins/grideditor.accordion.js
  Object.assign(GridEditor.locales.en, {
    "container.add_accordion": "Accordion",
    "container.add_accordion_item": "Add item",
    "container.accordion_label": "Item {number}",
    "confirm.delete_accordion_item": "Delete this item and everything in it?"
  });
  GridEditor.containers.accordion = function(ge) {
    var answered = /* @__PURE__ */ new WeakSet();
    function collapseOf(item) {
      return child(item, ".accordion-collapse");
    }
    function staysOpen(container, ignore) {
      var items = all(container, ":scope > .accordion > .accordion-item > .accordion-collapse");
      if (ignore) {
        var ignored = collapseOf(ignore);
        items = items.filter(function(collapse) {
          return collapse !== ignored;
        });
      }
      return items.length > 0 && !items.filter(function(collapse) {
        return collapse.hasAttribute("data-bs-parent");
      }).length;
    }
    function addAccordionItemTo(container, options) {
      options = options || {};
      var accordion = child(container, ".accordion");
      var id = ge.containerId("acc-item");
      var number = children(accordion, ".accordion-item").length + 1;
      var open = options.open === void 0 ? number === 1 : !!options.open;
      var stayOpen = options.stay_open === void 0 ? staysOpen(container) : !!options.stay_open;
      var item = accordion.appendChild(element("div", { "class": "accordion-item ge-accordion-item" }));
      var header = item.appendChild(element("h2", { "class": "accordion-header" }));
      var button = header.appendChild(element("button", {
        "class": "accordion-button",
        type: "button",
        "data-bs-toggle": "collapse",
        "data-bs-target": "#" + id,
        "aria-expanded": open ? "true" : "false"
      }));
      toggleClass(button, "collapsed", !open);
      button.appendChild(element(
        "span",
        { "class": "ge-pane-label" },
        options.label || ge.t("container.accordion_label", { number })
      ));
      var collapse = item.appendChild(element("div", {
        "class": "accordion-collapse collapse",
        id,
        "data-ge-open": open ? "true" : "false"
      }));
      toggleClass(collapse, "show", open);
      if (!stayOpen) {
        collapse.setAttribute("data-bs-parent", "#" + accordion.getAttribute("id"));
      }
      var body = collapse.appendChild(element("div", { "class": "accordion-body" }));
      body.appendChild(ge.defaultRegion());
      return body;
    }
    function toggleAccordionItem(container, item) {
      var collapse = collapseOf(item);
      var opening = collapse.getAttribute("data-ge-open") !== "true";
      if (opening && !staysOpen(container)) {
        all(container, ":scope > .accordion > .accordion-item").forEach(function(other) {
          if (other !== item) {
            setAccordionItemOpen(other, false);
          }
        });
      }
      setAccordionItemOpen(item, opening);
    }
    function setAccordionItemOpen(item, open) {
      var collapse = collapseOf(item);
      if (collapse) {
        collapse.setAttribute("data-ge-open", open ? "true" : "false");
        toggleClass(collapse, "show", open);
      }
      all(item, ":scope > .accordion-header .accordion-button").forEach(function(button) {
        toggleClass(button, "collapsed", !open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    function reparentAccordionItem(container, item) {
      var accordion = item.closest(".accordion");
      var collapse = collapseOf(item);
      if (!collapse) {
        return;
      }
      if (staysOpen(container, item)) {
        collapse.removeAttribute("data-bs-parent");
      } else {
        collapse.setAttribute("data-bs-parent", "#" + accordion.getAttribute("id"));
      }
    }
    return {
      labelKey: "container.add_accordion",
      // Items sort within their accordion and into any other one
      onSortable: function(sortable) {
        sortable(all(ge.canvas, ".ge-container-accordion > .accordion"), {
          draggable: ".ge-accordion-item",
          group: "accordion"
        });
      },
      addPaneKey: "container.add_accordion_item",
      paneKind: "accordion-item",
      create: function(options) {
        var container = element("div", { "data-ge-container": "accordion" });
        var labels = options.labels || [];
        var count = options.items || labels.length || 2;
        container.appendChild(element("div", { "class": "accordion", id: ge.containerId("accordion") }));
        for (var i = 0; i < count; i++) {
          addAccordionItemTo(container, {
            label: labels[i],
            open: i === 0,
            stay_open: options.stay_open
          });
        }
        return container;
      },
      addPane: addAccordionItemTo,
      mark: function(container) {
        all(container, ":scope > .accordion > .accordion-item").forEach(function(item) {
          addClass(item, "ge-accordion-item");
          var collapse = collapseOf(item);
          if (collapse && !collapse.hasAttribute("data-ge-open")) {
            collapse.setAttribute("data-ge-open", hasClass(collapse, "show") ? "true" : "false");
          }
          var button = one(item, ":scope > .accordion-header .accordion-button");
          if (button) {
            ge.suspendToggles(button);
            ge.makeLabelEditable(ge.labelIn(button));
            if (!answered.has(button)) {
              answered.add(button);
              button.addEventListener("click", function(e) {
                if (ge.labelIn(button).getAttribute("contenteditable") === "true") {
                  return;
                }
                e.preventDefault();
                toggleAccordionItem(container, item);
              });
            }
          }
          if (child(item, ".ge-tools-drawer")) {
            return;
          }
          ge.createPaneControls(
            item,
            "accordion-item",
            ge.settings.accordion_tools,
            ge.t("confirm.delete_accordion_item"),
            function(removed) {
              slideUp(item, 200, removed);
            }
          );
        });
      },
      unmark: function(container) {
        ge.resumeToggles(container);
        all(container, ":scope > .accordion > .accordion-item").forEach(function(item) {
          var collapse = collapseOf(item);
          setAccordionItemOpen(item, !!collapse && collapse.getAttribute("data-ge-open") === "true");
        });
        all(container, ".ge-accordion-item").forEach(function(item) {
          removeClass(item, "ge-accordion-item");
        });
        ge.unwrapLabels(container);
      },
      afterPaneMove: function(container, item) {
        reparentAccordionItem(container, item);
      }
    };
  };
})();
