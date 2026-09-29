/**
 * Text for grid-editor: what the text editor plugins share.
 *
 * Not a file a page loads. The build puts it at the top of each text editor
 * plugin - grideditor.tinymce.js, grideditor.ckeditor.js,
 * grideditor.summernote.js - and whichever of them loads first installs it:
 * a page with two editors has one of these.
 *
 * It is a feature plugin, `text`, that the `plugins` setting does not choose
 * (content_types does), and it is everything a text is to the editor: the
 * text block's drawer, the Text buttons in the toolbar, createText, opening
 * an editor on a click and closing it again with the host's attributes put
 * back, and making the host's plain content a text through the core's
 * `textTypes` hook.
 *
 * Each editor registers under GridEditor.texts, which is this file's own
 * registry and not a contract: an editor of a host's own is a feature plugin
 * of its own, as example/custom_editor.html shows.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

// However many editors a page loads, each with a copy of this file in its
// classic script: the first one installs it
if (!GridEditor.features.text) {

    Object.assign(GridEditor.locales.en, {
        'text.add': 'Text',
        'text.add_type': 'Text ({editor})',
        'panel.editor': 'Editor',
        'panel.kind_text': 'Text',
    });

    /**
     * What a content area's attributes were before its editor opened, and
     * once it had: the two readings closeText plays the host's changes
     * back from. Shared by every editor on the page, like the nodes.
     */
    var readBefore = new WeakMap();
    var readReady = new WeakMap();

    /** What a text editor puts on a content area while it is open, whenever it likes. */
    var EDITOR_CLASS = /^(mce-|cke|ck-|note-)|^(ck|active|ge-rte-active)$/;
    var EDITOR_ATTRIBUTE = /^(data-mce-|contenteditable$|spellcheck$)/;

    function attributesOf(element) {
        var found = {};
        Array.prototype.slice.call(element.attributes).forEach(function(attribute) {
            found[attribute.name] = attribute.value;
        });
        return found;
    }

    function classesIn(value) {
        return (value || '').split(/\s+/).filter(function(name) {
            return name !== '' && !EDITOR_CLASS.test(name);
        });
    }

    /** The host's markup, with what changed from `ready` to `open` played back onto it. */
    function restoreAttributes(block, before, ready, open) {
        var result = Object.assign({}, before);

        Object.keys(Object.assign({}, ready, open)).forEach(function(name) {
            if (name === 'class' || EDITOR_ATTRIBUTE.test(name) || ready[name] === open[name]) { return; }

            if (open[name] === undefined) {
                delete result[name];
            } else {
                result[name] = open[name];
            }
        });

        var readyClasses = classesIn(ready['class']);
        var openClasses = classesIn(open['class']);
        var classes = classesIn(before['class']).filter(function(name) {
            return openClasses.indexOf(name) !== -1 || readyClasses.indexOf(name) === -1;
        });
        openClasses.forEach(function(name) {
            if (readyClasses.indexOf(name) === -1 && classes.indexOf(name) === -1) { classes.push(name); }
        });

        // In the host's order, class where it was: getHtml should not
        // shuffle a node's attributes because it was edited
        if (classes.length) { result['class'] = classes.join(' '); } else { delete result['class']; }

        Object.keys(attributesOf(block)).forEach(function(name) { block.removeAttribute(name); });
        Object.keys(result).forEach(function(name) { block.setAttribute(name, result[name]); });
    }

    function textFeature(ge) {

        var settings = ge.settings;
        var TEXTS = {};
        var warned = {};

        Object.keys(GridEditor.texts).forEach(function(type) {
            TEXTS[type] = GridEditor.texts[type](ge);
        });

        // Every editor loaded, in the order the page loaded them, unless the
        // host names the ones it wants
        if (!Array.isArray(settings.content_types)) { settings.content_types = Object.keys(TEXTS); }
        if (!Array.isArray(settings.text_tools)) { settings.text_tools = []; }
        if (!Array.isArray(settings.text_classes)) { settings.text_classes = []; }

        /** The text editors this editor offers, in content_types order: the ones loaded. */
        function offeredTexts() {
            return settings.content_types.filter(function(type) { return !!TEXTS[type]; });
        }

        /** What a text editor is called: its plugin's label, or its type. */
        function textLabel(type) {
            var text = TEXTS[type];
            return text && text.labelKey ? ge.t(text.labelKey) : type;
        }

        /** A detached content area of `type`, holding `content` or the editor's initial content. */
        function makeText(type, content) {
            var text = TEXTS[type];
            var block = dom.element('div', {
                'class': 'ge-content ge-content-type-' + type,
                'data-ge-content-type': type,
            });

            if (content && content.nodeType) {
                block.appendChild(content);
            } else {
                dom.setHtml(block, content !== undefined ? content : (text && text.initialContent) || '');
            }
            return block;
        }

        /**
         * createText(type?, options?): a content area of a text editor's,
         * detached unless a placement is given. The type is the first one
         * offered by default. `options.content` is its html.
         */
        function apiCreateText(type, options) {
            if (type && typeof type === 'object') {
                options = type;
                type = undefined;
            }
            options = options || {};
            type = type || offeredTexts()[0];

            if (!type || !TEXTS[type]) {
                if (!warned['createText:' + type]) {
                    warned['createText:' + type] = true;
                    ge.warn('createText: no text editor "' + type + '" is loaded; ' +
                        'load its plugin and name it in content_types');
                }
                return null;
            }

            return ge.place(makeText(type, options.content), 'text', options);
        }

        /** Whether a content area is a text of one of the editors loaded here. */
        function isOurs(block) {
            return !!TEXTS[block.getAttribute('data-ge-content-type')];
        }

        /** Open the editor on a text, once: until it is closed again. */
        function startText(block) {
            if (dom.hasClass(block, 'ge-rte-active')) { return; }

            // A content area nobody can see - a tab that is not the open one,
            // a closed accordion item - has no geometry for an editor to lay
            // its toolbar out against, and nothing anyone can type into
            if (!dom.visible(block)) { return; }

            // The attribute: it is markup, and the drawer reads it the same way
            var text = TEXTS[block.getAttribute('data-ge-content-type')];
            if (!text) { return; }

            // Not marked active, so the next click tries again: the library
            // may be loaded by then
            if (text.available && !text.available()) {
                if (text.missingKey) { console.error(ge.t(text.missingKey)); }
                return;
            }

            readBefore.set(block, attributesOf(block));
            readReady.delete(block);
            dom.addClass(block, 'ge-rte-active');
            text.start([block]);
        }

        function onClick() {
            startText(this);
        }

        /**
         * Close the text editor on one content area, and leave the content
         * area's own attributes as the host left them.
         *
         * An editor adds attributes of its own while it is open, and takes
         * them off again, more or less: CKEditor leaves aria-readonly behind.
         * tinyMCE does worse, and puts back every attribute as it was when it
         * opened, so an id, a class or a plugin's attribute given while it was
         * open is lost. So the attributes are read three times - before the
         * editor opens, once it has opened, and before it closes - and what
         * changed between the second and the third, the host's doing, is
         * played back onto the first, the host's markup. What the editor did
         * is left out either way.
         */
        function closeText(block) {
            var text = TEXTS[block.getAttribute('data-ge-content-type')];
            var before = readBefore.get(block);
            var open = before ? attributesOf(block) : null;

            // Every content area is told: one whose editor never
            // started is the plugin's to ignore
            if (text) { text.stop([block]); }

            // After stop, not before: an editor that restores the class
            // attribute it snapshotted would put ge-rte-active back
            dom.removeClass(block, 'ge-rte-active');

            if (before) {
                restoreAttributes(block, before, readReady.get(block) || before, open);
                readBefore.delete(block);
                readReady.delete(block);
            }
        }

        function createTextControls(textBlock) {
            var block = dom.child(textBlock, '.ge-content');
            var type = block.getAttribute('data-ge-content-type');
            var drawer = dom.element('div', { 'class': 'ge-tools-drawer ge-text-drawer' });
            textBlock.insertBefore(drawer, textBlock.firstChild);

            ge.createMoveTool(drawer);

            var details = ge.addSettingsTool(drawer, block, settings.text_classes);

            // Which editor edits it, first in its settings: something to
            // know about it, not something to do with it
            var general = dom.child(details, '.ge-details-general');
            var editor = dom.element('div', { 'class': 'ge-field ge-text-editor' });
            editor.appendChild(dom.element('span', { 'class': 'ge-field-label' }, ge.t('panel.editor')));
            editor.appendChild(dom.element('span', { 'class': 'ge-field-value' }, textLabel(type)));
            general.insertBefore(editor, general.firstChild);

            settings.text_tools.forEach(function(hostTool) {
                ge.createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });

            ge.createTool(drawer, ge.t('tool.delete_text'), 'ge-delete-text', 'bi bi-trash', function() {
                ge.deleteNode('text', block, ge.t('confirm.delete_text'), function(removed) {
                    // Its editor lets go first: removed while open, it would
                    // be left behind, attached to nothing
                    closeText(block);
                    dom.slideUp(textBlock, function() {
                        textBlock.remove();
                        removed();
                    });
                });
            });
        }

        /** A drawer for each text of ours in a text block that has none yet. */
        function markTexts() {
            dom.all(ge.canvas, '.ge-text-block').forEach(function(textBlock) {
                if (dom.child(textBlock, '.ge-tools-drawer')) { return; }

                var block = dom.child(textBlock, '.ge-content');
                if (!block || !isOurs(block)) { return; }

                createTextControls(textBlock);
            });
        }

        var texts = offeredTexts();
        var clicks = null; // The delegated click listener, while editing

        return {
            methods: {
                createText: apiCreateText,
            },

            /**
             * The types this plugin edits, for the core: every editor loaded
             * is the owner of its texts, and the ones offered are what the
             * host's plain content can be made.
             */
            textTypes: function() {
                var offered = offeredTexts();
                var others = Object.keys(TEXTS).filter(function(type) { return offered.indexOf(type) === -1; });

                return offered.concat(others).map(function(type) {
                    var text = TEXTS[type];

                    return {
                        type: type,
                        label: textLabel(type),
                        offered: offered.indexOf(type) !== -1,
                        available: text.available ? function() { return text.available(); } : null,
                        missingKey: text.missingKey,
                        edit: function(block) {
                            var textBlock = block.parentElement;
                            if (dom.hasClass(textBlock, 'ge-text-block') && !dom.child(textBlock, '.ge-tools-drawer')) {
                                createTextControls(textBlock);
                            }

                            startText(block);
                        },
                    };
                });
            },

            // A text block of each editor offered. Like a container, it goes
            // into a row of its own when clicked, or where it is dropped
            toolbar: texts.map(function(type) {
                return {
                    label: function() {
                        return texts.length > 1 ? ge.t('text.add_type', { editor: textLabel(type) }) : ge.t('text.add');
                    },
                    iconClass: TEXTS[type].iconClass,
                    className: 'ge-add-text-button',
                    kind: 'text',
                    inColumn: true,
                    create: function() { return makeText(type); },
                };
            }),

            onInit: function() {
                markTexts();

                if (clicks) { ge.canvas.removeEventListener('click', clicks); }
                clicks = dom.delegate(ge.canvas, 'click', '.ge-content', onClick);
            },

            // While the drawers and the text blocks are still there, as the
            // editors left them
            onBeforeDeinit: function() {
                dom.all(ge.canvas, '.ge-content').forEach(function(block) {
                    if (isOurs(block)) { closeText(block); }
                });
            },

            onDeinit: function() {
                if (clicks) { ge.canvas.removeEventListener('click', clicks); }
                clicks = null;
            },

            // The first time only: an undo says ready again, and by then the
            // host may have changed the content area itself
            onContentReady: function(area) {
                if (readBefore.has(area) && !readReady.has(area)) {
                    readReady.set(area, attributesOf(area));
                }
            },
        };
    }

    // Whatever the plugins setting says: content_types chooses the editors
    textFeature.always = true;

    GridEditor.features.text = textFeature;

}
