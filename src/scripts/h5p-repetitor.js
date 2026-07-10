import Main from '@components/main.js';
import QuestionTypeContract from '@mixins/question-type-contract.js';
import XAPI from '@mixins/xapi.js';
import Dictionary from '@services/dictionary.js';
import { getSemanticsDefaults } from '@services/h5p-util.js';
import { addMixins, callOnceVisible, extend, formatLanguageCode } from '@services/util.js';
import { overrideContentParams } from '@services/parameter-handling.js';

export default class Repetitor extends H5P.EventDispatcher {
  /**
   * @class
   * @param {object} params Parameters from editor.
   * @param {number} contentId Content id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super();

    try {
      addMixins(Repetitor, [QuestionTypeContract, XAPI]);
    }
    catch (error) {
      console.error('Could not apply mixins:', error);
    }

    const defaults = extend({
      behaviour: {
        enableRetry: false, // see https://h5p.org/documentation/developers/contracts#guides-header-9
        enableSolutionsButton: false, // see https://h5p.org/documentation/developers/contracts#guides-header-8
        enableCheckButton: true, // Undocumented Question Type contract setting
      },
    }, getSemanticsDefaults());

    // Sanitize and override parameters
    this.params = extend(defaults, params);
    this.params.content = overrideContentParams(this.params.content, this.params.behaviour);

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
        onProgressed: () => {
          this.triggerXAPIEvent('progressed');
        },
      },
    );
    this.dom.appendChild(this.main.getDOM());

    callOnceVisible(this.dom, () => {
      this.initializeOnVisible();
    });
  }

  /**
   * Initialize content once visible in viewport.
   */
  initializeOnVisible() {
    this.trigger('resize');

    window.requestAnimationFrame(() => {
      // Math.max prevents edge case where startIndex -1 was stored
      const startIndex = Math.max(0, this.extras.previousState.pageIndex ?? 0);

      this.main.swipeTo(startIndex, { skipFocus: true, force: true });
      this.main.updateAnnouncement();
    });
  }

  /**
   * Attach DOM to H5P wrapper.
   * @param {H5P.jQuery} $wrapper H5P wrapper.
   */
  attach($wrapper) {
    $wrapper.get(0).append(this.dom);
  }
}
