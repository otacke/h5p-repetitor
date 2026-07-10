import PageSelector from './page-selector.js';
import { extend } from '@services/util.js';

/** @constant {number} DEFAULT_MASTERY_PASS_THRESHOLD_PERCENT Default mastery pass threshold in percent. */
const DEFAULT_MASTERY_PASS_THRESHOLD_PERCENT = 80;

/** @constant {number} DEFAULT_MASTERY_REQUIRED_PASSES Default consecutive passes required to master a page. */
const DEFAULT_MASTERY_REQUIRED_PASSES = 2;

/** Drilling selector: page retried each round until passed enough consecutive times, then retired. */
export default class MasteryThresholdSelector extends PageSelector {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {number} params.passThreshold Score ratio (0..1) required to count an attempt as a pass.
   * @param {number} params.requiredConsecutivePasses Consecutive passes required to master a page.
   * @param {number} [params.intervalDays] Days to wait before a page is due again. Defaults to 0 (no waiting).
   * @param {number} [params.maxPagesPerRound] Maximum number of pages to draw per round.
   */
  constructor(params = {}) {
    super(params);

    params = extend({
      passThreshold: DEFAULT_MASTERY_PASS_THRESHOLD_PERCENT / 100,
      requiredConsecutivePasses: DEFAULT_MASTERY_REQUIRED_PASSES,
      intervalDays: 0,
    }, params);
  }

  /**
   * Determine whether page is due, excluding mastered pages.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager.
   * @param {Date} now Reference date.
   * @returns {boolean} True if page is due.
   */
  isPageDue(id, pageManager, now) {
    if (this.isPageMastered(id, pageManager)) {
      return false;
    }

    if (this.params.intervalDays === 0) {
      return true;
    }

    return super.isPageDue(id, pageManager, now);
  }

  /**
   * Determine whether page has reached required number of consecutive passes.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if page is mastered.
   */
  isPageMastered(id, pageManager) {
    return pageManager.getStreak(id, this.getPassThreshold()) >= this.params.requiredConsecutivePasses;
  }

  /**
   * Get author-configured score ratio required to count as a pass.
   * @returns {number} Author-configured pass threshold ratio between 0 and 1.
   */
  getPassThreshold() {
    return this.params.passThreshold / 100;
  }

  /**
   * Get waiting period in days between attempts.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager.
   * @returns {number} Interval in days.
   */
  getIntervalDays(id, pageManager) {
    return this.params.intervalDays;
  }

  /**
   * Check whether all pages have reached required consecutive passes.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if there is nothing left to repeat, ever.
   */
  isFinished(ids, pageManager) {
    return ids.every((id) => this.isPageMastered(id, pageManager));
  }
}
