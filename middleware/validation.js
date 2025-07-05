const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }))
        });
    }
    next();
};

// User registration validation
const validateSignup = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),

    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),

    body('gender')
        .isIn(['male', 'female', 'non-binary', 'other'])
        .withMessage('Please select a valid gender'),

    body('dob')
        .isISO8601()
        .withMessage('Please provide a valid date of birth'),

    handleValidationErrors
];

// User login validation
const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),

    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),

    body('interests')
        .optional()
        .isArray({ max: 10 })
        .withMessage('Maximum 10 interests allowed'),

    body('interests.*')
        .optional()
        .isLength({ max: 30 })
        .withMessage('Each interest cannot exceed 30 characters'),

    handleValidationErrors
];

// Location validation
const validateLocation = [
    body('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),

    body('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),

    handleValidationErrors
];

// Like/Dislike validation
const validateLikeDislike = [
    body('targetUserId')
        .isMongoId()
        .withMessage('Invalid user ID'),

    handleValidationErrors
];

// Chat message validation
const validateChatMessage = [
    body('message')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters'),

    body('messageType')
        .optional()
        .isIn(['text', 'image', 'gif', 'emoji'])
        .withMessage('Invalid message type'),

    handleValidationErrors
];

// Report validation
const validateReport = [
    body('reportedUserId')
        .isMongoId()
        .withMessage('Invalid user ID'),

    body('reason')
        .isIn([
            'inappropriate_behavior',
            'fake_profile',
            'harassment',
            'spam',
            'underage',
            'inappropriate_photos',
            'other'
        ])
        .withMessage('Please select a valid reason'),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

    handleValidationErrors
];

// Admin login validation
const validateAdminLogin = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters'),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    handleValidationErrors
];

// Pagination validation
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    handleValidationErrors
];

// ObjectId validation
const validateObjectId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ID format'),

    handleValidationErrors
];

// Premium purchase validation
const validatePremiumPurchase = [
    body('plan')
        .isIn(['monthly', 'yearly', 'lifetime'])
        .withMessage('Please select a valid plan'),

    body('paymentMethod')
        .isIn(['razorpay', 'stripe'])
        .withMessage('Please select a valid payment method'),

    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateSignup,
    validateLogin,
    validateProfileUpdate,
    validateLocation,
    validateLikeDislike,
    validateChatMessage,
    validateReport,
    validateAdminLogin,
    validatePagination,
    validateObjectId,
    validatePremiumPurchase
}; 