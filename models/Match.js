const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: new Map()
    }
}, {
    timestamps: true
});

// Ensure users array has exactly 2 unique users
matchSchema.pre('save', function (next) {
    if (this.users.length !== 2) {
        return next(new Error('Match must have exactly 2 users'));
    }

    if (this.users[0].equals(this.users[1])) {
        return next(new Error('Cannot match user with themselves'));
    }

    next();
});

// Index for efficient queries
matchSchema.index({ users: 1 });
matchSchema.index({ isActive: 1, lastMessageAt: -1 });

// Method to get the other user in the match
matchSchema.methods.getOtherUser = function (userId) {
    return this.users.find(user => !user.equals(userId));
};

// Method to check if user is in this match
matchSchema.methods.hasUser = function (userId) {
    return this.users.some(user => user.equals(userId));
};

// Method to increment unread count for a user
matchSchema.methods.incrementUnread = function (userId) {
    const currentCount = this.unreadCount.get(userId.toString()) || 0;
    this.unreadCount.set(userId.toString(), currentCount + 1);
};

// Method to reset unread count for a user
matchSchema.methods.resetUnread = function (userId) {
    this.unreadCount.set(userId.toString(), 0);
};

module.exports = mongoose.model('Match', matchSchema); 