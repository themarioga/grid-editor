/**
 * The style plugin's free css: a textarea with every declaration of the
 * node's own style that no field on show stands for - whatever the host
 * wrote that the sections have no field for, and what a section the host
 * turned off or narrowed would have shown.
 *
 * Compared longhand by longhand, which is how the browser holds a style: a
 * margin written as a shorthand is its four sides, and a field for
 * border-width stands for the four border-*-width. Editing the textarea
 * writes those declarations again; the browser drops what it cannot
 * parse, and the textarea shows what was kept.
 */
import * as dom from '../dom.js';

/** The longhands a property sets, as the browser expands it. */
function longhands(property) {
    var probe = document.createElement('div').style;
    var list = [];

    probe.setProperty(property, 'initial');
    for (var i = 0; i < probe.length; i++) { list.push(probe[i]); }

    return list.length ? list : [property];
}

function declaration(cssText) {
    var style = document.createElement('div').style;
    style.cssText = cssText;
    return style;
}

/** `properties` are the ones the node's fields on show stand for. */
export function createCustom(ge, node, properties, changed) {
    var covered = {};
    properties.forEach(function(property) {
        longhands(property).forEach(function(longhand) { covered[longhand] = true; });
    });

    var box = dom.element('div', { 'class': 'ge-style-custom' });
    var textarea = box.appendChild(dom.element('textarea', {
        'class': 'form-control form-control-sm font-monospace ge-style-custom-css',
        rows: '4',
        spellcheck: 'false',
        'aria-label': ge.t('style.section_custom'),
    }));

    /** The declarations of the host's style no field stands for. */
    function free() {
        var style = declaration(ge.hostStyle(node));
        var rest = document.createElement('div').style;

        for (var i = 0; i < style.length; i++) {
            var name = style[i];
            if (!covered[name]) { rest.setProperty(name, style.getPropertyValue(name), style.getPropertyPriority(name)); }
        }

        return rest;
    }

    textarea.addEventListener('change', function() {
        var before = free();
        var wanted = declaration(textarea.value);
        var i;

        for (i = 0; i < before.length; i++) {
            if (wanted.getPropertyValue(before[i]) === '') { ge.setHostStyle(node, before[i], ''); }
        }
        for (i = 0; i < wanted.length; i++) {
            ge.setHostStyle(node, wanted[i], wanted.getPropertyValue(wanted[i]), wanted.getPropertyPriority(wanted[i]));
        }

        render();
        changed();
    });

    function render() {
        if (document.activeElement === textarea) { return; }
        textarea.value = free().cssText.replace(/; /g, ';\n');
    }

    render();

    return { element: box, render: render };
}
