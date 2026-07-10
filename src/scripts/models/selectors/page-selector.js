/**
 * Base class for page selectors. Selector decides which pages should be drawn into next repetition round,
 * and how page's progress is updated once round was completed. Concrete algorithms (Leitner, fixed
 * interval, ...) extend this class.
 */
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
   * Select ids of pages that should be drawn for next round. Subclasses can override `selectNextPile`
   * or `isPageDue` for custom logic.
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
   * Update progress once round has been submitted. Records raw attempts by default. Subclasses that need
   * extra bookkeeping (e.g. Leitner box) should call this base implementation and then update own state.
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
   * Determine whether algorithm has natural end and every page has reached it, e.g. all cards graduated
   * from Leitner system's last box. Defaults to false: most algorithms just keep repeating indefinitely.
   * @param {number[]} ids Ids of all pages in pool.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if there is nothing left to repeat, ever.
   */
  isFinished(ids, pageManager) {
    return false;
  }

  /**
   * Determine whether single page has reached this algorithm's notion of mastery, e.g. graduated from
   * Leitner system's last box. Defaults to false, matching `isFinished`'s default: most algorithms have no such
   * concept and just keep repeating page indefinitely. Subclasses that do have one should override this and
   * may then express `isFinished` in terms of it.
   * @param {number} id Page id.
   * @param {object} pageManager Page manager to read progress from.
   * @returns {boolean} True, if page is mastered.
   */
  isPageMastered(id, pageManager) {
    return false;
  }

  /**
   * Get score ratio for score/maxScore pair. Contents without task (maxScore 0) count as full pass,
   * since nothing to get wrong.
   * @param {number} score Score reached.
   * @param {number} maxScore Maximum possible score.
   * @returns {number} Score ratio between 0 and 1.
   */
  getScoreRatio(score, maxScore) {
    return computeScoreRatio(score, maxScore);
  }

  /**
   * Get score ratio required to count attempt as pass. Defaults to full score, since most algorithms
   * only ever progress page after perfect attempt. Subclasses with author-configurable threshold, e.g.
   * mastery-based one, should override this.
   * @returns {number} Pass threshold ratio between 0 and 1.
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
   * Get date when page will next be due. Returns null if page is mastered/retired and will never be
   * due again. Returns now if page is already due or never was attempted.
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
   * Limit selection of due page ids to configured maximum, keeping most overdue ones. Pages that were
   * never attempted are considered most overdue of all.
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
