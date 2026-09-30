/**
 * The inline-style plugin's catalog: Bootstrap's classes for what a section
 * styles, as chips that put a class on the node or take it off.
 *
 * A chip never touches the node itself. It writes the panel's classes
 * field and fires its change, as the user typing there would, so the
 * editor keeps the node's own classes apart from its editing ones, and the
 * Responsive section and the preview follow. Within an exclusive group,
 * choosing one class takes the others off.
 */
import * as dom from '../dom.js';
import { offeredOn } from './sections.js';

function classesOf(node) {
    return (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
}

/** Put a class on or off through the node's classes field. */
function choose(ge, node, group, name) {
    var details = ge.detailsOf(node);
    var input = details ? dom.one(details, '.ge-classes') : null;
    if (!input) { return; }

    var on = classesOf(node).indexOf(name) !== -1;
    var list = input.value.split(/\s+/).filter(Boolean).filter(function(each) {
        if (each === name) { return false; }
        return !(group.exclusive && !on && group.classes.indexOf(each) !== -1);
    });

    if (!on) { list.push(name); }

    input.value = list.join(' ');
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * A section's catalog for a node, or null when none of its groups is
 * offered on this kind of node.
 */
export function createCatalog(ge, node, kind, groups) {
    var offered = groups.filter(function(group) { return offeredOn(group, kind); });
    if (!offered.length) { return null; }

    var box = dom.element('div', { 'class': 'ge-inline-style-catalog' });
    box.appendChild(dom.element('span', { 'class': 'ge-inline-style-label' }, ge.t('inline_style.catalog')));

    offered.forEach(function(group) {
        var row = box.appendChild(dom.element('div', { 'class': 'ge-inline-style-chips' }));

        group.classes.forEach(function(name) {
            var chip = row.appendChild(dom.element('button', {
                type: 'button',
                'class': 'btn btn-sm btn-outline-secondary ge-inline-style-chip',
                'data-ge-class': name,
                'aria-pressed': 'false',
            }, name));

            chip.addEventListener('click', function() { choose(ge, node, group, name); });
        });
    });

    renderCatalog(box, node);

    return box;
}

/** A chip is pressed while its class is on the node. */
export function renderCatalog(box, node) {
    var classes = classesOf(node);

    dom.all(box, '.ge-inline-style-chip').forEach(function(chip) {
        var on = classes.indexOf(chip.getAttribute('data-ge-class')) !== -1;
        dom.toggleClass(chip, 'active', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}
