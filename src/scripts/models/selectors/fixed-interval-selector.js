import PageSelector from './page-selector.js';
import { extend } from '@services/util.js';

/** @constant {number} DEFAULT_FIXED_INTERVAL_DAYS Default fixed interval in days. */
const DEFAULT_FIXED_INTERVAL_DAYS = 1;

/** Fixed-interval selector: pages become due a fixed number of days after their last attempt. */
export default class FixedIntervalSelector extends PageSelector {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {number} params.intervalDays Days to wait before a page is due again.
   * @param {number} [params.maxPagesPerRound] Maximum number of pages to draw per round.
   */
  constructor(params = {}) {
    super(params);

    params = extend({
      intervalDays: DEFAULT_FIXED_INTERVAL_DAYS,
    }, params);
  }

  /**
   * Get fixed waiting period in days between attempts.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager.
   * @returns {number} Interval in days.
   */
  getIntervalDays(id, pageManager) {
    return this.params.intervalDays;
  }
}
