const express = require('express');
const AgentService = require('../services/AgentService');

const router = express.Router();

/**
 * GET /api/agents
 * Get list of available agents from ~/.claude/agents
 */
router.get('/', (req, res) => {
  try {
    const agents = AgentService.getAvailableAgents();
    res.json({ agents });
  } catch (error) {
    console.error('Error reading agents directory:', error);
    res.status(500).json({ error: 'Error reading agents directory' });
  }
});

module.exports = router;

