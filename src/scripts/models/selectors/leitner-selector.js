import PageSelector from './page-selector.js';
import { extend } from '@services/util.js';

/** @constant {number[]} DEFAULT_BOX_INTERVALS_DAYS Default box intervals in days. */
// eslint-disable-next-line no-magic-numbers
const DEFAULT_BOX_INTERVALS_DAYS = [1, 2, 3, 7, 14, 30];

/**
 * Leitner-style selector. Every page sits in a box. A page moves up a box once it reached a full score often
 * enough in a row, and drops back to the first box after any imperfect attempt. Each box has its own waiting
 * period before a page in it is due again.
 */
export default class LeitnerSelector extends PageSelector {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {number[]} params.boxIntervalsDays Days to wait per box before a page in it is due again.
   * @param {number} [params.promotionStreak] Consecutive full scores required to advance a box.
   * @param {number} [params.maxPagesPerRound] Maximum number of pages to draw per round.
   */
  constructor(params = {}) {
    super(params);

    // Apply defaults using extend pattern
    params = extend({
      boxIntervalsDays: DEFAULT_BOX_INTERVALS_DAYS,
    }, params);
  }

  /**
   * Draw pages due for repetition into next round.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {number[]} Ids to draw for next round.
   */
  selectNextPile(ids, pageManager, now = new Date()) {
    const dueIds = ids.filter((id) => this.isDue(id, pageManager, now));

    return this.limitSelection(dueIds, pageManager, now);
  }

  /**
   * Determine whether page is due, based on box it is currently in.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} now Reference date.
   * @returns {boolean} True, if the page is due.
   */
  isDue(id, pageManager, now) {
    if (pageManager.getAttemptCount(id) === 0) {
      return true;
    }

    const box = this.getBox(id, pageManager);
    const intervalDays = this.params.boxIntervalsDays[box] ??
      this.params.boxIntervalsDays[this.params.boxIntervalsDays.length - 1];

    return pageManager.getDaysSinceLastAttempt(id, now) >= intervalDays;
  }

  /**
   * Get box a page is currently in.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read state from.
   * @returns {number} Box index, 0-based.
   */
  getBox(id, pageManager) {
    return pageManager.getSelectorState(id).box ?? 0;
  }

  /**
   * Get waiting period in days for page's current box.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {number} Interval in days.
   */
  getIntervalDays(id, pageManager) {
    const box = this.getBox(id, pageManager);
    return this.params.boxIntervalsDays[box] ??
      this.params.boxIntervalsDays[this.params.boxIntervalsDays.length - 1];
  }

  /**
   * Update page box and streak after round completion.
   * @param {object} pageManager Page manager to update.
   * @param {object[]} results One result per page in completed round.
   */
  onRoundCompleted(pageManager, results) {
    super.onRoundCompleted(pageManager, results);

    const topBox = this.params.boxIntervalsDays.length - 1;

    results.forEach((result) => {
      const state = pageManager.getSelectorState(result.id);
      const box = state.box ?? 0;

      if (!this.isScoreBeyondThreshold(result.score, result.maxScore)) {
        pageManager.setSelectorState(result.id, { box: 0, streak: 0 });
        return;
      }

      const streak = (state.streak ?? 0) + 1;

      if (box < topBox && streak >= (this.params.promotionStreak ?? 1)) {
        pageManager.setSelectorState(result.id, { box: box + 1, streak: 0 });
      }
      else {
        pageManager.setSelectorState(result.id, { box: box, streak: streak });
      }
    });
  }

  /**
   * Check whether all pages have been mastered.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if there is nothing left to repeat, ever.
   */
  isFinished(ids, pageManager) {
    return ids.every((id) => this.isPageMastered(id, pageManager));
  }

  /**
   * Determine whether page has graduated to top box and held it for required streak.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if page is mastered.
   */
  isPageMastered(id, pageManager) {
    const topBox = this.params.boxIntervalsDays.length - 1;
    const state = pageManager.getSelectorState(id);

    return (state.box ?? 0) === topBox && (state.streak ?? 0) >= (this.params.promotionStreak ?? 1);
  }
}
