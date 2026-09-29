/**
 * The style plugin's settings, `style` in the editor's options:
 *
 *   style: {
 *       sections: { border: { properties: [...], catalog: false }, position: false, … },
 *       spacing: { values, scale },   // the values offered, and what 0 to 5 come to
 *       visibility: { drawer },       // false leaves the eye out of the drawers
 *   }
 *
 * Every section is on unless it is turned off.
 */
import { SECTIONS, section } from './sections.js';

/**
 * What each section shows: { key: { properties, catalog } } for the ones
 * that are on, in the sections' own order.
 */
function resolveSections(ge, given) {
    var resolved = {};

    Object.keys(given || {}).forEach(function(key) {
        if (!section(key)) { ge.warn('style.sections: there is no "' + key + '" section: ignored'); }
    });

    SECTIONS.forEach(function(each) {
        var option = given && given[each.key] !== undefined ? given[each.key] : true;
        if (option === false) { return; }

        var own = each.properties.map(function(property) { return property.name; });
        var properties = each.properties;
        var catalog = true;

        if (option && typeof option === 'object') {
            if (Array.isArray(option.properties)) {
                option.properties.forEach(function(name) {
                    if (own.indexOf(name) === -1) {
                        ge.warn('style.sections.' + each.key + ': "' + name + '" is not one of its properties: ignored');
                    }
                });
                properties = option.properties.filter(function(name) { return own.indexOf(name) !== -1; })
                    .map(function(name) { return each.properties[own.indexOf(name)]; });
            }
            if (option.catalog === false) { catalog = false; }
        }

        resolved[each.key] = { section: each, properties: properties, catalog: catalog };
    });

    return resolved;
}

export function resolveOptions(ge) {
    var style = ge.settings.style || {};

    return {
        sections: resolveSections(ge, style.sections),
        spacing: style.spacing,
        visibility: style.visibility,
    };
}
