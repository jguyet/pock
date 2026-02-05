const express = require('express');
const fs = require('fs');
const BlockService = require('../services/BlockService');
const ChatService = require('../services/ChatService');

const router = express.Router();

/**
 * GET /api/messages?projectId=<id>
 * Get all messages from chat history for a specific project
 */
router.get('/', (req, res) => {
  try {
    const projectId = req.query.projectId || null;
    const data = ChatService.readMessages(projectId);
    res.json(data);
  } catch (error) {
    console.error('Error reading chat history:', error);
    res.status(500).json({ error: 'Error reading chat history' });
  }
});

/**
 * POST /api/messages
 * Send a new message
 */
router.post('/', (req, res) => {
  try {
    const { agent, content, projectId, timestamp, for: forAgents } = req.body;
    
    // Get project folder for blockId detection
    const projectFolder = ChatService.getProjectFolder(projectId);
    
    // Auto-detect blockId from project folder
    const blockId = BlockService.getCurrentBlockId(projectFolder);
    
    const message = {
      id: Date.now(),
      agent: agent || 'user',
      content,
      projectId,
      blockId,
      timestamp: timestamp || new Date().toISOString()
    };
    
    // Add "for" field if provided
    if (forAgents) {
      message.for = forAgents;
      // Add "waiting" status for messages that will be processed
      message.status = 'waiting';
    }
    
    // Add message to project-specific chat.json
    ChatService.addMessage(projectId, message);
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Error saving message' });
  }
});

/**
 * DELETE /api/messages?projectId=<id>
 * Clear all messages for a specific project
 */
router.delete('/', (req, res) => {
  try {
    const projectId = req.query.projectId || null;
    ChatService.clearMessages(projectId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Error clearing chat history' });
  }
});

module.exports = router;

