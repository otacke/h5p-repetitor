import { extend } from '@services/util.js';
import Page from '@components/page/page.js';

/**
 * Catalog of all potential pages for spaced repetition.
 *
 * PagePool only knows page definitions and how to turn one into live `Page` instance. It holds no progress
 * information of its own, and it instantiates page's exercise lazily, on first draw, so that having large
 * pool does not mean instantiating every exercise up front.
 */
export default class PagePool {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} params.dictionary Dictionary instance.
   * @param {object} params.globals Globals.
   * @param {object[]} params.contents Content definitions. The array index of an entry is its page id.
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onAnswerStateChanged] Called when a drawn page's answer state changed.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = extend({
      contents: [],
    }, params);

    this.callbacks = extend({
      onAnswerStateChanged: () => {},
    }, callbacks);

    this.instances = {};
  }

  /**
   * Draw page from pool, instantiating its exercise lazily on first draw.
   * @param {number} id Page id to draw.
   * @returns {Page} Page instance.
   */
  draw(id) {
    if (!this.instances[id]) {
      this.instances[id] = new Page(
        {
          dictionary: this.params.dictionary,
          globals: this.params.globals,
          index: id,
          libraryParams: this.params.contents[id].libraryParams,
        },
        {
          onAnswerStateChanged: (index, isAnswered) => {
            this.callbacks.onAnswerStateChanged(index, isAnswered);
          },
        },
      );
    }

    return this.instances[id];
  }

  /**
   * Get ids of all pages in the pool.
   * @returns {number[]} Page ids.
   */
  getIds() {
    return [...this.params.contents.keys()];
  }

  /**
   * Get all pages that have been drawn from pool so far in this session, regardless of current pile.
   * @returns {Page[]} Instantiated pages.
   */
  getInstantiatedPages() {
    return Object.values(this.instances);
  }
}
