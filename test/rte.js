/**
 * Browser tests for the rich text editor integrations.
 *
 * Run with `npm test`, or on its own with `node test/rte.js`. This drives the
 * example pages in a real Chrome, against the real editors loaded from their
 * CDNs, because the things that break in these integrations are things only a
 * browser does: an inline editor taking focus, and the attributes an editor
 * restores on the element it was attached to when it is removed again.
 *
 * The editors come from a CDN rather than from `test/vendor`, so the runner
 * skips this suite when there is no network.
 *
 * Tests run against the built files in `dist`, so run `npm run build` first if
 * you changed anything under `src`.
 */

var path = require('path');
var cdp = require('./cdp');

var sleep = cdp.sleep;

/**
 * The editor state of the first content area, as seen from the page.
 */
var CONTENT_AREA_STATE = `
    const contentArea = jQuery('#myGrid .ge-content').first();
    return {
        editorsOpen: tinymce.get().length,
        editorAttached: !!contentArea.data('ge-tinymce'),
        pendingRemove: contentArea.data('ge-tinymce-pending-remove'),
        cssClass: contentArea.attr('class'),
        contenteditable: contentArea.attr('contenteditable'),
    };
`;

async function tinymceTests(t) {
    var page = await t.page('/example/basic.html');
    await page.waitFor(
        `window.jQuery && window.tinymce && jQuery('#myGrid').data('grideditor')`,
        { label: 'dependencies and grid editor' }
    );

    t.check('the page boots with the grid editor initialized', true, await page.eval(`
        return {
            jquery: jQuery.fn.jquery,
            tinymce: tinymce.majorVersion + '.' + tinymce.minorVersion,
            editing: jQuery('.ge-canvas').hasClass('ge-editing'),
            contentAreas: jQuery('.ge-content').length,
        };
    `));

    // Clicking a content area starts an inline editor on that element
    await page.click('.ge-content');
    await page.waitFor(`tinymce.get().length === 1 && tinymce.get()[0].initialized`, { label: 'editor init' });

    var editing = await page.eval(`
        const contentArea = jQuery('.ge-content').first();
        const editor = tinymce.get()[0];
        return {
            editorsOpen: tinymce.get().length,
            storedInData: contentArea.data('ge-tinymce') === editor,
            active: contentArea.hasClass('active'),
            contenteditable: contentArea.attr('contenteditable'),
            inline: !!editor.inline,
            attachedToContentArea: editor.getElement() === contentArea[0],
            focused: document.activeElement === contentArea[0],
            toolbar: !!document.querySelector('.tox-tinymce-inline'),
        };
    `);
    t.check('clicking a content area starts an inline editor on it',
        editing.editorsOpen === 1 && editing.storedInData && editing.active &&
        editing.contenteditable === 'true' && editing.inline && editing.attachedToContentArea,
        editing);
    t.check('the new editor takes focus and shows its inline toolbar',
        editing.focused && editing.toolbar, editing);

    var promotion = await page.eval(`
        return {
            byDefault: document.querySelectorAll('.tox-promotion').length,
            menubar: !!document.querySelector('.tox-menubar'),
        };
    `);
    t.check('tinyMCE\u2019s upgrade promotion is not shown',
        promotion.byDefault === 0 && promotion.menubar, promotion);

    await page.type('HELLO_FROM_CHROME ');
    var typed = await page.eval(`return { content: tinymce.get()[0].getContent().slice(0, 120) };`);
    t.check('typing reaches the editor', typed.content.indexOf('HELLO_FROM_CHROME') !== -1, typed);

    await page.screenshot(path.join(t.screenshots, 'tinymce-editing.png'));

    // getHtml has to hand back markup with no trace of the editor in it
    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            keptTypedText: html.includes('HELLO_FROM_CHROME'),
            contenteditable: /contenteditable/i.test(html),
            dataMce: /data-mce/i.test(html),
            mceClasses: /mce-content-body|mce-edit-focus/i.test(html),
            spellcheck: /spellcheck/i.test(html),
            idAttribute: /\\sid=/i.test(html),
            toolsDrawer: /ge-tools-drawer/.test(html),
            editorsOpen: tinymce.get().length,
            contentAreaAttributes: Array.from(jQuery('.ge-content').first()[0].attributes).map(a => a.name),
            stillEditing: jQuery('.ge-canvas').hasClass('ge-editing'),
        };
    `);
    t.check('getHtml returns markup with no editor leftovers',
        exported.keptTypedText && !exported.contenteditable && !exported.dataMce &&
        !exported.mceClasses && !exported.spellcheck && !exported.idAttribute && !exported.toolsDrawer,
        exported);
    t.check('getHtml removes the live editor and leaves the grid editor editing',
        exported.editorsOpen === 0 && exported.stillEditing, exported);

    // An editor that restores its class attribute on removal used to put
    // ge-rte-active back, which made initRTE ignore every later click
    await page.click('.ge-content');
    await sleep(2500);
    var reEdited = await page.eval(CONTENT_AREA_STATE);
    t.check('a content area is still editable after getHtml',
        reEdited.editorsOpen === 1 && reEdited.editorAttached, reEdited);

    // tinymce.init is asynchronous and getHtml deinits then inits
    // synchronously, so deinit can land while an init is still in flight
    var raced = await page.eval(`
        jQuery('#myGrid').gridEditor('getHtml');             // start from no editor
        jQuery('#myGrid .ge-content').first().trigger('click'); // starts tinymce.init()
        const html = jQuery('#myGrid').gridEditor('getHtml'); // deinit lands mid init
        return {
            editorsDuring: tinymce.get().length,
            htmlClean: !/contenteditable|data-mce|mce-content-body/i.test(html),
        };
    `);
    await sleep(2500);
    var settled = await page.eval(`
        return {
            editorsOpen: tinymce.get().length,
            activeEditor: !!tinymce.activeEditor,
            pendingRemove: jQuery('#myGrid .ge-content').first().data('ge-tinymce-pending-remove'),
            editorAttached: !!jQuery('#myGrid .ge-content').first().data('ge-tinymce'),
            contenteditableElements: document.querySelectorAll('#myGrid [contenteditable]').length,
            inlineToolbars: document.querySelectorAll('.tox-tinymce-inline').length,
            activeContentAreas: jQuery('#myGrid .ge-content.active').length,
        };
    `);
    t.check('a deinit during an in-flight init strands no editor',
        settled.editorsOpen === 0 && !settled.activeEditor && settled.pendingRemove === undefined &&
        !settled.editorAttached && settled.contenteditableElements === 0 &&
        settled.inlineToolbars === 0 && settled.activeContentAreas === 0,
        Object.assign(raced, settled));

    await page.click('.ge-content');
    await sleep(2500);
    var afterRace = await page.eval(CONTENT_AREA_STATE);
    t.check('a content area that lost that race is editable again afterwards',
        afterRace.editorsOpen === 1 && afterRace.editorAttached && afterRace.pendingRemove === undefined,
        afterRace);

    // Callbacks from the caller's own config, including the pre-6 oninit name
    await page.eval(`
        window.callbacks = { init_instance_callback: 0, oninit: 0, sameEditor: null };
        jQuery('#myGrid').gridEditor('remove');
        jQuery('#myGrid').gridEditor({
            new_row_layouts: [[12], [6, 6]],
            content_types: ['tinymce'],
            tinymce: { config: {
                init_instance_callback: function(editor) {
                    window.callbacks.init_instance_callback++;
                    window.callbacks.sameEditor = (editor === tinymce.get()[0]);
                },
                oninit: function() { window.callbacks.oninit++; },
                menubar: false,
            } },
        });
        return 1;
    `);
    await page.click('.ge-content');
    await sleep(3000);
    var callbacks = await page.eval(`
        return Object.assign({}, window.callbacks, {
            editorsOpen: tinymce.get().length,
            menubar: !!document.querySelector('.tox-menubar'),
        });
    `);
    t.check('init_instance_callback and the pre-6 oninit each fire once, with the user config applied',
        callbacks.init_instance_callback === 1 && callbacks.oninit === 1 &&
        callbacks.sameEditor === true && callbacks.menubar === false,
        callbacks);

    // The source code button deinits, then inits again on the way back
    await page.click('.gm-edit-mode');
    await sleep(400);
    var sourceMode = await page.eval(`
        const textarea = jQuery('#myGrid').parent().find('textarea').filter(':visible');
        return {
            editorsOpen: tinymce.get().length,
            textareaVisible: textarea.length === 1,
            textareaClean: textarea.length ? !/contenteditable|data-mce/i.test(textarea.val()) : null,
        };
    `);
    await page.click('.gm-edit-mode');
    await sleep(400);
    await page.click('.ge-content');
    await sleep(2000);
    t.check('the source code button deinits and inits again cleanly',
        sourceMode.editorsOpen === 0 && sourceMode.textareaVisible && sourceMode.textareaClean === true,
        Object.assign(sourceMode, { editableAfterwards: (await page.eval(CONTENT_AREA_STATE)).editorAttached }));

    // A row added from the toolbar gets content areas with the placeholder in
    // them, which the editor clears as it takes over
    var before = await page.eval(`return { contentAreas: jQuery('.ge-content').length };`);
    await page.click('.ge-addRowGroup a', 1);
    await sleep(400);
    var added = await page.eval(`return { contentAreas: jQuery('.ge-content').length };`);
    await page.click('.ge-content', added.contentAreas - 1);
    await sleep(2000);
    var newArea = await page.eval(`
        const contentArea = jQuery('.ge-content').last();
        return {
            editorAttached: !!contentArea.data('ge-tinymce'),
            placeholderCleared: contentArea.html().indexOf('Lorem ipsum dolores') === -1,
        };
    `);
    t.check('a content area in a newly added row becomes editable and drops its placeholder',
        added.contentAreas > before.contentAreas && newArea.editorAttached && newArea.placeholderCleared,
        Object.assign({ before: before.contentAreas, after: added.contentAreas }, newArea));

    var errors = page.errors();
    t.check('example/basic.html logged no errors', errors.length === 0, errors.slice(0, 5));

    // The other two pages wiring up tinyMCE
    for (var name of ['autosave.html', 'wrap_content.html', 'clipboard.html']) {
        var other = await t.page('/example/' + name);
        await other.waitFor(`window.tinymce && jQuery('#myGrid').data('grideditor')`, { label: name });

        // The autosave page starts from an empty grid, so give it a row first
        if (!await other.eval(`return jQuery('.ge-content').length;`)) {
            await other.click('.ge-addRowGroup a', 1);
            await sleep(400);
        }

        await other.click('.ge-content');
        await sleep(2000);
        var state = await other.eval(`
            return {
                editorsOpen: tinymce.get().length,
                activeContentAreas: jQuery('.ge-content.active').length,
            };
        `);
        var otherErrors = other.errors();
        t.check('example/' + name + ' boots and starts an editor without errors',
            otherErrors.length === 0 && state.editorsOpen === 1 && state.activeContentAreas === 1,
            Object.assign(state, { errors: otherErrors.slice(0, 5) }));
    }

    // Every example loads its text editor as a plugin, the way 6.0 needs it,
    // rather than leaning on the main bundle's copy
    var usingCopy = [];
    for (var example of ['basic', 'autosave', 'wrap_content', 'clipboard', 'attributes', 'elements',
        'containers', 'ckeditor', 'summernote']) {
        var loaded = await t.page('/example/' + example + '.html');
        await loaded.waitFor(`jQuery('#myGrid').data('grideditor')`, { label: example });
        var copies = await loaded.eval(`
            return Object.keys($.fn.gridEditor.texts).filter(function(type) {
                return $.fn.gridEditor.texts[type].bundled &&
                    jQuery('#myGrid').data('grideditor').settings.content_types.indexOf(type) !== -1;
            });
        `);
        if (copies.length) { usingCopy.push(example + ': ' + copies.join(',')); }
    }
    t.check('every example loads the plugin of the text editor it uses', usingCopy.length === 0, usingCopy);
}

/**
 * An element in the same content area as text: the editor has to treat it as
 * one atomic thing and hand it back unchanged. Checked on the elements
 * example, which is the page that loads the elements plugin.
 */
async function elementTests(t) {
    var page = await t.page('/example/elements.html',
        `window.tinymce && jQuery('#myGrid').data('grideditor')`);

    // An element sitting in the same content area as text: the editor has to
    // treat it as one atomic thing, and hand it back unchanged
    await page.eval(`
        jQuery('#myGrid').gridEditor('remove');
        jQuery('#myGrid').html(
            // The content type attribute is what an editor is started from,
            // and a hand written content area has to carry it like the ones
            // the editor wraps for itself do
            '<div class="row"><div class="col-lg-12">' +
            '<div class="ge-content" data-ge-content-type="tinymce">' +
            '<p>Text before the element.</p>' +
            '<div data-ge-element="callout" data-ge-label="Callout"><p>Inside the element.</p></div>' +
            '<p>Text after the element.</p>' +
            '</div></div></div>'
        );
        jQuery('#myGrid').gridEditor({ new_row_layouts: [[12]], content_types: ['tinymce'] });
        return jQuery('#myGrid .ge-element').length;
    `);
    await page.click('.ge-content');
    await sleep(2500);

    var withElement = await page.eval(`
        const element = jQuery('#myGrid .ge-element').first();
        const editor = tinymce.get()[0];
        return {
            editorOpen: !!editor,
            elementKept: element.length === 1,
            contenteditable: element.attr('contenteditable'),
            drawer: element.find('> .ge-tools-drawer').length,
            tools: element.find('> .ge-tools-drawer > a').map(function() {
                return jQuery(this).attr('class').split(' ')[0];
            }).get().join(','),
            typeKept: element.attr('data-ge-element'),
            marked: element.hasClass('ge-element'),
            editorSeesItAsAtomic: editor ? editor.dom.getAttrib(element[0], 'contenteditable') : null,
        };
    `);
    t.check('an element inside an active editor is atomic, not text it may rewrite',
        withElement.editorOpen && withElement.elementKept &&
        withElement.contenteditable === 'false' && withElement.drawer === 1 &&
        withElement.typeKept === 'callout' && withElement.marked &&
        withElement.editorSeesItAsAtomic === 'false',
        withElement);
    t.check('the element keeps its tools after the editor has rewritten the content area',
        withElement.tools === 'ge-move,ge-element-info,ge-settings,ge-delete-element', withElement);

    var exportedElement = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            keptElement: /data-ge-element="callout"/.test(html),
            keptLabel: /data-ge-label="Callout"/.test(html),
            keptInnerText: html.indexOf('Inside the element.') !== -1,
            keptTextAround: html.indexOf('Text before the element.') !== -1 &&
                html.indexOf('Text after the element.') !== -1,
            drawer: /ge-tools-drawer/.test(html),
            editable: /contenteditable/i.test(html),
            marking: /class="[^"]*ge-element/.test(html),
            mce: /data-mce|mce-content-body/i.test(html),
        };
    `);
    t.check('an element survives a round trip through the editor unchanged',
        exportedElement.keptElement && exportedElement.keptLabel &&
        exportedElement.keptInnerText && exportedElement.keptTextAround &&
        !exportedElement.drawer && !exportedElement.editable &&
        !exportedElement.marking && !exportedElement.mce,
        Object.assign({}, exportedElement, { html: exportedElement.html.slice(0, 220) }));

    var errors = page.errors();
    t.check('example/elements.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A utility on an element inside an open editor. The preview is inline style
 * on a node the editor rebuilds as it takes the content area over and again
 * as it lets go, so what is checked is that the record of it survives both,
 * and that getHtml hands back the class and nothing of the preview.
 */
async function utilityTests(t) {
    var page = await t.page('/example/elements.html',
        `window.tinymce && jQuery('#myGrid').data('grideditor')`);

    await page.eval(`
        jQuery('#myGrid').gridEditor('remove');
        jQuery.fn.gridEditor.utilities.testing = function() {
            return { families: [{
                name: 'order', prefix: 'order', values: ['1', '2', '3'], appliesTo: ['element'],
                preview: function(value) { return { order: value === null ? '0' : value }; },
            }] };
        };
        jQuery('#myGrid').html(
            '<div class="row"><div class="col-lg-12">' +
            '<div class="ge-content" data-ge-content-type="tinymce">' +
            '<p>Text before the element.</p>' +
            '<div data-ge-element="callout" class="order-md-2"><p>Inside the element.</p></div>' +
            '</div></div></div>'
        );
        jQuery('#myGrid').gridEditor({ new_row_layouts: [[12]], content_types: ['tinymce'], default_view: 'md' });
    `);
    await page.click('.ge-content');
    await sleep(2500);

    var open = await page.eval(`
        const element = jQuery('#myGrid .ge-element').first();
        return {
            editorOpen: tinymce.get().length === 1,
            classKept: element.hasClass('order-md-2'),
            previewed: element[0].style.getPropertyValue('order') === '2' &&
                element[0].style.getPropertyPriority('order') === 'important',
            recorded: element.attr('data-ge-preview') !== undefined,
            field: element.find('> .ge-tools-drawer .ge-utility select').val(),
        };
    `);
    t.check('an element inside an open editor keeps its utility class, its preview and its field',
        open.editorOpen && open.classKept && open.previewed && open.recorded && open.field === '2', open);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            classKept: /class="order-md-2"/.test(html),
            preview: /data-ge-preview|important|style=/.test(html),
            previewBack: jQuery('#myGrid .ge-element').first().attr('data-ge-preview') !== undefined,
        };
    `);
    t.check('the utility class survives the round trip through the editor, the preview does not',
        exported.classKept && !exported.preview && exported.previewBack,
        Object.assign({}, exported, { html: exported.html.slice(0, 220) }));

    await page.eval(`delete jQuery.fn.gridEditor.utilities.testing;`);

    var errors = page.errors();
    t.check('the utility round trip logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A content area inside a container is the awkward case: the pane it sits in
 * may have just appeared, and the inline toolbar is laid out against whatever
 * geometry the element has when tinyMCE draws it. Checked on the containers
 * example, which is the page that loads the container plugins.
 */
async function containerTests(t) {
    var page = await t.page('/example/containers.html',
        `window.tinymce && jQuery('#myGrid').data('grideditor')`);

    await page.eval(`
        jQuery('#myGrid').gridEditor('remove');
        jQuery('#myGrid').html('<div class="row"><div class="col-lg-12"><div class="ge-content" data-ge-content-type="tinymce"><p>Before</p></div></div></div>');
        jQuery('#myGrid').gridEditor({ new_row_layouts: [[12]], content_types: ['tinymce'] });
        jQuery('.ge-addContainerGroup a[data-ge-container-type="tabs"]').trigger('click');
        window.scrollTo(0, 0);
        return jQuery('#myGrid [data-ge-container="tabs"]').length;
    `);
    await page.click('#myGrid .tab-pane.active .ge-content');
    await sleep(2500);

    var inTab = await page.eval(`
        const toolbar = document.querySelector('.tox-tinymce-inline');
        const area = document.querySelector('#myGrid .tab-pane.active .ge-content');
        const box = toolbar ? toolbar.getBoundingClientRect() : null;

        return {
            editors: tinymce.get().length,
            toolbar: !!toolbar,
            // Wrapped into a narrow column, the menubar alone takes several
            // rows and the whole thing is a few hundred pixels tall
            toolbarWidth: box ? Math.round(box.width) : null,
            toolbarHeight: box ? Math.round(box.height) : null,
            areaWidth: Math.round(area.getBoundingClientRect().width),
        };
    `);
    t.check('an editor inside a tab lays its toolbar out against the pane it is in',
        inTab.editors === 1 && inTab.toolbar && inTab.toolbarHeight < 120 &&
        inTab.toolbarWidth > 400,
        inTab);

    var hiddenPane = await page.eval(`
        jQuery('#myGrid .tab-pane:not(.active) .ge-content').trigger('click');
        return {
            editors: tinymce.get().length,
            activeAreas: jQuery('#myGrid .ge-content.active').length,
        };
    `);
    t.check('a content area in a pane nobody can see does not get an editor at all',
        hiddenPane.editors === 1 && hiddenPane.activeAreas === 1, hiddenPane);

    var errors = page.errors();
    t.check('example/containers.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * The deinit path these tests cover is shared by every integration, so check
 * the other two examples through one edit cycle as well.
 */
async function otherEditorTests(t) {
    var page = await t.page('/example/ckeditor.html');
    await page.waitFor(`window.CKEDITOR && jQuery('#myGrid').data('grideditor')`, { label: 'ckeditor page' });

    // A CKEditor of the page's own, outside the grid: closing a content area
    // used to destroy every instance on the page, this one included
    await page.eval(`
        const own = jQuery('<div id="host-ckeditor" contenteditable="true"><p>A CKEditor of the page itself</p></div>')
            .appendTo('body');
        CKEDITOR.inline(own[0]);
        return true;
    `);
    await page.waitFor(`CKEDITOR.instances['host-ckeditor'] && CKEDITOR.instances['host-ckeditor'].status === 'ready'`,
        { label: 'the page\'s own CKEditor' });

    var state = `return {
        instances: Object.keys(CKEDITOR.instances).filter(function(name) { return name !== 'host-ckeditor'; }).length,
        hostKept: !!CKEDITOR.instances['host-ckeditor'],
        rteActive: jQuery('#myGrid .ge-content').first().hasClass('ge-rte-active'),
    };`;

    await page.click('.ge-content');
    await sleep(2000);
    var ckediting = await page.eval(state);
    var html = await page.eval(`return jQuery('#myGrid').gridEditor('getHtml');`);
    await sleep(500);
    var afterExport = await page.eval(state);
    await page.click('.ge-content');
    await sleep(2000);
    var ckReEdited = await page.eval(state);

    // 4.22.1 is the last release under the open source licence, so its
    // "consider upgrading" notice is expected and not a test failure
    var ckErrors = page.errors([/version is not secure/]);
    t.check('ckeditor edits, exports clean html and edits again',
        ckediting.instances === 1 && afterExport.instances === 0 && !afterExport.rteActive &&
        ckReEdited.instances === 1 && !/contenteditable|cke_|ge-rte-active/.test(html) && ckErrors.length === 0,
        { editing: ckediting, afterExport: afterExport, reEdited: ckReEdited, errors: ckErrors.slice(0, 3) });
    t.check('closing a content area destroys its own CKEditor and leaves the page\'s alone',
        afterExport.hostKept && ckReEdited.hostKept, { afterExport: afterExport, reEdited: ckReEdited });

    // Summernote 0.9.1 calls $.now(), which jQuery 4 removed: the plugin gives
    // it back, so summernote opens at all
    var sn = await t.page('/example/summernote.html');
    await sn.waitFor(`jQuery.fn.summernote && jQuery('#myGrid').data('grideditor')`, { label: 'summernote page' });

    var snState = `return {
        editors: jQuery('.note-editor').length,
        rteActive: jQuery('#myGrid .ge-content').first().hasClass('ge-rte-active'),
    };`;
    var nowBefore = await sn.eval(`return typeof jQuery.now;`);

    await sn.click('.ge-content');
    await sleep(1500);
    var snEditing = await sn.eval(snState);
    await sn.eval(`jQuery('#myGrid .ge-content').first().summernote('insertText', ' SUMMERNOTE-TYPED '); return 1;`);
    var snHtml = await sn.eval(`return jQuery('#myGrid').gridEditor('getHtml');`);
    await sleep(300);
    var snAfterExport = await sn.eval(snState);
    await sn.click('.ge-content');
    await sleep(1500);
    var snReEdited = await sn.eval(snState);
    var nowAfter = await sn.eval(`return jQuery.now === Date.now;`);

    var snErrors = sn.errors();
    t.check('summernote edits, exports clean html and edits again',
        nowBefore === 'undefined' && nowAfter &&
        snEditing.editors === 1 && snEditing.rteActive && snAfterExport.editors === 0 && !snAfterExport.rteActive &&
        snReEdited.editors === 1 && snHtml.indexOf('SUMMERNOTE-TYPED') !== -1 &&
        !/note-editor|note-editable|ge-rte-active/.test(snHtml) && snErrors.length === 0,
        { editing: snEditing, afterExport: snAfterExport, reEdited: snReEdited, nowBefore: nowBefore,
            nowAfter: nowAfter, errors: snErrors.slice(0, 3) });
}

/**
 * example/attributes.html: a plugin of the page's own that saves a modal's
 * settings as an attribute, on an element inside text tinyMCE is editing.
 * The attribute has to survive the user undoing their typing, which it only
 * does because the plugin writes it through tinyMCE's undo manager, and it
 * has to come out of getPlainHtml.
 */
async function attributePluginTests(t) {
    var page = await t.page('/example/attributes.html',
        `window.tinymce && jQuery('#myGrid').data('grideditor')`);

    var tools = await page.eval(`
        const tool = function(node) { return jQuery(node).children('.ge-tools-drawer').children('.my-animation-tool'); };
        return {
            rows: jQuery('#myGrid .row').get().every(function(row) { return tool(row).length === 1; }),
            columns: jQuery('#myGrid .column').get().every(function(column) { return tool(column).length === 1; }),
            card: tool(jQuery('#myGrid [data-ge-container="card"]')).length,
            element: tool(jQuery('#myGrid .ge-element')).length,
            texts: jQuery('#myGrid .ge-text-block').get().every(function(block) { return tool(block).length === 1; }),
            presetHighlighted: tool(jQuery('#myGrid > .row').first()).hasClass('my-animation-set'),
            othersPlain: tool(jQuery('#myGrid > .row').eq(1)).hasClass('my-animation-set'),
        };
    `);
    t.check('example/attributes.html puts its tool on rows, columns, texts, containers and elements',
        tools.rows && tools.columns && tools.texts && tools.card === 1 && tools.element === 1 &&
        tools.presetHighlighted && !tools.othersPlain,
        tools);

    // Open tinyMCE on the text around the quote, and type
    await page.eval(`jQuery('#myGrid .ge-element').closest('.ge-content').trigger('click'); return 1;`);
    await page.waitFor(`tinymce.get().length === 1 && tinymce.get()[0].initialized`, { label: 'tinyMCE' });
    await sleep(300);
    await page.eval(`tinymce.get()[0].insertContent(' BEFORE-MODAL '); return 1;`);

    // Set an animation on the quote through the modal, with the editor open
    await page.eval(`jQuery('#myGrid .ge-element > .ge-tools-drawer > .my-animation-tool').trigger('click'); return 1;`);
    await page.waitFor(`jQuery('.my-animation-modal').hasClass('show')`, { label: 'the modal' });
    await sleep(400);
    await page.eval(`
        const form = jQuery('.my-animation-modal form');
        form.find('[name=effect]').val('slide');
        form.find('[name=duration]').val('500');
        form.find('[name=delay]').val('100');
        form.find('[name=once]').prop('checked', false);
        return 1;
    `);
    await page.click('.my-animation-modal .modal-footer .btn-primary');
    await page.waitFor(`!jQuery('.my-animation-modal').hasClass('show')`, { label: 'the modal closing' });

    // Keep typing, then undo that
    var undone = await page.eval(`
        const editor = tinymce.get()[0];
        editor.insertContent(' AFTER-MODAL ');
        editor.undoManager.undo();
        return {
            editorStillOpen: tinymce.get().length === 1,
            // tinyMCE's snapshots leave the drawer out, so an undo that did
            // not put it back would leave the element with no tools at all
            drawers: jQuery('#myGrid .ge-element').children('.ge-tools-drawer').length,
            highlighted: jQuery('#myGrid .ge-element > .ge-tools-drawer > .my-animation-tool').hasClass('my-animation-set'),
        };
    `);

    var exported = await page.eval(`
        const plain = jQuery('#myGrid').gridEditor('getPlainHtml');
        const root = document.createElement('div');
        root.innerHTML = plain;
        const quote = root.querySelector('blockquote');
        return {
            quote: quote && quote.getAttribute('data-animation'),
            row: root.querySelector('.row').getAttribute('data-animation'),
            text: root.textContent,
            editorMarks: /data-ge-|ge-tools-drawer|my-animation-tool/.test(plain),
            modalOutside: jQuery('#myGrid .my-animation-modal').length === 0 && jQuery('body > .my-animation-modal').length === 1,
        };
    `);
    var quote = null;
    try { quote = JSON.parse(exported.quote); } catch (error) { quote = null; }

    t.check('the modal saves its settings on the element as data-animation',
        !!quote && quote.effect === 'slide' && quote.duration === 500 && quote.delay === 100 && quote.once === false &&
        undone.highlighted && undone.editorStillOpen,
        { undone: undone, exported: exported });
    t.check('an element keeps its drawer through an undo in tinyMCE',
        undone.drawers === 1, undone);
    t.check('undoing the typing after it, in tinyMCE, keeps the attribute and undoes the typing',
        !!quote && exported.text.indexOf('AFTER-MODAL') === -1 && exported.text.indexOf('BEFORE-MODAL') !== -1,
        exported);
    t.check('getPlainHtml keeps data-animation, preset and new, and nothing of the editor\'s',
        exported.row === '{"effect":"fade","duration":800,"delay":0,"once":true}' && !!quote &&
        !exported.editorMarks && exported.modalOutside,
        exported);

    var errors = page.errors();
    t.check('example/attributes.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A text block's own attributes - its id and classes from the panel, a
 * utility's class, a plugin's attribute - given while its editor is open.
 * tinyMCE puts back the attributes it found when it opened, and every
 * integration took the id off when it closed, so each of these used to be
 * lost; and CKEditor left aria-readonly behind.
 */
async function textAttributeTests(t) {
    var results = {};

    for (var example of ['basic', 'ckeditor', 'summernote']) {
        var page = await t.page('/example/' + example + '.html');
        await page.waitFor(`jQuery('#myGrid').data('grideditor')`, { label: example });
        await page.eval(`jQuery('#myGrid .ge-content').first().attr('id', 'kept-id'); return true;`);
        await page.click('#kept-id');
        await sleep(1800);

        results[example] = await page.eval(`
            const area = jQuery('#kept-id');
            const open = area.hasClass('ge-rte-active');
            const html = function() {
                const root = document.createElement('div');
                root.innerHTML = jQuery('#myGrid').gridEditor('getHtml');
                const first = root.querySelector('.ge-content');
                return Array.from(first.attributes).map(function(a) { return a.name + '=' + a.value; }).join(' | ');
            };
            const untouched = html();

            jQuery('#kept-id').trigger('click');
            return new Promise(function(resolve) {
                setTimeout(function() {
                    const reopened = jQuery('#kept-id');
                    reopened.parent().find('> .ge-tools-drawer .ge-details .ge-id').val('given-id').trigger('change');
                    jQuery('#given-id').addClass('host-class').attr('data-plugin', 'saved');
                    resolve({ open: open, reopened: jQuery('#given-id').hasClass('ge-rte-active'), untouched: untouched, changed: html() });
                }, 1800);
            });
        `);
        results[example].errors = page.errors([/version is not secure/]);
    }

    ['basic', 'ckeditor', 'summernote'].forEach(function(name) {
        var r = results[name];
        var type = name === 'basic' ? 'tinymce' : name;
        t.check('example/' + name + ': the content area keeps its id through an edit, and nothing of the editor\'s',
            r.open && r.untouched === 'class=ge-content ge-content-type-' + type + ' | data-ge-content-type=' + type + ' | id=kept-id' &&
            r.errors.length === 0,
            r);
        t.check('example/' + name + ': an id, a class and an attribute given while the editor is open are kept',
            r.reopened && r.changed === 'class=ge-content ge-content-type-' + type + ' host-class | data-ge-content-type=' + type +
                ' | id=given-id | data-plugin=saved',
            r);
    });
}

module.exports = {
    name: 'rte',
    description: 'rich text editor integrations',
    requiresNetwork: true,
    run: async function(t) {
        await tinymceTests(t);
        await elementTests(t);
        await utilityTests(t);
        await containerTests(t);
        await attributePluginTests(t);
        await textAttributeTests(t);
        await otherEditorTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['rte']);
}
