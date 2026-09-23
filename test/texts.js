/**
 * Browser tests for the text editor plugins' contract: $.fn.gridEditor.texts,
 * the copies the main bundle carries until 6.0, and the adapter for 5.x's
 * $.fn.gridEditor.RTEs.
 *
 * These run offline, on the fixture, with a stand-in for tinyMCE that has
 * only what the integration touches: the real editors are rte.js's business.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Warnings and errors, collected, and a tinyMCE that opens at once: init
 * hands its callback an editor with the methods the integration calls.
 */
var SETUP = `
    window.warnings = [];
    window.errorsLogged = [];
    const warn = console.warn, error = console.error;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    console.error = function() { window.errorsLogged.push(Array.prototype.join.call(arguments, ' ')); error.apply(console, arguments); };

    window.fakeTinymce = {
        started: 0,
        init: function(config) {
            window.fakeTinymce.started++;
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                remove: function() { editor.removed = true; } };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    // From markup with no content areas yet, so each start wraps its own,
    // of the content type it is started with: a content area keeps its type
    window.restart = function(overrides) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(
            '<div class="row"><div class="col-lg-6"><p>Left</p></div><div class="col-lg-6"><p>Right</p></div></div>'
        );
        window.fixture.init(Object.assign({ content_types: ['tinymce'] }, overrides || {}));
    };
    return true;
`;

var BUNDLED = `return window.warnings.filter(function(w) { return /copy in the main bundle/.test(w); }).length;`;

async function bundleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var copy = await page.eval(`
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        jQuery('#myGrid .ge-content').eq(1).trigger('click');
        return {
            marked: !!$.fn.gridEditor.texts.tinymce.bundled,
            started: window.fakeTinymce.started,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the main bundle carries tinyMCE, marked as its copy, and it still edits',
        copy.marked && copy.started === 2 && copy.attached, copy);
    t.check('editing with the bundle\'s copy warns once that 6.0 leaves it out',
        copy.warned === 1, copy);

    await page.eval(`
        const script = document.createElement('script');
        script.src = '/dist/plugins/grideditor.tinymce.js';
        script.onload = function() { window.pluginLoaded = true; };
        document.head.appendChild(script);
        return true;
    `);
    await page.waitFor(`window.pluginLoaded`, { label: 'the tinyMCE plugin file' });

    var plugin = await page.eval(`
        window.warnings = [];
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        return {
            marked: !!$.fn.gridEditor.texts.tinymce.bundled,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the plugin\'s own file replaces the copy, and edits without a warning',
        !plugin.marked && plugin.attached && plugin.warned === 0, plugin);

    var filtered = await page.eval(`
        restart({ plugins: ['tabs'] });
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        return { attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce') };
    `);
    t.check('the plugins setting does not turn a text editor off: content_types chooses it',
        filtered.attached, filtered);

    var missing = await page.eval(`
        restart();
        window.tinymce = undefined;
        const area = jQuery('#myGrid .ge-content').eq(0);
        area.trigger('click');
        const without = {
            active: area.hasClass('ge-rte-active'),
            error: window.errorsLogged.some(function(e) { return /tinyMCE not available/.test(e); }),
        };
        window.tinymce = window.fakeTinymce;
        area.trigger('click');
        return { without: without, laterAttached: !!area.data('ge-tinymce') };
    `);
    t.check('with no tinyMCE, a click says so and starts nothing; a later click, once it is there, does',
        !missing.without.active && missing.without.error && missing.laterAttached, missing);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return { clean: !/ge-rte-active|contenteditable|class="active/.test(html), detached: !jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce') };
    `);
    t.check('getHtml stops the editor and leaves the content area clean', exported.clean && exported.detached, exported);

    var errors = page.errors([/tinyMCE not available/]);
    t.check('the bundle tests logged no other errors', errors.length === 0, errors.slice(0, 5));
}

async function contractTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var own = await page.eval(`
        window.calls = [];
        $.fn.gridEditor.texts.plain = function(ge) {
            return {
                initialContent: '<p>Write here</p>',
                start: function(block) {
                    window.calls.push('start');
                    block.addClass('active');
                    // An editor rewrites what it takes over, drawers and all
                    block.find('.ge-tools-drawer').remove();
                    ge.textReady(block);
                },
                stop: function(block) {
                    if (block.hasClass('active')) { window.calls.push('stop'); }
                    block.removeClass('active');
                },
            };
        };
        restart({ content_types: ['plain'] });

        const area = jQuery('#myGrid .ge-content').eq(0);
        const ge = jQuery('#myGrid').data('grideditor');
        ge.createElement('<p>An element</p>', { appendTo: area });
        area.trigger('click');
        const drawerBack = area.find('.ge-element > .ge-tools-drawer').length;

        const column = ge.createColumn(6, { appendTo: jQuery('#myGrid .row').first() });
        const fresh = column.children('.ge-content').html();

        jQuery('#myGrid').gridEditor('getHtml');
        return { calls: window.calls.slice(), drawerBack: drawerBack, fresh: fresh, warnings: window.warnings.slice() };
    `);
    t.check('a text editor registered under texts is started on a click and stopped on deinit',
        own.calls.join(',') === 'start,stop', own);
    t.check('ge.textReady puts the elements\' drawers back after the editor rewrote the content area',
        own.drawerBack === 1, own);
    t.check('a new column starts with the text editor\'s initial content',
        own.fresh === '<p>Write here</p>', own);
    t.check('a text editor under texts is not deprecated',
        !own.warnings.some(function(w) { return /deprecated/.test(w); }), own.warnings);

    var legacy = await page.eval(`
        window.warnings = [];
        window.legacyCalls = [];
        $.fn.gridEditor.RTEs.legacy = {
            init: function(settings, areas) {
                window.legacyCalls.push('init:' + areas.length + ':' + (settings.content_types[0]));
                areas.addClass('active');
            },
            deinit: function(settings, areas) {
                if (areas.filter('.active').length) { window.legacyCalls.push('deinit'); }
                areas.removeClass('active');
            },
            initialContent: '<p>Legacy</p>',
        };
        restart({ content_types: ['legacy'] });
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        jQuery('#myGrid').gridEditor('getHtml');
        restart({ content_types: ['legacy'] });
        return {
            calls: window.legacyCalls.slice(),
            deprecations: window.warnings.filter(function(w) { return /RTEs is deprecated/.test(w); }).length,
            fresh: jQuery('#myGrid').data('grideditor').createColumn(6).children('.ge-content').html(),
        };
    `);
    t.check('an integration written to 5.x\'s RTEs contract still edits, with settings and the content area',
        legacy.calls.join(',') === 'init:1:legacy,deinit' && legacy.fresh === '<p>Legacy</p>', legacy);
    t.check('and warns, once per editor, that RTEs is deprecated',
        legacy.deprecations === 2, legacy);

    var shadowed = await page.eval(`
        window.warnings = [];
        $.fn.gridEditor.RTEs.tinymce = { init: function() { window.oldOneUsed = true; }, deinit: function() {}, initialContent: '' };
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        delete $.fn.gridEditor.RTEs.tinymce;
        return {
            oldOneUsed: !!window.oldOneUsed,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            deprecations: window.warnings.filter(function(w) { return /register "tinymce"/.test(w); }).length,
        };
    `);
    t.check('an RTEs entry a text plugin already provides is left unused, without a warning',
        !shadowed.oldOneUsed && shadowed.attached && shadowed.deprecations === 0, shadowed);

    var errors = page.errors();
    t.check('the contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'texts',
    description: 'the text editor plugins\' contract, the bundle\'s copies and the RTEs adapter',
    run: async function(t) {
        await bundleTests(t);
        await contractTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['texts']);
}
