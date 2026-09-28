(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/plugins/grideditor.float.js
  Object.assign(GridEditor.locales.en, {
    "utility.float": "Float",
    "utility.float_start": "Start",
    "utility.float_end": "End",
    "utility.float_none": "None"
  });
  var CSS = { start: "left", end: "right", none: "none" };
  GridEditor.utilities.float = function(ge) {
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
  };
})();
