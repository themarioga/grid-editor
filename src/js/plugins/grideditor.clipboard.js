/**
 * Copy and paste for grid-editor.
 *
 * A feature plugin: load this file after the editor and every row, column,
 * section, container and element gets a copy tool, and every place one of
 * them can go gets a paste tool while there is something copied that fits.
 * What it can ask the editor for is the handle its factory is called with,
 * described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.clipboard.min.js"></script>
 *
 * What is copied is kept in localStorage, so it survives a reload and can be
 * pasted in another tab or another editor of the same site. A browser that
 * will not give the page its storage keeps it in memory, for this page only.
 *
 * A paste is an add like any other - before-add-* and after-add-*, with
 * `source: 'paste'` - so a host can turn one away.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
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
var editors = 0;

/**
 * What each drawer takes when something is pasted into it, by the kind of the
 * node the drawer belongs to. A category is what was copied: a row, a column,
 * a section, a container of any type, an element.
 */
var TARGETS = {
    column: ['row', 'container', 'element'],
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

    $(document).trigger(CHANGE);
}

// Another tab copied something: every editor here looks again
$(window).on('storage', function(e) {
    if (e.originalEvent && e.originalEvent.key === STORAGE_ITEM) { $(document).trigger(CHANGE); }
});

$.fn.gridEditor.features.clipboard = function(ge) {

    var namespace = '.ge-clipboard-' + (++editors);
    var shown = null; // What the toolbar's paste buttons stand for

    function used(name) {
        return !ge.settings.plugins || ge.settings.plugins.indexOf(name) !== -1;
    }

    /** A category this editor can take: the plugin that makes it is here. */
    function available(clip) {
        if (clip.category === 'container') {
            return !!$.fn.gridEditor.containers[clip.kind] && used(clip.kind);
        }
        if (clip.category === 'section') { return !!$.fn.gridEditor.features.sections && used('sections'); }
        if (clip.category === 'element') { return !!$.fn.gridEditor.features.elements && used('elements'); }

        return true;
    }

    function fits(clip, categories) {
        return !!clip && categories.indexOf(clip.category) !== -1 && available(clip);
    }

    function categoryOf(kind) {
        if ($.fn.gridEditor.containers[kind]) { return 'container'; }

        return ['row', 'column', 'section', 'element'].indexOf(kind) !== -1 ? kind : null;
    }

    function copy(node, kind) {
        var html = ge.nodeHtml(node);

        write({ version: VERSION, category: categoryOf(kind), kind: kind, html: html });
        ge.emit('after-copy', ge.payloadFor(kind, node, { source: 'tool' }));

        // The canvas came back with new drawers: the one to flash is the
        // node's new copy tool
        var tool = node.children('.ge-tools-drawer').find('> .ge-copy');
        tool.addClass('ge-copied').find('i').attr('class', 'bi bi-check2');
        setTimeout(function() {
            tool.removeClass('ge-copied').find('i').attr('class', 'bi bi-copy');
        }, 1200);
    }

    function paste(target, categories) {
        var clip = read();
        if (!fits(clip, categories)) { return; }

        var node = fresh(clip.html);
        var into = target;

        // An element goes into the column's last content area. With none,
        // the column's next init wraps it in one of its own
        if (clip.category === 'element') {
            var area = target.children('.ge-content').last();
            if (area.length) { into = area; }
        }

        ge.place(node, clip.kind, { appendTo: into, source: 'paste' });
    }

    /**
     * The copied markup as a node, with new ids where the page already has
     * them: two copies of a tab strip pointing at one set of panes is a tab
     * strip that opens the other copy's tabs. An id the page does not have
     * is kept, so pasting into another page changes nothing.
     */
    function fresh(html) {
        var node = $($.parseHTML(html.trim(), document, true)).first();
        var renamed = {};
        var taken = function(id) {
            return !!document.getElementById(id) || Object.keys(renamed).some(function(old) {
                return renamed[old] === id;
            });
        };

        node.find('[id]').addBack('[id]').each(function() {
            var id = this.id;
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
            this.id = next;
        });

        if (!Object.keys(renamed).length) { return node; }

        node.find('*').addBack().each(function() {
            var element = this;

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

        ge.canvas.find('.ge-paste').each(function() {
            $(this).toggle(fits(clip, $(this).attr('data-ge-paste').split(' ')));
        });

        ge.toolbarItems('clipboard').each(function() {
            var item = TOOLBAR[parseInt($(this).attr('data-ge-item'), 10)];
            $(this).toggle(fits(clip, [item.kind]));
        });

        shown = clip;
    }

    var TOOLBAR = [
        { kind: 'row', labelKey: 'clipboard.paste_row' },
        { kind: 'section', labelKey: 'clipboard.paste_section' },
    ].map(function(item) {
        return $.extend(item, {
            iconClass: 'bi bi-clipboard-plus',
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

            ge.createTool(drawer, ge.t('tool.paste'), 'ge-paste', 'bi bi-clipboard-plus', function() {
                paste(node, categories);
            });
            drawer.children('.ge-paste').last()
                .attr('data-ge-paste', categories.join(' '))
                .toggle(fits(read(), categories));
        },

        toolbar: TOOLBAR,

        onInit: function() {
            refresh();
            $(document).off(CHANGE + namespace).on(CHANGE + namespace, refresh);
        },

        onDeinit: function() {
            $(document).off(CHANGE + namespace);
        },
    };
};

})(jQuery);
