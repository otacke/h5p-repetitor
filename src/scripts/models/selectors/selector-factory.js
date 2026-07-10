import LeitnerSelector from './leitner-selector.js';
import FixedIntervalSelector from './fixed-interval-selector.js';
import MasteryThresholdSelector from './mastery-threshold-selector.js';
import CustomWeightedSelector from './custom-weighted-selector.js';

/**
 * Create page selector instance matching configured spaced repetition mode.
 * @param {object} [params] Spaced repetition parameters as authored in semantics.
 * @returns {object|null} Selector instance, or null if mode is not recognized.
 */
export const createSelector = (params = {}) => {
  const maxPagesPerRound = params.general?.pagesPerRound || null;

  if (params.mode === 'leitner') {
    return new LeitnerSelector({
      boxIntervalsDays: params.leitner?.boxIntervalsDays,
      promotionStreak: params.leitner?.promotionStreak ?? 1,
      maxPagesPerRound: maxPagesPerRound,
    });
  }

  if (params.mode === 'fixedInterval') {
    return new FixedIntervalSelector({
      intervalDays: params.fixedInterval?.intervalDays,
      maxPagesPerRound: maxPagesPerRound,
    });
  }

  if (params.mode === 'masteryThreshold') {
    return new MasteryThresholdSelector({
      passThreshold: params.masteryThreshold?.passThreshold,
      requiredConsecutivePasses: params.masteryThreshold?.requiredConsecutivePasses,
      intervalDays: params.masteryThreshold?.intervalDays,
      maxPagesPerRound: maxPagesPerRound,
    });
  }

  if (params.mode === 'customWeighted') {
    return new CustomWeightedSelector({
      weights: {
        staleness: params.customWeighted?.weightStaleness ?? 1,
        lastScore: params.customWeighted?.weightLastScore ?? 1,
        averageScore: params.customWeighted?.weightAverageScore ?? 1,
        attemptCount: params.customWeighted?.weightAttemptCount ?? 1,
      },
      intervalDays: params.customWeighted?.intervalDays,
      maxPagesPerRound: maxPagesPerRound,
    });
  }

  return null;
};
