/**
 * A pile is the set of pages drawn from the pool for the current repetition round, in presentation order. It is a
 * thin, read-only wrapper: all it does is remember which pages belong to the round and in what order.
 */
export default class PagePile {
  /**
   * @class
   * @param {object[]} [pages] Pages drawn for this round, in presentation order.
   */
  constructor(pages = []) {
    this.pages = pages;
  }

  /**
   * Get ids of pages in pile.
   * @returns {number[]} Page ids, in presentation order.
   */
  getIds() {
    return this.pages.map((page) => page.getIndex());
  }

  /**
   * Get pages in pile.
   * @returns {object[]} Pages, in presentation order.
   */
  getPages() {
    return this.pages;
  }
}
