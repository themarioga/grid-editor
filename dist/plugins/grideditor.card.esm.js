// src/js/plugins/grideditor.card.js
import { GridEditor } from "../grideditor.esm.js";

// src/js/dom.js
function all(root, selector) {
  return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
}
function one(root, selector) {
  return root ? root.querySelector(selector) : null;
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

// src/js/plugins/grideditor.card.js
Object.assign(GridEditor.locales.en, {
  "container.add_card": "Card",
  "container.card_title": "Card title",
  "container.card_footer": "Card footer"
});
GridEditor.containers.card = function(ge) {
  function editable(part) {
    if (part) {
      ge.makeLabelEditable(ge.labelIn(part));
    }
  }
  return {
    labelKey: "container.add_card",
    /**
     * A card is a header, a body and an optional footer. `header: false`
     * leaves the title out, `footer: true` or a string adds one; both are
     * plain text the editor makes editable, not regions, so a card holds
     * exactly one region and nests like any other container.
     */
    create: function(options) {
      var card = element("div", { "class": "card" });
      if (options.header !== false) {
        var header = card.appendChild(element("div", { "class": "card-header" }));
        header.appendChild(element(
          "span",
          { "class": "ge-pane-label" },
          options.title || ge.t("container.card_title")
        ));
      }
      card.appendChild(element("div", { "class": "card-body" })).appendChild(ge.defaultRegion());
      if (options.footer) {
        var footer = card.appendChild(element("div", { "class": "card-footer text-body-secondary" }));
        footer.appendChild(element(
          "span",
          { "class": "ge-pane-label" },
          typeof options.footer === "string" ? options.footer : ge.t("container.card_footer")
        ));
      }
      var container = element("div", { "data-ge-container": "card" });
      container.appendChild(card);
      return container;
    },
    mark: function(container) {
      editable(one(container, ":scope > .card > .card-header"));
      editable(one(container, ":scope > .card > .card-footer"));
    },
    unmark: function(container) {
      ge.unwrapLabels(container);
    },
    // The same, on a copy of the canvas: unmark only touches markup
    cleanMarkup: function(root) {
      var definition = this;
      all(root, '[data-ge-container="card"]').forEach(function(container) {
        definition.unmark(container);
      });
    }
  };
};
