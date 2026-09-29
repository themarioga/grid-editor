// src/js/plugins/grideditor.textalign.js
import { GridEditor as GridEditor2 } from "../grideditor.esm.js";

// src/js/style/textalign.js
import { GridEditor } from "../grideditor.esm.js";
Object.assign(GridEditor.locales.en, {
  "utility.text_align": "Text alignment",
  "utility.text_start": "Start",
  "utility.text_center": "Center",
  "utility.text_end": "End"
});
var CSS = { start: "left", center: "center", end: "right" };
function textalignPart(ge) {
  function label(value) {
    if (value === "start") {
      return ge.t("utility.text_start");
    }
    if (value === "center") {
      return ge.t("utility.text_center");
    }
    return ge.t("utility.text_end");
  }
  return {
    families: [{
      name: "text-align",
      prefix: "text",
      values: ["start", "center", "end"],
      appliesTo: ["row", "column", "text", "element", "container"],
      labelKey: "utility.text_align",
      label,
      /**
       * With no class applying here, the node aligns as its parent
       * does - or as the host's css says - which only the browser can
       * tell, so it is asked with the classes out of the way. Parents
       * are previewed before their children, so the parent's answer is
       * already the view's.
       */
      preview: function(value, node) {
        return { "text-align": value === null ? ge.bareStyle(node, "text-align", "text-align") : CSS[value] };
      }
    }]
  };
}

// src/js/plugins/grideditor.textalign.js
GridEditor2.utilities.textalign = function(ge) {
  ge.warn('the "textalign" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
  return textalignPart(ge);
};
