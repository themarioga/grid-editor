/**
 * Cards for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a card, a bootstrap card whose body is an editable region. What it can ask
 * the editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.card.min.js"></script>
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'container.add_card': 'Card',
    'container.card_title': 'Card title',
    'container.card_footer': 'Card footer',
});

$.fn.gridEditor.containers.card = function(ge) {

    return {
        labelKey: 'container.add_card',

        /**
         * A card is a header, a body and an optional footer. `header: false`
         * leaves the title out, `footer: true` or a string adds one; both are
         * plain text the editor makes editable, not regions, so a card holds
         * exactly one region and nests like any other container.
         */
        create: function(options) {
            var card = $('<div class="card" />');

            if (options.header !== false) {
                $('<div class="card-header" />')
                    .append($('<span class="ge-pane-label" />')
                        .text(options.title || ge.t('container.card_title')))
                    .appendTo(card)
                ;
            }

            $('<div class="card-body" />').append(ge.defaultRegion()).appendTo(card);

            if (options.footer) {
                $('<div class="card-footer text-body-secondary" />')
                    .append($('<span class="ge-pane-label" />')
                        .text(typeof options.footer === 'string'
                            ? options.footer
                            : ge.t('container.card_footer')))
                    .appendTo(card)
                ;
            }

            return $('<div />').attr('data-ge-container', 'card').append(card);
        },

        mark: function(container) {
            ge.makeLabelEditable(ge.labelIn(container.find('> .card > .card-header')));
            ge.makeLabelEditable(ge.labelIn(container.find('> .card > .card-footer')));
        },

        unmark: function(container) {
            ge.unwrapLabels(container);
        },
    };
};

})(jQuery);
