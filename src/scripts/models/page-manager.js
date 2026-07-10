import { getScoreRatio } from '@services/util.js';

/** @constant {number} MS_PER_DAY Number of milliseconds in a day. */
export const MS_PER_DAY = 86400000;

/** Stores per-page attempt history and selector state, exposes generic helpers for selector logic. */
export default class PageManager {
  /**
   * @class
   * @param {object} [previousState] Serialized state to restore from, as returned by `getCurrentState`.
   */
  constructor(previousState = {}) {
    this.records = {};

    Object.keys(previousState.records ?? {}).forEach((id) => {
      const record = previousState.records[id];
      this.records[id] = {
        attempts: record.attempts ?? [],
        selectorState: record.selectorState ?? {},
      };
    });

    this.roundsCompleted = previousState.roundsCompleted ?? 0;
    this.currentRoundNumber = previousState.currentRoundNumber ?? 1;

    this.lastRoundCompletedAt = previousState.lastRoundCompletedAt ?
      new Date(previousState.lastRoundCompletedAt) :
      null;
  }

  /**
   * Get record for page, creating empty one if it does not exist yet.
   * @param {number} id Page id.
   * @returns {object} Record holding attempts and selector state.
   */
  getRecord(id) {
    if (!this.records[id]) {
      this.records[id] = { attempts: [], selectorState: {} };
    }

    return this.records[id];
  }

  /**
   * Record attempt for page.
   * @param {number} id Page id.
   * @param {object} [params] Attempt data.
   * @param {number} [params.score] Score reached.
   * @param {number} [params.maxScore] Maximum possible score.
   * @param {Date} [params.timestamp] When attempt was made. Defaults to now.
   */
  recordAttempt(id, params = {}) {
    const timestamp = params.timestamp ?? new Date();

    this.getRecord(id).attempts.push({
      score: params.score ?? 0,
      maxScore: params.maxScore ?? 0,
      timestamp: timestamp.toISOString(),
    });
  }

  /**
   * Get full attempt history for page, oldest first.
   * @param {number} id Page id.
   * @returns {object[]} Attempts. Empty if page was never attempted.
   */
  getHistory(id) {
    return this.records[id]?.attempts ?? [];
  }

  /**
   * Get number of attempts made for page.
   * @param {number} id Page id.
   * @returns {number} Number of attempts.
   */
  getAttemptCount(id) {
    return this.getHistory(id).length;
  }

  /**
   * Get score ratio of single attempt. Contents without task (maxScore 0) count as full pass, since
   * nothing to get wrong.
   * @param {object} attempt Attempt as stored in history.
   * @returns {number} Score ratio between 0 and 1.
   */
  getAttemptRatio(attempt) {
    return getScoreRatio(attempt.score, attempt.maxScore);
  }

  /**
   * Get score ratio of most recent attempt.
   * @param {number} id Page id.
   * @returns {number|null} Score ratio, or null if page was never attempted.
   */
  getLastScoreRatio(id) {
    const history = this.getHistory(id);
    if (!history.length) {
      return null;
    }

    return this.getAttemptRatio(history[history.length - 1]);
  }

  /**
   * Get average score ratio across all attempts.
   * @param {number} id Page id.
   * @returns {number|null} Average score ratio, or null if page was never attempted.
   */
  getAverageScoreRatio(id) {
    const history = this.getHistory(id);
    if (!history.length) {
      return null;
    }

    const sum = history.reduce((total, attempt) => total + this.getAttemptRatio(attempt), 0);

    return sum / history.length;
  }

  /**
   * Get number of consecutive most recent attempts that reached pass threshold.
   * @param {number} id Page id.
   * @param {number} [passThreshold] Minimum score ratio to count as pass. Defaults to full score.
   * @returns {number} Current streak length.
   */
  getStreak(id, passThreshold = 1) {
    const history = this.getHistory(id);

    let streak = 0;
    for (let index = history.length - 1; index >= 0; index--) {
      if (this.getAttemptRatio(history[index]) < passThreshold) {
        break;
      }
      streak++;
    }

    return streak;
  }

  /**
   * Get number of days since page was last attempted.
   * @param {number} id Page id.
   * @param {Date} [now] Reference date. Defaults to now.
   * @returns {number|null} Days since last attempt, or null if page was never attempted.
   */
  getDaysSinceLastAttempt(id, now = new Date()) {
    const history = this.getHistory(id);
    if (!history.length) {
      return null;
    }

    const lastAttemptDate = new Date(history[history.length - 1].timestamp);

    return (now.getTime() - lastAttemptDate.getTime()) / MS_PER_DAY;
  }

  /**
   * Get selector-specific state for page, e.g. current Leitner box. PageManager itself never reads or
   * writes into this, it is opaque storage for whichever selector is currently active.
   * @param {number} id Page id.
   * @returns {object} Selector state. Empty object if none was stored yet.
   */
  getSelectorState(id) {
    return this.getRecord(id).selectorState;
  }

  /**
   * Set selector-specific state for page.
   * @param {number} id Page id.
   * @param {object} state Selector state to store.
   */
  setSelectorState(id, state) {
    this.getRecord(id).selectorState = state;
  }

  /**
   * Get number of rounds completed so far.
   * @returns {number} Number of rounds completed.
   */
  getRoundsCompleted() {
    return this.roundsCompleted;
  }

  /**
   * Get date last round was completed at.
   * @returns {Date|null} Date, or null if no round was completed yet.
   */
  getLastRoundCompletedAt() {
    return this.lastRoundCompletedAt;
  }

  /**
   * Mark current round as completed.
   * @param {Date} [now] Completion date. Defaults to now.
   */
  markRoundCompleted(now = new Date()) {
    this.roundsCompleted++;
    this.lastRoundCompletedAt = now;
  }

  /**
   * Get round number to display. Stays at number of round whose results are being shown until
   * user actually moves on, see `advanceRound`, however long that takes or however often it is attempted.
   * @returns {number} Round number to display, 1-based.
   */
  getCurrentRoundNumber() {
    return this.currentRoundNumber;
  }

  /**
   * Move displayed round number on to next round, once user chooses to leave current round's
   * results behind, regardless of whether next round turns out to have anything due yet. Only takes effect
   * once per completed round: repeated calls before that round is completed are no-ops, so retrying round
   * that turned out to have nothing due does not keep advancing number.
   */
  advanceRound() {
    if (this.currentRoundNumber === this.roundsCompleted) {
      this.currentRoundNumber++;
    }
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    const records = {};

    Object.keys(this.records).forEach((id) => {
      records[id] = {
        attempts: this.records[id].attempts,
        selectorState: this.records[id].selectorState,
      };
    });

    return {
      records: records,
      roundsCompleted: this.roundsCompleted,
      currentRoundNumber: this.currentRoundNumber,
      lastRoundCompletedAt: this.lastRoundCompletedAt ? this.lastRoundCompletedAt.toISOString() : null,
    };
  }
}
