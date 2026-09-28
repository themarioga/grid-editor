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

/**
 * The attributes that point at an id, as the id itself or as a #selector.
 * A pasted copy that has to take new ids takes them here too, so its tabs,
 * its accordion and its popups still point at their own panes.
 */
var REFERENCES = ['data-bs-target', 'data-bs-parent', 'href', 'aria-controls', 'aria-labelledby',
    'aria-describedby', 'for', 'data-ge-popup-id', 'data-ge-popup-target'];

/** An id grid-editor generated: ge-{type}-{counter}-{random}. */
var GENERATED_ID = /^ge-([a-z][a-z-]*?)-\d+-[a-z0-9]+$/;

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

GridEditor.features.clipboard = function(ge) {

    var shown = null; // What the toolbar's paste buttons stand for
    var listening = false; // Whether refresh is on the document's change event

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

    function copy(node, kind) {
        var html = ge.nodeHtml(node);

        write({ version: VERSION, category: categoryOf(kind), kind: kind, html: html });
        ge.emit('after-copy', ge.payloadFor(kind, node, { source: 'tool' }));

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

        ge.place(fresh(clip.html), clip.kind, { appendTo: target, source: 'paste' });
    }

    /**
     * The copied markup as a node, with new ids where the page already has
     * them: two copies of a tab strip pointing at one set of panes is a tab
     * strip that opens the other copy's tabs. An id the page does not have
     * is kept, so pasting into another page changes nothing.
     *
     * Parsed the way innerHTML parses, so a <script> in what was copied is
     * markup, pasted like the rest, and does not run in the editor.
     */
    function fresh(html) {
        var node = dom.create(html);
        var renamed = {};
        var taken = function(id) {
            return !!document.getElementById(id) || Object.keys(renamed).some(function(old) {
                return renamed[old] === id;
            });
        };

        dom.selfAndAll(node, '[id]').forEach(function(element) {
            var id = element.id;
            if (!document.getElementById(id)) { return; }

            var generated = GENERATED_ID.exec(id);
            var next;

            if (generated) {
                do { next = ge.containerId(generated[1]); } while (taken(next));
            } else {
                var n = 2;
                while (taken(id + '-' + n)) { n++; }
                next = id + '-' + n;
            }

            renamed[id] = next;
            element.id = next;
        });

        if (!Object.keys(renamed).length) { return node; }

        dom.selfAndAll(node, '*').forEach(function(element) {
            REFERENCES.forEach(function(name) {
                var value = element.getAttribute(name);
                if (value === null) { return; }
                if (name === 'href' && value.charAt(0) !== '#') { return; }

                var rewritten = value.split(/(\s+)/).map(function(token) {
                    if (renamed[token]) { return renamed[token]; }
                    if (token.charAt(0) === '#' && renamed[token.slice(1)]) { return '#' + renamed[token.slice(1)]; }

                    return token;
                }).join('');

                if (rewritten !== value) { element.setAttribute(name, rewritten); }
            });
        });

        return node;
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
            // What the button showed, even if another tab has copied
            // something else since
            create: function() { return fresh(shown.html); },
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
        },

        onDeinit: function() {
            document.removeEventListener(CHANGE, refresh);
            listening = false;
        },
    };
};
