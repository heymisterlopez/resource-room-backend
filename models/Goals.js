const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  group: {
    type: String,
    required: true,
    enum: ['reading', 'math', 'writing', 'behavior'],
    lowercase: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  goal: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: function() {
      const icons = {
        reading: '📖',
        math: '🔢',
        writing: '✏️',
        behavior: '🤝'
      };
      return icons[this.group] || '📚';
    }
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  weekOf: {
    type: Date,
    default: function() {
      // Get Monday of current week
      const now = new Date();
      const monday = new Date(now.setDate(now.getDate() - now.getDay() + 1));
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure one active goal per group per teacher per week
goalSchema.index({ 
  teacher: 1, 
  group: 1, 
  weekOf: 1, 
  isActive: 1 
}, { 
  unique: true,
  partialFilterExpression: { isActive: true }
});

// Static method to get current week's goals for a teacher
goalSchema.statics.getCurrentWeekGoals = function(teacherId) {
  const monday = new Date();
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  
  return this.find({
    teacher: teacherId,
    weekOf: monday,
    isActive: true
  }).sort({ group: 1 });
};

// Static method to create default goals for a new teacher
goalSchema.statics.createDefaultGoals = async function(teacherId) {
  const defaultGoals = [
    {
      group: 'reading',
      topic: '2-syllable words',
      goal: 'Read 8 words correctly',
      teacher: teacherId
    },
    {
      group: 'math',
      topic: 'Addition with regrouping',
      goal: 'Solve 10 problems correctly',
      teacher: teacherId
    },
    {
      group: 'writing',
      topic: 'Complete sentences',
      goal: 'Write 5 complete sentences',
      teacher: teacherId
    },
    {
      group: 'behavior',
      topic: 'Asking for help politely',
      goal: 'Remember: "Excuse me, can you help me please?"',
      teacher: teacherId
    }
  ];

  return this.insertMany(defaultGoals);
};

module.exports = mongoose.model('Goal', goalSchema);