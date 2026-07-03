import Screenreader from '@services/screenreader.js';
import { extend } from '@services/util.js';
import MessageBox from '@components/message-box/message-box.js';
import TopBar from '@components/top-bar/top-bar.js';
import Page from '@components/page/page.js';
import './main.scss';

/**
 * Main DOM component incl. main controller.
 */
export default class Main {
  /**
   * @class
   * @param {object} [params] Parameters.
   * @param {object} [callbacks] Callbacks.
   * @param {object} [callbacks.onProgressed] Callback when user progressed.
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

    this.currentPageIndex = -1;
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

    if (this.behaviour.cycle) {
      this.dom.classList.add('h5p-repetitor-main-cycle');
    }

    if (!this.behaviour.canGoBackwards) {
      this.dom.classList.add('h5p-repetitor-main-no-backwards');
    }

    if (!this.behaviour.canSkipForward) {
      this.dom.classList.add('h5p-repetitor-main-no-forward');
    }

    if (this.behaviour.displayPageAnnouncement || this.behaviour.displayContentAnnouncement) {
      this.topbar = new TopBar({
        dictionary: this.params.dictionary,
        announcePage: this.behaviour.displayPageAnnouncement,
        announceContent: this.behaviour.displayContentAnnouncement,
      });
      this.dom.append(this.topbar.getDOM());
    }

    this.contents = document.createElement('div');
    this.contents.classList.add('h5p-repetitor-pages');
    this.dom.append(this.contents);

    this.globalParams.content.forEach((content, index) => {
      const page = new Page(
        {
          dictionary: this.params.dictionary,
          globals: this.params.globals,
          index: index,
          libraryParams: content.libraryParams,
        },
        {
          onAnswerStateChanged: (index, isAnswered) => {
            this.updateNavigation();
          },
        },
      );
      this.contents.append(page.getDOM());

      this.pages.push(page);
    });

    const initialQuestion = 0; // Does not need to be set to previous state, call to swipeTo will come

    const navigationTexts = {
      previousButton: this.params.dictionary.get('l10n.previous'),
      previousButtonAria: this.params.dictionary.get('a11y.previousContent'),
      nextButton: this.params.dictionary.get('l10n.next'),
      nextButtonAria: this.params.dictionary.get('a11y.nextContent'),
      lastButton: (self.isSubmitting) ? '_submit_' : '_finish_', // TODO
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

    // Screenreader for polite screen reading
    document.body.append(Screenreader.getDOM());

    const previousChildrenState = this.params.globals.get('extras').previousState?.children ?? [];
    previousChildrenState.forEach((childState, index) => {
      if (childState.wasAnswered) {
        this.pages[index].setAnswered(true);
      }
    });

    this.updateNavigationButtons();
  }

  /**
   * Update navigation buttons.
   */
  updateNavigationButtons() {
    if (this.behaviour.canSkipForward) {
      return;
    }

    const currentIndex = this.getCurrentPageIndex();
    const currentPage = this.pages[currentIndex];
    if (!currentPage) {
      return;
    }

    const canCycle = this.behaviour.cycle;
    const isLastButton = currentIndex + 1 === this.pages.length;

    const shouldNextButtonShow = currentPage.wasAnswered() && (canCycle || !isLastButton);
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
    if (currentIndex === -1) {
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
    });

    if (!this.behaviour.showProgressOnNavigationDots) {
      return;
    }

    this.pages.forEach((page, index) => {
      this.navigation.progressDots.toggleFilledDot(index, page.wasAnswered());
    });
  }

  /**
   * Toggle enabled state of navigation dot.
   * @param {number} index Index of dot to update.
   * @param {boolean} enabled True to enable, false to disable.
   */
  updateNavigationDotEnabledState(index, enabled) {
    const dotDOM = (this.navigation.progressDots.querySelectorAll('.h5p-progress-dot'))[index];
    dotDOM.classList.toggle('disabled', !enabled);
  }

  /**
   * Handle ProgressDotClick on H5P.Component.Navigation
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

    if (this.isSwiping || !this.behaviour.cycle && this.currentPageIndex <= 0) {
      return; // Swiping or already at outer left
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

    if (this.isSwiping || !this.behaviour.cycle && this.currentPageIndex === this.pages.length - 1) {
      return; // Swiping or already at outer right
    }

    this.swipeTo(this.currentPageIndex + 1, { force: true });
  }

  /**
   * Swipe to page.
   * @param {number} [to] Page number to swipe to.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipFocus] If true, skip focus after swiping.
   * @param {boolean} [options.force] If true, ignore checks.
   */
  swipeTo(to = -1, options = {}) {
    if (this.isSwiping || !this.behaviour.cycle && (to < 0 || to > this.pages.length - 1)) {
      return;
    }

    to = (to + this.pages.length) % this.pages.length;

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
   * Check if navigation from one page to another is allowed.
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

    if (this.behaviour.displayPageAnnouncement) {
      this.topbar.setIndicatorCurrent(this.currentPageIndex + 1);
      this.topbar.setIndicatorTotal(this.pages.length);
    }

    if (this.behaviour.displayContentAnnouncement) {
      const page = this.pages[this.currentPageIndex];
      if (page) {
        this.topbar.setTitle(page.getTitle());
      }
    }
  }

  /**
   * Mark current page as answered if it holds no task.
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
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return {
      pageIndex: this.currentPageIndex,
      children: this.pages.map((page) => {
        return page.getCurrentState();
      }),
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
   * Reset.
   */
  reset() {
    this.pages.forEach((page) => {
      page.reset();
    });

    this.swipeTo(0, { skipFocus: true, force: true });

    this.updateNavigation();
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
