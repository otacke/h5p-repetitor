import { extend } from '@services/util.js';
import ProgressIndicator from './progress-indicator.js';
import './top-bar.scss';

export default class TopBar {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {string} [params.position] Extra borders.
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onClickButtonLeft] Callback for left button.
   * @param {function} [callbacks.onClickButtonRight] Callback for right button.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = extend({
    }, params);

    // Build DOM
    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-repetitor-top-bar');

    this.roundAnnouncer = document.createElement('div');
    this.roundAnnouncer.classList.add('h5p-repetitor-page-announcer');

    if (this.params.announcePage) {
      this.progressIndicator = new ProgressIndicator();
      this.roundAnnouncer.append(this.progressIndicator.getDOM());
    }

    if (this.params.announceContent) {
      this.title = document.createElement('span');
      this.title.classList.add('h5p-repetitor-page-announcer-title');
      this.roundAnnouncer.append(this.title);
    }

    this.dom.append(this.roundAnnouncer);
  }

  /**
   * Return the DOM for this class.
   * @returns {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.dom;
  }

  /**
   * Set current value of progress indicator.
   * @param {number} value Current value.
   */
  setIndicatorCurrent(value) {
    this.progressIndicator?.setCurrent(value);
  }

  /**
   * Set total value of progress indicator.
   * @param {number} value Total value.
   */
  setIndicatorTotal(value) {
    this.progressIndicator?.setTotal(value);
  }

  /**
   * Set title text.
   * @param {string} text Title text.
   */
  setTitle(text) {
    if (!this.title) {
      return;
    }

    if (typeof text !== 'string') {
      return;
    }

    this.title.innerText = text;
  }
}
