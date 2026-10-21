/**
 * Undo and redo for grid-editor.
 *
 * A feature plugin: load this file after the editor and what is edited is
 * kept, step by step, in memory, so Ctrl+Z goes back to how it was and
 * Ctrl+Y (or Ctrl+Shift+Z) comes forward again. Two buttons on the right of
 * the toolbar do the same. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.history.min.js"></script>
 *
 * A step is the canvas's markup as ge.snapshotHtml() gives it, kept `delay`
 * ms after the last change: a drag or a burst of typing is one step. Going
 * to one puts its markup back with ge.setHtml(), and the target is chosen
 * again by where it was.
 *
 * Typing in a text is the text editor's own to undo while it has the focus:
 * the keys are left alone then, and what was typed becomes a step when it
 * is done.
 *
 *   new GridEditor('#myGrid', { history: { max: 100, buttons: false } });
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'history.undo': 'Undo',
    'history.redo': 'Redo',
});

var DEFAULT_MAX = 50;
var DEFAULT_DELAY = 500;

/** What the editor puts in a node that is not the node's own: a position counts without it. */
var FURNITURE = '.ge-tools-drawer, .ge-drop-marker';

/** What a drag or a resize leaves on the canvas while it lasts. */
var BUSY = '.ge-drag-chosen, .ge-drag-placeholder, .ge-drag-helper, .ge-resizing';

/** The editors listening for the keys, and the one used last, which a key press goes to. */
var listeningEditors = [];
var lastEditor = null;

function track(e) {
    lastEditor = listeningEditors.filter(function(ge) { return ge.contains(e.target); })[0] || null;
}

// Captured: a control that stops the event still counts as using its editor
document.addEventListener('pointerdown', track, true);
document.addEventListener('focusin', track, true);

/** 'z', 'y' or null, from the letter typed or, on a layout without Latin letters, the key's place. */
function shortcutKey(e) {
    var key = (e.key || '').toLowerCase();
    if (!/^[a-z]$/.test(key)) { key = { KeyZ: 'z', KeyY: 'y' }[e.code] || ''; }

    return key === 'z' || key === 'y' ? key : null;
}

function typing() {
    var focus = document.activeElement;
    return !!focus && (dom.is(focus, 'input, textarea, select') || focus.isContentEditable);
}

/** The children of `parent` that are its own content, without the editor's furniture. */
function contentOf(parent) {
    return dom.children(parent).filter(function(child) { return !dom.is(child, FURNITURE); });
}

GridEditor.features.history = function(ge) {

    var options = optionsFrom(ge.settings.history || {});

    var stack = []; // The markup of each step, oldest first
    var index = -1; // The step the canvas is at
    var shown = { canUndo: false, canRedo: false }; // What the last history-change said
    var timer = null;
    var observer = null;
    var observing = false;
    var initiated = false; // Whether the first init has been looked at
    var started = false; // Whether there is a first step to go back to
    var sourceOpen = false;
    var destroyed = false;

    function optionsFrom(given) {
        var result = {
            shortcuts: given.shortcuts === undefined ? true : given.shortcuts,
            buttons: given.buttons === undefined ? true : given.buttons,
            max: given.max === undefined ? DEFAULT_MAX : given.max,
            delay: given.delay === undefined ? DEFAULT_DELAY : given.delay,
        };

        ['shortcuts', 'buttons'].forEach(function(name) {
            if (typeof result[name] !== 'boolean') {
                ge.warn('history.' + name + ' is true or false: true is used');
                result[name] = true;
            }
        });
        if (!Number.isInteger(result.max) || result.max < 1) {
            ge.warn('history.max must be a whole number of steps, 1 or more: ' + DEFAULT_MAX + ' is used');
            result.max = DEFAULT_MAX;
        }
        if (!Number.isInteger(result.delay) || result.delay < 0) {
            ge.warn('history.delay must be a whole number of milliseconds, 0 or more: ' + DEFAULT_DELAY + ' is used');
            result.delay = DEFAULT_DELAY;
        }

        return result;
    }

    function observe() {
        observer.observe(ge.canvas, { subtree: true, childList: true, attributes: true, characterData: true });
        observing = true;
    }

    function stopObserving() {
        if (observer) { observer.disconnect(); }
        observing = false;
    }

    /** The canvas's markup now. Reading may change the canvas, when a plugin cannot be read on a copy, and that is no change of the user's. */
    function read() {
        var watching = observing;
        if (watching) { stopObserving(); }
        var html = ge.snapshotHtml();
        if (watching) { observe(); }

        return html;
    }

    function editing() {
        return dom.hasClass(ge.canvas, 'ge-editing');
    }

    /** A drag or a resize is going on: the canvas is not at a step but between two. */
    function busy() {
        return dom.hasClass(ge.canvas, 'ge-dropping') || !!dom.one(ge.canvas, BUSY);
    }

    function schedule() {
        window.clearTimeout(timer);
        timer = window.setTimeout(commit, options.delay);
    }

    /** Whether something changed since the last step that is not a step yet. */
    function pending() {
        return timer !== null && read() !== stack[index];
    }

    /** What is on the canvas, if it is not the step it is at, becomes the next one. */
    function commit() {
        window.clearTimeout(timer);
        timer = null;

        if (!started || destroyed || sourceOpen) { return; }
        if (busy()) { schedule(); return; }

        var html = read();
        if (html === stack[index]) { return; }

        stack.splice(index + 1);
        stack.push(html);
        if (stack.length > options.max + 1) { stack.shift(); }
        index = stack.length - 1;

        notify();
    }

    /** The buttons, and a history-change when what can be done is not what was last said. */
    function notify() {
        var now = { canUndo: index > 0, canRedo: index < stack.length - 1 };
        var changed = now.canUndo !== shown.canUndo || now.canRedo !== shown.canRedo;

        shown = now;
        paint();

        if (changed) {
            ge.emit('history-change', { canvas: ge.canvas, canUndo: now.canUndo, canRedo: now.canRedo });
        }
    }

    function paint() {
        ge.toolbarItems('history').forEach(function(button) {
            var off = button.getAttribute('data-ge-item') === '0' ? !shown.canUndo : !shown.canRedo;

            dom.toggleClass(button, 'disabled', off);
            if (off) {
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.removeAttribute('aria-disabled');
            }
        });
    }

    /**
     * Where a node is: its index among its parent's content, all the way up
     * from the canvas. The canvas is made again from markup, so a node is
     * not the same one afterwards, but the place it was in is.
     */
    function pathOf(node) {
        if (!node || node === ge.canvas || !ge.canvas.contains(node)) { return null; }

        var path = [];
        for (var at = node; at !== ge.canvas; at = at.parentElement) {
            path.unshift(contentOf(at.parentElement).indexOf(at));
        }

        return path;
    }

    function resolve(path) {
        if (!path) { return null; }

        var node = ge.canvas;
        for (var i = 0; i < path.length && node; i++) { node = contentOf(node)[path[i]]; }

        return node || null;
    }

    function go(step, source) {
        if (!started || destroyed || sourceOpen || !editing() || busy()) { return false; }

        // A change not yet a step is a step of its own, and the one undone
        commit();

        var to = index + step;
        if (to < 0 || to >= stack.length) { return false; }

        var target = pathOf(ge.getActiveTarget());

        stopObserving();
        index = to;
        ge.setHtml(stack[index]);
        // The step as the canvas reads it back, so that is what is compared with
        stack[index] = ge.snapshotHtml();

        var node = resolve(target);
        if (node) { ge.setActiveTarget(node); }

        observe();
        notify();
        ge.emit(step < 0 ? 'after-undo' : 'after-redo', { canvas: ge.canvas, html: stack[index], source: source });

        return true;
    }

    function onKeydown(e) {
        if (lastEditor !== ge || e.altKey || !(e.ctrlKey || e.metaKey)) { return; }

        var key = shortcutKey(e);
        if (!key || (key === 'y' && e.shiftKey)) { return; }
        if (!editing() || typing() || ge.panelOpen()) { return; }

        // Left alone, it is the browser's
        if (go(key === 'y' || e.shiftKey ? 1 : -1, 'shortcut')) { e.preventDefault(); }
    }

    function listenForShortcuts(on) {
        var at = listeningEditors.indexOf(ge);

        if (on && at === -1) {
            listeningEditors.push(ge);
            document.addEventListener('keydown', onKeydown);
        } else if (!on && at !== -1) {
            listeningEditors.splice(at, 1);
            document.removeEventListener('keydown', onKeydown);
        }
    }

    /** After the first init has finished: the canvas is ready to be read. */
    function start() {
        if (destroyed) { return; }

        stack = [read()];
        index = 0;
        observer = new MutationObserver(schedule);
        observe();
        started = true;
        notify();
    }

    return {
        toolbar: function() {
            if (!options.buttons) { return []; }

            return [
                {
                    labelKey: 'history.undo',
                    iconClass: 'bi bi-arrow-counterclockwise',
                    className: 'ge-history-undo',
                    align: 'end',
                    disabled: function() { return !shown.canUndo; },
                    action: function() { go(-1, 'tool'); },
                },
                {
                    labelKey: 'history.redo',
                    iconClass: 'bi bi-arrow-clockwise',
                    className: 'ge-history-redo',
                    align: 'end',
                    disabled: function() { return !shown.canRedo; },
                    action: function() { go(1, 'tool'); },
                },
            ];
        },

        onInit: function() {
            if (options.shortcuts) { listenForShortcuts(true); }

            if (initiated) { return; }
            initiated = true;
            Promise.resolve().then(start);
        },

        // A canvas out of editing leaves the keys to the page: it is read again when it is back
        onDeinit: function() { listenForShortcuts(false); },

        onSourceOpen: function() { sourceOpen = true; },
        onSourceClose: function() { sourceOpen = false; },

        onDestroy: function() {
            destroyed = true;
            window.clearTimeout(timer);
            timer = null;
            stopObserving();
            listenForShortcuts(false);
            if (lastEditor === ge) { lastEditor = null; }
            stack = [];
        },

        // Nothing of its own on the canvas
        cleanMarkup: function() {},

        methods: {
            undo: function() { return go(-1, 'api'); },

            redo: function() { return go(1, 'api'); },

            // A change waiting for its step counts: it is what an undo would undo
            canUndo: function() {
                return started && !destroyed && (index > 0 || pending());
            },

            // ... and it ends what could be redone
            canRedo: function() {
                return started && !destroyed && index < stack.length - 1 && !pending();
            },

            // What is there is the first step, with nothing before it or after it
            clearHistory: function() {
                if (!started || destroyed) { return false; }

                window.clearTimeout(timer);
                timer = null;
                // The textarea's markup is not the canvas's while the source is open
                stack = [sourceOpen ? stack[index] : read()];
                index = 0;
                notify();

                return true;
            },
        },
    };
};
