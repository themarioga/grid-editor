/**
 * Types for grid-editor's public API: the GridEditor class, its methods, its
 * settings, and its events and their payloads.
 *
 * The plugin contract - the handle a plugin's factory gets - is not typed
 * here; docs/plugins.md describes it. A plugin's factory is typed loosely as
 * a function of that handle.
 */

/** A breakpoint key. */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** A view: a breakpoint, or every one at once. */
export type View = Breakpoint | 'all';

/** A column's size: units, Bootstrap's `col` (`'equal'`) or `col-auto` (`'auto'`). */
export type ColumnSize = number | 'equal' | 'auto';

/** A row's columns-per-row layout: row-cols per breakpoint, and how many columns. */
export interface RowColsLayout {
    row_cols: Partial<Record<Breakpoint, number | 'auto'>>;
    columns?: number;
}

/** What a row is made of: sizes, or a columns-per-row layout. */
export type RowLayout = ColumnSize[] | RowColsLayout;

/** An element, or a selector for the first element it matches. */
export type Target = Element | string;

/** Where a created node goes. The first one given wins; none leaves it detached. */
export interface Placement {
    appendTo?: Target;
    prependTo?: Target;
    insertAfter?: Target;
    insertBefore?: Target;
}

/** A host tool in a drawer: row_tools, col_tools and the rest. */
export interface HostTool {
    title?: string;
    className?: string;
    iconClass?: string;
    /** A click handler, or handlers by event name. `this` is the tool. */
    on?: ((this: HTMLElement, event: Event) => void) | Record<string, (this: HTMLElement, event: Event) => void>;
}

/** A preset class toggle on a settings panel. */
export interface PresetClass {
    label: string;
    cssClass: string;
    title?: string;
}

/** A content filter: run on init and deinit with the canvas. A string names a function on window. */
/** A section of the inline-style plugin's accordion. */
export type InlineStyleSectionKey = 'size' | 'spacing' | 'border' | 'background' | 'text' | 'typography' | 'display' | 'flex' | 'position' | 'custom';

/** A section on or off, or on with some of its properties and without its catalog. */
export type InlineStyleSection = boolean | { properties?: string[]; catalog?: boolean };

/**
 * A tabs container's variant: its strip's style, width and alignment, and
 * whether it is laid out vertically - always, or from a breakpoint up.
 */
export interface TabsOptions {
    variant?: 'tabs' | 'pills' | 'underline';
    width?: 'natural' | 'fill' | 'justified';
    /** Only with the natural width, and horizontal. */
    align?: 'start' | 'center' | 'end';
    vertical?: boolean | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

/** createContainer('tabs', …): how many tabs, their labels, and the variant. */
export interface CreateTabsOptions extends Placement, TabsOptions {
    tabs?: number;
    labels?: string[];
}

/** The inline-style plugin's settings. */
export interface InlineStyleOptions {
    /** Every section is on unless it is turned off here. */
    sections?: Partial<Record<InlineStyleSectionKey, InlineStyleSection>>;
    /** The spacing section: the values offered, and what 0 to 5 come to - for the gaps too. */
    spacing?: { values?: string[]; scale?: string[] };
    /** The eye that hides and shows a node, the display family's: false leaves it out of the drawers. */
    visibility?: { drawer?: boolean };
}

export type CustomFilter = ((canvas: HTMLElement, isInit: boolean) => void) | string;

/** The settings. Every one is optional. */
export interface GridEditorOptions {
    new_row_layouts?: RowLayout[];
    row_classes?: PresetClass[];
    col_classes?: PresetClass[];
    element_classes?: PresetClass[];
    container_classes?: PresetClass[];
    pane_classes?: PresetClass[];
    text_classes?: PresetClass[];
    row_tools?: HostTool[];
    col_tools?: HostTool[];
    element_tools?: HostTool[];
    container_tools?: HostTool[];
    tab_tools?: HostTool[];
    accordion_tools?: HostTool[];
    text_tools?: HostTool[];
    drag_handle?: 'tool' | 'drawer';
    toolbar_drag?: 'auto' | boolean;
    /** The add buttons that don't fit on the toolbar's line: behind a more button, or onto another line. Default 'menu'. */
    toolbar_overflow?: 'menu' | 'wrap';
    /** The drawers' tools that don't fit on one line: behind a more tool, or onto more lines. Default 'menu'. */
    drawer_overflow?: 'menu' | 'wrap';
    /** A click in a column or a section makes it where the toolbar's buttons add. Default false. */
    active_target?: boolean;
    /** The plugins to use, of any kind; null is every one loaded. */
    plugins?: string[] | null;
    /** The text editors offered, in order. */
    content_types?: string[];
    row_cols?: boolean;
    utilities?: Record<string, unknown>;
    /** The inline-style plugin's sections, and the options of the utilities it carries. */
    inline_style?: InlineStyleOptions;
    /** The tabs plugin: the variant of the tabs containers made new. */
    tabs?: TabsOptions;
    elements?: { enabled?: boolean | 'auto'; selector?: string; auto?: boolean };
    custom_filter?: CustomFilter | CustomFilter[] | '';
    valid_col_sizes?: ColumnSize[];
    valid_col_offsets?: number[];
    add_column?: { size?: ColumnSize | null; picker?: boolean; delay?: number };
    layout_modes?: View[];
    default_view?: View;
    /** enabled is the handle on the column's edge, tools the narrower and wider tools in its drawer. */
    resize?: { enabled?: boolean; tools?: boolean; handles?: string; balance?: 'next' | false };
    /** tools is the indent tools in a column's drawer. */
    indent?: { tools?: boolean };
    /** A textarea whose html the canvas starts with. */
    source_textarea?: Target | '';
    edit_source?: boolean;
    locale?: string;
    locale_strings?: Record<string, string>;
    callbacks?: Partial<GridEditorCallbacks>;
    confirm_delete?: boolean;
    settings_panel?: 'offcanvas' | 'popover' | 'modal' | 'inline';
    drag?: { delay?: number; touch_delay?: number; threshold?: number; animation?: number; scroll?: boolean };
    tinymce?: { config?: Record<string, unknown> };
    ckeditor?: { config?: Record<string, unknown> };
    summernote?: { config?: Record<string, unknown> };
    [plugin: string]: unknown;
}

/** Where a node was, or went: its parent and its index among the blocks there. */
export interface Position {
    parent: HTMLElement;
    index: number;
}

/** What a breakpoint said before the all view's write took it off. */
export interface Cleared {
    breakpoint: Breakpoint;
    value: string | number;
}

/** What every notification carries. */
export interface Payload {
    /** What the node is: row, column, text, plain, element, tab, accordion-item, a container's type… */
    kind: string;
    node: HTMLElement;
    /** Where the node is going, or coming from on a delete; null while it is detached. */
    parent: HTMLElement | null;
    canvas: HTMLElement;
    breakpoint: View;
    source: 'api' | 'tool' | 'dragdrop' | 'paste' | 'panel' | string;
    /** A pane inside a container. */
    container?: HTMLElement;
}

export interface MovePayload extends Payload {
    from: Position;
    to?: Position;
}

export interface ResizePayload extends Payload {
    from: ColumnSize | null;
    to: ColumnSize | null;
    cleared?: Cleared[];
}

export interface IndentPayload extends Payload {
    from: number;
    to: number;
    cleared?: Cleared[];
}

export interface UtilityPayload extends Payload {
    family: string;
    from: string | null;
    to: string | null;
    tiers: Breakpoint[];
    cleared: Cleared[];
}

export interface ConvertPayload extends Payload {
    from: 'plain';
    to: string;
}

export interface EditHtmlPayload extends Omit<Payload, 'node'> {
    node: HTMLElement | null;
    /** Every element written, which may be several. */
    nodes?: HTMLElement[];
    from: string;
    to: string;
}

export interface PopupOrphanPayload extends Payload {
    missing: string;
}

export interface ViewChangePayload {
    canvas: HTMLElement;
    breakpoint: View;
    from: View;
    to: View;
}

/** The active target changed: the column or region the toolbar adds to, or null for the canvas. */
export interface TargetChangePayload {
    canvas: HTMLElement;
    target: HTMLElement | null;
    from: HTMLElement | null;
}

/** The events, by name, with their payloads. Adding fires a specific name and the generic one. */
export interface GridEditorEventMap {
    'grideditor:before-add': Payload;
    'grideditor:after-add': Payload;
    'grideditor:before-add-row': Payload;
    'grideditor:after-add-row': Payload;
    'grideditor:before-add-column': Payload;
    'grideditor:after-add-column': Payload;
    'grideditor:before-add-text': Payload;
    'grideditor:after-add-text': Payload;
    'grideditor:before-add-element': Payload;
    'grideditor:after-add-element': Payload;
    'grideditor:before-add-container': Payload;
    'grideditor:after-add-container': Payload;
    'grideditor:before-add-tab': Payload;
    'grideditor:after-add-tab': Payload;
    'grideditor:before-add-accordion-item': Payload;
    'grideditor:after-add-accordion-item': Payload;
    'grideditor:before-add-section': Payload;
    'grideditor:after-add-section': Payload;
    'grideditor:before-delete': Payload;
    'grideditor:after-delete': Payload;
    'grideditor:before-move': MovePayload;
    'grideditor:after-move': MovePayload;
    'grideditor:before-resize': ResizePayload;
    'grideditor:after-resize': ResizePayload;
    'grideditor:before-indent': IndentPayload;
    'grideditor:after-indent': IndentPayload;
    'grideditor:before-utility': UtilityPayload;
    'grideditor:after-utility': UtilityPayload;
    'grideditor:before-convert': ConvertPayload;
    'grideditor:after-convert': ConvertPayload;
    'grideditor:before-edit-html': EditHtmlPayload;
    'grideditor:after-edit-html': EditHtmlPayload;
    'grideditor:after-copy': Payload;
    'grideditor:popup-orphan': PopupOrphanPayload;
    'grideditor:view-change': ViewChangePayload;
    'grideditor:target-change': TargetChangePayload;
}

/** An event the editor dispatches on its canvas: a CustomEvent whose detail is the payload. */
export type GridEditorEvent<K extends keyof GridEditorEventMap> = CustomEvent<GridEditorEventMap[K]>;

/** 'grideditor:before-add-row' is the callback before_add_row. */
type CallbackName<K> = K extends `grideditor:${infer Name}` ? Snake<Name> : never;
type Snake<S extends string> = S extends `${infer Head}-${infer Tail}` ? `${Head}_${Snake<Tail>}` : S;

/** The callbacks setting: the events by another route. Returning false cancels a before-*. */
export type GridEditorCallbacks = {
    [K in keyof GridEditorEventMap as CallbackName<K>]: (payload: GridEditorEventMap[K]) => boolean | void;
};

/** A plugin's factory: called once per editor with the handle in docs/plugins.md. */
export type PluginFactory = ((ge: any) => Record<string, unknown>) & { always?: boolean };

export interface CreateColumnOptions extends Placement {
    offset?: number;
    /** Html, or a node: a text of the first editor offered, or plain content with none. */
    content?: string | Node;
}

export interface CreateTextOptions extends Placement {
    content?: string | Node;
}

export interface CreateElementOptions extends Placement {
    type?: string;
    label?: string;
}

export interface CreateSectionOptions extends Placement {
    width?: 'fixed' | 'fluid' | Breakpoint;
    rows?: RowLayout[];
}

export interface PaneOptions {
    label?: string;
    [option: string]: unknown;
}

/** An editor on a canvas element. */
export declare class GridEditor {
    /**
     * An editor on `target`. An element carries one at most: asked for a
     * second, this gives back the first, with its options, and warns once.
     * Throws a TypeError when `target` is neither an element nor a selector
     * that matches one.
     */
    constructor(target: Target, options?: GridEditorOptions);

    /** The same as `new GridEditor(target, options)`. */
    static create(target: Target, options?: GridEditorOptions): GridEditor;
    /** The editor on `target`, or null. */
    static get(target: Target | null | undefined): GridEditor | null;

    static containers: Record<string, PluginFactory>;
    static features: Record<string, PluginFactory>;
    static utilities: Record<string, PluginFactory>;
    static texts: Record<string, PluginFactory>;
    static locales: Record<string, Record<string, string>>;
    /** A string from the locale `settings.locale` names, English when it has none. */
    static t(settings: { locale?: string; locale_strings?: Record<string, string> }, key: string, params?: Record<string, string | number>): string;
    /** SortableJS, for a page that imports it rather than loading it as window.Sortable. */
    static Sortable: unknown;
    /** Bootstrap's javascript (only its Modal is used), for a page with no window.bootstrap. */
    static bootstrap: { Modal?: unknown } | null;
    static version: string;

    /** The canvas element. */
    readonly canvas: HTMLElement;
    /** A read-only copy of the settings the editor runs with. */
    readonly settings: Readonly<GridEditorOptions>;

    /** The html to save: no drawers, no editor classes, no inline styles. */
    getHtml(): string;
    /** getHtml without grid-editor's marking, for publishing. It cannot be edited again as it was. */
    getPlainHtml(): string;
    /** Run the editing pass over the canvas again, after markup was put in. */
    init(): this;
    /** Take the editing furniture off, leaving the markup. */
    deinit(): this;
    /** deinit(), then init(). */
    reset(): this;
    /** Take the editor off: the markup stays, everything else goes. */
    destroy(): this;
    changeView(view: View): this;
    /** The column or region the toolbar adds to, or null. Null without active_target. */
    getActiveTarget(): HTMLElement | null;
    /** Make a column or region, or the first a selector matches, where the toolbar adds; null for none. */
    setActiveTarget(target: HTMLElement | string | null): this;
    getView(): View;
    setLocale(code: string): this;
    createRow(layout?: RowLayout, options?: Placement): HTMLElement | null;
    createColumn(size?: ColumnSize | null, options?: CreateColumnOptions): HTMLElement | null;
    createText(type?: string, options?: CreateTextOptions): HTMLElement | null;
    createText(options: CreateTextOptions): HTMLElement | null;
    createElement(content: string | Node | ArrayLike<Node>, options?: CreateElementOptions): HTMLElement | null;
    createSection(options?: CreateSectionOptions): HTMLElement | null;
    createContainer(type: 'tabs', options?: CreateTabsOptions): HTMLElement | null;
    createContainer(type: string, options?: Placement & Record<string, unknown>): HTMLElement | null;
    addTab(container: Target, options?: PaneOptions): HTMLElement | null;
    addAccordionItem(container: Target, options?: PaneOptions): HTMLElement | null;
    /** A utility's value on a node in a view (the current one by default), or null. */
    getUtility(node: Target, family: string, view?: View): string | null;
    /** Write one through the events; null is inherit. False when canceled or nothing changed. */
    setUtility(node: Target, family: string, value: string | number | null, view?: View): boolean;
}

export default GridEditor;

declare global {
    interface Window {
        GridEditor: typeof GridEditor;
    }

    interface HTMLElementEventMap extends GridEditorEventMap_ {}
}

/** The events on any element, so canvas.addEventListener('grideditor:...') is typed. */
type GridEditorEventMap_ = {
    [K in keyof GridEditorEventMap]: CustomEvent<GridEditorEventMap[K]>;
};
