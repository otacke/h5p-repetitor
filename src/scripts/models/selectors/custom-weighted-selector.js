import PageSelector from './page-selector.js';
import { extend } from '@services/util.js';

/** Author-configurable weighted page selector combining staleness, accuracy, and frequency signals. */
export default class CustomWeightedSelector extends PageSelector {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} params.weights Weights to combine into a priority score.
   * @param {number} params.weights.staleness Weight for days since last attempt.
   * @param {number} params.weights.lastScore Weight for a low last score.
   * @param {number} params.weights.averageScore Weight for a low average score.
   * @param {number} params.weights.attemptCount Weight for a low attempt count.
   * @param {number} [params.intervalDays] Days to wait before a page is due again. Defaults to 0 (no waiting).
   * @param {number} [params.maxPagesPerRound] Maximum number of pages to draw per round.
   */
  constructor(params = {}) {
    super(params);

    // Apply defaults using extend pattern
    params = extend({
      intervalDays: 0,
    }, params);
  }

  /**
   * Draw highest-priority pages into next round.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {number[]} Ids to draw for next round.
   */
  selectNextPile(ids, pageManager, now = new Date()) {
    const dueIds = ids.filter((id) => {
      if (this.params.intervalDays === 0) {
        return true;
      }

      const daysSinceLastAttempt = pageManager.getDaysSinceLastAttempt(id, now);

      return daysSinceLastAttempt === null || daysSinceLastAttempt >= this.params.intervalDays;
    });

    const maxCount = this.params.maxPagesPerRound || dueIds.length;

    return [...dueIds]
      .sort((idA, idB) => this.getPriority(idB, pageManager, now) - this.getPriority(idA, pageManager, now))
      .slice(0, maxCount);
  }

  /**
   * Get configured waiting period in days between attempts.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager.
   * @returns {number} Interval in days.
   */
  getIntervalDays(id, pageManager) {
    return this.params.intervalDays;
  }

  /**
   * Compute priority score for page, higher means more due, never-attempted pages get highest priority.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @param {Date} now Reference date.
   * @returns {number} Priority score.
   */
  getPriority(id, pageManager, now) {
    if (pageManager.getAttemptCount(id) === 0) {
      return Infinity;
    }

    const weights = this.params.weights;

    return (
      weights.staleness * pageManager.getDaysSinceLastAttempt(id, now) +
      weights.lastScore * (1 - pageManager.getLastScoreRatio(id)) +
      weights.averageScore * (1 - pageManager.getAverageScoreRatio(id)) +
      weights.attemptCount * (1 / (pageManager.getAttemptCount(id) + 1))
    );
  }
}
