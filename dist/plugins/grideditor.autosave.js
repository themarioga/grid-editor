(() => {
  // src/js/register.js
  var GridEditor = window.GridEditor;
  if (!GridEditor || typeof GridEditor.get !== "function") {
    throw new Error("grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, its locales and grideditor.jquery.js");
  }

  // src/js/plugins/grideditor.autosave.js
  Object.assign(GridEditor.locales.en, {
    "autosave.restore_title": "Restore the draft?",
    "autosave.restore_message": "There is a draft of this page saved on {date}, with changes that were not published. Restore it?",
    "autosave.restore": "Restore",
    "autosave.discard": "Discard"
  });
  var VERSION = 1;
  var STORAGES = { local: "localStorage", session: "sessionStorage" };
  var DEFAULT_DELAY = 1e3;
  var liveKeys = /* @__PURE__ */ new Set();
  function fingerprint(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function validDraft(value) {
    return !!value && typeof value === "object" && value.version === VERSION && typeof value.html === "string" && typeof value.base === "string" && typeof value.savedAt === "string" && !isNaN(Date.parse(value.savedAt));
  }
  GridEditor.features.autosave = function(ge) {
    var options = optionsFrom(ge.settings.autosave || {});
    var key = options.key || "grideditor.autosave:" + window.location.pathname + "#" + ge.canvas.id;
    var storage = storageFor(options.storage);
    var state = "disabled";
    var enabledAfterAsking = true;
    var started = false;
    var draft = null;
    var base = null;
    var last = null;
    var timer = null;
    var observer = null;
    var sourceOpen = false;
    var warnedWrite = false;
    if (!storage) {
      ge.warn("autosave: the browser will not give this page its " + STORAGES[options.storage] + ", so nothing is saved");
      state = "unavailable";
    } else if (liveKeys.has(key)) {
      ge.warn('autosave: another editor on this page already saves to "' + key + '", so this one does not; give each its own autosave.key');
      state = "unavailable";
    } else {
      liveKeys.add(key);
      if (options.enabled) {
        state = "enabled";
        draft = readDraft(true);
      }
    }
    function optionsFrom(given) {
      var result = {
        enabled: given.enabled === void 0 ? true : !!given.enabled,
        storage: given.storage === void 0 ? "local" : given.storage,
        key: given.key === void 0 ? null : given.key,
        delay: given.delay === void 0 ? DEFAULT_DELAY : given.delay,
        maxAge: given.maxAge === void 0 ? null : given.maxAge
      };
      if (!STORAGES[result.storage]) {
        ge.warn('autosave.storage "' + result.storage + '" is not local or session: local is used');
        result.storage = "local";
      }
      if (result.key !== null && (typeof result.key !== "string" || result.key === "")) {
        ge.warn("autosave.key must be a string: the page's own key is used");
        result.key = null;
      }
      if (typeof result.delay !== "number" || !Number.isInteger(result.delay) || result.delay < 0) {
        ge.warn("autosave.delay must be a whole number of milliseconds, 0 or more: " + DEFAULT_DELAY + " is used");
        result.delay = DEFAULT_DELAY;
      }
      if (result.maxAge !== null && !(typeof result.maxAge === "number" && isFinite(result.maxAge) && result.maxAge > 0)) {
        ge.warn("autosave.maxAge must be a number of milliseconds over 0, or null: drafts do not expire");
        result.maxAge = null;
      }
      return result;
    }
    function storageFor(name) {
      try {
        var found = window[STORAGES[name]];
        found.getItem(key);
        return found;
      } catch (error) {
        return null;
      }
    }
    function readDraft(starting) {
      var raw;
      try {
        raw = storage.getItem(key);
      } catch (error) {
        return null;
      }
      if (raw === null) {
        return null;
      }
      var value = null;
      try {
        value = JSON.parse(raw);
      } catch (error) {
      }
      if (!validDraft(value)) {
        if (starting) {
          ge.warn('autosave: what is saved under "' + key + '" is not a draft this version can read: it is discarded');
          remove();
        }
        return null;
      }
      if (starting && options.maxAge !== null && Date.now() - Date.parse(value.savedAt) > options.maxAge) {
        remove();
        return null;
      }
      return value;
    }
    function remove() {
      try {
        storage.removeItem(key);
      } catch (error) {
      }
    }
    function save(source) {
      window.clearTimeout(timer);
      timer = null;
      if (sourceOpen || base === null) {
        return false;
      }
      var watching = !!observer;
      if (watching) {
        observer.disconnect();
      }
      var html = ge.snapshotHtml();
      if (watching) {
        watch();
      }
      if (html === last) {
        return false;
      }
      var value = { version: VERSION, html, savedAt: (/* @__PURE__ */ new Date()).toISOString(), base };
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (error) {
        if (!warnedWrite) {
          warnedWrite = true;
          ge.warn("autosave: the draft could not be saved (" + (error && error.message || error) + ")");
        }
        ge.emit("autosave-error", { canvas: ge.canvas, error });
        return false;
      }
      last = html;
      ge.emit("after-autosave", { canvas: ge.canvas, html, savedAt: value.savedAt, source });
      return true;
    }
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function() {
        save("change");
      }, options.delay);
    }
    function watch() {
      if (!observer) {
        observer = new MutationObserver(schedule);
      }
      observer.observe(ge.canvas, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    function unwatch() {
      window.clearTimeout(timer);
      timer = null;
      if (observer) {
        observer.disconnect();
      }
    }
    function onPageHide() {
      if (state === "enabled") {
        save("pagehide");
      }
    }
    function start() {
      if (state === "destroyed" || state === "unavailable") {
        return;
      }
      last = ge.snapshotHtml();
      base = fingerprint(last);
      window.addEventListener("pagehide", onPageHide);
      if (state === "enabled" && draft && draft.base === base && draft.html !== last) {
        ask(draft);
        return;
      }
      draft = null;
      if (state === "enabled") {
        watch();
      }
    }
    function dateOf(savedAt) {
      try {
        return new Date(savedAt).toLocaleString(ge.settings.locale || void 0);
      } catch (error) {
        return new Date(savedAt).toLocaleString();
      }
    }
    function ask(found) {
      state = "asking";
      ge.confirm(ge.t("autosave.restore_message", { date: dateOf(found.savedAt) }), {
        title: ge.t("autosave.restore_title"),
        ok: ge.t("autosave.restore"),
        cancel: ge.t("autosave.discard")
      }, function(restore) {
        if (state === "destroyed") {
          return;
        }
        if (restore === null) {
          window.setTimeout(function() {
            if (state === "asking") {
              ask(found);
            }
          }, 0);
          return;
        }
        draft = null;
        if (restore) {
          last = found.html;
          ge.setHtml(found.html);
          ge.emit("after-restore-draft", { canvas: ge.canvas, html: found.html, savedAt: found.savedAt });
        } else {
          remove();
        }
        state = enabledAfterAsking ? "enabled" : "disabled";
        if (state === "enabled") {
          watch();
        }
      });
    }
    return {
      // The first init, once it has finished: the canvas is ready to be read
      onInit: function() {
        if (started) {
          return;
        }
        started = true;
        Promise.resolve().then(start);
      },
      onSourceOpen: function() {
        sourceOpen = true;
      },
      onSourceClose: function() {
        sourceOpen = false;
      },
      onDestroy: function() {
        if (state === "enabled" && timer) {
          save("destroy");
        }
        unwatch();
        observer = null;
        window.removeEventListener("pagehide", onPageHide);
        if (state !== "unavailable") {
          liveKeys.delete(key);
        }
        state = "destroyed";
      },
      methods: {
        enableAutosave: function() {
          if (state === "unavailable") {
            return false;
          }
          if (state === "asking") {
            enabledAfterAsking = true;
            return true;
          }
          if (state !== "enabled") {
            state = "enabled";
            if (base !== null) {
              watch();
            }
          }
          return true;
        },
        disableAutosave: function() {
          if (state === "unavailable") {
            return false;
          }
          if (state === "asking") {
            enabledAfterAsking = false;
            return true;
          }
          unwatch();
          state = "disabled";
          return true;
        },
        saveDraft: function() {
          if (state === "unavailable" || state === "asking") {
            return false;
          }
          return save("api");
        },
        getDraft: function() {
          if (state === "unavailable") {
            return null;
          }
          var found = readDraft(false);
          return found ? { html: found.html, savedAt: found.savedAt } : null;
        },
        // What there is now is not a draft any more - a page calls this
        // once it has saved to its server - so the save waiting does not
        // write it back, and only a change from here makes a new draft
        clearDraft: function() {
          if (state === "unavailable") {
            return false;
          }
          window.clearTimeout(timer);
          timer = null;
          remove();
          if (base !== null && state !== "asking" && !sourceOpen) {
            var watching = !!observer && state === "enabled";
            if (watching) {
              observer.disconnect();
            }
            last = ge.snapshotHtml();
            if (watching) {
              watch();
            }
          }
          return true;
        }
      }
    };
  };
})();
