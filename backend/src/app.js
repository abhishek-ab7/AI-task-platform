const express = require('express');
const cors = require('cors');
const { helmetMiddleware, rateLimiter } = require('./middleware/security');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

app.use(cors());
app.use(helmetMiddleware);
app.use(rateLimiter);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
