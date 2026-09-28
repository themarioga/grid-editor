/**
 * The Angular example, checked in a real Chrome: build it, serve what was
 * built, and drive it the way test/ drives the other examples.
 *
 *   npm run build && npm run check
 *
 * Uses the repository's own test harness (test/cdp.js and test/server.js),
 * so it runs from a checkout of grid-editor, with Chrome installed.
 */
const path = require('path');
const cdp = require('../../test/cdp');
const { serve } = require('../../test/server');

const ROOT = path.join(__dirname, 'dist', 'angular', 'browser');
const results = [];

function check(name, passed, detail) {
  results.push(passed);
  console.log((passed ? '  PASS  ' : '  FAIL  ') + name + (passed ? '' : '\n          ' + JSON.stringify(detail)));
}

async function main() {
  const server = await serve(ROOT);
  const browser = await cdp.launchChrome();

  try {
    const page = await browser.newPage();
    await cdp.goto(page, server.url + '/');
    await page.waitFor(`document.querySelector('app-grid-editor .ge-canvas.ge-editing')`, { label: 'the editor' });

    const booted = await page.eval(`
      return {
        jquery: typeof window.jQuery,
        dollar: typeof window.$,
        global: typeof window.GridEditor,
        rows: document.querySelectorAll('.ge-canvas > .row > .ge-tools-drawer').length,
        containers: Array.from(document.querySelectorAll('.ge-add-container[data-ge-container-type]'), b => b.getAttribute('data-ge-container-type')).join(','),
        text: !!document.querySelector('.ge-add-text-button'),
      };
    `);
    check('the editor starts in the component, with its plugins, and no jQuery and no GridEditor on window',
      booted.jquery === 'undefined' && booted.dollar === 'undefined' && booted.global === 'undefined' &&
      booted.rows === 1 && booted.containers === 'tabs,accordion,card' && booted.text, booted);

    await page.click('.ge-canvas .ge-content');
    await page.waitFor(`window.tinymce && tinymce.get().length === 1 && document.querySelector('.tox-tinymce-inline')`, { label: 'tinyMCE' });
    check('a click on a text opens tinyMCE, bundled by the app', true);

    await page.click('.ge-addRowGroup a', 1);
    await cdp.sleep(300);
    const added = await page.eval(`
      return { rows: document.querySelectorAll('.ge-canvas > .row').length, changes: document.querySelector('#changes').textContent.trim() };
    `);
    check('the toolbar adds a row, and the component tells the app, which renders it', added.rows === 2 && added.changes === 'Changes: 1', added);

    await page.drag('.ge-canvas > .row:last-child > .ge-tools-drawer .ge-move', '.ge-canvas > .row:first-child', { yRatio: 0.1 });
    await cdp.sleep(400);
    const moved = await page.eval(`
      return {
        first: document.querySelector('.ge-canvas > .row').querySelectorAll(':scope > .column').length,
        changes: document.querySelector('#changes').textContent.trim(),
      };
    `);
    check('a row drags with the SortableJS the app handed over', moved.first === 2 && moved.changes === 'Changes: 2', moved);

    await page.click('.ge-canvas > .row:first-child > .ge-tools-drawer .ge-delete-row');
    await page.waitFor(`document.querySelector('body > .ge-confirm.show')`, { label: 'the confirmation' });
    await cdp.sleep(300);
    await page.click('body > .ge-confirm .ge-confirm-ok');
    await cdp.sleep(1200);
    const deleted = await page.eval(`
      return { rows: document.querySelectorAll('.ge-canvas > .row').length, changes: document.querySelector('#changes').textContent.trim() };
    `);
    check("a delete is confirmed in Bootstrap's modal, from the Bootstrap the app imported", deleted.rows === 1 && deleted.changes === 'Changes: 3', deleted);

    await page.click('.ge-canvas > .row > .ge-tools-drawer .ge-settings');
    await page.waitFor(`document.querySelector('body > .ge-settings-modal.show')`, { label: 'the settings panel' });
    await cdp.sleep(300);
    await page.click('body > .ge-settings-modal .modal-footer .ge-settings-close');
    await cdp.sleep(600);
    check('the settings open in a Bootstrap modal, and close', await page.eval(`return !document.querySelector('body > .ge-settings-modal.show');`));

    await page.eval(`
      const select = document.querySelector('#locale');
      select.value = 'es';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
    await cdp.sleep(200);
    const spanish = await page.eval(`return document.querySelector('.ge-canvas .ge-tools-drawer .ge-move').getAttribute('title');`);
    check('the locale imported as a module switches the editor to Spanish', spanish === 'Mover', spanish);

    await page.click('#save');
    await cdp.sleep(300);
    const saved = await page.eval(`
      const out = document.querySelector('#output').textContent;
      return { rows: (out.match(/class="row/g) || []).length, clean: !/ge-tools-drawer|ge-editing|tox-|contenteditable/.test(out) };
    `);
    check('getHtml saves clean markup', saved.rows === 1 && saved.clean, saved);

    await page.click('#toggle');
    await cdp.sleep(600);
    const away = await page.eval(`
      return {
        editor: !!document.querySelector('app-grid-editor'),
        controls: document.querySelectorAll('.ge-mainControls').length,
        panels: document.querySelectorAll('body > .ge-settings-panel, body > .ge-confirm').length,
        tinymce: tinymce.get().length,
        locked: document.body.classList.contains('modal-open'),
      };
    `);
    check('taking the component away destroys the editor: no controls, panels or tinyMCE left, the page not locked',
      !away.editor && away.controls === 0 && away.panels === 0 && away.tinymce === 0 && !away.locked, away);

    await page.click('#toggle');
    await page.waitFor(`document.querySelector('app-grid-editor .ge-canvas.ge-editing')`, { label: 'the editor again' });
    const back = await page.eval(`return document.querySelectorAll('.ge-canvas > .row').length;`);
    check('bringing it back makes a new editor on what was saved', back === 1, back);

    const errors = page.errors();
    check('the page logged no errors', errors.length === 0, errors.slice(0, 5));
  } finally {
    browser.close();
    await server.close();
  }

  const failed = results.filter((passed) => !passed).length;
  console.log('\n' + results.length + ' checks, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
}

main();
