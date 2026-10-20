/**
 * Browser tests for the history plugin: the steps it keeps, going back and
 * forward with the keys, the buttons and the methods, and the node selected
 * and the target chosen again afterwards (spec history).
 *
 * The fixture does not load the plugin - every suite's editor would start
 * keeping steps - so this suite loads it itself.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var MARKUP = '<div class="row" id="r1"><div class="col-md-6" id="a"><p>A</p></div><div class="col-md-6" id="b"><p>B</p></div></div>';

var SETUP = `
    for (const name of ['history', 'autosave']) {
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '../../dist/plugins/grideditor.' + name + '.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    await new Promise(function(resolve) {
        const script = document.createElement('script');
        script.src = '../../dist/locales/grideditor.es.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });

    window.MARKUP = ${JSON.stringify(MARKUP)};
    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };

    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.events = [];
    ['after-undo', 'after-redo', 'history-change'].forEach(function(name) {
        q('#myGrid').addEventListener('grideditor:' + name, function(e) {
            window.events.push({ name: name, source: e.detail.source, html: e.detail.html,
                canUndo: e.detail.canUndo, canRedo: e.detail.canRedo });
        });
    });

    /** A fresh editor with the plugin, on markup, with a short delay unless told; used, so the keys go to it. */
    window.start = async function(history, overrides, markup) {
        const running = window.fixture.editor();
        if (running) { running.destroy(); }
        localStorage.clear();
        window.events.length = 0;
        window.warnings.length = 0;
        q('#myGrid').innerHTML = markup === undefined ? window.MARKUP : markup;
        window.ge = window.fixture.init(Object.assign({
            plugins: window.fixture.plugins(['history']),
            confirm_delete: false,
            history: Object.assign({ delay: 50 }, history || {}),
        }, overrides || {}));
        await wait(20);
        use(q('#myGrid'));
        return window.ge;
    };
    /** A pointer pressing on a node: what says which editor is used. */
    window.use = function(node) {
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    };
    /** A key with Ctrl, sent where the focus is. True when the editor took it. */
    window.press = function(letter, extra) {
        const e = new KeyboardEvent('keydown', Object.assign({
            key: letter, code: 'Key' + letter.toUpperCase(), ctrlKey: true, bubbles: true, cancelable: true,
        }, extra || {}));
        (document.activeElement || document.body).dispatchEvent(e);
        return e.defaultPrevented;
    };
    /** A change, as a step once the delay is over. */
    window.change = async function(id) {
        ge.createRow([12], { appendTo: q('#myGrid') }).id = id || 'added';
        await wait(120);
    };
    window.html = function() { return ge.getHtml(); };
    window.button = function(which) { return q('.ge-history-' + which); };
    window.off = function(which) {
        const b = button(which);
        return !!b && b.classList.contains('disabled') && b.getAttribute('aria-disabled') === 'true';
    };
    window.named = function(name) { return window.events.filter(function(e) { return e.name === name; }); };
    window.undoAll = function() {
        let done = 0;
        while (ge.undo()) { done++; }
        return done;
    };
    return true;
`;

async function keyTests(t, page) {
    // AC-01, AC-02, AC-03, AC-04
    var keys = await page.eval(`
        await start();
        const base = html();
        await change('gone');
        const changed = html();
        const z = press('z');
        const undone = html() === base;
        const y = press('y');
        const redone = html() === changed;
        press('z');
        const shiftZ = press('z', { shiftKey: true });
        const redoneShift = html() === changed;
        const meta = press('z', { ctrlKey: false, metaKey: true });
        return { z: z, undone: undone, y: y, redone: redone, shiftZ: shiftZ, redoneShift: redoneShift,
            meta: meta, metaUndone: html() === base, undoSources: named('after-undo').map(function(e) { return e.source; }),
            redos: named('after-redo').length };
    `);
    t.check('Ctrl+Z goes back a step, prevented, after-undo with source shortcut (AC-01)',
        keys.z && keys.undone && keys.undoSources[0] === 'shortcut', keys);
    t.check('Ctrl+Y comes forward again, with after-redo (AC-02)', keys.y && keys.redone && keys.redos >= 1, keys);
    t.check('Ctrl+Shift+Z is Ctrl+Y (AC-03)', keys.shiftZ && keys.redoneShift, keys);
    t.check('⌘Z is Ctrl+Z (AC-04)', keys.meta && keys.metaUndone, keys);

    // AC-05
    var branch = await page.eval(`
        await start();
        await change('one');
        ge.undo();
        await change('other');
        return { canRedo: ge.canRedo(), y: press('y'), has: html().indexOf('id="other"') !== -1 };
    `);
    t.check('a change after going back ends what could be redone (AC-05)',
        !branch.canRedo && !branch.y && branch.has, branch);

    // AC-06
    var nothing = await page.eval(`
        await start();
        const before = html();
        return { z: press('z'), same: html() === before, undos: named('after-undo').length };
    `);
    t.check('a fresh editor has nothing to undo: not prevented, no after-undo (AC-06)',
        !nothing.z && nothing.same && nothing.undos === 0, nothing);

    // AC-07
    var typing = await page.eval(`
        await start();
        await change();
        const area = q('#a p');
        area.setAttribute('contenteditable', 'true');
        area.focus();
        const z = press('z');
        area.blur();
        area.removeAttribute('contenteditable');
        await wait(120);
        return { z: z, kept: html().indexOf('id="added"') !== -1 };
    `);
    t.check('with the focus in an editable text the key is the text editor’s (AC-07)', !typing.z && typing.kept, typing);

    // AC-08
    var field = await page.eval(`
        await start({}, { settings_panel: 'sidebar' });
        await change();
        q('#a > .ge-tools-drawer').click();
        const input = q('.ge-settings-sidebar .ge-id');
        input.focus();
        const z = press('z');
        input.blur();
        return { found: !!input, z: z, kept: html().indexOf('id="added"') !== -1 };
    `);
    t.check('with the focus in a panel’s field the key is the field’s (AC-08)', field.found && !field.z && field.kept, field);

    // AC-10
    var preview = await page.eval(`
        await start();
        await change();
        const eye = q('.gm-preview');
        eye.dispatchEvent(new MouseEvent('mouseenter'));
        eye.click();
        const z = press('z');
        const kept = ge.getHtml().indexOf('id="added"') !== -1;
        eye.click();
        eye.dispatchEvent(new MouseEvent('mouseleave'));
        return { z: z, kept: kept, editing: q('#myGrid').classList.contains('ge-editing') };
    `);
    t.check('in preview the key does nothing (AC-10)', !preview.z && preview.kept && preview.editing, preview);

    // AC-12
    var panel = await page.eval(`
        await start({}, { settings_panel: 'popover' });
        await change();
        use(q('#a'));
        q('#a > .ge-tools-drawer > .ge-settings').click();
        const z = press('z');
        q('#a > .ge-tools-drawer > .ge-settings').click();
        return { z: z, kept: html().indexOf('id="added"') !== -1 };
    `);
    t.check('with a popover panel open the key does nothing (AC-12)', !panel.z && panel.kept, panel);

    // AC-13
    var noKeys = await page.eval(`
        await start({ shortcuts: false });
        const base = html();
        await change();
        const z = press('z');
        const kept = html().indexOf('id="added"') !== -1;
        return { z: z, kept: kept, undo: ge.undo(), undone: html() === base };
    `);
    t.check('shortcuts: false leaves the keys alone, and undo() still works (AC-13)',
        !noKeys.z && noKeys.kept && noKeys.undo && noKeys.undone, noKeys);

    // AC-22, AC-23
    var two = await page.eval(`
        await start();
        await change('first-added');
        const other = document.body.appendChild(document.createElement('div'));
        other.id = 'otherGrid';
        other.innerHTML = '<div class="row"><div class="col-md-12" id="oc"><p>Other</p></div></div>';
        const second = GridEditor.create(other, { plugins: ['history'], history: { delay: 50 } });
        let undos = 0;
        other.addEventListener('grideditor:after-undo', function() { undos++; });
        await wait(20);
        second.createRow([12], { appendTo: other }).id = 'second-added';
        await wait(120);
        use(q('#oc'));
        const z = press('z');
        const result = {
            z: z,
            secondUndone: second.getHtml().indexOf('second-added') === -1,
            firstKept: html().indexOf('first-added') !== -1,
            undos: undos + named('after-undo').length,
        };
        use(document.body);
        result.outside = press('z');
        result.firstStill = html().indexOf('first-added') !== -1;
        second.destroy();
        other.remove();
        return result;
    `);
    t.check('with two editors the key goes to the one used last, one after-undo (AC-22)',
        two.z && two.secondUndone && two.firstKept && two.undos === 1, two);
    t.check('used last outside both, the key does nothing (AC-23)', !two.outside && two.firstStill, two);

    // AC-39
    var held = await page.eval(`
        await start();
        await change('one');
        await change('two');
        press('z');
        press('z', { repeat: true });
        return { both: html().indexOf('id="one"') === -1 && html().indexOf('id="two"') === -1 };
    `);
    t.check('a held Ctrl+Z goes on undoing (AC-39)', held.both, held);

    // AC-42
    var cyrillic = await page.eval(`
        await start();
        await change();
        const z = press('я', { code: 'KeyZ' });
        return { z: z, undone: html().indexOf('id="added"') === -1 };
    `);
    t.check('on a layout without Latin letters the key’s place counts (AC-42)', cyrillic.z && cyrillic.undone, cyrillic);
}

async function stepTests(t, page) {
    // AC-09
    var waiting = await page.eval(`
        await start({ delay: 300 });
        await change('a-step');
        await wait(300);
        const afterA = html();
        ge.createRow([12], { appendTo: q('#myGrid') }).id = 'pending';
        await wait(50);
        const can = ge.canUndo();
        ge.undo();
        return { can: can, isAfterA: html() === afterA };
    `);
    t.check('a change still waiting is what is undone (AC-09)', waiting.can && waiting.isAfterA, waiting);

    // AC-11
    var source = await page.eval(`
        await start();
        await change();
        q('.gm-edit-mode').click();
        const undo = ge.undo();
        q('.gm-edit-mode').click();
        await wait(120);
        return { undo: undo, kept: html().indexOf('id="added"') !== -1 };
    `);
    t.check('with the source open undo() answers false and changes nothing (AC-11)', !source.undo && source.kept, source);

    // AC-14, AC-15, AC-16
    var limits = await page.eval(`
        const result = {};
        for (const count of [2, 3, 4]) {
            await start({ max: 3 });
            const base = html();
            let first = null;
            for (let i = 0; i < count; i++) {
                await change('c' + i);
                if (i === 0) { first = html(); }
            }
            const undone = undoAll();
            result[count] = { undone: undone, atBase: html() === base, atFirst: html() === first };
        }
        return result;
    `);
    t.check('max 3, two changes: two undone, back to the start (AC-14)', limits[2].undone === 2 && limits[2].atBase, limits[2]);
    t.check('max 3, three changes: three undone, back to the start (AC-15)', limits[3].undone === 3 && limits[3].atBase, limits[3]);
    t.check('max 3, four changes: three undone, at the first change (AC-16)', limits[4].undone === 3 && limits[4].atFirst, limits[4]);

    // AC-17
    var fifty = await page.eval(`
        await start({ delay: 0 });
        let first = null;
        for (let i = 0; i < 51; i++) {
            ge.createRow([12], { appendTo: q('#myGrid') }).id = 'n' + i;
            await wait(15);
            if (i === 0) { first = html(); }
        }
        const undone = undoAll();
        return { undone: undone, atFirst: html() === first };
    `);
    t.check('by default 50 steps can be undone (AC-17)', fifty.undone === 50 && fifty.atFirst, fifty);

    // AC-18
    var noChange = await page.eval(`
        await start({}, { settings_panel: 'sidebar' });
        const drawer = q('#a > .ge-tools-drawer');
        drawer.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        drawer.dispatchEvent(new MouseEvent('mouseenter'));
        drawer.click();
        await wait(150);
        return { selected: !!ge.getSelected(), can: ge.canUndo(), changes: named('history-change').length };
    `);
    t.check('a hover and a selection are no step (AC-18)',
        noChange.selected && !noChange.can && noChange.changes === 0, noChange);

    // AC-19
    var id = await page.eval(`
        await start({}, { settings_panel: 'sidebar' });
        q('#a > .ge-tools-drawer').click();
        const input = q('.ge-settings-sidebar .ge-id');
        input.value = 'renamed';
        input.dispatchEvent(new Event('change'));
        await wait(120);
        const can = ge.canUndo();
        use(q('#myGrid'));
        input.blur();
        press('z');
        return { can: can, back: !!q('#a') && !q('#renamed') };
    `);
    t.check('an id changed in the panel is a step, and Ctrl+Z gives the old one back (AC-19)', id.can && id.back, id);

    // AC-20
    var typed = await page.eval(`
        window.tinymce = {
            init: function(config) {
                const area = config.target;
                const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {},
                    getContent: function() { return area.innerHTML; }, remove: function() {} };
                config.init_instance_callback.call(editor, editor);
            },
        };
        await start({}, { content_types: ['tinymce'], plugins: window.fixture.plugins(['history', 'tinymce']) },
            '<div class="row"><div class="col-md-12"><div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce" id="t"><p>Text</p></div></div></div>');
        q('#t').click();
        q('#t p').textContent = 'Typed in it';
        await wait(150);
        const can = ge.canUndo();
        ge.undo();
        const back = html();
        delete window.tinymce;
        return { can: can, back: back.indexOf('Text') !== -1 && back.indexOf('Typed in it') === -1 };
    `);
    t.check('what is typed in a text is a step, and undo gives the text before back (AC-20)', typed.can && typed.back, typed);

    // AC-21
    var draft = await page.eval(`
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        q('#myGrid').innerHTML = window.MARKUP;
        const probe = window.fixture.init({});
        const startHtml = probe.getHtml({ keepEditing: true });
        probe.destroy();
        let hash = 0x811c9dc5;
        for (let i = 0; i < startHtml.length; i++) { hash ^= startHtml.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
        const base = (hash >>> 0).toString(16).padStart(8, '0');
        localStorage.setItem('grideditor.autosave:/test/fixtures/grid.html#myGrid', JSON.stringify({
            version: 1, base: base, savedAt: new Date().toISOString(),
            html: '<div class="row"><div class="col-md-12" id="from-draft"><p>Draft</p></div></div>',
        }));
        q('#myGrid').innerHTML = window.MARKUP;
        window.ge = window.fixture.init({ plugins: window.fixture.plugins(['history', 'autosave']), history: { delay: 50 } });
        const initial = ge.getHtml();
        await wait(800);
        q('.ge-confirm .ge-confirm-ok').click();
        await wait(800);
        const restored = !!q('#from-draft');
        const undo = ge.undo();
        const result = { restored: restored, undo: undo, atInitial: ge.getHtml() === initial };
        ge.destroy();
        localStorage.clear();
        return result;
    `);
    t.check('a draft restored by the autosave is a step: undo goes back to what the editor started with (AC-21)',
        draft.restored && draft.undo && draft.atInitial, draft);

    // AC-31, AC-32
    var told = await page.eval(`
        await start();
        await change('one');
        await change('two');
        const once = named('history-change').length;
        const cleared = ge.clearHistory();
        return { once: once, last: window.events[window.events.length - 1], cleared: cleared,
            canUndo: ge.canUndo(), canRedo: ge.canRedo(), kept: html().indexOf('id="two"') !== -1 };
    `);
    t.check('two steps tell history-change once, as canUndo becomes true (AC-31)', told.once === 1, told);
    t.check('clearHistory leaves nothing to undo or redo, says so, and the markup as it is (AC-32)',
        told.cleared && !told.canUndo && !told.canRedo && told.kept &&
            told.last.name === 'history-change' && told.last.canUndo === false, told);

    // AC-37
    var round = await page.eval(`
        await start();
        await change('one');
        await change('two');
        await change('three');
        const before = html();
        press('z'); press('z'); press('z');
        press('y'); press('y'); press('y');
        return { same: html() === before };
    `);
    t.check('three back and three forward is where it was (AC-37)', round.same, round);

    // AC-38
    var burst = await page.eval(`
        await start({ delay: 100 });
        const base = html();
        const col = q('#a');
        for (const size of ['col-md-5', 'col-md-4', 'col-md-3']) {
            col.className = col.className.replace(/col-md-\\d+/, size);
            await wait(20);
        }
        await wait(200);
        ge.undo();
        return { one: html() === base, can: ge.canUndo() };
    `);
    t.check('changes closer than delay are one step (AC-38)', burst.one && !burst.can, burst);

    // AC-40
    var host = await page.eval(`
        await start();
        ge.deinit();
        ge.init();
        await wait(150);
        return { can: ge.canUndo() };
    `);
    t.check('the host’s deinit() and init() are no step (AC-40)', !host.can, host);

    // AC-41
    var edited = await page.eval(`
        await start();
        const base = html();
        q('.gm-edit-mode').click();
        const area = q('.ge-html-output');
        area.value = area.value + '<div class="row" id="typed-in-source"><div class="col-md-12"><p>S</p></div></div>';
        q('.gm-edit-mode').click();
        await wait(150);
        const has = !!q('#typed-in-source');
        ge.undo();
        return { has: has, back: html() === base };
    `);
    t.check('what was edited in the source is a step, undone with the rest (AC-41)', edited.has && edited.back, edited);

    // AC-33
    var gone = await page.eval(`
        await start();
        await change();
        ge.destroy();
        window.warnings.length = 0;
        const z = press('z');
        const kept = q('#myGrid').innerHTML.indexOf('id="added"') !== -1;
        const undo = ge.undo();
        ge.undo();
        return { z: z, kept: kept, undo: undo, warnings: window.warnings.filter(function(w) { return w.indexOf('undo()') !== -1; }).length };
    `);
    t.check('a destroyed editor: the key does nothing, undo() gives null and warns once (AC-33 rev v2)',
        !gone.z && gone.kept && gone.undo === null && gone.warnings === 1, gone);
}

async function settingTests(t, page) {
    // AC-27, AC-28
    var buttons = await page.eval(`
        await start();
        const fresh = { undo: !!button('undo'), redo: !!button('redo'), undoOff: off('undo'), redoOff: off('redo'),
            right: !!button('undo').closest('.ge-toolbar-end') };
        await change();
        const changed = { undoOff: off('undo') };
        button('undo').click();
        return { fresh: fresh, changed: changed, undone: html().indexOf('id="added"') === -1,
            source: named('after-undo')[0] && named('after-undo')[0].source, undoOff: off('undo'), redoOff: off('redo') };
    `);
    t.check('a fresh editor has undo and redo on the right of the toolbar, both disabled (AC-27)',
        buttons.fresh.undo && buttons.fresh.redo && buttons.fresh.undoOff && buttons.fresh.redoOff && buttons.fresh.right, buttons);
    t.check('a step enables undo; its click undoes with source tool, and enables redo (AC-28)',
        !buttons.changed.undoOff && buttons.undone && buttons.source === 'tool' && buttons.undoOff && !buttons.redoOff, buttons);

    // AC-29
    var target = await page.eval(`
        await start({}, { active_target: true });
        q('#a > .ge-tools-drawer').click();
        const isTarget = ge.getActiveTarget() === q('#a');
        await change();
        let adds = 0;
        q('#myGrid').addEventListener('grideditor:before-add', function() { adds++; });
        button('undo').click();
        return { isTarget: isTarget, undone: html().indexOf('id="added"') === -1, adds: adds, inA: q('#a').querySelectorAll('.row').length };
    `);
    t.check('with a target, the undo button undoes and adds nothing to it (AC-29)',
        target.isTarget && target.undone && target.adds === 0 && target.inA === 0, target);

    // AC-30, AC-45
    var noButtons = await page.eval(`
        await start({ buttons: false });
        await change();
        const told = named('history-change').length;
        return { buttons: qa('.ge-history-undo, .ge-history-redo').length, z: press('z'), told: told };
    `);
    t.check('buttons: false, no buttons, and Ctrl+Z works (AC-30)', noButtons.buttons === 0 && noButtons.z, noButtons);
    t.check('without buttons history-change still tells a page with its own (AC-45)', noButtons.told === 1, noButtons);

    // AC-34
    var locale = await page.eval(`
        await start();
        await change();
        ge.setLocale('es');
        await wait(150);
        const result = { title: button('undo').getAttribute('title'), undoOff: off('undo') };
        result.undone = undoAll();
        ge.setLocale('en');
        return result;
    `);
    t.check('setLocale makes no step, and undo stays enabled, in Spanish (AC-34)',
        locale.title === 'Deshacer' && !locale.undoOff && locale.undone === 1, locale);

    // AC-35, AC-36
    var settings = await page.eval(`
        const result = {};
        for (const max of [0, 1, 2]) {
            await start({ max: max });
            const warned = window.warnings.length;
            for (let i = 0; i < 3; i++) { await change('m' + i); }
            result[max] = { warned: warned, undone: undoAll() };
        }
        const odd = {};
        for (const given of [{ max: 1.5 }, { delay: -1 }, { shortcuts: 'yes' }, { buttons: 'no' }]) {
            await start(Object.assign({ delay: 50 }, given));
            const key = Object.keys(given)[0];
            odd[key] = { warnings: window.warnings.filter(function(w) { return w.indexOf('history.' + key) !== -1; }).length,
                buttons: qa('.ge-history-undo').length };
            await change();
            odd[key].z = press('z');
        }
        return { max: result, odd: odd };
    `);
    t.check('max 0 warns and is 50; 1 and 2 are as given (AC-35)',
        settings.max[0].warned === 1 && settings.max[0].undone === 3 &&
            settings.max[1].warned === 0 && settings.max[1].undone === 1 &&
            settings.max[2].warned === 0 && settings.max[2].undone === 2, settings.max);
    t.check('a value that is not one warns once and the default is used (AC-36)',
        ['max', 'delay', 'shortcuts', 'buttons'].every(function(key) { return settings.odd[key].warnings === 1; }) &&
            settings.odd.shortcuts.z && settings.odd.buttons.buttons === 1, settings.odd);
}

async function selectionTests(t, page) {
    // AC-24
    var selected = await page.eval(`
        await start({}, { settings_panel: 'sidebar' });
        q('#b > .ge-tools-drawer').click();
        q('#b').classList.add('picked');
        await wait(120);
        use(q('#myGrid'));
        press('z');
        const now = ge.getSelected();
        return { second: !!now && now === q('#r1').children[2] && now.id === 'b', fresh: !q('#b').classList.contains('picked'),
            shown: !!q('.ge-settings-sidebar .ge-id') && q('.ge-settings-sidebar .ge-id').value === 'b' };
    `);
    t.check('the second column, selected before, is selected again after Ctrl+Z, the sidebar showing it (AC-24)',
        selected.second && selected.fresh && selected.shown, selected);

    // AC-25
    var gone = await page.eval(`
        await start({}, { settings_panel: 'sidebar' });
        ge.createRow([12], { appendTo: q('#myGrid') }).id = 'last';
        q('#last > .ge-tools-drawer').click();
        const was = ge.getSelected() === q('#last');
        await wait(120);
        ge.undo();
        return { was: was, row: !!q('#last'), selected: ge.getSelected() };
    `);
    t.check('a selected node the step does not have leaves nothing selected (AC-25)',
        gone.was && !gone.row && gone.selected === null, gone);

    // AC-26
    var target = await page.eval(`
        await start({}, { active_target: true });
        q('#b > .ge-tools-drawer').click();
        await change();
        ge.undo();
        return { target: ge.getActiveTarget() === q('#b') };
    `);
    t.check('the target is the node in the same place after an undo (AC-26)', target.target, target);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    // In the background a page's transitions do not run, and the confirm modal does not show
    await page.send('Page.bringToFront');
    await page.eval(SETUP);

    await keyTests(t, page);
    await stepTests(t, page);
    await settingTests(t, page);
    await selectionTests(t, page);

    await page.eval(`if (window.fixture.editor()) { window.fixture.editor().destroy(); } localStorage.clear(); return true;`);
    t.check('the history suite logged no page errors', page.errors().length === 0, page.errors().slice(0, 5));
}

module.exports = {
    name: 'history',
    description: 'the history plugin: steps, undo and redo by key, button and method, and the selection after',
    run: run,
};

if (require.main === module) {
    require('./run').main(['history']);
}
