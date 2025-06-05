

// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size too large. Maximum size is 10MB.'
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too many files. Maximum 5 files allowed.'
    });
  }

  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Only PDF files are allowed'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication token expired'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Supabase errors
  if (err.code === 'PGRST116') {
    return res.status(404).json({
      success: false,
      error: 'Resource not found'
    });
  }

  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      error: 'Resource already exists'
    });
  }

  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      success: false,
      error: 'Invalid reference to related resource'
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }

  // Google API errors
  if (err.message && err.message.includes('Google')) {
    return res.status(503).json({
      success: false,
      error: 'Google services temporarily unavailable'
    });
  }

  // Gemini API errors
  if (err.message && err.message.includes('Gemini')) {
    return res.status(503).json({
      success: false,
      error: 'AI service temporarily unavailable'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};

module.exports = errorHandler;