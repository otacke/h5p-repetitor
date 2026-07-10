import { extend } from '@services/util.js';
import './progress-indicator.scss';

/**
 * Parse string to integer.
 * @param {string} string String to parse to integer.
 * @returns {number|'-'} Parsed integer or '-'.
 */
const getIntegerFromString = (string) => {
  let value = string;

  if (typeof string === 'string') {
    value = parseInt(string);
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    value = '-';
  }

  return value;
};

export default class ProgressIndicator {

  constructor(params = {}) {
    this.params = extend({
      delimiter: '/',
      roundTemplate: '(@round)',
      hasPage: true,
      hasRound: false,
    }, params);

    if (this.params.hasPage) {
      this.params.roundTemplate = `(${this.params.roundTemplate})`;
    }

    this.dom = document.createElement('div');
    this.dom.classList.add('progress-indicator');

    const page = document.createElement('span');
    page.classList.add('progress-indicator-page');
    page.classList.toggle('display-none', !this.params.hasPage);

    this.current = document.createElement('span');
    this.current.classList.add('progress-indicator-number');
    this.setCurrent(this.params.current);
    page.append(this.current);

    const delimiter = document.createElement('span');
    delimiter.classList.add('progress-indicator-delimiter');
    if (typeof this.params.delimiter === 'string') {
      delimiter.innerText = this.params.delimiter;
    }
    page.append(delimiter);

    this.total = document.createElement('span');
    this.total.classList.add('progress-indicator-number');
    this.setTotal(this.params.total);
    page.append(this.total);

    this.dom.append(page);

    const round = document.createElement('span');
    round.classList.add('progress-indicator-round');
    round.classList.toggle('display-none', !this.params.hasRound);

    this.round = document.createElement('span');
    this.round.classList.add('progress-indicator-number');
    this.setRound(this.params.round);
    round.append(this.round);

    this.dom.append(round);
  }

  /**
   * Set current value.
   * @param {string} value Value.
   */
  setCurrent(value) {
    const parsedValue = getIntegerFromString(value);
    this.current.innerText = parsedValue.toString();
  }

  /**
   * Set total value.
   * @param {string} value Value.
   */
  setTotal(value) {
    const parsedValue = getIntegerFromString(value);
    this.total.innerText = parsedValue.toString();
  }

  /**
   * Set round value.
   * @param {string} value Value.
   */
  setRound(value) {
    const parsedValue = getIntegerFromString(value);
    this.round.innerText = this.params.roundTemplate.replace('@round', parsedValue.toString());
  }

  /**
   * Get DOM.
   * @returns {HTMLElement} Progress indicator DOM.
   */
  getDOM() {
    return this.dom;
  }
}
