const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Import routes
const messagesRouter = require('./routes/messages');
const processorRouter = require('./routes/processor');
const projectsRouter = require('./routes/projects');
const projectsCrudRouter = require('./routes/projects-crud');
const agentsRouter = require('./routes/agents');

// Import scheduler
const SchedulerService = require('./services/SchedulerService');

const app = express();
const PORT = 8081;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/messages', messagesRouter);
app.use('/api/process', processorRouter);
app.use('/api/project-folder', projectsRouter);
app.use('/api/projects', projectsCrudRouter);
app.use('/api/agents', agentsRouter);

// Route for project chat page
app.get('/project/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Pock server running on http://localhost:${PORT}`);
  console.log(`📁 Project root: ${path.join(__dirname, '..')}`);
  
  // Start scheduler
  SchedulerService.start(100); // Check every 100ms
  console.log(`⏰ Scheduler started (checking every 100ms)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  SchedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  SchedulerService.stop();
  process.exit(0);
});

