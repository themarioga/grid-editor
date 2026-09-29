/**
 * Browser tests for 7.3's deprecated utility plugins: spacing, textalign,
 * visibility and float, loaded on their own, without the style plugin that
 * carries them now. They do what they did in 7.2 - their fields in the
 * Responsive section, their options under utilities - and each says once
 * per editor that it is deprecated. Loaded beside the style plugin, they
 * stand down.
 *
 * What the fields do is test/spacing.js, textalign.js, visibility.js and
 * float.js, on the style plugin: the code is the same.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/legacy-utilities.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.start = function(plugins, settings) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        window.warnings = [];
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-6">' +
            '<div class="ge-content"><p>a</p><div data-ge-element="box">box</div></div></div></div>';
        window.fixture.init(Object.assign({ plugins: plugins ? window.fixture.plugins(plugins) : null }, settings || {}));
    };
    window.responsive = function(node) {
        return Array.from(node.querySelectorAll(':scope > .ge-tools-drawer > .ge-details > .ge-utilities .ge-utility')).map(function(field) {
            return field.getAttribute('data-ge-family');
        }).join(',');
    };
    window.deprecated = function(name) {
        return window.warnings.filter(function(w) {
            return w.indexOf('the "' + name + '" plugin is deprecated and will be removed in 8.0: load grideditor.style.js') !== -1;
        }).length;
    };
    return true;
`;

async function onTheirOwn(t, page) {
    var alone = await page.eval(`
        start(['spacing', 'textalign', 'visibility', 'float'], { utilities: { spacing: { values: ['0', '2'] } } });
        const col = document.querySelector('#myGrid .column');
        const element = document.querySelector('#myGrid .ge-element');
        const values = Array.from(col.querySelector('.ge-spacing-group[data-ge-spacing="p"] .ge-utility select').options)
            .map(function(option) { return option.value; }).filter(Boolean).join(',');
        const found = {
            column: responsive(col),
            element: responsive(element),
            accordion: !!document.querySelector('#myGrid .ge-style'),
            eye: !!col.querySelector(':scope > .ge-tools-drawer > .ge-visibility-tool'),
            values: values,
            warnings: ['spacing', 'textalign', 'visibility', 'float'].map(deprecated).join(','),
            optionWarning: window.warnings.some(function(w) { return /utilities\\.spacing is deprecated/.test(w); }),
        };
        window.fixture.editor().setLocale('en');
        found.again = ['spacing', 'textalign', 'visibility', 'float'].map(deprecated).join(',');
        return found;
    `);
    t.check('on their own they put their fields in Responsive, as in 7.2, with no accordion (AC-63)',
        alone.column === 'col,visibility,text-align,p,m' && alone.element === 'visibility,text-align,float,p,m' && !alone.accordion && alone.eye, alone);
    t.check('and read their options from utilities, as in 7.2', alone.values === '0,2' && !alone.optionWarning, alone);
    t.check('each says once per editor that it is deprecated', alone.warnings === '1,1,1,1' && alone.again === '1,1,1,1', alone);
}

async function besideStyle(t, page) {
    var beside = await page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/plugins/grideditor.style.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('could not load the style plugin'));
            document.head.appendChild(script);
        });
        start(null);
        const col = document.querySelector('#myGrid .column');
        return {
            accordion: !!col.querySelector(':scope > .ge-tools-drawer .ge-style'),
            responsive: responsive(col),
            ignored: ['spacing', 'textalign', 'visibility', 'float'].filter(function(name) {
                return window.warnings.some(function(w) { return w.indexOf('the "' + name + '" plugin is part of "style", which is loaded: ignoring it') !== -1; });
            }).join(','),
            deprecated: ['spacing', 'textalign', 'visibility', 'float'].map(deprecated).join(','),
            duplicate: window.warnings.some(function(w) { return /already declared/.test(w); }),
        };
    `);
    t.check('loaded beside the style plugin they stand down, each with a warning, and none is declared twice (AC-64)',
        beside.accordion && beside.responsive === 'col' && beside.ignored === 'spacing,textalign,visibility,float' &&
        beside.deprecated === '0,0,0,0' && !beside.duplicate, beside);

    var named = await page.eval(`
        start(['spacing']);
        const col = document.querySelector('#myGrid .column');
        return {
            accordion: !!col.querySelector(':scope > .ge-tools-drawer .ge-style'),
            renamed: window.warnings.some(function(w) { return /the "spacing" plugin is part of "style" now/.test(w); }),
        };
    `);
    t.check('with the style plugin loaded, the old name in the plugins setting asks for it (AC-65)',
        named.accordion && named.renamed, named);
}

module.exports = {
    name: 'legacyutilities',
    description: 'the deprecated spacing, textalign, visibility and float plugins on their own',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await onTheirOwn(t, page);
        await besideStyle(t, page);

        var errors = page.errors();
        t.check('the legacy utility tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
