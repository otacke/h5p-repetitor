import { extend } from '@services/util.js';

/** @constant {string} DEFAULT_DESCRIPTION Default description */
const DEFAULT_DESCRIPTION = 'Repetitor';

/**
 * Mixin containing methods for xapi stuff.
 */
export default class XAPI {
  /**
   * Trigger xAPI event.
   * @param {string} verb Short id of verb to be triggered.
   */
  triggerXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEvent(verb);
    this.trigger(xAPIEvent);
  }

  /**
   * Create xAPI event.
   * @param {string} verb Short id of verb to be triggered.
   * @returns {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);

    extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getXAPIDefinition(),
    );

    if (verb === 'progressed' && this.main) {
      xAPIEvent.data.statement.object.definition
        .extensions['http://id.tincanapi.com/extension/ending-point'] =
          this.main.getCurrentPageIndex() + 1;
    }

    return xAPIEvent;
  }

  /**
   * Get xAPI definition for xAPI object.
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
}
