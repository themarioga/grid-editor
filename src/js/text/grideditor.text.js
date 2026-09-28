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
 * Each editor registers under $.fn.gridEditor.texts, which is this file's own
 * registry and not a contract: an editor of a host's own is a feature plugin
 * of its own, as example/custom_editor.html shows.
 */
(function($) {

    if ($.fn.gridEditor.features.text) { return; }

    $.extend($.fn.gridEditor.locales.en, {
        'text.add': 'Text',
        'text.add_type': 'Text ({editor})',
        'panel.editor': 'Editor',
        'panel.kind_text': 'Text',
    });

    /** The text editors, by the content type each edits. */
    $.fn.gridEditor.texts = $.fn.gridEditor.texts || {};

    /** What a text editor puts on a content area while it is open, whenever it likes. */
    var EDITOR_CLASS = /^(mce-|cke|note-)|^(active|ge-rte-active)$/;
    var EDITOR_ATTRIBUTE = /^(data-mce-|contenteditable$|spellcheck$)/;

    function attributesOf(element) {
        var found = {};
        $.each($.makeArray(element.attributes), function(i, attribute) {
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
        var result = $.extend({}, before);

        $.each($.extend({}, ready, open), function(name) {
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

        $.each(attributesOf(block[0]), function(name) { block.removeAttr(name); });
        $.each(result, function(name, value) { block.attr(name, value); });
    }

    function textFeature(ge) {

        var settings = ge.settings;
        var TEXTS = {};
        var warned = {};

        $.each($.fn.gridEditor.texts, function(type, factory) {
            TEXTS[type] = factory(ge);
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

            return $('<div class="ge-content" />')
                .addClass('ge-content-type-' + type)
                .attr('data-ge-content-type', type)
                .html(content !== undefined ? content : (text && text.initialContent) || '');
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
            return !!TEXTS[block.attr('data-ge-content-type')];
        }

        /** Open the editor on a text, once: until it is closed again. */
        function startText(block) {
            if (block.hasClass('ge-rte-active')) { return; }

            // A content area nobody can see - a tab that is not the open one,
            // a closed accordion item - has no geometry for an editor to lay
            // its toolbar out against, and nothing anyone can type into
            if (!block.is(':visible')) { return; }

            // The attribute, not jQuery's cached copy of it: it is markup, and
            // the drawer reads it the same way
            var text = TEXTS[block.attr('data-ge-content-type')];
            if (!text) { return; }

            // Not marked active, so the next click tries again: the library
            // may be loaded by then
            if (text.available && !text.available()) {
                if (text.missingKey) { console.error(ge.t(text.missingKey)); }
                return;
            }

            block.data('ge-text-before', attributesOf(block[0])).removeData('ge-text-ready');
            block.addClass('ge-rte-active');
            text.start(block);
        }

        function onClick() {
            startText($(this));
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
            var text = TEXTS[block.attr('data-ge-content-type')];
            var before = block.data('ge-text-before');
            var open = before ? attributesOf(block[0]) : null;

            // Every content area is told, as in 5.x: one whose editor never
            // started is the plugin's to ignore
            if (text) { text.stop(block); }

            // After stop, not before: an editor that restores the class
            // attribute it snapshotted would put ge-rte-active back
            block.removeClass('ge-rte-active');

            if (before) {
                restoreAttributes(block, before, block.data('ge-text-ready') || before, open);
                block.removeData('ge-text-before').removeData('ge-text-ready');
            }
        }

        function createTextControls(textBlock) {
            var block = textBlock.children('.ge-content');
            var type = block.attr('data-ge-content-type');
            var drawer = $('<div class="ge-tools-drawer ge-text-drawer" />').prependTo(textBlock);

            ge.createMoveTool(drawer);

            var details = ge.addSettingsTool(drawer, block, settings.text_classes);

            // Which editor edits it, first in its settings: something to
            // know about it, not something to do with it
            $('<div class="ge-field ge-text-editor" />')
                .append($('<span class="ge-field-label" />').text(ge.t('panel.editor')))
                .append($('<span class="ge-field-value" />').text(textLabel(type)))
                .prependTo(details.children('.ge-details-general'));

            settings.text_tools.forEach(function(hostTool) {
                ge.createTool(drawer, hostTool.title || '', hostTool.className || '',
                    hostTool.iconClass || 'bi bi-wrench', hostTool.on);
            });

            ge.createTool(drawer, ge.t('tool.delete_text'), 'ge-delete-text', 'bi bi-trash', function() {
                ge.deleteNode('text', block, ge.t('confirm.delete_text'), function(removed) {
                    // Its editor lets go first: removed while open, it would
                    // be left behind, attached to nothing
                    closeText(block);
                    textBlock.slideUp(function() {
                        textBlock.remove();
                        removed();
                    });
                });
            });
        }

        /** A drawer for each text of ours in a text block that has none yet. */
        function markTexts() {
            ge.canvas.find('.ge-text-block').each(function() {
                var textBlock = $(this);
                if (textBlock.children('.ge-tools-drawer').length) { return; }
                if (!isOurs(textBlock.children('.ge-content'))) { return; }

                createTextControls(textBlock);
            });
        }

        var texts = offeredTexts();

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
                            var textBlock = block.parent('.ge-text-block');
                            if (textBlock.length && !textBlock.children('.ge-tools-drawer').length) {
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

                ge.canvas.off('click.ge-text').on('click.ge-text', '.ge-content', onClick);
            },

            // While the drawers and the text blocks are still there, as the
            // editors left them
            onBeforeDeinit: function() {
                ge.canvas.find('.ge-content').each(function() {
                    if (isOurs($(this))) { closeText($(this)); }
                });
            },

            onDeinit: function() {
                ge.canvas.off('click.ge-text');
            },

            // The first time only: an undo says ready again, and by then the
            // host may have changed the content area itself
            onContentReady: function(area) {
                if (area.data('ge-text-before') && !area.data('ge-text-ready')) {
                    area.data('ge-text-ready', attributesOf(area[0]));
                }
            },
        };
    }

    // Whatever the plugins setting says: content_types chooses the editors
    textFeature.always = true;

    $.fn.gridEditor.features.text = textFeature;

})(jQuery);
