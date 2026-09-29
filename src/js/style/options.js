/**
 * The style plugin's settings, `style` in the editor's options:
 *
 *   style: {
 *       sections: { border: { properties: [...], catalog: false }, position: false, … },
 *       spacing: { values, scale },   // what utilities.spacing was
 *       visibility: { drawer },       // what utilities.visibility was
 *   }
 *
 * Every section is on unless it is turned off. utilities.spacing and
 * utilities.visibility are still read, for 7.x, when the new key is not
 * there, and said to be deprecated.
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

/** An option of a merged part: the new key, or the old one, deprecated. */
function partOption(ge, style, name) {
    if (style[name] !== undefined) { return style[name]; }

    var old = (ge.settings.utilities || {})[name];
    if (old !== undefined) {
        ge.warn('utilities.' + name + ' is deprecated and will be removed in 8.0: use style.' + name);
        return old;
    }

    return undefined;
}

export function resolveOptions(ge) {
    var style = ge.settings.style || {};

    return {
        sections: resolveSections(ge, style.sections),
        spacing: partOption(ge, style, 'spacing'),
        visibility: partOption(ge, style, 'visibility'),
    };
}
