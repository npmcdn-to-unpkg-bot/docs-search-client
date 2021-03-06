import * as React from 'react';
import * as ReactDOM from 'react-dom';
const {findDOMNode} = ReactDOM;

const isEqualSubset = (a, b) => {
    for (let key in a) { if (a[key] !== b[key]) { return false; } }
    return true;
};

const isEqual = (a, b) => isEqualSubset(a, b) && isEqualSubset(b, a);

const CLIENT_SIZE_KEYS = { x: 'clientWidth', y: 'clientHeight' };
const CLIENT_START_KEYS = { x: 'clientTop', y: 'clientLeft' };
const INNER_SIZE_KEYS = { x: 'innerWidth', y: 'innerHeight' };
const OFFSET_SIZE_KEYS = { x: 'offsetWidth', y: 'offsetHeight' };
const OFFSET_START_KEYS = { x: 'offsetLeft', y: 'offsetTop' };
const OVERFLOW_KEYS = { x: 'overflowX', y: 'overflowY' };
const SCROLL_SIZE_KEYS = { x: 'scrollWidth', y: 'scrollHeight' };
const SCROLL_START_KEYS = { x: 'scrollLeft', y: 'scrollTop' };
const SIZE_KEYS = { x: 'width', y: 'height' };
const NOOP = () => { ; };

interface IReactListProp {
    axis?: 'x' | 'y';
    initialIndex?: number;
    itemRenderer?: (index, key) => JSX.Element;
    itemSizeEstimator?: (index, cache) => number;
    itemSizeGetter?: (index) => number;
    itemsRenderer?: (index, key) => JSX.Element;
    length?: number;
    pageSize?: number;
    scrollParentGetter?: () => Element | Window;
    threshold?: number;
    useStaticSize?: boolean;
    useTranslate3d?: boolean;
}

export default React.createClass<IReactListProp, { from: number, size: number, itemsPerRow: number }>({
    displayName: 'ReactList',
    cache: {},
    // private items: React.ReactInstance;
    // private cache = {};
    // private scrollParent;

    // constructor(props: IReactListProp) {
    //     super(props);
    //     this.props = createMergedResultFunction(this.props, this.getDefaultProps())();
    //     const {initialIndex, pageSize} = this.props;
    //     const itemsPerRow = 1;
    //     const {from, size} = this.constrain(initialIndex, pageSize, itemsPerRow, this.props);
    //     this.state = { from, size, itemsPerRow };
    // }
    getDefaultProps(): IReactListProp {
        return {
            axis: 'y',
            initialIndex: 0,
            itemRenderer: (index, key) => (<div key={key}>{index}</div>),
            itemsRenderer: (items, ref) => (<div ref={ref}>{items}</div>),
            length: 0,
            pageSize: 10,
            threshold: 100,
            useStaticSize: false,
            useTranslate3d: false,
        };
    },
    getInitialState() {
        const {initialIndex, pageSize} = this.props;
        const itemsPerRow = 1;
        const {from, size} = this.constrain(initialIndex, pageSize, itemsPerRow, this.props);
        return { from, size, itemsPerRow };
    },
    componentWillReceiveProps(next) {
        let {from, size, itemsPerRow} = this.state;
        this.setState(this.constrain(from, size, itemsPerRow, next));
    },

    componentDidMount() {
        window.addEventListener('resize', this.updateFrame);
        this.updateFrame(this.scrollTo.bind(this, this.props.initialIndex));
    },

    shouldComponentUpdate(props, state) {
        return !isEqual(props, this.props) || !isEqual(state, this.state);
    },

    componentDidUpdate() {
        this.updateFrame(NOOP);
    },

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateFrame);
        this.scrollParent.removeEventListener('scroll', this.updateFrame);
        this.scrollParent.removeEventListener('mousewheel', NOOP);
    },

    getOffset(el) {
        const {axis} = this.props;
        let offset = el[CLIENT_START_KEYS[axis]] || 0;
        const offsetKey = OFFSET_START_KEYS[axis];
        do { offset += el[offsetKey] || 0; } while (el = el.offsetParent);
        return offset;
    },

    getScrollParent() {
        const {axis, scrollParentGetter} = this.props;
        if (scrollParentGetter) { return scrollParentGetter(); }
        let el = findDOMNode(this);
        const overflowKey = OVERFLOW_KEYS[axis];
        while (el = el.parentElement) {
            switch (window.getComputedStyle(el)[overflowKey]) {
                case 'auto':
                case 'scroll':
                case 'overlay':
                    return el;
                default: continue;
            }
        }
        return window;
    },

    getScroll() {
        const {scrollParent} = this;
        const {axis} = this.props;
        const scrollKey = SCROLL_START_KEYS[axis];
        const actual = scrollParent === window ?
            // Firefox always returns document.body[scrollKey] as 0 and Chrome/Safari
            // always return document.documentElement[scrollKey] as 0, so take
            // whichever has a value.
            document.body[scrollKey] || document.documentElement[scrollKey] :
            scrollParent[scrollKey];
        const max = this.getScrollSize() - this.getViewportSize();
        const scroll = Math.max(0, Math.min(actual, max));
        const el = findDOMNode(this);
        return this.getOffset(scrollParent) + scroll - this.getOffset(el);
    },

    setScroll(offset) {
        const {scrollParent} = this;
        const {axis} = this.props;
        offset += this.getOffset(findDOMNode(this));
        if (scrollParent === window) { return window.scrollTo(0, offset); }

        offset -= this.getOffset(this.scrollParent);
        scrollParent[SCROLL_START_KEYS[axis]] = offset;
    },

    getViewportSize() {
        const {scrollParent} = this;
        const {axis} = this.props;
        return scrollParent === window ?
            window[INNER_SIZE_KEYS[axis]] :
            scrollParent[CLIENT_SIZE_KEYS[axis]];
    },

    getScrollSize() {
        const {scrollParent} = this;
        const {body, documentElement} = document;
        const key = SCROLL_SIZE_KEYS[this.props.axis];
        return scrollParent === window ?
            Math.max(body[key], documentElement[key]) :
            scrollParent[key];
    },

    hasDeterminateSize() {
        const {itemSizeGetter, type} = this.props;
        return type === 'uniform' || itemSizeGetter;
    },

    getStartAndEnd(threshold = this.props.threshold) {
        const scroll = this.getScroll();
        const start = Math.max(0, scroll - threshold);
        let end = scroll + this.getViewportSize() + threshold;
        if (this.hasDeterminateSize()) {
            end = Math.min(end, this.getSpaceBefore(this.props.length));
        }
        return { start, end };
    },

    getItemSizeAndItemsPerRow(): { itemSize: number, itemsPerRow: number } {
        const {axis, useStaticSize} = this.props;
        let {itemSize, itemsPerRow} = this.state;
        if (useStaticSize && itemSize && itemsPerRow) {
            return { itemSize, itemsPerRow };
        }
        let itemsEle = findDOMNode(this.items);
        const itemEls = itemsEle ? itemsEle.childNodes : [];
        if (!itemEls.length) { return { itemSize: 0, itemsPerRow: 0 }; }

        const firstEl = itemEls[0];

        // Firefox has a problem where it will return a *slightly* (less than
        // thousandths of a pixel) different size for the same element between
        // renders. This can cause an infinite render loop, so only change the
        // itemSize when it is significantly different.
        const firstElSize = firstEl[OFFSET_SIZE_KEYS[axis]];
        const delta = Math.abs(firstElSize - itemSize);
        if (isNaN(delta) || delta >= 1) { itemSize = firstElSize; }

        if (!itemSize) { return { itemSize: 0, itemsPerRow: 0 }; }

        const startKey = OFFSET_START_KEYS[axis];
        const firstStart = firstEl[startKey];
        itemsPerRow = 1;
        for (
            let item = itemEls[itemsPerRow];
            item && item[startKey] === firstStart;
            item = itemEls[itemsPerRow]
        ) { ++itemsPerRow; }

        return { itemSize, itemsPerRow };
    },

    updateFrame(cb) {
        this.updateScrollParent();
        if (typeof cb !== 'function') { cb = NOOP; }
        return this.updateSimpleFrame(cb);
    },

    updateScrollParent() {
        const prev = this.scrollParent;
        this.scrollParent = this.getScrollParent();
        if (prev === this.scrollParent) { return; }
        if (prev) {
            prev.removeEventListener('scroll', this.updateFrame);
            prev.removeEventListener('mousewheel', NOOP);
        }
        this.scrollParent.addEventListener('scroll', this.updateFrame);
        this.scrollParent.addEventListener('mousewheel', NOOP);
    },

    updateSimpleFrame(cb) {
        const {end} = this.getStartAndEnd();
        const itemEls = findDOMNode(this.items).childNodes;
        let elEnd = 0;

        if (itemEls.length) {
            const {axis} = this.props;
            const firstItemEl = itemEls[0];
            const lastItemEl = itemEls[itemEls.length - 1];
            elEnd = this.getOffset(lastItemEl) + lastItemEl[OFFSET_SIZE_KEYS[axis]] -
                this.getOffset(firstItemEl);
        }

        if (elEnd > end) { return cb(); }

        const {pageSize, length} = this.props;
        this.setState({ size: Math.min(this.state.size + pageSize, length) }, cb);
    },

    getSpaceBefore(index, cache = {}) {
        if (cache[index] != null) { return cache[index]; }

        // Try the static itemSize.
        const {itemSize, itemsPerRow} = this.state;
        if (itemSize) {
            return cache[index] = Math.floor(index / itemsPerRow) * itemSize;
        }

        // Find the closest space to index there is a cached value for.
        let from = index;
        while (from > 0 && cache[--from] == null) { ; }

        // Finally, accumulate sizes of items from - index.
        let space = cache[from] || 0;
        for (let i = from; i < index; ++i) {
            cache[i] = space;
            const itemSize = this.getSizeOf(i);
            if (itemSize == null) { break; }
            space += itemSize;
        }

        return cache[index] = space;
    },

    cacheSizes() {
        const {cache} = this;
        const {from} = this.state;
        const itemEls = findDOMNode(this.items).childNodes;
        const sizeKey = OFFSET_SIZE_KEYS[this.props.axis];
        for (let i = 0, l = itemEls.length; i < l; ++i) {
            cache[from + i] = itemEls[i][sizeKey];
        }
    },

    getSizeOf(index) {
        const {cache, items} = this;
        const {axis, itemSizeGetter, itemSizeEstimator, type} = this.props;
        const {from, itemSize, size} = this.state;

        // Try the static itemSize.
        if (itemSize) { return itemSize; }

        // Try the itemSizeGetter.
        if (itemSizeGetter) { return itemSizeGetter(index); }

        // Try the cache.
        if (index in cache) { return cache[index]; }

        // Try the DOM.
        if (type === 'simple' && index >= from && index < from + size && items) {
            const itemEl = findDOMNode(items).childNodes[index - from];
            if (itemEl) { return itemEl[OFFSET_SIZE_KEYS[axis]]; }
        }

        // Try the itemSizeEstimator.
        if (itemSizeEstimator) { return itemSizeEstimator(index, cache); }
    },

    constrain(from, size, itemsPerRow, props) {
        const {length = 0, pageSize = 0, type = 'simple'} = props;
        size = Math.max(size, pageSize);
        let mod = size % itemsPerRow;
        if (mod) { size += itemsPerRow - mod; }
        if (size > length) { size = length; }
        from =
            type === 'simple' || !from ? 0 :
                Math.max(Math.min(from, length - size), 0);

        if (mod = from % itemsPerRow) {
            from -= mod;
            size += mod;
        }

        return { from, size };
    },

    scrollTo(index) {
        if (index != null) { this.setScroll(this.getSpaceBefore(index)); }
    },

    renderItems() {
        const {itemRenderer, itemsRenderer} = this.props;
        const {from, size} = this.state;
        const items = [];
        for (let i = 0; i < size; ++i) { items.push(itemRenderer(from + i, i)); }
        return itemsRenderer(items, c => this.items = c);
    },
    render() {
        const {axis, length, type, useTranslate3d} = this.props;
        const {from, itemsPerRow} = this.state;

        const items = this.renderItems();
        if (type === 'simple') { return items; }

        const style = { position: 'relative' };
        const cache = {};
        const bottom = Math.ceil(length / itemsPerRow) * itemsPerRow;
        const size = this.getSpaceBefore(bottom, cache);
        if (size) {
            style[SIZE_KEYS[axis]] = size;
            // if (axis === 'x') { style.overflowX = 'hidden'; }
        }
        const offset = this.getSpaceBefore(from, cache);
        const x = axis === 'x' ? offset : 0;
        const y = axis === 'y' ? offset : 0;
        const transform =
            useTranslate3d ?
                `translate3d(${x}px, ${y}px, 0)` :
                `translate(${x}px, ${y}px)`;
        const listStyle = {
            msTransform: transform,
            WebkitTransform: transform,
            transform,
        };
        return <div className="ReactList" {...{ style }}><div style={listStyle}>{items}</div></div>;
    },
});
