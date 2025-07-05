const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: [true, 'Report reason is required'],
        enum: [
            'inappropriate_behavior',
            'fake_profile',
            'harassment',
            'spam',
            'underage',
            'inappropriate_photos',
            'other'
        ]
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    status: {
        type: String,
        enum: ['pending', 'investigating', 'resolved', 'dismissed'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    resolvedAt: {
        type: Date
    },
    action: {
        type: String,
        enum: ['warning', 'temporary_ban', 'permanent_ban', 'no_action'],
        default: 'no_action'
    },
    evidence: [{
        type: String // URLs to screenshots or other evidence
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
reportSchema.index({ reportedUser: 1, status: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to prevent self-reporting
reportSchema.pre('save', function (next) {
    if (this.reportedBy.equals(this.reportedUser)) {
        return next(new Error('Cannot report yourself'));
    }
    next();
});

// Method to resolve report
reportSchema.methods.resolve = function (adminId, action, notes) {
    this.status = 'resolved';
    this.resolvedBy = adminId;
    this.resolvedAt = new Date();
    this.action = action;
    this.adminNotes = notes;
    return this.save();
};

// Method to dismiss report
reportSchema.methods.dismiss = function (adminId, notes) {
    this.status = 'dismissed';
    this.resolvedBy = adminId;
    this.resolvedAt = new Date();
    this.action = 'no_action';
    this.adminNotes = notes;
    return this.save();
};

module.exports = mongoose.model('Report', reportSchema); 