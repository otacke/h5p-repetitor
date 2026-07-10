import { extend } from '@services/util.js';
import H5PContent from './h5p-content.js';
import './page.scss';

export default class Page {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {number} params.index Index of page.
   * @param {object} params.libraryParams Library parameters for content.
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onAnswerStateChanged] Call on instances answer state changed.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = extend({
      libraryParams: {},
    }, params);

    this.callbacks = extend({
      onAnswerStateChanged: () => {},
    }, callbacks);

    this.isAnsweredState = false;

    this.nextTransitionId = 0;
    this.transitionCallbacks = {};

    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-repetitor-page');
    this.setPosition(1); // 1 = Future to allow initial slide in from right

    this.h5pContent = new H5PContent(
      {
        dictionary: params.dictionary,
        globals: params.globals,
        index: params.index,
        libraryParams: params.libraryParams,
      },
      {
        onAnswerStateChanged: (isAnswered) => {
          this.setAnswered(isAnswered);
        },
      },
    );
    this.dom.append(this.h5pContent.getDOM());
    this.title = this.h5pContent.getTitle();
  }

  /**
   * Set position.
   * @param {number} position negative = past, 0 = present, positive = future.
   */
  setPosition(position) {
    this.dom.classList.toggle('past', position < 0);
    this.dom.classList.toggle('present', position === 0);
    this.dom.classList.toggle('future', position > 0);
  }

  /**
   * Set answered.
   * @param {boolean} isAnswered True to set answered, false to set unanswered.
   */
  setAnswered(isAnswered) {
    this.isAnsweredState = isAnswered;
    this.callbacks.onAnswerStateChanged(this.getIndex(), isAnswered);
  }

  /**
   * Get page index.
   * @returns {number} Page index.
   */
  getIndex() {
    return this.params.index;
  }

  /**
   * Set focus to first focusable element.
   * @returns {boolean} True if could focus on first child, else false.
   */
  focusFirstChild() {
    return this.h5pContent.focusFirstChild();
  }

  /**
   * Check if result has been submitted or input has been given.
   * @returns {boolean} True, if answer was given.
   */
  getAnswerGiven() {
    return this.h5pContent.getAnswerGiven();
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return {
      contentState: this.h5pContent.getCurrentState(),
      wasAnswered: this.isAnsweredState,
    };
  }

  /**
   * Get DOM.
   * @returns {HTMLElement} Content DOM.
   */
  getDOM() {
    return this.dom;
  }

  /**
   * Get maximum possible score.
   * @returns {number} Score necessary for mastering.
   */
  getMaxScore() {
    return this.h5pContent.getMaxScore();
  }

  /**
   * Get current score.
   * @returns {number} Current score.
   */
  getScore() {
    return this.h5pContent.getScore();
  }

  /**
   * Get title.
   * @returns {string} title.
   */
  getTitle() {
    return this.title;
  }

  /**
   * Get xAPI data from exercises.
   * @returns {object} XAPI data objects used to build report.
   */
  getXAPIData() {
    return this.h5pContent.getXAPIData();
  }

  /**
   * Determine whether page holds task.
   * @returns {boolean} True if page holds task, else false.
   */
  holdsTask() {
    return this.h5pContent.isTask();
  }

  /**
   * Register callback to call once next transition has ended.
   * @param {function} callback Callback when transition has ended.
   */
  registerTransitionEnd(callback) {
    if (typeof callback !== 'function') {
      return; // No valid callback
    }

    this.dom.addEventListener('transitionend', callback, { once: true });
  }

  /**
   * Reset.
   */
  reset() {
    this.h5pContent.reset();
    this.isAnsweredState = false;
  }

  /**
   * Show solutions.
   */
  showSolutions() {
    this.h5pContent.showSolutions();
  }

  /**
   * Update page.
   * @param {object} [params] Parameters.
   */
  update(params = {}) {
    if (typeof params.visible === 'boolean') {
      this.dom.classList.toggle('display-none', !params.visible);
    }
  }

  /**
   * Determine whether page was answered or not.
   * @returns {boolean} True if page was answered, else false.
   */
  wasAnswered() {
    return this.isAnsweredState;
  }
}
