/**
 * Mixin containing methods for H5P Question Type contract.
 */
export default class QuestionTypeContract {
  /**
   * Get context data. Contract used for confusion report. Undocumented method :-/
   * @returns {object} Context data.
   */
  getContext() {
    return {
      type: 'page',
      value: this.main.getCurrentPageIndex() + 1,
    };
  }


  /**
   * Check if result has been submitted or input has been given.
   * @returns {boolean} True, if answer was given.
   */
  getAnswerGiven() {
    return this.main.getAnswerGiven();
  }

  /**
   * Get current score.
   * @returns {number} Current score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
    return this.main.getScore();
  }

  /**
   * Get maximum possible score.
   * @returns {number} Score necessary for mastering.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
   */
  getMaxScore() {
    return this.main.getMaxScore();
  }

  /**
   * Show solutions.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
   */
  showSolutions() {
    this.main.showSolutions();
  }

  /**
   * Reset task.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    this.main.reset();
  }

  /**
   * Get xAPI data.
   * @returns {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    const xAPIEvent = this.createXAPIEvent('completed');

    // Not a valid xAPI value (!), but H5P uses it for reporting
    xAPIEvent.data.statement.object.definition.interactionType = 'compound';

    // Add round string to allow halfway decent reporting for Repetitor content.
    const roundString = this.dictionary.get('l10n.roundTemplate').replace('@round', this.main.getRound());
    this.attachRound(xAPIEvent.data.statement.object.definition, 'description', roundString);
    this.attachRound(xAPIEvent.data.statement.object.definition, 'name', roundString);

    return {
      statement: xAPIEvent.data.statement,
      children: this.main.getXAPIData(),
    };
  }

  /**
   * Attach round string to xAPI definition object.
   * @param {object} xAPIDefinition XAPI definition object.
   * @param {string} key Property key (intended for `name` and `description`).
   * @param {string} roundString Round string, e.g. `Round 1`.
   */
  attachRound(xAPIDefinition, key, roundString) {
    const locales = [this.languageTag, 'en-US'];
    const base = (xAPIDefinition?.[key]?.[this.languageTag] ?? xAPIDefinition?.[key]?.['en-US']);
    const withRound = [base, roundString].filter((item) => typeof item === 'string').join('|');

    xAPIDefinition[key] = xAPIDefinition[key] ?? {};
    xAPIDefinition[key][this.languageTag] = withRound;
    xAPIDefinition[key]['en-US'] = withRound;
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return this.main.getCurrentState();
  }
}
