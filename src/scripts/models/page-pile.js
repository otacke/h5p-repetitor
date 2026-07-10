/** Tracks which pages belong to the current round and their presentation order. */
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
