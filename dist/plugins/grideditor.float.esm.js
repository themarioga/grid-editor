// src/js/plugins/grideditor.float.js
import { GridEditor as GridEditor2 } from "../grideditor.esm.js";

// src/js/style/float.js
import { GridEditor } from "../grideditor.esm.js";
Object.assign(GridEditor.locales.en, {
  "utility.float": "Float",
  "utility.float_start": "Start",
  "utility.float_end": "End",
  "utility.float_none": "None"
});
var CSS = { start: "left", end: "right", none: "none" };
function floatPart(ge) {
  function label(value) {
    if (value === "start") {
      return ge.t("utility.float_start");
    }
    if (value === "end") {
      return ge.t("utility.float_end");
    }
    return ge.t("utility.float_none");
  }
  return {
    families: [{
      name: "float",
      prefix: "float",
      values: ["start", "end", "none"],
      appliesTo: ["element"],
      labelKey: "utility.float",
      label,
      /** With no class applying here, whatever the host's css floats it as. */
      preview: function(value, node) {
        return { float: value === null ? ge.bareStyle(node, "float", "float") : CSS[value] };
      }
    }]
  };
}

// src/js/plugins/grideditor.float.js
GridEditor2.utilities.float = function(ge) {
  ge.warn('the "float" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
  return floatPart(ge);
};
