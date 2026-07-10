import { extend } from '@services/util.js';
import './round-summary.scss';

/** Screen between spaced repetition rounds. Summarizes completed round, shows results, lets user start next round. */
export default class RoundSummary {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} params.dictionary Dictionary instance.
   * @param {HTMLElement} [params.mainDom] Main container DOM element for dialog attachment.
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onStartNextRound] Called on user choosing to start next round.
   * @param {function} [callbacks.onStartOver] Called on user choosing to start over from scratch.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = extend({}, params);

    this.callbacks = extend({
      onStartNextRound: () => {},
      onStartOver: () => {},
    }, callbacks);

    this.canContinue = false;
    this.hasResults = false;

    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-repetitor-round-summary');

    this.resultsContainer = document.createElement('div');
    this.resultsContainer.classList.add('h5p-repetitor-round-summary-results');
    this.dom.append(this.resultsContainer);

    this.message = document.createElement('p');
    this.message.classList.add('h5p-repetitor-round-summary-message');
    this.dom.append(this.message);

    this.buttonFooter = document.createElement('div');
    this.buttonFooter.classList.add('h5p-repetitor-round-summary-button-footer');
    this.dom.append(this.buttonFooter);

    this.startOverButton = H5P.Components.Button({
      label: this.params.dictionary.get('l10n.startOver'),
      icon: 'retry',
      styleType: 'secondary',
      onClick: () => {
        this.showStartOverConfirmation();
      },
    });
    this.startOverButton.classList.add('h5p-repetitor-round-summary-button');
    this.buttonFooter.append(this.startOverButton);

    this.nextRoundButton = this.buildNextRoundButton();
    this.buttonFooter.append(this.nextRoundButton);
  }

  /**
   * Show confirmation dialog before starting over.
   */
  showStartOverConfirmation() {
    const dialog = new H5P.ConfirmationDialog({
      dialogText: this.params.dictionary.get('l10n.startOverConfirmation'),
      theme: true,
    });
    dialog.appendTo(this.params.mainDom);
    dialog.on('confirmed', () => {
      this.callbacks.onStartOver();
    });
    dialog.show();
  }

  /**
   * Build "start next round" button.
   * @returns {HTMLElement} Button element.
   */
  buildNextRoundButton() {
    const button = H5P.Components.Button({
      label: this.params.dictionary.get('l10n.startNextRound').replace('@number', this.params.currentRoundNumber + 1),
      icon: 'continue',
      styleType: 'primary',
      onClick: () => {
        this.callbacks.onStartNextRound();
      },
    });
    button.classList.add('h5p-repetitor-round-summary-button');

    return button;
  }

  /**
   * Get DOM.
   * @returns {HTMLElement} DOM.
   */
  getDOM() {
    return this.dom;
  }

  /**
   * Focus best available.
   */
  focus() {
    if (!this.hasResults) {
      return;
    }

    if (this.canContinue) {
      this.nextRoundButton.focus();
    }
    else {
      this.startOverButton.focus();
    }
  }

  /**
   * Update summary contents.
   * @param {object} [params] Parameters.
   * @param {object[]} [params.results] Results of round just completed, one entry per page.
   * @param {string} [params.results[].title] Page title.
   * @param {number} [params.results[].score] Score reached.
   * @param {number} [params.results[].maxScore] Maximum possible score.
   * @param {number} [params.currentRoundNumber] Current round number.
   * @param {string} [params.message] Status message to display below results.
   * @param {boolean} [params.canContinue] True to show "start next round" button.
   * @param {number} [params.masteredPagesCount] Number of pages mastered so far, across whole pool.
   * @param {number} [params.totalPagesCount] Total number of pages in pool.
   */
  update(params = {}) {
    this.resultsContainer.innerHTML = '';

    this.params.currentRoundNumber = params.currentRoundNumber ?? this.params.currentRoundNumber;

    const nextRoundButton = this.buildNextRoundButton();
    this.nextRoundButton.replaceWith(nextRoundButton);
    this.nextRoundButton = nextRoundButton;

    const results = params.results ?? [];
    this.hasResults = results.length > 0;
    if (this.hasResults) {
      this.resultsContainer.append(
        this.buildResultScreen(results, params.masteredPagesCount ?? 0, params.totalPagesCount ?? 0),
      );
    }

    this.message.innerText = params.message ?? '';
    this.message.classList.toggle('display-none', !params.message);

    this.canContinue = !!params.canContinue;
    this.nextRoundButton.classList.toggle('display-none', !this.canContinue);

    // The button footer is only relevant alongside the results it belongs to.
    this.buttonFooter.classList.toggle('display-none', !this.hasResults);
  }

  /**
   * Build themed result screen summarizing pages of round.
   * @param {object[]} results Results of round just completed.
   * @param {number} masteredPagesCount Number of pages mastered so far, across whole pool.
   * @param {number} totalPagesCount Total number of pages in pool.
   * @returns {HTMLElement} Result screen DOM.
   */
  buildResultScreen(results, masteredPagesCount, totalPagesCount) {
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const totalMaxScore = results.reduce((sum, result) => sum + result.maxScore, 0);

    return H5P.Components.ResultScreen({
      header: this.params.dictionary.get('l10n.roundSummaryHeader'),
      scoreHeader: this.params.dictionary.get('l10n.roundSummaryNumber')
        .replace('@round', this.params.currentRoundNumber),
      questionGroups: [
        {
          questions: this.buildResultRows(results),
        },
        {
          listHeaders: [this.params.dictionary.get('l10n.roundSummaryOverallResults')],
          questions: this.buildOverallResultRows(masteredPagesCount, totalPagesCount),
        },
      ],
    });
  }

  /**
   * Build one row per page, showing passed/failed state, plus trailing row summarizing counts.
   * @param {object[]} results Results of round just completed.
   * @param {string} [results[].title] Page title.
   * @param {boolean} [results[].scoreBeyondThreshold] True, if page's score counted as pass.
   * @returns {object[]} Rows ready for H5P.Components.ResultScreen's question groups.
   */
  buildResultRows(results) {
    const rows = results.map((result) => {
      const passedIcon = document.createElement('span');
      passedIcon.classList.add('h5p-repetitor-round-summary-state');
      passedIcon.classList.add(result.scoreBeyondThreshold ? 'passed' : 'failed');

      return {
        title: result.title,
        points: passedIcon.outerHTML,
      };
    });

    const passedCount = results.filter((result) => result.scoreBeyondThreshold).length;

    rows.push({
      title: this.params.dictionary.get('l10n.roundSummaryPassed'),
      points: this.params.dictionary.get('l10n.xOfY')
        .replace('@x', passedCount)
        .replace('@y', results.length),
    });

    rows.push({
      title: this.params.dictionary.get('l10n.roundSummaryFailed'),
      points: this.params.dictionary.get('l10n.xOfY')
        .replace('@x', results.length - passedCount)
        .replace('@y', results.length),
    });

    return rows;
  }

  /**
   * Build row summarizing overall progress across whole pool, not just round just completed.
   * @param {number} masteredPagesCount Number of pages mastered so far, across whole pool.
   * @param {number} totalPagesCount Total number of pages in pool.
   * @returns {object[]} Rows ready for H5P.Components.ResultScreen's question groups.
   */
  buildOverallResultRows(masteredPagesCount, totalPagesCount) {
    return [{
      title: this.params.dictionary.get('l10n.roundSummaryExercisesCompleted'),
      points: this.params.dictionary.get('l10n.xOfY')
        .replace('@x', masteredPagesCount)
        .replace('@y', totalPagesCount),
    }];
  }
}
