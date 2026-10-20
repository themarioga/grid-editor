/**
 * Copy and paste for grid-editor.
 *
 * A feature plugin: load this file after the editor and every row, column,
 * section, text block, container and element gets a copy tool, and every
 * place one of them can go gets a paste tool while there is something copied
 * that fits.
 * What it can ask the editor for is the handle its factory is called with,
 * described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.clipboard.min.js"></script>
 *
 * What is copied is kept in localStorage, so it survives a reload and can be
 * pasted in another tab or another editor of the same site. A browser that
 * will not give the page its storage keeps it in memory, for this page only.
 *
 * A paste is an add like any other - before-add-* and after-add-*, with
 * `source: 'paste'` - so a host can turn one away.
 *
 * With active_target (which the sidebar turns on), Ctrl+C copies the node
 * selected, or the target, and Ctrl+V pastes into the target, or the node
 * selected. `clipboard: { shortcuts: false }` turns them off. They go through
 * the same store as the tools, never the system clipboard.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'tool.copy': 'Copy',
    'tool.paste': 'Paste',
    'clipboard.paste_row': 'Paste row',
    'clipboard.paste_section': 'Paste section',
});

var STORAGE_ITEM = 'grideditor.clipboard';
var CHANGE = 'grideditor-clipboard';
var VERSION = 1;

/** Where nothing can be stored, what was copied lives here, for this page. */
var memory = null;

/**
 * What each drawer takes when something is pasted into it, by the kind of the
 * node the drawer belongs to. A category is what was copied: a row, a column,
 * a section, a text block, a container of any type, an element.
 */
var TARGETS = {
    column: ['row', 'text', 'container', 'element'],
    row: ['column'],
    section: ['row'],
};

function read() {
    var raw;

    try {
        raw = window.localStorage.getItem(STORAGE_ITEM);
    } catch (error) {
        return memory;
    }
    if (raw === null) { return memory; }

    try {
        var clip = JSON.parse(raw);
        return clip && clip.version === VERSION && clip.html ? clip : null;
    } catch (error) {
        return null;
    }
}

function write(clip) {
    try {
        window.localStorage.setItem(STORAGE_ITEM, JSON.stringify(clip));
        memory = null;
    } catch (error) {
        memory = clip;
    }

    announce();
}

/** Every editor on the page looks at the clipboard again. */
function announce() {
    document.dispatchEvent(new CustomEvent(CHANGE));
}

// Another tab copied something: every editor here looks again
window.addEventListener('storage', function(e) {
    if (e.key === STORAGE_ITEM) { announce(); }
});

/** The editors listening for the shortcuts, and the one used last, which a key press goes to. */
var listeningEditors = [];
var lastEditor = null;

function track(e) {
    lastEditor = listeningEditors.filter(function(ge) { return ge.contains(e.target); })[0] || null;
}

// Captured: a control that stops the event still counts as using its editor
document.addEventListener('pointerdown', track, true);
document.addEventListener('focusin', track, true);

/** 'c', 'v' or null, from the letter typed or, on a layout without Latin letters, the key's place. */
function shortcutKey(e) {
    var key = (e.key || '').toLowerCase();
    if (!/^[a-z]$/.test(key)) { key = { KeyC: 'c', KeyV: 'v' }[e.code] || ''; }

    return key === 'c' || key === 'v' ? key : null;
}

function typing() {
    var focus = document.activeElement;
    return !!focus && (dom.is(focus, 'input, textarea, select') || focus.isContentEditable);
}

function textSelected() {
    var selection = window.getSelection ? window.getSelection() : null;
    return !!selection && !selection.isCollapsed && selection.toString() !== '';
}

GridEditor.features.clipboard = function(ge) {

    var shown = null; // What the toolbar's paste buttons stand for
    var listening = false; // Whether refresh is on the document's change event
    var shortcuts = shortcutsSetting();

    function used(name) {
        return !ge.settings.plugins || ge.settings.plugins.indexOf(name) !== -1;
    }

    /** A category this editor can take: the plugin that makes it is here. */
    function available(clip) {
        if (clip.category === 'container') {
            return !!GridEditor.containers[clip.kind] && used(clip.kind);
        }
        if (clip.category === 'section') { return !!GridEditor.features.sections && used('sections'); }
        if (clip.category === 'element') { return !!GridEditor.features.elements && used('elements'); }

        return true;
    }

    function fits(clip, categories) {
        return !!clip && categories.indexOf(clip.category) !== -1 && available(clip);
    }

    function categoryOf(kind) {
        if (GridEditor.containers[kind]) { return 'container'; }

        return ['row', 'column', 'section', 'text', 'element'].indexOf(kind) !== -1 ? kind : null;
    }

    /** On, unless the host said otherwise: with no target there is nothing for a key to act on. */
    function shortcutsSetting() {
        var wanted = (ge.settings.clipboard || {}).shortcuts;
        var target = !!ge.settings.active_target;

        if (wanted !== undefined && typeof wanted !== 'boolean') {
            ge.warn('clipboard.shortcuts is true or false: ' + (target ? 'on' : 'off') + ', as with active_target, is used');
            wanted = undefined;
        }
        if (wanted === undefined) { return target; }
        if (wanted && !target) {
            ge.warn('clipboard.shortcuts needs active_target, or settings_panel "sidebar": without it, Ctrl+C and Ctrl+V do nothing');
            return false;
        }

        return wanted;
    }

    function copy(node, kind, source) {
        var html = ge.nodeHtml(node);

        write({ version: VERSION, category: categoryOf(kind), kind: kind, html: html });
        ge.emit('after-copy', ge.payloadFor(kind, node, { source: source || 'tool' }));

        // The canvas came back with new drawers: the one to flash is the
        // node's new copy tool
        var tool = dom.child(ge.drawerOf(node), '.ge-copy');
        if (!tool) { return; }

        var icon = dom.one(tool, 'i');
        dom.addClass(tool, 'ge-copied');
        if (icon) { icon.setAttribute('class', 'bi bi-check2'); }
        setTimeout(function() {
            dom.removeClass(tool, 'ge-copied');
            if (icon) { icon.setAttribute('class', 'bi bi-copy'); }
        }, 1200);
    }

    function paste(target, categories) {
        var clip = read();
        if (!fits(clip, categories)) { return; }

        ge.place(ge.freshNode(clip.html), clip.kind, { appendTo: target, source: 'paste' });
    }

    /**
     * Ctrl+V: into the target as the toolbar's paste button would - a
     * section, which only the canvas takes, after the block the target is in
     * - and what that button has none for as the target's paste tool would.
     * With no target, as the selected node's paste tool. What does not fit
     * is not pasted anywhere else.
     */
    function pasteByShortcut() {
        var clip = read();
        var target = ge.getActiveTarget();
        var node = target || ge.getSelected();
        if (!clip || !node) { return false; }

        var placement = { appendTo: node, source: 'paste' };
        if (target && clip.category === 'section') {
            if (!available(clip)) { return false; }
            var top = target;
            while (top.parentElement && top.parentElement !== ge.canvas) { top = top.parentElement; }
            placement = { insertAfter: top, source: 'paste' };
        } else if (!fits(clip, TARGETS[ge.kindOf(node)] || [])) {
            return false;
        }

        var made = ge.place(ge.freshNode(clip.html), clip.kind, placement);
        if (made && made.scrollIntoView) { made.scrollIntoView({ behavior: 'smooth' }); }

        return true;
    }

    function copyByShortcut() {
        if (textSelected()) { return false; }

        var node = ge.getSelected() || ge.getActiveTarget();
        var kind = node && ge.kindOf(node);
        if (!kind || !categoryOf(kind)) { return false; }

        copy(node, kind, 'shortcut');
        return true;
    }

    function onKeydown(e) {
        if (lastEditor !== ge || e.repeat || e.shiftKey || e.altKey || !(e.ctrlKey || e.metaKey)) { return; }
        var key = shortcutKey(e);
        if (!key || !dom.hasClass(ge.canvas, 'ge-editing') || typing() || ge.panelOpen()) { return; }

        // Left alone, it is the browser's: a copy of the text, a paste in a field
        if (key === 'c' ? copyByShortcut() : pasteByShortcut()) { e.preventDefault(); }
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

    /** Show the paste tools, and the toolbar's paste buttons, that fit what is copied. */
    function refresh() {
        var clip = read();

        dom.all(ge.canvas, '.ge-paste').forEach(function(tool) {
            dom.toggle(tool, fits(clip, tool.getAttribute('data-ge-paste').split(' ')));
        });

        ge.toolbarItems('clipboard').forEach(function(button) {
            var item = TOOLBAR[parseInt(button.getAttribute('data-ge-item'), 10)];
            dom.toggle(button, fits(clip, [item.kind]));
        });

        shown = clip;
    }

    var TOOLBAR = [
        { kind: 'row', labelKey: 'clipboard.paste_row' },
        { kind: 'section', labelKey: 'clipboard.paste_section' },
    ].map(function(item) {
        return Object.assign(item, {
            iconClass: 'bi bi-clipboard-plus',
            // On the right, as an icon: pasting is not one of the things
            // the add buttons make
            align: 'end',
            source: 'paste',
            // A toolbar built again - another plugin's buttons changed -
            // shows only what fits, as refresh would
            hidden: function() { return !fits(read(), [item.kind]); },
            // What the button showed, even if another tab has copied
            // something else since
            create: function() { return ge.freshNode(shown.html); },
        });
    });

    return {
        drawerTools: function(drawer, node, kind) {
            if (categoryOf(kind)) {
                ge.createTool(drawer, ge.t('tool.copy'), 'ge-copy', 'bi bi-copy', function() {
                    copy(node, kind);
                });
            }

            var categories = TARGETS[kind];
            if (!categories) { return; }

            var tool = ge.createTool(drawer, ge.t('tool.paste'), 'ge-paste', 'bi bi-clipboard-plus', function() {
                paste(node, categories);
            });
            tool.setAttribute('data-ge-paste', categories.join(' '));
            dom.toggle(tool, fits(read(), categories));
        },

        toolbar: TOOLBAR,

        onInit: function() {
            refresh();
            if (!listening) {
                document.addEventListener(CHANGE, refresh);
                listening = true;
            }
            listenForShortcuts(shortcuts);
        },

        onDeinit: function() {
            document.removeEventListener(CHANGE, refresh);
            listening = false;
            // A copy takes the canvas out of editing and back: the editor
            // stays the one used last, as it is still
            listenForShortcuts(false);
        },

        onDestroy: function() {
            if (lastEditor === ge) { lastEditor = null; }
        },

        // Nothing of its own on the canvas: the tools are in the drawers
        cleanMarkup: function() {},
    };
};
