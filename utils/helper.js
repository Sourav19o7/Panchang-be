// utils/helpers.js
const crypto = require('crypto');

class Helpers {
  // Generate unique ID
  static generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Format date to YYYY-MM-DD
  static formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Format date for display
  static formatDisplayDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Format currency (Indian Rupees)
  static formatCurrency(amount) {
    if (!amount && amount !== 0) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  // Format percentage
  static formatPercentage(value, decimals = 2) {
    if (!value && value !== 0) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
  }

  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  static validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  static calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }

  // Sanitize string input
  static sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  }

  // Parse JSON safely
  static safeJSONParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      return defaultValue;
    }
  }

  // Deep clone object
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Generate slug from string
  static generateSlug(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Calculate pagination info
  static calculatePagination(total, limit, offset) {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    
    return {
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      nextOffset: currentPage < totalPages ? offset + limit : null,
      prevOffset: currentPage > 1 ? offset - limit : null
    };
  }

  // Validate Indian phone number
  static isValidIndianPhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }

  // Format Indian phone number
  static formatIndianPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+91 ${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
    }
    return phone;
  }

  // Calculate age from date of birth
  static calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Get time ago string
  static getTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - new Date(date);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return this.formatDisplayDate(date);
  }

  // Generate random color
  static generateRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#FFB347', '#87CEEB', '#F0E68C'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Truncate text with ellipsis
  static truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  // Convert string to title case
  static toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  // Remove HTML tags from string
  static stripHtmlTags(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Check if string is empty or whitespace
  static isEmpty(str) {
    return !str || str.trim().length === 0;
  }

  // Generate random string
  static generateRandomString(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Convert object to query string
  static objectToQueryString(obj) {
    return Object.keys(obj)
      .filter(key => obj[key] !== null && obj[key] !== undefined && obj[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
      .join('&');
  }

  // Parse query string to object
  static queryStringToObject(queryString) {
    const params = new URLSearchParams(queryString);
    const obj = {};
    for (const [key, value] of params.entries()) {
      obj[key] = value;
    }
    return obj;
}
}

module.exports = Helpers;