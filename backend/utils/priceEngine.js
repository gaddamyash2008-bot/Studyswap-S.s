const DEFAULT_SETTINGS = {
  annualRate: 0.15,
  conditionMultipliers: {
    'Like New': 1.0,
    'Good': 0.9,
    'Fair': 0.75,
    'Poor': 0.55,
  },
  minComparableMatches: 2,
  marketWeight: 0.6,
  mathematicalWeight: 0.4,
  recencyDays: 365,
  lowerBound: 0,
  upperBound: 500000,
};

function roundMoney(value) {
  const numeric = Number(value || 0);
  return Number(Math.max(0, numeric).toFixed(2));
}

function median(values) {
  if (!values || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function buildComparableInfo(comparableSales = []) {
  const validSales = comparableSales
    .filter((sale) => Number(sale.price || 0) > 0)
    .map((sale) => Number(sale.price));

  if (validSales.length === 0) {
    return {
      available: false,
      count: 0,
      median: 0,
      min: 0,
      max: 0,
      explanation: 'Insufficient comparable sales were found.',
    };
  }

  return {
    available: validSales.length >= DEFAULT_SETTINGS.minComparableMatches,
    count: validSales.length,
    median: median(validSales),
    min: Math.min(...validSales),
    max: Math.max(...validSales),
    explanation: validSales.length >= DEFAULT_SETTINGS.minComparableMatches
      ? 'Sufficient comparable sales were found.'
      : 'Comparable sale count is below the configured threshold.',
  };
}

function calculateMathematicalEstimate({ originalPrice, ageYears, condition }) {
  const P = Number(originalPrice || 0);
  const T = Number(ageYears || 0);

  if (P <= 0) {
    throw new Error('Original purchase price must be greater than zero.');
  }

  if (T < 0) {
    throw new Error('Book age cannot be negative.');
  }

  const annualRate = Number(DEFAULT_SETTINGS.annualRate || 0.15);
  const multiplier = Number(DEFAULT_SETTINGS.conditionMultipliers[condition] || DEFAULT_SETTINGS.conditionMultipliers['Good']);
  const safeAgeYears = Math.min(T, 8);

  const depreciation = P * annualRate * safeAgeYears;
  const realisticValue = P - Math.min(depreciation, P * 0.75);
  const adjustedValue = realisticValue * multiplier;
  const cappedValue = Math.min(Math.max(adjustedValue, DEFAULT_SETTINGS.lowerBound), P);
  const nearBookValue = cappedValue * (1 - Math.min(safeAgeYears * 0.03, 0.18));
  const boundedValue = Math.min(Math.max(nearBookValue, DEFAULT_SETTINGS.lowerBound), DEFAULT_SETTINGS.upperBound);

  return roundMoney(boundedValue);
}

function calculatePricingEstimate(input, comparableSales = []) {
  const { originalPrice, ageYears, condition } = input;
  const mathEstimate = calculateMathematicalEstimate({ originalPrice, ageYears, condition });

  const comparableInfo = buildComparableInfo(comparableSales);
  const marketMedian = comparableInfo.available ? comparableInfo.median : mathEstimate;
  const maxAllowedPrice = Number(originalPrice || 0);
  const hybridEstimateRaw = comparableInfo.available
    ? (DEFAULT_SETTINGS.mathematicalWeight * mathEstimate) + (DEFAULT_SETTINGS.marketWeight * marketMedian)
    : mathEstimate;
  const hybridEstimate = roundMoney(Math.min(Math.max(hybridEstimateRaw, 0), maxAllowedPrice));

  const lowerBound = Math.max(0, roundMoney(mathEstimate * 0.85));
  const upperBound = Math.min(maxAllowedPrice, roundMoney(mathEstimate * 1.15));
  const suggestedRange = comparableInfo.available
    ? {
        min: roundMoney(Math.min(lowerBound, comparableInfo.median * 0.9)),
        max: roundMoney(Math.max(upperBound, comparableInfo.median * 1.1)),
        label: 'Market-backed range based on comparable completed exchanges',
      }
    : {
        min: lowerBound,
        max: upperBound,
        label: 'Provisional mathematical range',
      };

  const evidenceLabel = comparableInfo.available ? 'Stronger evidence' : 'Limited evidence';
  const explanation = comparableInfo.available
    ? 'The estimate combines a conservative resale model with actual comparable completed exchanges from the StudySwap marketplace.'
    : 'Comparable exchange data is insufficient, so the recommendation relies on a realistic resale model for this book condition and age.';

  return {
    formulaVersion: 'v1.1',
    settings: DEFAULT_SETTINGS,
    mathEstimate,
    comparableSalesCount: comparableInfo.count,
    comparableMedian: comparableInfo.median,
    hybridEstimate: roundMoney(hybridEstimate),
    suggestedRange,
    evidenceLabel,
    explanation,
    recommendationText: comparableInfo.available
      ? 'Hybrid estimate – fair resale price near the current book value.'
      : 'Realistic resale estimate – near the book value and below the original purchase price.',
    comparableInfo,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  calculatePricingEstimate,
  calculateMathematicalEstimate,
  roundMoney,
};
