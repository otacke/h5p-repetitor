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
 * Call callback function once dom element gets visible in viewport.
 * @param {HTMLElement} dom DOM element to wait for.
 * @param {function} callback Function to call once DOM element is visible.
 */
export const callOnceVisible = (dom, callback) => {
  if (typeof dom !== 'object' || typeof callback !== 'function') {
    return; // Invalid arguments
  }

  // iOS is behind ... Again ...
  const idleCallback = window.requestIdleCallback ?
    window.requestIdleCallback :
    window.requestAnimationFrame;

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
