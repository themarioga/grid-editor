(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/style/textalign.js
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
  GridEditor.utilities.textalign = function(ge) {
    ge.warn('the "textalign" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
    return textalignPart(ge);
  };
})();
