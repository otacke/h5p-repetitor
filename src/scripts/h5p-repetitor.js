import Dictionary from '@services/dictionary.js';
import { getSemanticsDefaults } from '@services/h5p-util.js';
import { callOnceVisible, extend, formatLanguageCode } from '@services/util.js';
import Main from '@components/main.js';

/** @constant {string} DEFAULT_DESCRIPTION Default description*/
const DEFAULT_DESCRIPTION = 'Repetitor';

export default class Repetitor extends H5P.EventDispatcher {
  /**
   * @class
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super();

    const defaults = extend({
      behaviour: {
        enableRetry: false, // @see {@link https://h5p.org/documentation/developers/contracts#guides-header-9}
        enableSolutionsButton: false, // @see {@link https://h5p.org/documentation/developers/contracts#guides-header-8}
        enableCheckButton: true, // Undocumented Question Type contract setting
      },
    }, getSemanticsDefaults());

    // Sanitize parameters
    this.params = extend(defaults, params);

    this.contentId = contentId;

    this.extras = extend({
      previousState: {},
    }, extras);

    // Fill dictionary
    this.dictionary = new Dictionary();
    this.dictionary.fill({ l10n: this.params.l10n, a11y: this.params.a11y });

    // Set globals
    this.globals = new Map();
    this.globals.set('mainInstance', this);
    this.globals.set('params', this.params);
    this.globals.set('contentId', this.contentId);
    this.globals.set('extras', this.extras);
    this.globals.set('resize', () => {
      this.trigger('resize');
    });

    const defaultLanguage = extras?.metadata?.defaultLanguage || 'en';
    this.languageTag = formatLanguageCode(defaultLanguage);

    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-repetitor', 'h5p-theme');

    this.main = new Main(
      {
        dictionary: this.dictionary,
        globals: this.globals,
      },
      {
        onProgressed: (index) => {
          this.handleProgressed(index);
        },
      },
    );
    this.dom.appendChild(this.main.getDOM());

    callOnceVisible(
      this.dom, () => {
        this.trigger('resize');

        window.requestAnimationFrame(() => {
          // Math.max prevents edge case where startIndex -1 was stored
          const startIndex = Math.max(0, this.extras.previousState.pageIndex ?? 0);

          this.main.swipeTo(startIndex, { skipFocus: true, force: true });
          this.main.updateAnnouncement();
        });
      },
    );
  }

  /**
   * Attach DOM to H5P wrapper.
   * @param {H5P.jQuery} $wrapper H5P wrapper.
   */
  attach($wrapper) {
    $wrapper.get(0).append(this.dom);
  }

  /**
   * Get tasks title.
   * @returns {string} Title.
   */
  getTitle() {
    let raw;
    if (this.extras.metadata) {
      raw = this.extras.metadata.title;
    }
    raw = raw || DEFAULT_DESCRIPTION;

    // H5P Core function: createTitle
    return H5P.createTitle(raw);
  }

  /**
   * Get tasks description.
   * @returns {string} Description.
   */
  getDescription() {
    return this.params.taskDescription || DEFAULT_DESCRIPTION;
  }

  /**
   * Get context data. Contract used for confusion report.
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
   * Handle progressed.
   */
  handleProgressed() {
    this.triggerXAPIEvent('progressed');
  }

  /**
   * Trigger xAPI event.
   * @param {string} verb Short id of the verb we want to trigger.
   */
  triggerXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEvent(verb);
    this.trigger(xAPIEvent);
  }

  /**
   * Create an xAPI event.
   * @param {string} verb Short id of the verb we want to trigger.
   * @returns {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);

    extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getXAPIDefinition(),
    );

    if (verb === 'progressed') {
      xAPIEvent.data.statement.object.definition
        .extensions['http://id.tincanapi.com/extension/ending-point'] =
          this.main.getCurrentPageIndex + 1;
    }

    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   * @returns {object} XAPI definition.
   */
  getXAPIDefinition() {
    const definition = {};

    definition.name = {};
    definition.name[this.languageTag] = this.getTitle();
    // Fallback for h5p-php-reporting, expects en-US
    definition.name['en-US'] = definition.name[this.languageTag];

    definition.description = {};
    definition.description[this.languageTag] = this.getDescription();
    // Fallback for h5p-php-reporting, expects en-US
    definition.description['en-US'] = definition.description[this.languageTag];

    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'other';

    return definition;
  }

  /**
   * Return H5P core's call to store current state.
   * @returns {object} Current state.
   */
  getCurrentState() {
    return this.main.getCurrentState();
  }
}
