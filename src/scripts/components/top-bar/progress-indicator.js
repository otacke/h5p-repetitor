import { extend } from '@services/util.js';
import './progress-indicator.scss';

/**
 * Get integer from string;
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
    this.params = extend(params, {
      delimiter: '/',
    });

    this.dom = document.createElement('div');
    this.dom.classList.add('progress-indicator');

    this.current = document.createElement('span');
    this.current.classList.add('progress-indicator-number');
    this.setCurrent(this.params.current);
    this.dom.append(this.current);

    const delimiter = document.createElement('span');
    delimiter.classList.add('progress-indicator-delimiter');
    if (typeof this.params.delimiter === 'string') {
      delimiter.innerText = this.params.delimiter;
    }
    this.dom.append(delimiter);

    this.total = document.createElement('span');
    this.total.classList.add('progress-indicator-number');
    this.setTotal(this.params.total);
    this.dom.append(this.total);
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
   * Get DOM.
   * @returns {HTMLElement} Progress indicator DOM.
   */
  getDOM() {
    return this.dom;
  }
}
