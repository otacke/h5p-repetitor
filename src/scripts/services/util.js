/**
 * Add mixins to a class, useful for splitting files.
 * @param {object} [master] Master class to add mixins to.
 * @param {object[]|object} [mixins] Mixins to be added to master.
 */
export const addMixins = (master = {}, mixins = []) => {
  if (!master.prototype) {
    throw new Error('Master must be a class or function with a prototype');
  }

  if (!Array.isArray(mixins)) {
    mixins = [mixins];
  }

  const masterPrototype = master.prototype;

  mixins.forEach((mixin) => {
    const mixinPrototype = mixin.prototype;
    Object.getOwnPropertyNames(mixinPrototype).forEach((property) => {
      if (property === 'constructor') {
        return; // Don't need constructor
      }

      if (Object.getOwnPropertyNames(masterPrototype).includes(property)) {
        return; // property already present, do not override
      }

      masterPrototype[property] = mixinPrototype[property];
    });
  });
};

/**
 * Call callback function once dom element gets visible in viewport.
 * @param {HTMLElement} dom DOM element to wait for.
 * @param {function} callback Function to call once DOM element is visible.
 */
export const callOnceVisible = (dom, callback) => {
  if (typeof dom !== 'object' || typeof callback !== 'function') {
    return; // Invalid arguments
  }

  // Workaround for iOS, not all versions support requestIdleCallback
  const idleCallback = window.requestIdleCallback ?? window.requestAnimationFrame;

  idleCallback(() => {
    // Get started once visible and ready
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.unobserve(dom);
        callback();
      }
    }, {
      threshold: 0,
    });
    observer.observe(dom);
  });
};

/**
 * Extend objects like jQuery's extend.
 * @param {object} target Target object.
 * @param {...object} sources Source objects.
 * @returns {object} Merged target object.
 */
export const extend = (target, ...sources) => {
  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (typeof target[key] === 'object' && typeof source[key] === 'object') {
          extend(target[key], source[key]);
        }
        else {
          target[key] = source[key];
        }
      }
    }
  }

  return target;
};

/**
 * Format Date as locale-aware date-time string.
 * @param {Date} [date] Date to format. Defaults to now.
 * @returns {string} Formatted date-time string.
 */
export const getLocalDateRepresentation = (date = new Date()) => {
  return date.toLocaleString(navigator.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Format language tag (RFC 5646). Assuming "language-coutry". No validation.
 * Cmp. https://tools.ietf.org/html/rfc5646
 * @param {string} languageCode Language tag.
 * @returns {string} Formatted language tag.
 */
export const formatLanguageCode = (languageCode) => {
  if (typeof languageCode !== 'string') {
    return languageCode;
  }

  /*
    * RFC 5646 states that language tags are case insensitive, but
    * recommendations may be followed to improve human interpretation
    */
  const segments = languageCode.split('-');
  segments[0] = segments[0].toLowerCase(); // ISO 639 recommendation
  if (segments.length > 1) {
    segments[1] = segments[1].toUpperCase(); // ISO 3166-1 recommendation
  }
  languageCode = segments.join('-');

  return languageCode;
};

/**
 * Randomize order of elements in array using Fisher-Yates shuffle.
 * @param {unknown[]} array Array to randomize.
 * @returns {unknown[]} New array with elements in random order.
 */
export const randomize = (array) => {
  if (!Array.isArray(array)) {
    return array;
  }

  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

/**
 * Compute score ratio, treating contents without task (maxScore 0) as full pass.
 * @param {number} score Score reached.
 * @param {number} maxScore Maximum possible score.
 * @returns {number} Score ratio between 0 and 1.
 */
export const getScoreRatio = (score, maxScore) => {
  return maxScore > 0 ? score / maxScore : 1;
};
