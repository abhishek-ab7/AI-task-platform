const Task = require('../models/Task');
const redis = require('../config/redis');

const VALID_OPERATIONS = ['UPPERCASE', 'LOWERCASE', 'REVERSE_STRING', 'WORD_COUNT'];

const createTask = async (req, res) => {
  try {
    const { title, inputText, operationType } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (inputText === undefined || inputText === null || typeof inputText !== 'string') {
      return res.status(400).json({ message: 'InputText is required' });
    }
    if (!operationType || !VALID_OPERATIONS.includes(operationType)) {
      return res.status(400).json({ message: 'Invalid operationType' });
    }

    const task = new Task({
      userId: req.user.id,
      title: title.trim(),
      inputText,
      operationType,
      status: 'Pending',
      logs: [
        {
          timestamp: new Date(),
          level: 'INFO',
          message: 'Task created and queued'
        }
      ]
    });

    await task.save();

    const payload = JSON.stringify({
      taskId: task._id,
      userId: task.userId,
      operationType: task.operationType,
      inputText: task.inputText
    });

    await redis.rpush('ai_task_queue', payload);

    return res.status(201).json(task);
  } catch (err) {
    console.error('Error in createTask:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(tasks);
  } catch (err) {
    console.error('Error in getTasks:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.userId.toString() !== req.user.id.toString()) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(200).json(task);
  } catch (err) {
    console.error('Error in getTaskById:', err);
    if (err.kind === 'ObjectId' || err.name === 'CastError') {
      return res.status(404).json({ message: 'Task not found' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById
};
