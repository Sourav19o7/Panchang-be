// utils/constants.js
const PUJA_CONSTANTS = {
  STATUSES: {
    PENDING_REVIEW: 'pending_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FEEDBACK_RECEIVED: 'feedback_received'
  },

  USER_ROLES: {
    ADMIN: 'admin',
    EDITOR: 'editor',
    USER: 'user'
  },

  MONTHS: {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December'
  },

  DEITIES: [
    'Ganesha',
    'Shiva',
    'Vishnu',
    'Durga',
    'Lakshmi',
    'Saraswati',
    'Krishna',
    'Rama',
    'Hanuman',
    'Kali',
    'Parvati',
    'Brahma',
    'Surya',
    'Chandra',
    'Mangal',
    'Budh',
    'Guru',
    'Shukra',
    'Shani',
    'Rahu',
    'Ketu'
  ],

  USE_CASES: [
    'Health & Wellness',
    'Career Growth',
    'Relationship Harmony',
    'Financial Prosperity',
    'Education Success',
    'Spiritual Progress',
    'Protection from Negativity',
    'Mental Peace',
    'Family Happiness',
    'Business Success',
    'Marriage & Love',
    'Children Welfare',
    'Travel Safety',
    'Property & Home',
    'Debt Relief',
    'Victory & Success',
    'Knowledge & Wisdom',
    'Divine Blessings'
  ],

  TITHIS: [
    'Pratipada',
    'Dwitiya',
    'Tritiya',
    'Chaturthi',
    'Panchami',
    'Shashthi',
    'Saptami',
    'Ashtami',
    'Navami',
    'Dashami',
    'Ekadashi',
    'Dwadashi',
    'Trayodashi',
    'Chaturdashi',
    'Purnima',
    'Amavasya'
  ],

  NAKSHATRAS: [
    'Ashwini',
    'Bharani',
    'Krittika',
    'Rohini',
    'Mrigashira',
    'Ardra',
    'Punarvasu',
    'Pushya',
    'Ashlesha',
    'Magha',
    'Purva Phalguni',
    'Uttara Phalguni',
    'Hasta',
    'Chitra',
    'Swati',
    'Vishakha',
    'Anuradha',
    'Jyeshtha',
    'Mula',
    'Purva Ashadha',
    'Uttara Ashadha',
    'Shravana',
    'Dhanishta',
    'Shatabhisha',
    'Purva Bhadrapada',
    'Uttara Bhadrapada',
    'Revati'
  ],

  GRAHAS: [
    'Sun (Surya)',
    'Moon (Chandra)',
    'Mars (Mangal)',
    'Mercury (Budh)',
    'Jupiter (Guru)',
    'Venus (Shukra)',
    'Saturn (Shani)',
    'Rahu',
    'Ketu'
  ],

  EXPERIMENT_TYPES: [
    'deity_combination',
    'timing_innovation',
    'use_case_expansion',
    'cultural_fusion',
    'modern_adaptation'
  ],

  ANALYSIS_TYPES: [
    'performance',
    'feedback_synthesis',
    'competitive',
    'seasonal',
    'market_trends'
  ],

  TIMEFRAMES: [
    '1_month',
    '3_months',
    '6_months',
    '1_year',
    '2_years'
  ],

  RATING_SCALE: {
    MIN: 1,
    MAX: 5,
    LABELS: {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent'
    }
  },

  FILE_LIMITS: {
    PDF_MAX_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 5,
    ALLOWED_TYPES: ['application/pdf']
  },

  API_LIMITS: {
    RATE_LIMIT: 100, // requests per 15 minutes
    MAX_PROPOSITIONS_PER_REQUEST: 50,
    MAX_FEEDBACK_PER_REQUEST: 100
  },

  ERROR_CODES: {
    INVALID_INPUT: 'INVALID_INPUT',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  },

  SUCCESS_MESSAGES: {
    USER_CREATED: 'User created successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    PUJA_CREATED: 'Puja proposition created successfully',
    FEEDBACK_SUBMITTED: 'Feedback submitted successfully',
    EXPORT_SUCCESS: 'Data exported successfully'
  }
};

const VALIDATION_RULES = {
  EMAIL: {
    REQUIRED: true,
    MIN_LENGTH: 5,
    MAX_LENGTH: 255,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },

  PASSWORD: {
    REQUIRED: true,
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true
  },

  NAME: {
    REQUIRED: true,
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z\s.''-]+$/
  },

  PUJA_NAME: {
    REQUIRED: true,
    MIN_LENGTH: 5,
    MAX_LENGTH: 200
  },

  RATIONALE: {
    REQUIRED: true,
    MIN_LENGTH: 400,
    MAX_LENGTH: 1000
  },

  RATING: {
    REQUIRED: true,
    MIN: 1,
    MAX: 5,
    TYPE: 'number'
  }
};

module.exports = {
  PUJA_CONSTANTS,
  VALIDATION_RULES
};