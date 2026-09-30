/**
 * Browser tests for the inline-style plugin: the Style accordion in a node's
 * settings panel, its inline fields writing the node's own style, the
 * catalog of Bootstrap classes, free css, and the inline_style setting.
 *
 * What the merged utilities do in its sections - spacing, text alignment,
 * display, flex, sticky, float and the drawer - is test/spacing.js,
 * textalign.js, display.js, flex.js, sticky.js, float.js and drawerflow.js.
 * Where the accordion opens for each settings_panel, and the
 * dialog, are test/panelsection.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };

    window.start = function(html, settings) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        window.warnings = [];
        document.querySelector('#myGrid').innerHTML = html || (
            '<div class="row"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>'
        );
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['inline-style', 'sections']) }, settings || {}));
    };

    /** A node's accordion, in its drawer's panel: the fixture's panel is offcanvas, and closed. */
    window.acc = function(node) {
        const drawer = node.classList.contains('ge-content')
            ? node.parentElement.querySelector(':scope > .ge-tools-drawer')
            : node.querySelector(':scope > .ge-tools-drawer');
        return drawer ? drawer.querySelector(':scope > .ge-details .ge-inline-style') : null;
    };
    window.sections = function(node) {
        const accordion = acc(node);
        return accordion ? Array.from(accordion.querySelectorAll(':scope > .accordion-item')).map(function(item) {
            return item.getAttribute('data-ge-inline-style-section');
        }).join(',') : null;
    };
    window.section = function(node, key) { return acc(node).querySelector('[data-ge-inline-style-section="' + key + '"]'); };
    window.opened = function(node) {
        return Array.from(acc(node).querySelectorAll('.accordion-collapse.show')).map(function(collapse) {
            return collapse.parentElement.getAttribute('data-ge-inline-style-section');
        }).join(',');
    };
    window.openSection = function(node, key) { section(node, key).querySelector('.accordion-button').click(); };
    window.field = function(node, property) { return acc(node).querySelector('[data-ge-inline-style-property="' + property + '"]'); };
    /** A field's value input: the text of a color, the select of a list, the input of the rest. */
    window.input = function(node, property) { return field(node, property).querySelector('input[type="text"], select'); };
    window.fields = function(node, key) {
        return Array.from(section(node, key).querySelectorAll('.ge-inline-style-field')).map(function(each) {
            return each.getAttribute('data-ge-inline-style-property');
        }).join(',');
    };
    window.chip = function(node, name) { return acc(node).querySelector('.ge-inline-style-chip[data-ge-class="' + name + '"]'); };
    window.chips = function(node, key) {
        return section(node, key).querySelectorAll('.ge-inline-style-chip').length;
    };
    window.active = function(node) {
        return Array.from(acc(node).querySelectorAll('.ge-inline-style-chip.active')).map(function(each) {
            return each.getAttribute('data-ge-class');
        }).join(',');
    };
    window.note = function(node, property) {
        const small = field(node, property).querySelector('.ge-inline-style-overridden');
        return getComputedStyle(small).display === 'none' ? '' : small.textContent;
    };
    window.type = function(element, value) {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    window.classesField = function(node) {
        return node.querySelector(':scope > .ge-tools-drawer > .ge-details .ge-classes');
    };
    window.hostClasses = function(node) { return classesField(node).value; };
    return true;
`;

async function structure(t, page) {
    var built = await page.eval(`
        start('<div class="row"><div class="column col-6"><div class="ge-content"><p>a</p></div>' +
            '<div data-ge-element="box">box</div></div>' +
            '<div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>b</p></div>' +
            '<div data-ge-container="tabs"><ul class="nav nav-tabs"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="column col-12"><div class="ge-content"><p>in</p></div></div></div></div></div></div>' +
            '</div></div>');
        ge().createSection({ appendTo: '#myGrid' });
        const details = row().querySelector(':scope > .ge-tools-drawer > .ge-details');
        const text = document.querySelectorAll('#myGrid .ge-content')[1];
        const all = 'size,spacing,border,background,text,typography,display,flex,position,custom';
        return {
            order: Array.from(details.children).map(function(child) { return child.className.split(' ')[0]; }).join(','),
            row: sections(row()),
            closed: opened(row()),
            column: sections(col()),
            element: sections(document.querySelector('#myGrid .ge-element')),
            container: sections(document.querySelector('#myGrid [data-ge-container="tabs"]')),
            pane: sections(document.querySelector('#myGrid .ge-tab')),
            section: sections(document.querySelector('#myGrid .ge-section')),
            text: sections(text),
            textFields: acc(text).querySelectorAll('.ge-inline-style-field, .ge-inline-style-chip').length,
            textParts: Array.from(acc(text).querySelectorAll('.ge-utility')).map(function(each) { return each.getAttribute('data-ge-family'); }).join(','),
            all: all,
        };
    `);
    t.check('the panel has the general fields, then the Style accordion, then Responsive, all sections closed (AC-01)',
        built.order === 'ge-section-title,ge-details-general,ge-panel-section,ge-utilities' && built.row === built.all && built.closed === '', built);
    t.check('rows, columns, elements, containers, panes and sections all get the accordion (AC-09)',
        [built.column, built.element, built.container, built.pane, built.section].every(function(each) {
            return each === built.all;
        }), built);
    t.check('a text gets Text and Display, with the per breakpoint fields and no inline field or chip (AC-10)',
        built.text === 'text,display' && built.textFields === 0 && built.textParts === 'text-align,display', built);

    var none = await page.eval(`
        start('<div class="row"><div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>b</p></div></div></div>',
            { inline_style: { sections: { text: false, display: false } } });
        const text = document.querySelector('#myGrid .ge-content');
        const drawer = text.parentElement.querySelector(':scope > .ge-tools-drawer');
        return { accordion: !!acc(text), section: !!drawer.querySelector('.ge-panel-section') };
    `);
    t.check('a node none of whose sections is left gets no accordion, and no button (AC-11)',
        !none.accordion && !none.section, none);

    var folding = await page.eval(`
        start('<div class="row"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        openSection(row(), 'border');
        const border = opened(row());
        openSection(row(), 'background');
        const background = opened(row());
        const column = opened(col());
        openSection(row(), 'background');
        return { border: border, background: background, column: column, closed: opened(row()) + '|' + opened(col()) };
    `);
    t.check('opening a section closes the one that was open (AC-07)',
        folding.border === 'border' && folding.background === 'background', folding);
    t.check('the section the user opened is open on the next node\'s panel too (AC-08)',
        folding.column === 'background' && folding.closed === '|', folding);

    var twoEditors = await page.eval(`
        start();
        const other = document.createElement('div');
        other.id = 'otherGrid';
        other.innerHTML = '<div class="row"><div class="column col-6"><div class="ge-content"><p>x</p></div></div></div>';
        document.body.appendChild(other);
        const second = GridEditor.create('#otherGrid', Object.assign({}, window.fixture.settings, { plugins: window.fixture.plugins(['inline-style']) }));
        const otherRow = other.querySelector('.row');
        openSection(row(), 'border');
        openSection(otherRow, 'text');
        const result = { first: opened(row()), second: opened(otherRow) };
        second.destroy();
        other.remove();
        return result;
    `);
    t.check('two editors on one page each keep their own open section (AC-71)',
        twoEditors.first === 'border' && twoEditors.second === 'text', twoEditors);
}

async function inline(t, page) {
    var written = await page.eval(`
        start();
        type(input(row(), 'border-width'), '2px');
        const wrote = row().getAttribute('style');
        const html = ge().getHtml();
        type(input(row(), 'border-width'), '');
        return { wrote: wrote, html: html, cleared: row().hasAttribute('style') };
    `);
    t.check('a value in a field is written to the node\'s style, and saved (AC-12)',
        written.wrote === 'border-width: 2px;' && /style="border-width: 2px;"/.test(written.html), written);
    t.check('emptying the field takes the property off, and the empty style with it (AC-13)', !written.cleared, written);

    var kept = await page.eval(`
        start('<div class="row" style="transform: rotate(1deg); color: red"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        type(input(row(), 'color'), 'blue');
        const other = ge().getHtml();
        start('<div class="row" style="color: red !important"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        type(input(row(), 'color'), 'blue');
        return { other: other, important: row().getAttribute('style') };
    `);
    t.check('what the host wrote and nobody edits is kept (AC-14)',
        /transform: rotate\(1deg\)/.test(kept.other) && /color: blue/.test(kept.other), kept);
    t.check('a property the host made !important stays !important (AC-15)', kept.important === 'color: blue !important;', kept);

    var invalid = await page.eval(`
        start();
        const margin = input(row(), 'margin-top');
        type(margin, 'abc');
        const refused = { invalid: margin.classList.contains('is-invalid'), style: row().hasAttribute('style'), text: margin.value };
        ge().changeView('md');
        const kept = margin.value;
        type(margin, '1rem');
        const fixed = { invalid: margin.classList.contains('is-invalid'), style: row().getAttribute('style') };
        type(input(row(), 'color'), 'red; background: blue');
        const injected = { invalid: input(row(), 'color').classList.contains('is-invalid'), style: row().getAttribute('style') };
        return { refused: refused, kept: kept, fixed: fixed, injected: injected };
    `);
    t.check('a value the browser refuses marks the field, writes nothing and stays in the field (AC-16)',
        invalid.refused.invalid && !invalid.refused.style && invalid.refused.text === 'abc' && invalid.kept === 'abc', invalid);
    t.check('putting it right writes it (AC-17)', !invalid.fixed.invalid && invalid.fixed.style === 'margin-top: 1rem;', invalid);
    t.check('a value that tries to add a declaration is refused (AC-73)',
        invalid.injected.invalid && invalid.injected.style === 'margin-top: 1rem;', invalid);

    var free = await page.eval(`
        start();
        type(input(row(), 'width'), 'calc(100% - 2rem)');
        type(input(row(), 'max-width'), 'var(--x)');
        type(input(row(), 'margin-left'), 'auto');
        type(input(row(), 'padding-top'), '  4px  ');
        type(input(row(), 'padding-bottom'), '3px !important');
        type(input(row(), 'padding-left'), '   ');
        return row().getAttribute('style');
    `);
    t.check('calc(), var() and auto go as they are; a value is trimmed, and !important is its priority (AC-18)',
        /width: calc\(100% - 2rem\)/.test(free) && /max-width: var\(--x\)/.test(free) && /margin-left: auto/.test(free) &&
        /padding-top: 4px/.test(free) && /padding-bottom: 3px !important/.test(free), free);

    var shorthand = await page.eval(`
        start('<div class="row" style="margin: 1px 2px 3px 4px"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        return ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].map(function(p) { return input(row(), p).value; }).join(' ');
    `);
    t.check('a shorthand the host wrote shows side by side (AC-19)', shorthand === '1px 2px 3px 4px', shorthand);
}

async function conflicts(t, page) {
    var notes = await page.eval(`
        start('<div class="row mt-3 rounded-3" style="border-radius: 4px"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        const empty = note(row(), 'margin-top');
        type(input(row(), 'margin-top'), '10px');
        const written = { note: note(row(), 'margin-top'), style: row().getAttribute('style'), classes: row().className };
        const radius = note(row(), 'border-radius');
        type(classesField(row()), 'rounded-3');
        const gone = note(row(), 'margin-top');
        start('<div class="row" style="margin-top: 10px"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        return { empty: empty, written: written, radius: radius, gone: gone, plain: note(row(), 'margin-top') };
    `);
    t.check('a value a Bootstrap class overrules is written, with a note, and the class stays (AC-20)',
        notes.empty === '' && notes.written.note === 'The class mt-3 takes priority over this value' &&
        /margin-top: 10px/.test(notes.written.style) && /\bmt-3\b/.test(notes.written.classes), notes);
    t.check('no class, no note (AC-21)', notes.plain === '', notes);
    t.check('the note goes when the class does (AC-22)', notes.gone === '', notes);
    t.check('a rounded-* class and an inline radius say so too (AC-23)',
        notes.radius === 'The class rounded-3 takes priority over this value', notes);
}

async function catalog(t, page) {
    var chosen = await page.eval(`
        start();
        const events = [];
        ['before-utility', 'after-utility', 'before-add', 'after-add'].forEach(function(name) {
            ge().canvas.addEventListener('grideditor:' + name, function() { events.push(name); });
        });
        chip(row(), 'rounded-3').click();
        const first = { field: hostClasses(row()), node: row().classList.contains('rounded-3'), active: active(row()) };
        chip(row(), 'rounded-pill').click();
        const swapped = { field: hostClasses(row()), active: active(row()) };
        chip(row(), 'rounded-pill').click();
        const off = { field: hostClasses(row()), active: active(row()) };
        chip(row(), 'border').click();
        chip(row(), 'border-3').click();
        chip(row(), 'border-top-0').click();
        const together = hostClasses(row());
        type(input(row(), 'color'), 'red');
        return { first: first, swapped: swapped, off: off, together: together, events: events };
    `);
    t.check('a chip puts its class in the classes field and on the node, and is pressed (AC-24)',
        chosen.first.field === 'rounded-3' && chosen.first.node && chosen.first.active === 'rounded-3', chosen);
    t.check('within a group, choosing one takes the other off (AC-25)',
        chosen.swapped.field === 'rounded-pill' && chosen.swapped.active === 'rounded-pill', chosen);
    t.check('pressing it again takes it off (AC-26)', chosen.off.field === '' && chosen.off.active === '', chosen);
    t.check('chips of different groups live together (AC-27)', chosen.together === 'border border-3 border-top-0', chosen);
    t.check('neither the chips nor an inline field fire the editor\'s events (AC-30)', chosen.events.length === 0, chosen);

    var typed = await page.eval(`
        start();
        type(classesField(row()), 'shadow-lg');
        const pressed = active(row());
        ge().changeView('md');
        chip(row(), 'bg-primary').click();
        return { pressed: pressed, md: hostClasses(row()) };
    `);
    t.check('a class typed in the classes field presses its chip (AC-28)', typed.pressed === 'shadow-lg', typed);
    t.check('in a breakpoint view a chip still writes its class as it is: none is responsive (AC-29)',
        typed.md === 'shadow-lg bg-primary', typed);
}

/** The Bootstrap 5.3 classes of spec style-bootstrap-extras, and the Flex section. */
async function extras(t, page) {
    var groups = await page.eval(`
        start('<div class="row"><div class="column col-6"><div class="ge-content"><p>a</p></div>' +
            '<div data-ge-element="box">box</div></div>' +
            '<div class="column col-6"><div data-ge-container="tabs"><ul class="nav nav-tabs"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="column col-12"><div class="ge-content"><p>in</p></div></div></div></div></div></div>' +
            '</div></div>');
        ge().createSection({ appendTo: '#myGrid' });
        const rows = function(node, key) {
            return Array.from(section(node, key).querySelectorAll('.ge-inline-style-chips')).map(function(line) {
                return Array.from(line.querySelectorAll('.ge-inline-style-chip')).map(function(each) { return each.getAttribute('data-ge-class'); }).join(' ');
            });
        };
        const images = function(node) {
            return node ? Array.from(acc(node).querySelectorAll('.ge-inline-style-chip')).map(function(each) {
                return each.getAttribute('data-ge-class');
            }).filter(function(name) { return /^(img-|object-fit-)/.test(name); }).join(' ') : '';
        };
        const element = document.querySelector('#myGrid .ge-element');
        return {
            background: rows(row(), 'background'),
            text: rows(row(), 'text'),
            border: rows(row(), 'border'),
            element: images(element),
            others: [row(), col(), document.querySelector('#myGrid [data-ge-container]'), document.querySelector('#myGrid .ge-tab'),
                document.querySelector('#myGrid .ge-section')].map(images).join('|'),
            position: rows(row(), 'position'),
        };
    `);
    var colors = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
    var suffixed = function(prefix, suffix) { return colors.map(function(color) { return prefix + color + suffix; }).join(' '); };
    t.check('Background offers the subtle and text-bg colors after today\'s, and the opacities after the gradient (AC-01)',
        groups.background[0].endsWith('bg-transparent ' + suffixed('bg-', '-subtle') + ' ' + suffixed('text-bg-', '')) &&
        groups.background[1] === 'bg-gradient' && groups.background[2] === 'bg-opacity-10 bg-opacity-25 bg-opacity-50 bg-opacity-75 bg-opacity-100',
        groups.background);
    t.check('Text offers the emphasis colors and the text opacities (AC-06)',
        groups.text[0].endsWith('text-black ' + suffixed('text-', '-emphasis') + ' text-body-emphasis') &&
        groups.text[1] === 'text-opacity-25 text-opacity-50 text-opacity-75 text-opacity-100',
        groups.text);
    t.check('Border offers the subtle colors and the border opacities (AC-08)',
        groups.border[2].endsWith('border-white ' + suffixed('border-', '-subtle')) &&
        groups.border[3] === 'border-opacity-10 border-opacity-25 border-opacity-50 border-opacity-75 border-opacity-100',
        groups.border);
    t.check('an element is offered the image classes (AC-09)',
        groups.element === 'img-fluid img-thumbnail object-fit-contain object-fit-cover object-fit-fill object-fit-scale object-fit-none', groups);
    t.check('rows, columns, containers, panes and sections are not (AC-10)', groups.others === '||||', groups);
    t.check('Position offers fixed-top and fixed-bottom', groups.position[groups.position.length - 1] === 'fixed-top fixed-bottom', groups.position);

    var picked = await page.eval(`
        const pick = function(before, names, html) {
            start(html || '<div class="row ' + before + '"><div class="column col-6"><div class="ge-content"><p>a</p></div><div data-ge-element="box">box</div></div></div>');
            const node = html ? document.querySelector('#myGrid .ge-element') : row();
            names.forEach(function(name) { chip(node, name).click(); });
            return hostClasses(node);
        };
        const element = '<div class="row"><div class="column col-6"><div data-ge-element="box">box</div></div></div>';
        return {
            subtle: pick('bg-success', ['bg-primary-subtle']),
            textBg: pick('bg-primary-subtle', ['text-bg-danger']),
            opacity: pick('bg-primary-subtle', ['bg-opacity-50']),
            opacities: pick('bg-opacity-25', ['bg-opacity-75']),
            emphasis: pick('text-danger', ['text-primary-emphasis']),
            images: pick('', ['img-fluid', 'img-thumbnail'], element),
            fit: pick('', ['object-fit-cover', 'object-fit-contain'], element),
            fixed: pick('fixed-top', ['fixed-bottom']),
        };
    `);
    t.check('a subtle background takes the other background color off (AC-02)', picked.subtle === 'bg-primary-subtle', picked);
    t.check('text-bg is a background color too (AC-03)', picked.textBg === 'text-bg-danger', picked);
    t.check('an opacity goes with a color (AC-04)', picked.opacity === 'bg-primary-subtle bg-opacity-50', picked);
    t.check('and one opacity takes the other off (AC-05)', picked.opacities === 'bg-opacity-75', picked);
    t.check('an emphasis color takes the other text color off (AC-07)', picked.emphasis === 'text-primary-emphasis', picked);
    t.check('img-fluid and img-thumbnail go together (AC-11)', picked.images === 'img-fluid img-thumbnail', picked);
    t.check('one object-fit takes the other off (AC-12)', picked.fit === 'object-fit-contain', picked);
    t.check('fixed-bottom takes fixed-top off (AC-48)', picked.fixed === 'fixed-bottom', picked);

    var priority = await page.eval(`
        const noteFor = function(classes, property, value, html) {
            start(html || '<div class="row ' + classes + '"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
            const node = html ? document.querySelector('#myGrid .ge-element') : row();
            type(classesField(node), classes);
            type(input(node, property), value);
            return note(node, property);
        };
        return {
            textBgColor: noteFor('text-bg-primary', 'color', 'red'),
            textBgBackground: noteFor('text-bg-primary', 'background-color', 'red'),
            subtle: noteFor('bg-primary-subtle', 'background-color', 'red'),
            emphasis: noteFor('text-primary-emphasis', 'color', 'red'),
            body: noteFor('text-body-emphasis', 'color', 'red'),
            border: noteFor('border-primary-subtle', 'border-color', 'red'),
            opacity: noteFor('bg-opacity-50', 'background-color', 'red'),
            fluid: noteFor('img-fluid', 'max-width', '10px',
                '<div class="row"><div class="column col-6"><div data-ge-element="box">box</div></div></div>'),
            stack: noteFor('vstack', 'display', 'grid',
                '<div class="row"><div class="column col-6"><div data-ge-element="box">box</div></div></div>'),
            sticky: noteFor('sticky-top', 'position', 'relative'),
            stickyTop: noteFor('sticky-top', 'top', '1px'),
            fixedBottom: noteFor('fixed-bottom', 'bottom', '1px'),
        };
    `);
    var says = function(name) { return 'The class ' + name + ' takes priority over this value'; };
    t.check('text-bg takes priority over color and background color (AC-13)',
        priority.textBgColor === says('text-bg-primary') && priority.textBgBackground === says('text-bg-primary'), priority);
    t.check('subtle and emphasis colors take priority over their property (AC-14)',
        priority.subtle === says('bg-primary-subtle') && priority.emphasis === says('text-primary-emphasis') &&
        priority.body === says('text-body-emphasis') && priority.border === says('border-primary-subtle'), priority);
    t.check('an opacity and img-fluid take no priority (AC-15)', priority.opacity === '' && priority.fluid === '', priority);
    t.check('stacks, sticky and fixed take priority over display, position, top and bottom (AC-45)',
        priority.stack === says('vstack') && priority.sticky === says('sticky-top') &&
        priority.stickyTop === says('sticky-top') && priority.fixedBottom === says('fixed-bottom'), priority);

    var off = await page.eval(`
        start('', { inline_style: { sections: { background: { catalog: false } } } });
        const none = chips(row(), 'background');
        start();
        ge().changeView('md');
        chip(row(), 'bg-primary-subtle').click();
        return { none: none, md: hostClasses(row()) };
    `);
    t.check('catalog false takes the new chips off too (AC-16)', off.none === 0, off);
    t.check('a new chip is no more responsive than the others (AC-17)', off.md === 'bg-primary-subtle', off);

    var flex = await page.eval(`
        start('<div class="row"><div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>a</p></div></div></div>');
        const utilities = function(node) {
            return Array.from(section(node, 'flex').querySelectorAll('.ge-utility')).map(function(each) {
                return each.getAttribute('data-ge-family');
            }).join(',');
        };
        const stacks = function(node) {
            return Array.from(section(node, 'flex').querySelectorAll('.ge-inline-style-chip')).map(function(each) {
                return each.getAttribute('data-ge-class');
            }).join(',');
        };
        const text = document.querySelector('#myGrid .ge-content');
        const result = {
            column: utilities(col()),
            columnStacks: stacks(col()),
            row: utilities(row()),
            rowStacks: stacks(row()),
            text: sections(text),
            textSticky: acc(text).querySelectorAll('.ge-utility[data-ge-family="sticky"]').length,
        };
        chip(col(), 'vstack').click();
        chip(col(), 'hstack').click();
        result.swapped = hostClasses(col());
        start('', { inline_style: { sections: { flex: false } } });
        result.off = sections(col());
        ge().setUtility(col(), 'flex-direction', 'column');
        result.written = col().classList.contains('flex-column');
        return result;
    `);
    t.check('a column\'s Flex section has the eleven fields in order, and the stacks (AC-31)',
        flex.column === 'flex-direction,flex-wrap,justify-content,align-items,align-content,gap,row-gap,column-gap,flex-fill,flex-grow,flex-shrink' &&
        flex.columnStacks === 'vstack,hstack', flex);
    t.check('a row\'s has no gaps, no fill, grow or shrink, and no stacks (AC-32)',
        flex.row === 'flex-direction,flex-wrap,justify-content,align-items,align-content' && flex.rowStacks === '', flex);
    t.check('a text has no Flex section and no sticky field (AC-33)',
        flex.text === 'text,display' && flex.textSticky === 0, flex);
    t.check('hstack takes vstack off (AC-44)', flex.swapped === 'hstack', flex);
    t.check('with the Flex section off, the families still write (AC-43)',
        flex.off.indexOf('flex') === -1 && flex.off.indexOf('display') !== -1 && flex.written, flex);
}

async function views(t, page) {
    var shown = await page.eval(`
        start();
        const visible = function() {
            const small = section(row(), 'border').querySelector('.ge-inline-style-all-sizes');
            return getComputedStyle(small).display !== 'none';
        };
        const all = visible();
        ge().changeView('md');
        return { all: all, md: visible(), text: section(row(), 'border').querySelector('.ge-inline-style-all-sizes').textContent };
    `);
    t.check('a breakpoint view says the inline style applies to every size (AC-31)',
        shown.md && shown.text === 'Applies to every size', shown);
    t.check('the all view does not (AC-32)', !shown.all, shown);
}

async function columns(t, page) {
    var sized = await page.eval(`
        start();
        return {
            column: fields(col(), 'size'),
            columnChips: chips(col(), 'size'),
            catalog: !!section(col(), 'size').querySelector('.ge-inline-style-catalog'),
            position: fields(col(), 'position'),
            positionChips: chips(col(), 'position') > 0,
            row: fields(row(), 'size'),
            rowChips: chips(row(), 'size'),
        };
    `);
    t.check('a column is offered min- and max- sizes only (AC-36)',
        sized.column === 'min-width,min-height,max-width,max-height', sized);
    t.check('and no size catalog at all (AC-74)', sized.columnChips === 0 && !sized.catalog, sized);
    t.check('a column\'s Position has no top, right, bottom or left (AC-37)',
        sized.position === 'position,z-index' && sized.positionChips, sized);
    t.check('a row has the six sizes and their chips (AC-38)',
        sized.row === 'width,height,min-width,min-height,max-width,max-height' && sized.rowChips === 16, sized);
}

async function shadows(t, page) {
    var built = await page.eval(`
        start();
        const shadow = field(row(), 'box-shadow');
        const part = function(name) { return shadow.querySelector('.ge-inline-style-shadow-' + name); };
        part('x').value = '2px';
        part('y').value = '4px';
        type(part('blur'), '6px');
        type(shadow.querySelector('.ge-inline-style-color input[type="text"]'), '#000000');
        const first = row().style.boxShadow;
        const inset = shadow.querySelector('.ge-inline-style-shadow-inset input');
        inset.checked = true;
        inset.dispatchEvent(new Event('change', { bubbles: true }));
        const text = field(row(), 'text-shadow');
        return {
            first: first,
            inset: row().style.boxShadow,
            textParts: !!text.querySelector('.ge-inline-style-shadow-spread') + '|' + !!text.querySelector('.ge-inline-style-shadow-inset'),
            textBlur: !!text.querySelector('.ge-inline-style-shadow-blur'),
        };
    `);
    t.check('the builder writes one shadow (AC-39)', /^(?:2px 4px 6px (?:#000000|rgb\(0, 0, 0\))|rgb\(0, 0, 0\) 2px 4px 6px)$/.test(built.first), built);
    t.check('inset goes first (AC-40)', /inset/.test(built.inset) && /2px 4px 6px/.test(built.inset), built);
    t.check('a text shadow has no spread and no inset (AC-43)', built.textParts === 'false|false' && built.textBlur, built);

    var several = await page.eval(`
        start('<div class="row" style="box-shadow: 1px 1px red, 2px 2px blue"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        const shadow = field(row(), 'box-shadow');
        const text = shadow.querySelector('.ge-inline-style-shadow-text');
        const shown = text ? text.value : null;
        type(text, '');
        return { shown: shown, style: row().hasAttribute('style'), builder: !!field(row(), 'box-shadow').querySelector('.ge-inline-style-shadow-builder') };
    `);
    t.check('several shadows show as text (AC-41)', /1px 1px/.test(several.shown) && /2px 2px/.test(several.shown), several);
    t.check('emptying the text takes the shadow off and brings the builder back (AC-42)',
        !several.style && several.builder, several);

    var back = await page.eval(`
        start('<div class="row" style="box-shadow: 2px 4px 6px red"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        const shadow = function() { return field(row(), 'box-shadow'); };
        const link = function() { return shadow().querySelector('.ge-inline-style-shadow-mode'); };
        link().click();
        const asText = { text: !!shadow().querySelector('.ge-inline-style-shadow-text'), link: link() ? link().textContent : null };
        link().click();
        const builder = shadow().querySelector('.ge-inline-style-shadow-builder');
        const again = { builder: !!builder, x: builder ? shadow().querySelector('.ge-inline-style-shadow-x').value : null, style: row().style.boxShadow };
        start('<div class="row" style="box-shadow: 1px 1px red, 2px 2px blue"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        return { asText: asText, again: again, several: !!link() };
    `);
    t.check('a shadow edited as text by choice can go back to the builder, with its value (AC-75)',
        back.asText.text && back.asText.link === 'Edit with the builder' &&
        back.again.builder && back.again.x === '2px' && /2px 4px 6px/.test(back.again.style), back);
    t.check('several shadows, which the builder cannot hold, offer no way back to it (AC-76)', !back.several, back);
}

async function values(t, page) {
    var picked = await page.eval(`
        start('<div class="row" style="background-color: rgba(0, 0, 0, .5); display: contents; background-image: linear-gradient(red, blue)"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        const bg = field(row(), 'background-color');
        const rgba = input(row(), 'background-color').value;
        const display = { value: input(row(), 'display').value, options: input(row(), 'display').options.length };
        const gradient = input(row(), 'background-image').value;
        const picker = bg.querySelector('input[type="color"]');
        picker.value = '#ff0000';
        picker.dispatchEvent(new Event('input', { bubbles: true }));
        const chosen = { style: row().style.backgroundColor, text: input(row(), 'background-color').value };
        type(input(row(), 'background-image'), 'img/a b.png');
        return { rgba: rgba, display: display, gradient: gradient, chosen: chosen, url: row().style.backgroundImage, shownUrl: input(row(), 'background-image').value };
    `);
    t.check('a color the picker cannot hold shows as text (AC-45)', /^rgba\(0, 0, 0, 0?\.5\)$/.test(picked.rgba), picked);
    t.check('the picker writes the color and the text follows, as the browser writes it (AC-44)',
        picked.chosen.style === 'rgb(255, 0, 0)' && /^(?:#ff0000|rgb\(255, 0, 0\))$/.test(picked.chosen.text), picked);
    t.check('a url is written as url("…") and shown as the url (AC-46)',
        /^url\("img\/a b\.png"\)$/.test(picked.url) && picked.shownUrl === 'img/a b.png', picked);
    t.check('a gradient shows as it is (AC-47)', picked.gradient === 'linear-gradient(red, blue)', picked);
    t.check('a value the list does not have is an extra choice, chosen (AC-48)',
        picked.display.value === 'contents' && picked.display.options === 10, picked);
}

async function custom(t, page) {
    var free = await page.eval(`
        start('<div class="row" style="color: red; transform: rotate(1deg); will-change: auto"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>');
        const area = section(row(), 'custom').querySelector('textarea');
        const shown = area.value;
        type(area, 'transform: none; foo: bar');
        return { shown: shown, style: row().getAttribute('style'), after: area.value };
    `);
    t.check('free css shows what no field stands for (AC-49)',
        /transform: rotate\(1deg\)/.test(free.shown) && /will-change: auto/.test(free.shown) && !/color/.test(free.shown), free);
    t.check('editing it writes those declarations, drops what the browser refuses and keeps the rest (AC-50)',
        /color: red/.test(free.style) && /transform: none/.test(free.style) && !/will-change|foo/.test(free.style) &&
        free.after === 'transform: none;', free);

    var narrowed = await page.eval(`
        start('<div class="row" style="border-style: solid; top: 0px"><div class="column col-6"><div class="ge-content"><p>a</p></div></div></div>',
            { inline_style: { sections: { border: { properties: ['border-width'] }, position: false } } });
        return { custom: section(row(), 'custom').querySelector('textarea').value, sections: sections(row()) };
    `);
    t.check('what a narrowed section has no field for is in free css (AC-51)', /border-style: solid/.test(narrowed.custom), narrowed);
    t.check('a section turned off is not there, and what it held is in free css (AC-52)',
        !/position/.test(narrowed.sections) && /top: 0px/.test(narrowed.custom), narrowed);
}

async function settings(t, page) {
    var chosen = await page.eval(`
        start('', { inline_style: { sections: { border: { properties: ['border-radius', 'border-width'], catalog: false }, foo: true, text: { properties: ['border-color'] } } } });
        return { border: fields(row(), 'border'), chips: chips(row(), 'border'), warnings: window.warnings.slice() };
    `);
    t.check('a section can be narrowed, in an order of the host\'s, and lose its catalog (AC-53)',
        chosen.border === 'border-radius,border-width' && chosen.chips === 0, chosen);
    t.check('an unknown section, or a property of another section, is a warning and nothing else (AC-54)',
        chosen.warnings.some(function(w) { return /no "foo" section/.test(w); }) &&
        chosen.warnings.some(function(w) { return /"border-color" is not one of its properties/.test(w); }), chosen);

    var options = await page.eval(`
        const values = function() {
            const select = section(row(), 'spacing').querySelector('.ge-spacing-group[data-ge-spacing="p"] .ge-utility select');
            return Array.from(select.options).map(function(option) { return option.value; }).filter(Boolean).join(',');
        };
        start('', { utilities: { spacing: { values: ['0', '2'] } } });
        const old = { values: values(), warnings: window.warnings.slice() };
        start('', { utilities: { visibility: { drawer: false } } });
        const eye = { eye: !!row().querySelector(':scope > .ge-tools-drawer > .ge-visibility-tool'), warnings: window.warnings.slice() };
        start('', { inline_style: { spacing: { values: ['0', '4'] } } });
        return { old: old, eye: eye, style: values() };
    `);
    t.check('utilities.spacing is not read, and nothing is said about it (AC-04)',
        options.old.values === '0,1,2,3,4,5' && options.old.warnings.length === 0, options);
    t.check('nor utilities.visibility: the eye is there (AC-05)', options.eye.eye && options.eye.warnings.length === 0, options);
    t.check('inline_style.spacing is (AC-06)', options.style === '0,4', options);

    var named = await page.eval(`
        start('', { plugins: window.fixture.plugins(['spacing']) });
        return {
            accordion: !!acc(row()),
            warnings: window.warnings.filter(function(w) { return /"spacing" plugin is not loaded/.test(w); }).length,
        };
    `);
    t.check('spacing in the plugins setting is a plugin that is not loaded: the usual warning, and no style (AC-02)',
        !named.accordion && named.warnings === 1, named);
}

async function locale(t, page) {
    var spanish = await page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('could not load the es locale'));
            document.head.appendChild(script);
        });
        start('', { locale: 'es' });
        ge().changeView('md');
        type(classesField(row()), 'mt-3');
        type(input(row(), 'margin-top'), '10px');
        return {
            sections: Array.from(acc(row()).querySelectorAll('.accordion-button')).map(function(button) { return button.textContent; }).join(','),
            note: note(row(), 'margin-top'),
            sizes: section(row(), 'spacing').querySelector('.ge-inline-style-all-sizes').textContent,
            label: field(row(), 'margin-top').querySelector('.ge-inline-style-label').textContent,
        };
    `);
    t.check('the accordion speaks the editor\'s locale (AC-72)',
        spanish.sections === 'Tamaño,Espaciado,Borde,Fondo,Texto,Tipografía,Visualización,Flex,Posición,CSS libre' &&
        spanish.note === 'La clase mt-3 tiene prioridad sobre este valor' &&
        spanish.sizes === 'Se aplica a todos los tamaños' && spanish.label === 'Margen superior', spanish);
}

module.exports = {
    name: 'inlinestyle',
    description: 'the inline-style plugin: inline style, the catalog and free css',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await structure(t, page);
        await inline(t, page);
        await conflicts(t, page);
        await catalog(t, page);
        await extras(t, page);
        await views(t, page);
        await columns(t, page);
        await shadows(t, page);
        await values(t, page);
        await custom(t, page);
        await settings(t, page);
        await locale(t, page);

        // The background image the url test writes is not there to load
        var errors = page.errors([/a%20b\.png/]);
        t.check('the style tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
