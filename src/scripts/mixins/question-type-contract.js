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

    return {
      statement: xAPIEvent.data.statement,
      children: this.main.getXAPIData(),
    };
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return this.main.getCurrentState();
  }
}
