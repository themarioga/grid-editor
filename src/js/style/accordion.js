/**
 * The style plugin's accordion for one node: a section per group of
 * properties, each with the merged utilities' per breakpoint fields, the
 * inline fields and the catalog - as far as each applies to the node.
 *
 * Bootstrap's accordion markup, opened and closed here, so it needs none of
 * Bootstrap's javascript. One section is open at a time, and the one the
 * user opened last is open again on the next node's panel.
 */
import * as dom from '../dom.js';
import { offeredOn } from './sections.js';
import { createStyleField, renderStyleField } from './fields.js';
import { createCatalog, renderCatalog } from './catalog.js';
import { createCustom } from './custom.js';

/** The kinds of node that take inline style: not a text, nor plain content. */
export function takesInlineStyle(node, kind) {
    if (kind === 'row' || kind === 'column' || kind === 'element' || kind === 'section') { return true; }
    if (dom.is(node, '[data-ge-container]')) { return true; }

    // A pane of a container, whatever its container calls it
    return !!dom.child(node, '.ge-tools-drawer.ge-pane-drawer');
}

/** Whether a merged family applies to the node, as the editor decides it. */
function familyApplies(family, node, kind) {
    if (kind === 'plain') { kind = 'text'; }
    if (family.appliesTo.indexOf(kind) !== -1) { return true; }

    return family.appliesTo.indexOf('container') !== -1 && dom.is(node, '[data-ge-container]');
}

/**
 * What a merged part shows in its section for a node: the spacing part
 * its own panel, the others the field of their one family.
 */
function partContent(ge, part, node, kind) {
    if (part.panel) { return part.panel(node, kind); }

    var family = part.families[0];
    return familyApplies(family, node, kind) ? ge.utilityField(node, family.name) : null;
}

/**
 * `context` is the plugin's: its resolved sections, its parts by name, the
 * state it keeps for the editor ({ open }) and `opened(key)`, called when
 * the user opens or closes a section.
 */
export function createAccordion(ge, node, kind, context) {
    var inline = takesInlineStyle(node, kind);
    var accordion = dom.element('div', { 'class': 'accordion ge-style' });
    var fields = [];
    var catalogs = [];
    var notes = [];
    var custom = null;
    var customItem = null;
    var changed = function() { render(); };

    function item(key, labelKey) {
        var entry = accordion.appendChild(dom.element('div', { 'class': 'accordion-item', 'data-ge-style-section': key }));
        var header = entry.appendChild(dom.element('h2', { 'class': 'accordion-header' }));
        var button = header.appendChild(dom.element('button', {
            type: 'button',
            'class': 'accordion-button collapsed',
            'aria-expanded': 'false',
        }, ge.t(labelKey)));
        var collapse = entry.appendChild(dom.element('div', { 'class': 'accordion-collapse collapse' }));
        var body = collapse.appendChild(dom.element('div', { 'class': 'accordion-body' }));

        button.addEventListener('click', function() {
            var opening = !dom.hasClass(collapse, 'show');
            context.state.open = opening ? key : null;
            // Every panel is built on init, so the others are told as well:
            // whoever opened Border on one node wants it on the next
            context.opened(context.state.open);
        });

        return { entry: entry, body: body };
    }

    function toggle(entry, shown) {
        dom.toggleClass(dom.one(entry, '.accordion-collapse'), 'show', shown);
        var button = dom.one(entry, '.accordion-button');
        dom.toggleClass(button, 'collapsed', !shown);
        button.setAttribute('aria-expanded', shown ? 'true' : 'false');
    }

    Object.keys(context.sections).forEach(function(key) {
        var resolved = context.sections[key];
        var section = resolved.section;

        if (section.custom) {
            if (inline) { customItem = item(key, section.labelKey); }
            return;
        }

        var parts = section.parts.map(function(name) {
            return context.parts[name] ? partContent(ge, context.parts[name], node, kind) : null;
        }).filter(Boolean);
        var properties = inline ? resolved.properties.filter(function(property) { return offeredOn(property, kind); }) : [];
        var catalog = inline && resolved.catalog ? createCatalog(ge, node, kind, section.catalog) : null;

        if (!parts.length && !properties.length && !catalog) { return; }

        var body = item(key, section.labelKey).body;
        parts.forEach(function(part) { body.appendChild(dom.addClass(part, 'ge-style-part')); });

        if (properties.length) {
            var note = body.appendChild(dom.element('small', { 'class': 'ge-style-note ge-style-all-sizes' }, ge.t('style.all_sizes')));
            notes.push(note);

            var grid = body.appendChild(dom.element('div', { 'class': 'ge-style-fields' }));
            properties.forEach(function(property) {
                var field = createStyleField(ge, node, property, changed);
                fields.push(field);
                grid.appendChild(field);
            });
        }

        if (catalog) {
            catalogs.push(catalog);
            body.appendChild(catalog);
        }
    });

    // Last, since it shows what the fields made above do not
    if (customItem) {
        custom = createCustom(ge, node, fields.map(function(field) {
            return field.getAttribute('data-ge-style-property');
        }), changed);
        customItem.body.appendChild(custom.element);
        accordion.appendChild(customItem.entry);
    }

    if (!accordion.children.length) { return null; }

    /** Open this section and no other; null closes them all. */
    function open(key) {
        dom.all(accordion, '.accordion-item').forEach(function(entry) {
            toggle(entry, entry.getAttribute('data-ge-style-section') === key);
        });
    }

    open(context.state.open);

    /** Fill everything from the node again: after a write, a change of classes or view. */
    function render() {
        fields.forEach(renderStyleField);
        catalogs.forEach(function(catalog) { renderCatalog(catalog, node); });
        if (custom) { custom.render(); }
        notes.forEach(function(note) { dom.toggle(note, ge.view() !== 'all'); });
    }

    render();

    return { element: accordion, render: render, open: open };
}
