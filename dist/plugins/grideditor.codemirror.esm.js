// src/js/plugins/grideditor.codemirror.js
import { GridEditor } from "../grideditor.esm.js";

// src/js/dom.js
function addClass(node, names) {
  split(names).forEach(function(name) {
    node.classList.add(name);
  });
  return node;
}
function split(names) {
  return String(names || "").split(/\s+/).filter(Boolean);
}
function outerHeight(node) {
  return node.getBoundingClientRect().height;
}

// src/js/plugins/grideditor.codemirror.js
Object.assign(GridEditor.locales.en, {
  "error.codemirror_missing": "CodeMirror not available! Make sure you loaded the CodeMirror js file; the source is edited in a plain textarea without it."
});
GridEditor.features.codemirror = function(ge) {
  var editor = null;
  var warned = false;
  function options() {
    var own = ge.settings.codemirror && ge.settings.codemirror.config || {};
    return Object.assign({
      mode: "htmlmixed",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2
    }, own);
  }
  return {
    // Over the textarea the editor fills with the canvas's html: it goes
    // where the textarea was, as tall as the editor made the textarea
    onSourceOpen: function(textarea) {
      if (!window.CodeMirror) {
        if (!warned) {
          warned = true;
          ge.warn(ge.t("error.codemirror_missing"));
        }
        return;
      }
      var height = outerHeight(textarea);
      editor = window.CodeMirror.fromTextArea(textarea, options());
      addClass(editor.getWrapperElement(), "ge-code-editor");
      editor.setSize(null, height);
      editor.focus();
    },
    // What it holds goes back in the textarea, which is what the canvas
    // is made of again, and the textarea is left as it found it
    onSourceClose: function() {
      if (!editor) {
        return;
      }
      editor.save();
      editor.toTextArea();
      editor = null;
    }
  };
};
