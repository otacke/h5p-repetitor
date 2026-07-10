import PagePile from './page-pile.js';
import { randomize } from '@services/util.js';

/** Orchestrates four subsystems behind a round-centric facade. */
export default class SpacedRepetitionController {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} params.pagePool Pool holding all potential pages.
   * @param {object} params.pageManager Manager holding per-page progress.
   * @param {object} params.selector Selector determining which pages are due.
   * @param {object} params.roundController Controller gating when a new round may start.
   * @param {object[]} [params.lastRoundResults] Results of the most recently completed round, to restore.
   */
  constructor(params = {}) {
    this.params = params;
    this.currentPile = null;
    this.lastRoundResults = params.lastRoundResults ?? null;
  }

  /**
   * Move displayed round number on, once user chooses to leave current round's results behind.
   */
  advanceRound() {
    this.params.pageManager.advanceRound();
  }

  /**
   * Determine whether new round may start.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {object} Result with `allowed` and, if not allowed, `reason`.
   */
  canStartNextRound(now = new Date()) {
    if (this.params.selector.isFinished(this.params.pagePool.getIds(), this.params.pageManager)) {
      return { allowed: false, reason: 'finished' };
    }

    const dueIds = this.params.selector.selectNextPile(
      this.params.pagePool.getIds(),
      this.params.pageManager,
      now,
    );

    if (!dueIds.length) {
      return { allowed: false, reason: 'waiting' };
    }

    const roundStatus = this.params.roundController.canStartNextRound(this.params.pageManager);

    if (!roundStatus.allowed) {
      return roundStatus;
    }

    return { allowed: true, reason: null };
  }

  /**
   * Get round number to display. Stays at number of round whose results are being shown until user chooses to move on.
   * @returns {number} Round number to display.
   */
  getCurrentRoundNumber() {
    return this.params.pageManager.getCurrentRoundNumber();
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return {
      manager: this.params.pageManager.getCurrentState(),
      pileIds: this.currentPile?.getIds() ?? [],
      lastRoundResults: this.lastRoundResults,
    };
  }

  /**
   * Get all pages that have been drawn from pool so far in this session, regardless of current pile.
   * @returns {object[]} Instantiated pages.
   */
  getAllDrawnPages() {
    return this.params.pagePool.getInstantiatedPages();
  }

  /**
   * Get results of most recently completed round, if any.
   * @returns {object[]|null} Results, one entry per page, or null if no round has been completed yet.
   */
  getLastRoundResults() {
    return this.lastRoundResults;
  }

  /**
   * Get number of pages that have reached mastery so far across whole pool.
   * @returns {number} Number of pages mastered.
   */
  getMasteredPagesCount() {
    return this.params.pagePool.getIds()
      .filter((id) => this.params.selector.isPageMastered(id, this.params.pageManager))
      .length;
  }

  /**
   * Get earliest date when any page in pool will be due next. Returns null if all pages are mastered.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {Date|null} Earliest due date, or null if all pages are mastered/retired.
   */
  getNextDueDate(now = new Date()) {
    const ids = this.params.pagePool.getIds();
    let earliest = null;

    ids.forEach((id) => {
      const dueDate = this.params.selector.getNextDueDate(id, this.params.pageManager, now);

      if (dueDate !== null) {
        if (earliest === null || dueDate < earliest) {
          earliest = dueDate;
        }
      }
    });

    return earliest;
  }

  /**
   * Get total number of pages in pool, not just ones drawn so far.
   * @returns {number} Total number of pages.
   */
  getTotalPagesCount() {
    return this.params.pagePool.getIds().length;
  }

  /**
   * Restore in-progress pile, e.g. after reloading page, without drawing new one or resetting any exercise.
   * @param {number[]} ids Ids of pages that were in pile.
   * @returns {PagePile} Restored pile.
   */
  restorePile(ids) {
    this.currentPile = new PagePile(ids.map((id) => this.params.pagePool.draw(id)));

    return this.currentPile;
  }

  /**
   * Draw pages for fresh round and remember as current pile.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {PagePile|null} Pile to present, or null if nothing is due right now.
   */
  startNextRound(now = new Date()) {
    let ids = this.params.selector.selectNextPile(
      this.params.pagePool.getIds(),
      this.params.pageManager,
      now,
    );

    if (!ids.length) {
      this.currentPile = null;
      return null;
    }

    if (this.params.randomize) {
      ids = randomize(ids);
    }

    this.currentPile = new PagePile(ids.map((id) => this.params.pagePool.draw(id)));

    return this.currentPile;
  }

  /**
   * Submit results of current pile's round and update progress accordingly.
   * @param {Date} [now] Reference date. Defaults to now.
   */
  submitCurrentRound(now = new Date()) {
    if (!this.currentPile) {
      return;
    }

    const pages = this.currentPile.getPages();

    const results = pages.map((page) => ({
      id: page.getIndex(),
      title: page.getTitle(),
      score: page.getScore(),
      maxScore: page.getMaxScore(),
      scoreBeyondThreshold: this.params.selector.isScoreBeyondThreshold(page.getScore(), page.getMaxScore()),
    }));

    this.params.selector.onRoundCompleted(this.params.pageManager, results);
    this.params.pageManager.markRoundCompleted(now);

    pages.forEach((page) => {
      page.reset();
    });

    this.lastRoundResults = results;

    this.currentPile = null;
  }
}
