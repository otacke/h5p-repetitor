/** Decides whether new repetition round may start, independent of pages `PageSelector` picks: max rounds reached? */
export default class RoundController {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {number} [params.maxRounds] Maximum number of rounds allowed. Falsy means unlimited.
   */
  constructor(params = {}) {
    this.params = params;
  }

  /**
   * Determine whether new round may start right now.
   * @param {object} pageManager Page manager to read round history from.
   * @returns {object} Result with `allowed` and, if not allowed, `reason`.
   */
  canStartNextRound(pageManager) {
    if (this.params.maxRounds && pageManager.getRoundsCompleted() >= this.params.maxRounds) {
      return { allowed: false, reason: 'maxRoundsReached' };
    }

    return { allowed: true, reason: null };
  }
}
