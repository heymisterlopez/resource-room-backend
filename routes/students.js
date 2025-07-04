const express = require('express');
const { Student, Session } = require('../models/Student');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all students for the current teacher
router.get('/', requireAuth, async (req, res) => {
  try {
    const students = await Student.find({ 
      teacher: req.teacher._id, 
      isActive: true 
    }).sort({ name: 1 });

    // Get today's sessions for all students
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sessions = await Session.find({
      teacher: req.teacher._id,
      date: { $gte: today }
    });

    // Map sessions to students and handle data migration
    const studentsWithSessions = students.map(student => {
      const todaySession = sessions.find(s => 
        s.student.toString() === student._id.toString()
      );

      // Handle migration for old students without groups/primaryGroup
      let studentGroups = student.groups;
      let primaryGroup = student.primaryGroup;
      let displayGroup = student.group; // For backward compatibility

      // If student has old 'group' field but no 'groups' array, migrate it
      if (student.group && (!student.groups || student.groups.length === 0)) {
        studentGroups = [student.group];
        primaryGroup = student.group;
        displayGroup = student.group;
        
        // Update the student in database
        Student.findByIdAndUpdate(student._id, {
          groups: [student.group],
          primaryGroup: student.group
        }).catch(err => console.error('Migration error:', err));
      }
      // If student has no group data at all, default to reading
      else if ((!student.groups || student.groups.length === 0) && !student.group && !student.primaryGroup) {
        studentGroups = ['reading'];
        primaryGroup = 'reading';
        displayGroup = 'reading';
        
        // Update the student in database
        Student.findByIdAndUpdate(student._id, {
          groups: ['reading'],
          primaryGroup: 'reading'
        }).catch(err => console.error('Migration error:', err));
      }
      // Use existing data
      else {
        displayGroup = primaryGroup || studentGroups?.[0] || 'reading';
      }

      return {
        ...student.toObject(),
        groups: studentGroups,
        primaryGroup: primaryGroup,
        todayTokens: todaySession?.tokensEarned || 0,
        todaySubjects: todaySession?.subjectsAttended || [],
        present: todaySession?.present || false,
        // For backward compatibility, use primaryGroup as group
        group: displayGroup
      };
    });

    res.json(studentsWithSessions);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Add new student
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, groups, primaryGroup, skillsCompleted = 0, totalSkills = 10 } = req.body;

    if (!name || (!groups && !primaryGroup)) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and at least one group are required'
      });
    }

    // Handle both old (single group) and new (multiple groups) format
    let studentGroups = [];
    let studentPrimaryGroup = '';

    if (groups && Array.isArray(groups)) {
      studentGroups = groups.map(g => g.toLowerCase());
      studentPrimaryGroup = primaryGroup?.toLowerCase() || studentGroups[0];
    } else {
      // Backward compatibility - single group
      const singleGroup = primaryGroup || groups;
      studentGroups = [singleGroup.toLowerCase()];
      studentPrimaryGroup = singleGroup.toLowerCase();
    }

    // Check if student already exists for this teacher
    const existingStudent = await Student.findOne({
      name: name.toUpperCase(),
      teacher: req.teacher._id,
      isActive: true
    });

    if (existingStudent) {
      return res.status(400).json({
        error: 'Student already exists',
        message: 'A student with this name already exists in your class'
      });
    }

    const student = new Student({
      name: name.toUpperCase(),
      groups: studentGroups,
      primaryGroup: studentPrimaryGroup,
      skillsCompleted,
      totalSkills,
      teacher: req.teacher._id
    });

    await student.save();

    res.status(201).json({
      message: 'Student added successfully',
      student: {
        ...student.toObject(),
        todayTokens: 0,
        todaySubjects: [],
        present: false,
        // For backward compatibility
        group: student.primaryGroup
      }
    });

  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: 'Failed to add student' });
  }
});

// Update student groups
router.put('/:id/groups', requireAuth, async (req, res) => {
  try {
    const { groups, primaryGroup } = req.body;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({
        error: 'Invalid groups',
        message: 'Groups must be a non-empty array'
      });
    }

    if (primaryGroup && !groups.includes(primaryGroup)) {
      return res.status(400).json({
        error: 'Invalid primary group',
        message: 'Primary group must be one of the selected groups'
      });
    }

    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update groups
    student.groups = groups.map(g => g.toLowerCase());
    student.primaryGroup = (primaryGroup || groups[0]).toLowerCase();

    await student.save();

    res.json({
      message: 'Student groups updated successfully',
      student: {
        ...student.toObject(),
        group: student.primaryGroup // For backward compatibility
      }
    });

  } catch (error) {
    console.error('Update student groups error:', error);
    res.status(500).json({ error: 'Failed to update student groups' });
  }
});

// Update student
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, group, skillsCompleted, totalSkills, tokens } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update fields if provided
    if (name) student.name = name.toUpperCase();
    if (group) student.group = group.toLowerCase();
    if (skillsCompleted !== undefined) student.skillsCompleted = skillsCompleted;
    if (totalSkills !== undefined) student.totalSkills = totalSkills;
    if (tokens !== undefined) student.tokens = tokens;

    await student.save();

    res.json({
      message: 'Student updated successfully',
      student: student.toObject()
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.isActive = false;
    await student.save();

    res.json({ message: 'Student deleted successfully' });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Student check-in (when they click "I'M READY")
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const { group } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if student is enrolled in this group
    const isEnrolledInGroup = student.groups?.includes(group) || 
                             student.primaryGroup === group ||
                             student.group === group; // backward compatibility

    if (!isEnrolledInGroup) {
      return res.status(400).json({
        error: 'Student not enrolled',
        message: `${student.name} is not enrolled in the ${group} group`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's session
    let session = await Session.findOne({
      student: student._id,
      teacher: req.teacher._id,
      date: { $gte: today }
    });

    if (!session) {
      session = new Session({
        student: student._id,
        teacher: req.teacher._id,
        date: new Date()
      });
    }

    // Check if already attended this subject today
    if (session.subjectsAttended.includes(group)) {
      return res.status(400).json({
        error: 'Already checked in',
        message: `${student.name} already earned a token for ${group} today!`
      });
    }

    // Add subject and award token
    session.subjectsAttended.push(group);
    session.tokensEarned += 1;
    session.present = true;

    await session.save();

    // Update student's total tokens
    student.tokens += 1;
    await student.save();

    res.json({
      message: 'Check-in successful',
      tokensEarned: 1,
      totalTokens: student.tokens
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in student' });
  }
});

// Award bonus tokens
router.post('/:id/bonus', requireAuth, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid token amount' });
    }

    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update student tokens
    student.tokens += amount;
    await student.save();

    // Update today's session
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let session = await Session.findOne({
      student: student._id,
      teacher: req.teacher._id,
      date: { $gte: today }
    });

    if (session) {
      session.tokensEarned += amount;
      await session.save();
    }

    res.json({
      message: 'Bonus tokens awarded',
      tokensAwarded: amount,
      totalTokens: student.tokens,
      reason
    });

  } catch (error) {
    console.error('Bonus tokens error:', error);
    res.status(500).json({ error: 'Failed to award bonus tokens' });
  }
});

// Student purchase
router.post('/:id/purchase', requireAuth, async (req, res) => {
  try {
    const { item, cost } = req.body;

    if (!item || !cost || cost <= 0) {
      return res.status(400).json({ error: 'Invalid purchase data' });
    }

    const student = await Student.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isActive: true
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.tokens < cost) {
      return res.status(400).json({ 
        error: 'Insufficient tokens',
        message: 'Student does not have enough tokens for this purchase'
      });
    }

    // Process purchase
    student.tokens -= cost;
    student.purchases.push({
      item,
      cost,
      date: new Date()
    });

    await student.save();

    res.json({
      message: 'Purchase successful',
      item,
      cost,
      remainingTokens: student.tokens
    });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

// Manual migration route for existing students
router.post('/migrate', requireAuth, async (req, res) => {
  try {
    const students = await Student.find({ 
      teacher: req.teacher._id, 
      isActive: true 
    });

    let migratedCount = 0;

    for (const student of students) {
      let needsUpdate = false;
      const updates = {};

      // If student has old 'group' field but no 'groups' array
      if (student.group && (!student.groups || student.groups.length === 0)) {
        updates.groups = [student.group];
        updates.primaryGroup = student.group;
        needsUpdate = true;
      }
      // If student has no group data at all, default to reading
      else if ((!student.groups || student.groups.length === 0) && !student.group && !student.primaryGroup) {
        updates.groups = ['reading'];
        updates.primaryGroup = 'reading';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Student.findByIdAndUpdate(student._id, updates);
        migratedCount++;
      }
    }

    res.json({ 
      message: `Migration completed. Updated ${migratedCount} students.`,
      migratedCount 
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

module.exports = router;