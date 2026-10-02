/**
 * Autosave for grid-editor.
 *
 * A feature plugin: load this file after the editor and what is being edited
 * is kept in the browser's storage as it changes, and offered back the next
 * time an editor starts from the same html. What it can ask the editor for is
 * the handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.autosave.min.js"></script>
 *
 * It reads the canvas with ge.snapshotHtml(), which leaves the canvas
 * editing: the text being typed into stays open, with its cursor. A save
 * comes `delay` ms after the last change, and when the page is left.
 *
 * A draft remembers the html its editor started from, and is only offered
 * to an editor that starts from the same html: a page that loads one
 * document after another is not offered one document's draft over another.
 * Such a page gives each document a key of its own, and each keeps its draft.
 *
 *   new GridEditor('#myGrid', { autosave: { key: 'page-42', storage: 'session' } });
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'autosave.restore_title': 'Restore the draft?',
    'autosave.restore_message': 'There is a draft of this page saved on {date}, with changes that were not published. Restore it?',
    'autosave.restore': 'Restore',
    'autosave.discard': 'Discard',
});

var VERSION = 1;
var STORAGES = { local: 'localStorage', session: 'sessionStorage' };
var DEFAULT_DELAY = 1000;

/** The keys the editors on this page save to: one editor to a key. */
var liveKeys = new Set();

/** FNV-1a, 32 bits, as hex: enough to tell one document's html from another's. */
function fingerprint(text) {
    var hash = 0x811c9dc5;

    for (var i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
}

/** A stored value that is a draft this file wrote, or null. */
function validDraft(value) {
    return !!value && typeof value === 'object' && value.version === VERSION &&
        typeof value.html === 'string' && typeof value.base === 'string' &&
        typeof value.savedAt === 'string' && !isNaN(Date.parse(value.savedAt));
}

GridEditor.features.autosave = function(ge) {

    var options = optionsFrom(ge.settings.autosave || {});
    var key = options.key || 'grideditor.autosave:' + window.location.pathname + '#' + ge.canvas.id;
    var storage = storageFor(options.storage);

    // unavailable | disabled | asking | enabled | destroyed
    var state = 'disabled';
    var enabledAfterAsking = true; // What asking ends in: a method may have changed it meanwhile
    var started = false; // Whether the first init has been looked at
    var draft = null; // The draft found when the editor was made, while it may be offered
    var base = null; // The fingerprint of the html the editor started from
    var last = null; // The html saved last, or the one there was to start from
    var timer = null;
    var observer = null;
    var sourceOpen = false;
    var warnedWrite = false;

    if (!storage) {
        ge.warn('autosave: the browser will not give this page its ' + STORAGES[options.storage] +
            ', so nothing is saved');
        state = 'unavailable';
    } else if (liveKeys.has(key)) {
        ge.warn('autosave: another editor on this page already saves to "' + key + '", so this one does not; ' +
            'give each its own autosave.key');
        state = 'unavailable';
    } else {
        liveKeys.add(key);
        if (options.enabled) {
            state = 'enabled';
            draft = readDraft(true);
        }
    }

    function optionsFrom(given) {
        var result = {
            enabled: given.enabled === undefined ? true : !!given.enabled,
            storage: given.storage === undefined ? 'local' : given.storage,
            key: given.key === undefined ? null : given.key,
            delay: given.delay === undefined ? DEFAULT_DELAY : given.delay,
            maxAge: given.maxAge === undefined ? null : given.maxAge,
        };

        if (!STORAGES[result.storage]) {
            ge.warn('autosave.storage "' + result.storage + '" is not local or session: local is used');
            result.storage = 'local';
        }
        if (result.key !== null && (typeof result.key !== 'string' || result.key === '')) {
            ge.warn('autosave.key must be a string: the page\'s own key is used');
            result.key = null;
        }
        if (typeof result.delay !== 'number' || !Number.isInteger(result.delay) || result.delay < 0) {
            ge.warn('autosave.delay must be a whole number of milliseconds, 0 or more: ' + DEFAULT_DELAY + ' is used');
            result.delay = DEFAULT_DELAY;
        }
        if (result.maxAge !== null && !(typeof result.maxAge === 'number' && isFinite(result.maxAge) && result.maxAge > 0)) {
            ge.warn('autosave.maxAge must be a number of milliseconds over 0, or null: drafts do not expire');
            result.maxAge = null;
        }

        return result;
    }

    /** The storage, if the browser lets the page have it. */
    function storageFor(name) {
        try {
            var found = window[STORAGES[name]];
            found.getItem(key);
            return found;
        } catch (error) {
            return null;
        }
    }

    /**
     * The draft saved under the key, or null. Starting, one that cannot be
     * read or has expired is taken away: nothing will ever offer it.
     */
    function readDraft(starting) {
        var raw;

        try {
            raw = storage.getItem(key);
        } catch (error) {
            return null;
        }
        if (raw === null) { return null; }

        var value = null;
        try { value = JSON.parse(raw); } catch (error) { /* not ours, or mangled */ }

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
        try { storage.removeItem(key); } catch (error) { /* nothing to take away */ }
    }

    /** Write the canvas as it is, if it changed. True when it was written. */
    function save(source) {
        window.clearTimeout(timer);
        timer = null;

        if (sourceOpen || base === null) { return false; }

        // The read itself may change the canvas - getHtml, when a plugin
        // cannot be read on a copy - and that is not a change to save
        var watching = !!observer;
        if (watching) { observer.disconnect(); }
        var html = ge.snapshotHtml();
        if (watching) { watch(); }

        if (html === last) { return false; }

        var value = { version: VERSION, html: html, savedAt: new Date().toISOString(), base: base };

        try {
            storage.setItem(key, JSON.stringify(value));
        } catch (error) {
            if (!warnedWrite) {
                warnedWrite = true;
                ge.warn('autosave: the draft could not be saved (' + (error && error.message || error) + ')');
            }
            ge.emit('autosave-error', { canvas: ge.canvas, error: error });
            return false;
        }

        last = html;
        ge.emit('after-autosave', { canvas: ge.canvas, html: html, savedAt: value.savedAt, source: source });
        return true;
    }

    function schedule() {
        window.clearTimeout(timer);
        timer = window.setTimeout(function() { save('change'); }, options.delay);
    }

    function watch() {
        if (!observer) { observer = new MutationObserver(schedule); }
        observer.observe(ge.canvas, { subtree: true, childList: true, attributes: true, characterData: true });
    }

    function unwatch() {
        window.clearTimeout(timer);
        timer = null;
        if (observer) { observer.disconnect(); }
    }

    function onPageHide() {
        if (state === 'enabled') { save('pagehide'); }
    }

    /** After the first init has finished: what there is to start from, and the draft offered. */
    function start() {
        if (state === 'destroyed' || state === 'unavailable') { return; }

        last = ge.snapshotHtml();
        base = fingerprint(last);
        window.addEventListener('pagehide', onPageHide);

        // One of another document, or the same as what is there, is not offered
        if (state === 'enabled' && draft && draft.base === base && draft.html !== last) {
            ask(draft);
            return;
        }

        draft = null;
        if (state === 'enabled') { watch(); }
    }

    function dateOf(savedAt) {
        try {
            return new Date(savedAt).toLocaleString(ge.settings.locale || undefined);
        } catch (error) {
            return new Date(savedAt).toLocaleString();
        }
    }

    function ask(found) {
        state = 'asking';

        ge.confirm(ge.t('autosave.restore_message', { date: dateOf(found.savedAt) }), {
            title: ge.t('autosave.restore_title'),
            ok: ge.t('autosave.restore'),
            cancel: ge.t('autosave.discard'),
        }, function(restore) {
            if (state === 'destroyed') { return; }

            // Taken away unanswered - setLocale - so asked again, in the new
            // language, once the old modal is out of the way
            if (restore === null) {
                window.setTimeout(function() {
                    if (state === 'asking') { ask(found); }
                }, 0);
                return;
            }

            draft = null;

            if (restore) {
                last = found.html;
                ge.setHtml(found.html);
                ge.emit('after-restore-draft', { canvas: ge.canvas, html: found.html, savedAt: found.savedAt });
            } else {
                remove();
            }

            state = enabledAfterAsking ? 'enabled' : 'disabled';
            if (state === 'enabled') { watch(); }
        });
    }

    return {
        // The first init, once it has finished: the canvas is ready to be read
        onInit: function() {
            if (started) { return; }
            started = true;
            Promise.resolve().then(start);
        },

        onSourceOpen: function() { sourceOpen = true; },
        onSourceClose: function() { sourceOpen = false; },

        onDestroy: function() {
            if (state === 'enabled' && timer) { save('destroy'); }

            unwatch();
            observer = null;
            window.removeEventListener('pagehide', onPageHide);
            if (state !== 'unavailable') { liveKeys.delete(key); }
            state = 'destroyed';
        },

        methods: {
            enableAutosave: function() {
                if (state === 'unavailable') { return false; }
                if (state === 'asking') {
                    enabledAfterAsking = true;
                    return true;
                }
                if (state !== 'enabled') {
                    state = 'enabled';
                    if (base !== null) { watch(); }
                }
                return true;
            },

            disableAutosave: function() {
                if (state === 'unavailable') { return false; }
                if (state === 'asking') {
                    enabledAfterAsking = false;
                    return true;
                }
                unwatch();
                state = 'disabled';
                return true;
            },

            saveDraft: function() {
                if (state === 'unavailable' || state === 'asking') { return false; }
                return save('api');
            },

            getDraft: function() {
                if (state === 'unavailable') { return null; }

                var found = readDraft(false);
                return found ? { html: found.html, savedAt: found.savedAt } : null;
            },

            // What there is now is not a draft any more - a page calls this
            // once it has saved to its server - so the save waiting does not
            // write it back, and only a change from here makes a new draft
            clearDraft: function() {
                if (state === 'unavailable') { return false; }

                window.clearTimeout(timer);
                timer = null;
                remove();

                // Not while it asks: the canvas is not what was offered yet
                if (base !== null && state !== 'asking' && !sourceOpen) {
                    var watching = !!observer && state === 'enabled';
                    if (watching) { observer.disconnect(); }
                    last = ge.snapshotHtml();
                    if (watching) { watch(); }
                }
                return true;
            },
        },
    };
};
