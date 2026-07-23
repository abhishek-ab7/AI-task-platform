const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    inputText: {
      type: String,
      required: true
    },
    operationType: {
      type: String,
      enum: ['UPPERCASE', 'LOWERCASE', 'REVERSE_STRING', 'WORD_COUNT'],
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Running', 'Success', 'Failed'],
      default: 'Pending',
      index: true
    },
    result: {
      type: String,
      default: null
    },
    logs: [
      {
        timestamp: {
          type: Date,
          default: Date.now
        },
        level: {
          type: String
        },
        message: {
          type: String
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);
