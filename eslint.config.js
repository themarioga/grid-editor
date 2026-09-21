/**
 * Lint configuration, as a flat config for eslint 9.
 *
 * This replaces the old `.eslintrc`, which named `babel-eslint` as its parser
 * and pre-flat-config rule names, so `eslint src` had not run on a current
 * eslint for a long time. The rule set below is the one that `.eslintrc`
 * described, minus the rules eslint removed (the commonjs rules, which moved
 * to a plugin, and `no-catch-shadow`) and with the renamed ones under their
 * current names.
 *
 * Run it with `npm run lint`. Almost everything is a warning, as it was
 * before: the point is to catch mistakes in a pull request, not to fail a
 * build over spacing. Warnings still have to be dealt with, per CONTRIBUTING.
 */

var CORRECTNESS = {
    'no-cond-assign': 1,
    'no-constant-condition': 1,
    'no-control-regex': 1,
    'no-debugger': 1,
    'no-dupe-args': 1,
    'no-dupe-keys': 1,
    'no-duplicate-case': 1,
    'no-empty': 1,
    'no-empty-character-class': 1,
    'no-ex-assign': 1,
    'no-extra-boolean-cast': 1,
    'no-extra-semi': 1,
    'no-func-assign': 1,
    'no-inner-declarations': 1,
    'no-invalid-regexp': 1,
    'no-irregular-whitespace': 1,
    'no-obj-calls': 1,
    'no-regex-spaces': 1,
    'no-sparse-arrays': 1,
    'no-unreachable': 1,
    'no-unsafe-negation': 1,      // was no-negated-in-lhs
    'use-isnan': 1,
    'valid-typeof': 1,
};

var PRACTICES = {
    'consistent-return': 1,
    'curly': 1,
    'no-array-constructor': 1,
    'no-caller': 1,
    'no-delete-var': 1,
    'no-eval': 1,
    'no-extend-native': 1,
    'no-extra-bind': 1,
    'no-fallthrough': 1,
    'no-global-assign': 1,        // was no-native-reassign
    'no-implied-eval': 1,
    'no-iterator': 1,
    'no-label-var': 1,
    'no-labels': 1,
    'no-lone-blocks': 1,
    'no-loop-func': 1,
    'no-multi-str': 1,
    'no-new': 1,
    'no-new-func': 1,
    'no-new-wrappers': 1,
    'no-object-constructor': 1,   // was no-new-object
    'no-octal': 1,
    'no-octal-escape': 1,
    'no-proto': 1,
    'no-redeclare': 1,
    'no-return-assign': 1,
    'no-script-url': 1,
    'no-sequences': 1,
    'no-shadow': 1,
    'no-shadow-restricted-names': 1,
    'no-undef-init': 1,
    'no-unused-expressions': 1,
    'no-with': 1,
    'new-cap': [1, { capIsNewExceptions: ['$.Event', 'jQuery.Event'] }], // jQuery.Event is a factory
    'yoda': 1,
};

var STYLE = {
    'comma-spacing': 1,
    'keyword-spacing': 1,
    'new-parens': 1,
    'no-mixed-spaces-and-tabs': 1,
    'semi': 1,
    'semi-spacing': 1,
    'space-infix-ops': 1,
    'space-unary-ops': 1,
};

var RULES = Object.assign({}, CORRECTNESS, PRACTICES, STYLE);

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**', 'test/vendor/**'],
    },
    {
        // The plugin sources: a browser script, not a module. Globals are not
        // declared because `no-undef` is off, as it was in .eslintrc: the
        // sources talk to whatever editor the host page loaded.
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2018,
            sourceType: 'script',
        },
        rules: RULES,
    },
    {
        // The test harness and the build: node, and free to use newer syntax
        // than the plugin, since only node runs it.
        files: ['test/**/*.js', 'Gruntfile.js', 'release.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
        },
        rules: RULES,
    },
];
