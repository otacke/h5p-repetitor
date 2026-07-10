/** Base class deciding which pages enter next round and updating progress after completion. */
import { MS_PER_DAY } from '@models/page-manager.js';
import { getScoreRatio as computeScoreRatio } from '@services/util.js';

export default class PageSelector {
  /**
   * @class
   * @param {object} [params] Algorithm-specific parameters, see subclasses.
   * @param {number} [params.maxPagesPerRound] Maximum number of pages to draw per round.
   */
  constructor(params = {}) {
    this.params = params;
  }

  /**
   * Select pages for next round, subclasses override selectNextPile or isPageDue for custom logic.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {number[]} Ids to draw for next round.
   */
  selectNextPile(ids, pageManager, now = new Date()) {
    const dueIds = ids.filter((id) => this.isPageDue(id, pageManager, now));

    return this.limitSelection(dueIds, pageManager, now);
  }

  /**
   * Determine whether a single page is due for repetition. Override for custom logic.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager.
   * @param {Date} now Reference date.
   * @returns {boolean} True if page is due.
   */
  isPageDue(id, pageManager, now) {
    const daysSinceLastAttempt = pageManager.getDaysSinceLastAttempt(id, now);
    return daysSinceLastAttempt === null || daysSinceLastAttempt >= (this.params.intervalDays ?? 0);
  }

  /**
   * Record raw attempts after round submission, subclasses update own state after calling this.
   * @param {object} pageManager Page manager to update.
   * @param {object[]} results One result per page in completed round.
   * @param {number} results[].id Page id.
   * @param {number} results[].score Score reached.
   * @param {number} results[].maxScore Maximum possible score.
   */
  onRoundCompleted(pageManager, results) {
    results.forEach((result) => {
      pageManager.recordAttempt(result.id, { score: result.score, maxScore: result.maxScore });
    });
  }

  /**
   * True when algorithm reached natural end, e.g. all pages graduated from last box.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if there is nothing left to repeat, ever.
   */
  isFinished(ids, pageManager) {
    return false;
  }

  /**
   * Check whether page reached mastery, default false, subclasses override.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if page is mastered.
   */
  isPageMastered(id, pageManager) {
    return false;
  }

  /**
   * Get score ratio for score/maxScore pair. Contents without task (maxScore 0) count as full pass.
   * @param {number} score Score reached.
   * @param {number} maxScore Maximum possible score.
   * @returns {number} Score ratio between 0 and 1.
   */
  getScoreRatio(score, maxScore) {
    return computeScoreRatio(score, maxScore);
  }

  /**
   * Get pass threshold ratio. Defaults to full score. Subclasses should override for configurable thresholds.
   * @returns {number} Threshold ratio.
   */
  getPassThreshold() {
    return 1;
  }

  /**
   * Determine whether score reached threshold required to pass page, under this selector's algorithm.
   * @param {number} score Score reached.
   * @param {number} maxScore Maximum possible score.
   * @returns {boolean} True, if score counts as pass.
   */
  isScoreBeyondThreshold(score, maxScore) {
    return this.getScoreRatio(score, maxScore) >= this.getPassThreshold();
  }

  /**
   * Get next due date, null when mastered/retired, now when never attempted.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} now Reference date.
   * @returns {Date|null} Next due date, or null if page is mastered/retired.
   */
  getNextDueDate(id, pageManager, now) {
    if (this.isPageMastered(id, pageManager)) {
      return null;
    }

    const history = pageManager.getHistory(id);

    if (!history.length) {
      return now;
    }

    const lastAttemptDate = new Date(history[history.length - 1].timestamp);
    const intervalDays = this.getIntervalDays(id, pageManager);

    return new Date(lastAttemptDate.getTime() + intervalDays * MS_PER_DAY);
  }

  /**
   * Get number of days to wait before page is due again. Subclasses should override.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {number} Interval in days.
   */
  getIntervalDays(id, pageManager) {
    return 0;
  }

  /**
   * Limit selection of due page ids to configured maximum, keeping most overdue ones.
   * @param {number[]} ids Ids that are due.
   * @param {object} pageManager Page manager to read attempt history from.
   * @param {Date} now Reference date to compute staleness against.
   * @returns {number[]} Ids to actually draw.
   */
  limitSelection(ids, pageManager, now) {
    if (!this.params.maxPagesPerRound || ids.length <= this.params.maxPagesPerRound) {
      return ids;
    }

    return [...ids]
      .sort((idA, idB) => {
        const staleA = pageManager.getDaysSinceLastAttempt(idA, now) ?? Infinity;
        const staleB = pageManager.getDaysSinceLastAttempt(idB, now) ?? Infinity;
        return staleB - staleA;
      })
      .slice(0, this.params.maxPagesPerRound);
  }
}
