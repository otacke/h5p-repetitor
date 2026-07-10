import Screenreader from '@services/screenreader.js';
import { extend, getLocalDateRepresentation } from '@services/util.js';
import MessageBox from '@components/message-box/message-box.js';
import TopBar from '@components/top-bar/top-bar.js';
import RoundSummary from '@components/round-summary/round-summary.js';
import PagePool from '@models/page-pool.js';
import PageManager from '@models/page-manager.js';
import RoundController from '@models/round-controller.js';
import SpacedRepetitionController from '@models/spaced-repetition-controller.js';
import { createSelector } from '@models/selectors/selector-factory.js';
import './main.scss';

/** @constant {number} NO_PAGE_SELECTED_INDEX Index for no page selected, used for initial sliding. */
const NO_PAGE_SELECTED_INDEX = -1;

/**
 * Main DOM component incl. main controller.
 */
export default class Main {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} [callbacks] Callbacks.
   * @param {object} [callbacks.onProgressed] Callback on user progress.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = extend({
    }, params);

    this.callbacks = extend({
      onProgressed: () => {},
    }, callbacks);

    this.handleUpdatePagePositionsEnded = this.handleUpdatePagePositionsEnded.bind(this);
    this.globalParams = this.params.globals.get('params');
    this.behaviour = this.globalParams.behaviour;
    this.spacedRepetitionParams = this.globalParams.spacedRepetition;
    this.isSubmitting = (this.params.globals.get('extras').isScoringEnabled ||
      this.params.globals.get('extras').isReportingEnabled) ?? false;

    this.currentPageIndex = NO_PAGE_SELECTED_INDEX;
    this.pages = [];

    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-repetitor-main');

    if (!this.globalParams.content.length) {
      const messageBox = new MessageBox({
        text: this.params.dictionary.get('l10n.noContents'),
      });
      this.dom.append(messageBox.getDOM());

      return;
    }

    if (!this.behaviour.canGoBackwards) {
      this.dom.classList.add('h5p-repetitor-main-no-backwards');
    }

    if (!this.behaviour.canSkipForward) {
      this.dom.classList.add('h5p-repetitor-main-no-forward');
    }

    if (
      this.behaviour.displayPageAnnouncement ||
      this.behaviour.displayRoundAnnouncement ||
      this.behaviour.displayContentAnnouncement
    ) {
      this.topbar = new TopBar({
        dictionary: this.params.dictionary,
        announcePage: this.behaviour.displayPageAnnouncement,
        announceRound: this.behaviour.displayRoundAnnouncement,
        announceContent: this.behaviour.displayContentAnnouncement,
      });
      this.dom.append(this.topbar.getDOM());
    }

    this.contents = document.createElement('div');
    this.contents.classList.add('h5p-repetitor-pages');
    this.dom.append(this.contents);

    document.body.append(Screenreader.getDOM());

    const previousState = this.params.globals.get('extras').previousState ?? {};

    this.spacedRepetitionController = this.buildSpacedRepetitionController(previousState.spacedRepetition);

    const previousPileIds = previousState.spacedRepetition?.pileIds ?? [];
    const roundsCompleted = previousState.spacedRepetition?.manager?.roundsCompleted ?? 0;
    const currentRoundNumber = previousState.spacedRepetition?.manager?.currentRoundNumber ?? 1;
    const hasCompletedRounds = roundsCompleted > 0;

    this.roundSummary = new RoundSummary(
      {
        dictionary: this.params.dictionary,
        currentRoundNumber: currentRoundNumber,
        mainDom: this.dom,
      },
      {
        onStartNextRound: () => this.startNextRoundFromSummary(),
        onStartOver: () => this.params.globals.get('mainInstance').resetTask(),
      },
    );

    if (previousPileIds.length) {
      this.startRound(this.spacedRepetitionController.restorePile(previousPileIds).getPages());
    }
    else if (hasCompletedRounds) {
      // A round was already submitted in a previous session. Let the user decide when to continue.
      this.showRoundSummary(this.spacedRepetitionController.getLastRoundResults() ?? []);
    }
    else {
      this.startFirstRound();
    }

    if (this.pages.length) {
      const previousChildrenState = previousState.children ?? [];
      this.pages.forEach((page) => {
        if (previousChildrenState[page.getIndex()]?.wasAnswered) {
          page.setAnswered(true);
        }
      });

      this.updateNavigationButtons();
    }
  }

  /**
   * Build model layer for spaced repetition.
   * @param {object} [previousSpacedRepetitionState] Serialized state to restore, as returned by
   * `SpacedRepetitionController.getCurrentState`, if any.
   * @returns {SpacedRepetitionController} Controller tying pool, manager, selector and round control together.
   */
  buildSpacedRepetitionController(previousSpacedRepetitionState = {}) {
    const pagePool = new PagePool(
      {
        dictionary: this.params.dictionary,
        globals: this.params.globals,
        contents: this.globalParams.content,
      },
      {
        onAnswerStateChanged: () => {
          this.updateNavigation();
        },
      },
    );

    const general = this.spacedRepetitionParams.general ?? {};

    const roundController = new RoundController({
      maxRounds: general.maxRounds,
    });

    return new SpacedRepetitionController({
      pagePool: pagePool,
      pageManager: new PageManager(previousSpacedRepetitionState.manager),
      selector: createSelector(this.spacedRepetitionParams),
      roundController: roundController,
      lastRoundResults: previousSpacedRepetitionState.lastRoundResults,
      randomize: general.randomize,
    });
  }

  /**
   * Start first spaced repetition round. Revealing left to deferred call H5P core makes once content becomes
   * visible, so this does not swipe to it itself.
   */
  startFirstRound() {
    const pile = this.spacedRepetitionController.startNextRound();
    this.startRound(pile.getPages());
  }

  /**
   * Show round summary screen instead of round: results of round just completed, if any, current status,
   * if allowed, button to explicitly start next round.
   * @param {object[]} [results] Results of round just completed, one entry per page. Omitted when no freshly
   * completed round to report, e.g. when resuming session after round was already submitted.
   */
  showRoundSummary(results = []) {
    this.pages = [];
    this.callbacks.onProgressed(this.currentPageIndex + 1); // Pseudo index, used to make H5P store state

    this.currentPageIndex = NO_PAGE_SELECTED_INDEX;

    this.navigation?.remove();
    this.navigation = null;

    const status = this.spacedRepetitionController.canStartNextRound();

    let message;
    switch (status.reason) {
      case 'maxRoundsReached':
        message = this.params.dictionary.get('l10n.roundCompletedMaxRounds');
        break;
      case 'finished':
        message = this.params.dictionary.get('l10n.roundCompletedFinished');
        break;
      case 'waiting':
        message = this.params.dictionary.get('l10n.roundCompletedWaiting')
          .replace('@date', getLocalDateRepresentation(
            this.spacedRepetitionController.getNextDueDate()));
        break;
      default:
        message = (status.allowed ?
          this.params.dictionary.get('l10n.roundCompletedReady') :
          this.params.dictionary.get('l10n.roundCompletedFinished'));
    }

    this.roundSummary.update({
      results: results,
      currentRoundNumber: this.spacedRepetitionController.getCurrentRoundNumber(),
      message: message,
      canContinue: status.allowed,
      masteredPagesCount: this.spacedRepetitionController.getMasteredPagesCount(),
      totalPagesCount: this.spacedRepetitionController.getTotalPagesCount(),
    });

    this.topbar.toggle(false);
    this.contents.innerHTML = '';
    this.contents.append(this.roundSummary.getDOM());

    this.updateAnnouncement();

    Screenreader.read(message);
    this.roundSummary.focus();

    this.params.globals.get('resize')();
  }

  /**
   * Handle user choosing to start next round from round summary screen. Round number advances as soon as user
   * makes this choice, regardless of whether round actually turns out to be due yet.
   */
  startNextRoundFromSummary() {
    this.spacedRepetitionController.advanceRound();
    this.attemptNextRound();
  }

  /**
   * Try to start next round.
   */
  attemptNextRound() {
    const pile = this.spacedRepetitionController.startNextRound();

    this.startRound(pile.getPages(), { announce: true });
    this.swipeTo(0, { force: true });

    /*
     * The very first page of a freshly started round was never painted at its initial position, so its CSS
     * transition (and the transitionend-triggered announcement update) may not fire. Update directly as well.
     */
    this.updateAnnouncement();
  }

  /**
   * Start presenting round: render pages and (re)build navigation for them.
   * @param {object[]} pages Pages to present, in order.
   * @param {object} [options] Options.
   * @param {boolean} [options.announce] If true, announce new round to screen readers.
   */
  startRound(pages, options = {}) {
    this.pages = pages;
    this.currentPageIndex = NO_PAGE_SELECTED_INDEX;

    this.contents.innerHTML = '';
    this.topbar.toggle(true);
    this.pages.forEach((page) => {
      // Pages can be reused across rounds and may still carry DOM state from a previous round.
      page.setPosition(1); // 1 = Future to allow initial slide in from right
      page.update({ visible: true });
      this.contents.append(page.getDOM());
    });

    this.buildNavigation();

    if (options.announce) {
      Screenreader.read(this.params.dictionary.get('l10n.roundStarted'));
    }

    this.params.globals.get('resize')();
  }

  /**
   * Build (or rebuild) navigation footer for current pages.
   */
  buildNavigation() {
    this.navigation?.remove();

    const initialQuestion = 0; // Does not need to be set to previous state, call to swipeTo will come

    const navigationTexts = {
      previousButton: this.params.dictionary.get('l10n.previous'),
      previousButtonAria: this.params.dictionary.get('a11y.previousContent'),
      nextButton: this.params.dictionary.get('l10n.next'),
      nextButtonAria: this.params.dictionary.get('a11y.nextContent'),
      lastButton: this.isSubmitting ?
        this.params.dictionary.get('l10n.submit') :
        this.params.dictionary.get('l10n.finish'),
      lastButtonAria: this.isSubmitting ?
        this.params.dictionary.get('a11y.submit') :
        this.params.dictionary.get('a11y.finish'),
      jumpToQuestion: this.params.dictionary.get('a11y.jumpToQuestion')
        .replace('@current', '%d')
        .replace('@total', '%total'),
      answeredText: this.params.dictionary.get('a11y.answered'),
      unansweredText: this.params.dictionary.get('a11y.unanswered'),
      currentQuestionText: this.params.dictionary.get('a11y.currentQuestion'),
    };

    this.navigation = H5P.Components.Navigation({
      className: 'h5p-repetitor-footer',
      handlePrevious: () => {
        this.swipeLeft();
      },
      handleNext: () => {
        this.swipeRight();
      },
      handleLast: () => {
        this.swipeRight();
      },
      progressType: 'dots',
      texts: navigationTexts,
      index: initialQuestion,
      navigationLength: this.pages.length,
      dots: this.pages.map((page, index) => ({
        ariaLabel: this.params.dictionary.get('a11y.jumpToQuestion')
          .replace('@current', index + 1)
          .replace('@total', this.pages.length),
        tabIndex: index === initialQuestion ? 0 : -1,
      })),
      handleProgressDotClick: ((event, index) => {
        this.handleProgressDotClick(event, index);
      }),
    });
    this.dom.append(this.navigation);
  }

  /**
   * Update navigation buttons.
   */
  updateNavigationButtons() {
    const currentIndex = this.getCurrentPageIndex();
    const currentPage = this.pages[currentIndex];
    if (!currentPage) {
      return;
    }

    const isLastPageOfRound = currentIndex === this.pages.length - 1;
    const wereAllPagesAnswered = this.pages.every((page) => page.wasAnswered());

    this.navigation.setCanShowLast(isLastPageOfRound && wereAllPagesAnswered);

    if (this.behaviour.canSkipForward) {
      return;
    }

    const shouldNextButtonShow = currentPage.wasAnswered() && !isLastPageOfRound;
    this.navigation.classList.toggle('next-is-visible', shouldNextButtonShow);
  }

  /**
   * Get current page index.
   * @returns {number} Current page index.
   */
  getCurrentPageIndex() {
    return this.currentPageIndex;
  }

  /**
   * Update navigation buttons and dots.
   */
  updateNavigation() {
    this.updateNavigationButtons();
    this.updateNavigationDots();
  }

  /**
   * Update navigation dots.
   */
  updateNavigationDots() {
    const currentIndex = this.getCurrentPageIndex();
    if (currentIndex === NO_PAGE_SELECTED_INDEX) {
      return;
    }

    const currentPage = this.pages[currentIndex];
    const { canGoBackwards, canSkipForward } = this.behaviour;

    this.pages.forEach((page, index) => {
      if (index < currentIndex && !canGoBackwards) {
        this.updateNavigationDotEnabledState(index, false);
      }
      else if (index === currentIndex) {
        this.updateNavigationDotEnabledState(index, true);
      }
      else if (index > currentIndex && !canSkipForward) {
        const referencePage = (index === currentIndex + 1) ? currentPage : page;
        this.updateNavigationDotEnabledState(index, referencePage.wasAnswered());
      }

      this.navigation.progressDots.toggleFilledDot(index, page.wasAnswered());
    });
  }

  /**
   * Toggle navigation dot enabled state.
   * @param {number} index Index of dot to update.
   * @param {boolean} enabled True to enable, false to disable.
   */
  updateNavigationDotEnabledState(index, enabled) {
    const dotDOM = (this.navigation.progressDots.querySelectorAll('.h5p-progress-dot'))[index];
    dotDOM.classList.toggle('disabled', !enabled);
  }

  /**
   * Handle ProgressDotClick on H5P.Component.Navigation.
   * @param {PointerEvent} event Pointer event.
   * @param {number} index Index of position.
   */
  handleProgressDotClick(event, index) {
    event.preventDefault();

    this.swipeTo(index);
  }

  /**
   * Swipe content left.
   */
  swipeLeft() {
    if (!this.behaviour.canGoBackwards) {
      return;
    }

    if (this.isSwiping || this.currentPageIndex <= 0) {
      return;
    }

    this.swipeTo(this.currentPageIndex - 1, { force: true });
  }

  /**
   * Swipe content right.
   */
  swipeRight() {
    const currentPage = this.pages[this.getCurrentPageIndex()];
    if (!currentPage) {
      return;
    }
    if (!this.behaviour.canSkipForward && !currentPage.wasAnswered()) {
      return;
    }

    if (this.isSwiping) {
      return;
    }

    const isLastPageOfRound = this.currentPageIndex === this.pages.length - 1;

    if (isLastPageOfRound) {
      this.handleRoundEnd();
      return;
    }

    this.swipeTo(this.currentPageIndex + 1, { force: true });
  }

  /**
   * Handle reaching end of current spaced repetition round: submit results and show summary screen.
   */
  handleRoundEnd() {
    this.spacedRepetitionController.submitCurrentRound();
    this.showRoundSummary(this.spacedRepetitionController.getLastRoundResults() ?? []);
  }

  /**
   * Swipe to page.
   * @param {number} [to] Page number to swipe to.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipFocus] If true, skip focus after swiping.
   * @param {boolean} [options.force] If true, skip checks.
   */
  swipeTo(to = NO_PAGE_SELECTED_INDEX, options = {}) {
    if (!this.pages.length) {
      return; // Nothing to show right now, e.g. a round outcome message is displayed instead
    }

    if (this.isSwiping || to < 0 || to > this.pages.length - 1) {
      return;
    }

    const from = this.currentPageIndex;
    if (from === to || !this.isNavigationAllowed(from, to, options)) {
      return;
    }

    this.isSwiping = true;
    this.currentPageIndex = to;

    const text = this.params.dictionary.get('a11y.movedTo')
      .replace(/@current/g, to + 1)
      .replace(/@total/g, this.pages.length);
    Screenreader.read(text ? `${text}. ${this.pages[to].getTitle()}` : this.pages[to].getTitle());

    this.startTransition(from, to, options);

    this.callbacks.onProgressed(this.currentPageIndex);
  }

  /**
   * Check navigation from one page to another is allowed.
   * @param {number} from Index of current page.
   * @param {number} to Index of target page.
   * @param {object} options Options.
   * @param {boolean} [options.force] If true, skip checks.
   * @returns {boolean} True if navigation is allowed.
   */
  isNavigationAllowed(from, to, options) {
    if (options.force) {
      return true;
    }

    if (to < from && !this.behaviour.canGoBackwards) {
      return false;
    }

    if (from < to && !this.behaviour.canSkipForward) {
      return to === 0 || this.pages[to - 1].wasAnswered();
    }

    return true;
  }

  /**
   * Start transition to target page.
   * @param {number} from Index of current page.
   * @param {number} to Index of target page.
   * @param {object} options Options.
   * @param {boolean} [options.skipFocus] If true, skip focus after transition.
   */
  startTransition(from, to, options) {
    const lower = Math.min(from, to);
    const upper = Math.max(from, to);

    this.pages[to].registerTransitionEnd(() => {
      this.handleUpdatePagePositionsEnded({ skipFocus: options.skipFocus });
    });

    this.pages.forEach((page, index) => {
      page.update({ visible: index >= lower && index <= upper });
    });

    this.params.globals.get('resize')();

    // Let browser display and resize pages before starting transition
    window.requestAnimationFrame(() => {
      this.pages.forEach((page, index) => {
        page.setPosition(index - this.currentPageIndex);
      });

      this.navigation.setCurrentIndex(this.getCurrentPageIndex());
      this.updateNavigation();
    });
  }

  /**
   * Handle updating page positions ended.
   * @param {object} [options] Options.
   */
  handleUpdatePagePositionsEnded(options = {}) {
    this.pages.forEach((page, index) => {
      if (index !== this.currentPageIndex) {
        page.getDOM().classList.add('display-none');
      }
      else if (!options.skipFocus) {
        if (!page.focusFirstChild()) {
          // Re-announce current button after moving page to make focus clear
          const currentFocusElement = document.activeElement;
          document.activeElement.blur();
          currentFocusElement.focus();
        }
      }
    });

    this.isSwiping = false;

    this.updateAnnouncement();
    this.autoMarkCurrentPageAnswered();

    this.params.globals.get('resize')();
  }

  /**
   * Update announcement.
   */
  updateAnnouncement() {
    if (!this.topbar) {
      return;
    }

    const currentPage = this.pages[this.currentPageIndex];

    if (this.behaviour.displayRoundAnnouncement) {
      this.topbar.setIndicatorRound(this.spacedRepetitionController.getCurrentRoundNumber());
    }

    if (this.behaviour.displayPageAnnouncement) {
      // Clear rather than leave stale values from a previous round when there is no current page to report.
      this.topbar.setIndicatorCurrent(currentPage ? this.currentPageIndex + 1 : undefined);
      this.topbar.setIndicatorTotal(currentPage ? this.pages.length : undefined);
    }

    if (this.behaviour.displayContentAnnouncement) {
      this.topbar.setTitle(currentPage ? currentPage.getTitle() : '');
    }
  }

  /**
   * Mark current page as answered if holds no task.
   */
  autoMarkCurrentPageAnswered() {
    const currentPage = this.pages[this.currentPageIndex];
    if (!currentPage.holdsTask()) {
      currentPage.setAnswered(true);
    }
  }

  /**
   * Check if result has been submitted or input has been given.
   * @returns {boolean} True, if answer was given.
   */
  getAnswerGiven() {
    return this.pages.some((page) => page.getAnswerGiven());
  }

  /**
   * Build content state for every page, indexed by page id. Pages that were never drawn (e.g. not due yet in
   * spaced repetition round) get empty state, since H5PContent expects entry to exist for every page id.
   * @returns {object[]} Content state, indexed by page id.
   */
  buildChildrenState() {
    const children = this.globalParams.content.map(() => ({}));

    this.spacedRepetitionController.getAllDrawnPages().forEach((page) => {
      children[page.getIndex()] = page.getCurrentState();
    });

    return children;
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return {
      pageIndex: this.currentPageIndex,
      children: this.buildChildrenState(),
      spacedRepetition: this.spacedRepetitionController.getCurrentState(),
    };
  }

  /**
   * Get DOM.
   * @returns {HTMLElement} Content DOM.
   */
  getDOM() {
    return this.dom;
  }

  /**
   * Get maximum possible score.
   * @returns {number} Score necessary for mastering.
   */
  getMaxScore() {
    return this.pages.reduce((score, page) => {
      return score + page.getMaxScore();
    }, 0);
  }

  /**
   * Get current score.
   * @returns {number} Current score.
   */
  getScore() {
    return this.pages.reduce((score, page) => {
      return score + page.getScore();
    }, 0);
  }

  /**
   * Get xAPI data from exercises.
   * @returns {object[]} XAPI data objects used to build report.
   */
  getXAPIData() {
    return this.pages
      .map((page) => {
        return page.getXAPIData();
      })
      .filter((data) => !!data);
  }

  /**
   * Discard all progress and restart from the first page.
   */
  reset() {
    // Rebuild pool, manager and controller from scratch to discard all progress and exercise state.
    this.spacedRepetitionController = this.buildSpacedRepetitionController();
    this.startFirstRound();
    this.swipeTo(0, { skipFocus: true, force: true });

    // The freshly started round's first page may not fire a transitionend event, see startNextRoundFromSummary.
    this.updateAnnouncement();
  }

  /**
   * Show solutions.
   */
  showSolutions() {
    this.pages.forEach((page) => {
      page.showSolutions();
    });
  }
}
