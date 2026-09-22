/**
 * Tests for the locale plumbing and the shipped locales.
 *
 * Half of this suite is source checking rather than browser driving: the key
 * catalogue in `docs/locale-keys.md` is hand-written, so something has to hold
 * it to the code, and the Spanish locale ships, so something has to hold it to
 * the English one. The rest drives the fixture, because what matters is that
 * the strings reach the DOM.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var fs = require('fs');
var path = require('path');
var cdp = require('./cdp');

var ROOT = path.join(__dirname, '..');
var SOURCE = path.join(ROOT, 'src', 'js');
var CATALOGUE = path.join(ROOT, 'docs', 'locale-keys.md');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Every locale key the source actually asks for: the literal keys in `t()`
 * calls, and the keys named by a `...Key` property or constant, which is how
 * the breakpoint table names the label of each view.
 */
function keysUsedInSource() {
    var patterns = [
        /\bt\(\s*(?:settings,\s*)?'([^']+)'/g,
        /\w+(?:Key|KEY)\s*[:=]\s*'([^']+)'/g,
    ];
    var keys = {};

    sourceFiles(SOURCE).forEach(function(file) {
        var text = fs.readFileSync(file, 'utf8');

        patterns.forEach(function(pattern) {
            var match;
            pattern.lastIndex = 0;
            while ((match = pattern.exec(text)) !== null) {
                keys[match[1]] = file;
            }
        });
    });

    return Object.keys(keys).sort();
}

/** Every javascript file under src, plugins and locales included. */
function sourceFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).reduce(function(found, entry) {
        var full = path.join(directory, entry.name);

        return found.concat(entry.isDirectory() ? sourceFiles(full) : (/\.js$/.test(entry.name) ? [full] : []));
    }, []);
}

/** The keys docs/locale-keys.md documents, read out of its tables. */
function keysInCatalogue() {
    var text = fs.readFileSync(CATALOGUE, 'utf8');
    var pattern = /^\| `([a-z][\w.]*)` \|/gm;
    var keys = [];
    var match;

    while ((match = pattern.exec(text)) !== null) {
        keys.push(match[1]);
    }

    return keys.sort();
}

function missingFrom(theseKeys, thoseKeys) {
    return theseKeys.filter(function(key) { return thoseKeys.indexOf(key) === -1; });
}

/** Load a built locale file into the page, the way a host would. */
function loadLocale(page, code) {
    return page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.` + code + `.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('could not load the ` + code + ` locale'));
            document.head.appendChild(script);
        });
        return Object.keys(jQuery.fn.gridEditor.locales);
    `);
}

/**
 * The strings the UI is actually showing: every tooltip, placeholder and
 * dropdown label in the controls and the drawers.
 */
var RENDERED_STRINGS = `
    const strings = [];
    const add = function(where, value) {
        if (value !== undefined && value !== null && value !== '') { strings.push({ where: where, value: value }); }
    };

    jQuery('.ge-mainControls [title], #myGrid [title]').each(function() {
        add(this.className || this.tagName.toLowerCase(), jQuery(this).attr('title'));
    });
    jQuery('.ge-mainControls [placeholder], #myGrid [placeholder]').each(function() {
        add('placeholder', jQuery(this).attr('placeholder'));
    });
    jQuery('.ge-layout-mode button, .ge-layout-mode a').each(function() {
        add('layout-mode', jQuery(this).text());
    });
    return strings;
`;

/**
 * The catalogue, the source and the shipped locales have to agree, and nothing
 * checks that at runtime, so it is checked here.
 */
async function catalogueTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await loadLocale(page, 'es');

    var catalogues = await page.eval(`
        const locales = jQuery.fn.gridEditor.locales;
        return {
            en: Object.keys(locales.en).sort(),
            es: Object.keys(locales.es).sort(),
            registered: Object.keys(locales).sort(),
        };
    `);

    var used = keysUsedInSource();
    var documented = keysInCatalogue();

    t.check('every key the source asks for is in locales.en',
        missingFrom(used, catalogues.en).length === 0,
        { missing: missingFrom(used, catalogues.en) });
    t.check('locales.en has no key the source never asks for',
        missingFrom(catalogues.en, used).length === 0,
        { unused: missingFrom(catalogues.en, used) });
    t.check('docs/locale-keys.md documents exactly the keys in locales.en',
        missingFrom(catalogues.en, documented).length === 0 &&
        missingFrom(documented, catalogues.en).length === 0,
        { undocumented: missingFrom(catalogues.en, documented), stale: missingFrom(documented, catalogues.en) });
    t.check('the shipped Spanish locale translates every key in locales.en',
        missingFrom(catalogues.en, catalogues.es).length === 0,
        { missing: missingFrom(catalogues.en, catalogues.es) });
    t.check('the Spanish locale has no key English does not have',
        missingFrom(catalogues.es, catalogues.en).length === 0,
        { extra: missingFrom(catalogues.es, catalogues.en) });
    t.check('loading a locale file registers it and leaves English in place',
        catalogues.registered.join(',') === 'en,es', catalogues.registered);

    var errors = page.errors();
    t.check('the catalogue tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * The lookup order, and what a missing key does.
 */
async function lookupTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await loadLocale(page, 'es');
    await page.eval(`
        window.warnings = [];
        const original = console.warn;
        console.warn = function() {
            window.warnings.push(Array.prototype.join.call(arguments, ' '));
            original.apply(console, arguments);
        };
        return true;
    `);

    var stub = await page.eval(`
        jQuery.fn.gridEditor.locales.stub = { 'tool.move': 'STUB MOVE' };
        window.fixture.init({ locale: 'stub' });
        return {
            move: jQuery('#myGrid .ge-move').first().attr('title'),
            fallenBack: jQuery('#myGrid .ge-settings').first().attr('title'),
            addRow: jQuery('.ge-addRowGroup a').first().attr('title'),
        };
    `);
    t.check('a locale swaps the keys it has and falls back to English for the rest',
        stub.move === 'STUB MOVE' && stub.fallenBack === 'Settings' && stub.addRow === 'Add row 12',
        stub);

    var overrides = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        window.fixture.init({
            locale: 'es',
            locale_strings: { 'tool.move': 'Arrastrar' },
        });
        return {
            overridden: jQuery('#myGrid .ge-move').first().attr('title'),
            fromLocale: jQuery('#myGrid .ge-settings').first().attr('title'),
        };
    `);
    t.check('locale_strings wins over the locale file, which wins over English',
        overrides.overridden === 'Arrastrar' && overrides.fromLocale === 'Configuración', overrides);

    var missing = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        const english = jQuery.fn.gridEditor.locales.en;
        const kept = english['tool.move'];
        delete english['tool.move'];

        window.fixture.init({ locale: 'es', locale_strings: {} });
        const shown = jQuery('#myGrid .ge-move').first().attr('title');

        jQuery('#myGrid').gridEditor('destroy');
        window.fixture.init({ locale: 'en' });
        const shownAgain = jQuery('#myGrid .ge-move').first().attr('title');

        english['tool.move'] = kept;
        return {
            shown: shown,
            shownAgain: shownAgain,
            warnings: window.warnings.filter(w => /tool\\.move/.test(w)),
        };
    `);
    t.check('a key no locale defines shows the key itself and warns once',
        missing.shown === 'Mover' && missing.shownAgain === 'tool.move' &&
        missing.warnings.length === 1,
        missing);

    var interpolation = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        window.fixture.init({ locale: 'es', new_row_layouts: [[12], [6, 6], [9, 3]] });
        return {
            titles: jQuery('.ge-addRowGroup a').map(function() { return jQuery(this).attr('title'); }).get(),
            unfilled: jQuery('.ge-addRowGroup a').filter(function() { return /\\{/.test(jQuery(this).attr('title')); }).length,
        };
    `);
    t.check('{name} placeholders are filled from the parameters',
        interpolation.titles.join('|') === 'Añadir fila 12|Añadir fila 6-6|Añadir fila 9-3' &&
        interpolation.unfilled === 0,
        interpolation);

    var errors = page.errors();
    t.check('the lookup tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * setLocale, and the acceptance question for the phase: is there any English
 * left in the UI when the editor runs in Spanish?
 */
async function spanishTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await loadLocale(page, 'es');

    var switched = await page.eval(`
        window.fixture.init({ locale: 'en' });
        const english = {
            move: jQuery('#myGrid .ge-move').first().attr('title'),
            view: jQuery('.ge-layout-mode button').text(),
            addRow: jQuery('.ge-addRowGroup a').first().attr('title'),
            source: jQuery('.gm-edit-mode').attr('title'),
            placeholder: jQuery('#myGrid .ge-id').first().attr('placeholder'),
        };

        jQuery('#myGrid').gridEditor('setLocale', 'es');
        const spanish = {
            move: jQuery('#myGrid .ge-move').first().attr('title'),
            view: jQuery('.ge-layout-mode button').text(),
            addRow: jQuery('.ge-addRowGroup a').first().attr('title'),
            source: jQuery('.gm-edit-mode').attr('title'),
            placeholder: jQuery('#myGrid .ge-id').first().attr('placeholder'),
        };

        jQuery('#myGrid').gridEditor('setLocale', 'en');
        return {
            english: english,
            spanish: spanish,
            back: jQuery('#myGrid .ge-move').first().attr('title'),
            controls: jQuery('.ge-mainControls').length,
            view: jQuery('#myGrid').gridEditor('getView'),
            english_view: english.view,
            editing: jQuery('#myGrid').hasClass('ge-editing'),
            settings: jQuery('#myGrid').data('grideditor').settings.locale,
        };
    `);
    t.check('setLocale re-renders the toolbar and the drawers, both ways',
        switched.english.move === 'Move' && switched.spanish.move === 'Mover' &&
        switched.spanish.view === 'Todos los tamaños' && switched.spanish.addRow === 'Añadir fila 12' &&
        switched.spanish.source === 'Editar el código fuente' &&
        switched.back === 'Move' && switched.controls === 1 &&
        switched.english_view === 'All sizes' && switched.view === 'all' && switched.editing,
        switched);
    t.check('setLocale leaves one set of controls and reports the locale it switched to',
        switched.controls === 1 && switched.settings === 'en', switched);

    // The acceptance question: with the editor in Spanish, is any string in
    // the UI still showing its English value?
    var leftInEnglish = await page.eval(`
        jQuery('#myGrid').gridEditor('setLocale', 'es');
        jQuery('#myGrid .ge-settings').first().trigger('click'); // open a settings panel

        const locales = jQuery.fn.gridEditor.locales;
        const englishOnly = {};
        Object.keys(locales.en).forEach(function(key) {
            if (locales.es[key] !== locales.en[key]) { englishOnly[locales.en[key]] = key; }
        });

        const rendered = (function() { ` + RENDERED_STRINGS + ` })();

        return {
            rendered: rendered.length,
            english: rendered.filter(function(string) { return englishOnly[string.value] !== undefined; }),
            sample: rendered.slice(0, 6),
        };
    `);
    t.check('with the editor in Spanish, nothing in the UI is still in English',
        leftInEnglish.rendered > 10 && leftInEnglish.english.length === 0,
        leftInEnglish);

    // Nothing here can judge wording, but it can say whether a string fits.
    // The dropdown has to be open for its items to have a width at all.
    await page.click('.ge-layout-mode .dropdown-toggle');
    var fits = await page.eval(`
        const overflowing = [];
        jQuery('.ge-mainControls button, .ge-layout-mode a, .ge-addRowGroup a').each(function() {
            if (this.scrollWidth > this.clientWidth + 1) {
                overflowing.push({ text: jQuery(this).text().trim(), scroll: this.scrollWidth, client: this.clientWidth });
            }
        });
        const menuOpen = jQuery('.ge-layout-mode .dropdown-menu').is(':visible');
        const itemWidths = jQuery('.ge-layout-mode a').map(function() { return this.clientWidth; }).get();

        // The open menu hangs outside the toolbar by design, so close it
        // before asking whether the toolbar itself fits
        jQuery('.ge-layout-mode .dropdown-toggle').trigger('click');
        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            overflowing: overflowing,
            menuOpen: menuOpen,
            itemWidths: itemWidths,
            toolbarFits: jQuery('.ge-wrapper')[0].scrollWidth <= jQuery('.ge-wrapper')[0].clientWidth + 1,
        };
    `);
    t.check('the Spanish strings fit the controls they are rendered in',
        fits.overflowing.length === 0 && fits.toolbarFits && fits.menuOpen &&
        fits.itemWidths.every(function(width) { return width > 0; }),
        fits);

    await page.screenshot(path.join(t.screenshots, 'locale-es.png'));

    var errors = page.errors();
    t.check('the Spanish tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'locales',
    description: 'the locale plumbing and the shipped locales',
    run: async function(t) {
        await catalogueTests(t);
        await lookupTests(t);
        await spanishTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['locales']);
}
