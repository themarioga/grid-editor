(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/plugins/grideditor.alignment.js
  Object.assign(GridEditor.locales.en, {
    "utility.align_self": "Align self"
  });
  var FLEX = {
    start: "flex-start",
    end: "flex-end",
    center: "center",
    baseline: "baseline",
    stretch: "stretch",
    auto: "auto"
  };
  GridEditor.utilities.alignment = function() {
    return {
      families: [{
        name: "align-self",
        prefix: "align-self",
        labelKey: "utility.align_self",
        values: ["auto", "start", "center", "end", "baseline", "stretch"],
        appliesTo: ["column"],
        /** Without a class, auto: what the row's align-items says. */
        preview: function(value) {
          return { "align-self": value === null ? "auto" : FLEX[value] };
        }
      }]
    };
  };
})();
