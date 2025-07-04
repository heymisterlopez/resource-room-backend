const express = require('express');
const Goal = require('../models/Goals');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get current week's goals for the teacher
router.get('/current', requireAuth, async (req, res) => {
  try {
    const goals = await Goal.getCurrentWeekGoals(req.teacher._id);
    
    // Transform to the format expected by frontend
    const goalsObject = {};
    goals.forEach(goal => {
      goalsObject[goal.group] = {
        topic: goal.topic,
        goal: goal.goal,
        icon: goal.icon
      };
    });

    res.json(goalsObject);
  } catch (error) {
    console.error('Get current goals error:', error);
    res.status(500).json({ error: 'Failed to fetch current goals' });
  }
});

// Update goals for current week
router.put('/current', requireAuth, async (req, res) => {
  try {
    const { goals } = req.body;

    if (!goals || typeof goals !== 'object') {
      return res.status(400).json({ error: 'Invalid goals data' });
    }

    const monday = new Date();
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    monday.setHours(0, 0, 0, 0);

    const updatePromises = [];

    // Update each group's goals
    for (const [group, goalData] of Object.entries(goals)) {
      if (!goalData.topic || !goalData.goal) {
        continue;
      }

      const updatePromise = Goal.findOneAndUpdate(
        {
          teacher: req.teacher._id,
          group: group,
          weekOf: monday,
          isActive: true
        },
        {
          topic: goalData.topic,
          goal: goalData.goal,
          icon: goalData.icon || getDefaultIcon(group)
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

      updatePromises.push(updatePromise);
    }

    await Promise.all(updatePromises);

    res.json({ message: 'Goals updated successfully' });

  } catch (error) {
    console.error('Update goals error:', error);
    res.status(500).json({ error: 'Failed to update goals' });
  }
});

// Get goals history for a specific week
router.get('/week/:date', requireAuth, async (req, res) => {
  try {
    const targetDate = new Date(req.params.date);
    
    // Get Monday of the target week
    const monday = new Date(targetDate);
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    monday.setHours(0, 0, 0, 0);

    const goals = await Goal.find({
      teacher: req.teacher._id,
      weekOf: monday,
      isActive: true
    }).sort({ group: 1 });

    const goalsObject = {};
    goals.forEach(goal => {
      goalsObject[goal.group] = {
        topic: goal.topic,
        goal: goal.goal,
        icon: goal.icon
      };
    });

    res.json({
      weekOf: monday,
      goals: goalsObject
    });

  } catch (error) {
    console.error('Get week goals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals for specified week' });
  }
});

// Get all weeks with goals (for history/archive)
router.get('/weeks', requireAuth, async (req, res) => {
  try {
    const weeks = await Goal.aggregate([
      {
        $match: {
          teacher: req.teacher._id,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$weekOf',
          goalCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': -1 }
      },
      {
        $limit: 10 // Last 10 weeks
      }
    ]);

    res.json(weeks.map(week => ({
      weekOf: week._id,
      goalCount: week.goalCount
    })));

  } catch (error) {
    console.error('Get weeks error:', error);
    res.status(500).json({ error: 'Failed to fetch goals weeks' });
  }
});

// Helper function to get default icon for group
function getDefaultIcon(group) {
  const icons = {
    reading: '📖',
    math: '🔢',
    writing: '✏️',
    behavior: '🤝'
  };
  return icons[group] || '📚';
}

module.exports = router;