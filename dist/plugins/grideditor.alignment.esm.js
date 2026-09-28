// src/js/plugins/grideditor.alignment.js
import { GridEditor } from "../grideditor.esm.js";
Object.assign(GridEditor.locales.en, {
  "utility.justify_content": "Justify columns",
  "utility.align_items": "Align columns",
  "utility.align_self": "Align self"
});
var FLEX = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
  baseline: "baseline",
  stretch: "stretch",
  auto: "auto"
};
function family(definition) {
  return Object.assign({
    prefix: definition.name,
    preview: function(value) {
      var styles = {};
      styles[definition.name] = value === null ? definition.none : FLEX[value];
      return styles;
    }
  }, definition);
}
GridEditor.utilities.alignment = function() {
  return {
    families: [
      family({
        name: "justify-content",
        labelKey: "utility.justify_content",
        values: ["start", "center", "end", "between", "around", "evenly"],
        appliesTo: ["row"],
        none: "normal"
      }),
      family({
        name: "align-items",
        labelKey: "utility.align_items",
        values: ["start", "center", "end", "baseline", "stretch"],
        appliesTo: ["row"],
        none: "normal"
      }),
      family({
        name: "align-self",
        labelKey: "utility.align_self",
        values: ["auto", "start", "center", "end", "baseline", "stretch"],
        appliesTo: ["column"],
        none: "auto"
      })
    ]
  };
};
