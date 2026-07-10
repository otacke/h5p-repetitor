/**
 * Apply `behaviour` override to behaviour config object.
 * @param {object} behaviour Behaviour config object to mutate.
 * @param {object} behaviourOverrides User-provided behaviour overrides.
 * @param {string} configKey Key on behaviour object to set.
 * @param {string} overrideKey Key on the overrides object.
 */
export const applyBehaviourOverride = (behaviour, behaviourOverrides, configKey, overrideKey) => {
  if (behaviourOverrides[overrideKey] !== 'contentSetting') {
    behaviour[configKey] = behaviourOverrides[overrideKey] === 'on';
  }
};

/**
 * Apply both solution button and retry button overrides to behaviour object.
 * @param {object} behaviour Behaviour config object to mutate.
 * @param {object} behaviourOverrides User-provided behaviour overrides.
 */
export const applyBehaviourOverrides = (behaviour, behaviourOverrides) => {
  applyBehaviourOverride(behaviour, behaviourOverrides, 'enableSolutionsButton', 'overrideShowSolutionButton');
  applyBehaviourOverride(behaviour, behaviourOverrides, 'enableRetry', 'overrideRetryButton');
};

/**
 * Apply behaviour overrides to a CoursePresentation content item.
 * @param {object} contentItem Content item to modify.
 * @param {object} behaviourOverrides Behaviour overrides from parent params.
 */
const overrideContentParamsCoursePresentation = (contentItem, behaviourOverrides) => {
  const slides = contentItem.libraryParams.params?.presentation?.slides;
  if (!Array.isArray(slides)) {
    return;
  }

  for (const slide of slides) {
    const elements = slide.elements ?? [];
    for (const element of elements) {
      if (element.action?.params) {
        element.action.params.behaviour = element.action.params.behaviour || {};
        applyBehaviourOverrides(element.action.params.behaviour, behaviourOverrides);
      }
    }
  }
};

/**
 * Apply behaviour overrides to an InteractiveVideo content item.
 * @param {object} contentItem Content item to modify.
 * @param {object} behaviourOverrides Behaviour overrides from parent params.
 */
const overrideContentParamsInteractiveVideo = (contentItem, behaviourOverrides) => {
  const interactions = contentItem.libraryParams.params?.interactiveVideo?.assets?.interactions;
  if (!Array.isArray(interactions)) {
    return;
  }

  for (const interaction of interactions) {
    if (interaction.action?.params) {
      interaction.action.params.behaviour = interaction.action.params.behaviour || {};

      applyBehaviourOverrides(interaction.action.params.behaviour, behaviourOverrides);
    }
  }
};

/**
 * Apply behaviour overrides to a MemoryGame content item.
 * @param {object} contentItem Content item to modify.
 * @param {object} behaviourOverrides Behaviour overrides from parent params.
 */
const overrideContentParamsMemoryGame = (contentItem, behaviourOverrides) => {
  applyBehaviourOverride(
    contentItem.libraryParams.params.behaviour,
    behaviourOverrides,
    'allowRetry',
    'overrideRetryButton',
  );
};

/**
 * Apply behaviour overrides to a QuestionSet content item.
 * @param {object} contentItem Content item to modify.
 * @param {object} behaviourOverrides Behaviour overrides from parent params.
 */
const overrideContentParamsQuestionSet = (contentItem, behaviourOverrides) => {
  contentItem.libraryParams.params.override = contentItem.libraryParams.params.override || {};

  if (['on', 'off'].includes(behaviourOverrides.overrideShowSolutionButton)) {
    contentItem.libraryParams.params.override.showSolutionButton = behaviourOverrides.overrideShowSolutionButton;
  }

  if (['on', 'off'].includes(behaviourOverrides.overrideRetryButton)) {
    contentItem.libraryParams.params.override.retryButton = behaviourOverrides.overrideRetryButton;
  }
};

/**
 * Override content parameters by applying behaviour overrides from parent params.
 * @param {object[]} [content] Content items to sanitize.
 * @param {object} behaviourOverrides Behaviour overrides from parent params.
 * @returns {object[]} Sanitized content items.
 */
export const overrideContentParams = (content, behaviourOverrides) => {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.map((contentItem) => {
    if (!contentItem.libraryParams?.params) {
      return contentItem;
    }

    const machineName = contentItem.libraryParams.library.split(' ')[0];
    const handler = OVERRIDE_CONTENT_PARAMS[machineName];
    if (handler) {
      handler(contentItem, behaviourOverrides);
    }

    contentItem.libraryParams.params.behaviour = contentItem.libraryParams.params.behaviour ?? {};

    applyBehaviourOverrides(contentItem.libraryParams.params.behaviour, behaviourOverrides);

    return contentItem;
  });
};

/**
 * @constant {object} OVERRIDE_CONTENT_PARAMS Mapping of library machine names to their content override handlers.
 */
const OVERRIDE_CONTENT_PARAMS = {
  'H5P.CoursePresentation': overrideContentParamsCoursePresentation,
  'H5P.InteractiveVideo': overrideContentParamsInteractiveVideo,
  'H5P.MemoryGame': overrideContentParamsMemoryGame,
  'H5P.QuestionSet': overrideContentParamsQuestionSet,
};
