const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  item: {
    type: String,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  groups: [{
    type: String,
    enum: ['reading', 'math', 'writing', 'behavior'],
    lowercase: true
  }],
  // Keep primary group for backward compatibility
  primaryGroup: {
    type: String,
    required: true,
    enum: ['reading', 'math', 'writing', 'behavior'],
    lowercase: true
  },
  skillsCompleted: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSkills: {
    type: Number,
    default: 10,
    min: 1
  },
  tokens: {
    type: Number,
    default: 0,
    min: 0
  },
  purchases: [purchaseSchema],
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Daily session tracking (separate collection for better performance)
const sessionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  subjectsAttended: [{
    type: String,
    enum: ['reading', 'math', 'writing', 'behavior']
  }],
  tokensEarned: {
    type: Number,
    default: 0
  },
  present: {
    type: Boolean,
    default: false
  }
});

// Ensure one session per student per day
sessionSchema.index({ student: 1, date: 1 }, { 
  unique: true,
  partialFilterExpression: { 
    date: { 
      $gte: new Date(new Date().setHours(0,0,0,0)) 
    }
  }
});

const Student = mongoose.model('Student', studentSchema);
const Session = mongoose.model('Session', sessionSchema);

module.exports = { Student, Session };