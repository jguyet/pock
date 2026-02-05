const express = require('express');
const MessageProcessor = require('../processor/MessageProcessor');
const BlockService = require('../services/BlockService');
const ChatService = require('../services/ChatService');
const ProjectService = require('../services/ProjectService');
const { jsonrepair } = require('jsonrepair');

const router = express.Router();

/**
 * Extract JSON from text using jsonrepair
 */
function extractJson(text) {
  try {
    // Try to find JSON in the text (look for { or [ at the start)
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    
    if (!jsonMatch) {
      console.log('[Processor] No JSON found in output');
      return null;
    }
    
    const jsonText = jsonMatch[0];
    console.log('[Processor] Found JSON in output, attempting to repair...');
    
    // Use jsonrepair to fix any JSON syntax issues
    const repairedJson = jsonrepair(jsonText);
    const parsed = JSON.parse(repairedJson);
    
    console.log('[Processor] Successfully parsed JSON:', parsed);
    return parsed;
  } catch (error) {
    console.error('[Processor] Error extracting/repairing JSON:', error.message);
    return null;
  }
}

/**
 * Execute message in background (async, non-blocking)
 */
async function executeInBackground(message, messageId) {
  console.log(`[Background] Starting execution for message ${messageId}`);
  
  try {
    const processor = new MessageProcessor(message);
    const result = await processor.execute();
    
    console.log(`[Background] Command executed, extracting JSON...`);
    
    // Extract and repair JSON from output
    let jsonData = extractJson(result.output.trim());
    
    // Determine response agent
    const responseAgent = Array.isArray(message.for) ? message.for[0] : message.for || 'system';
    
    // Get project folder for blockId detection
    const projectFolder = ProjectService.getProjectFolder(message.projectId);
    
    let responseMessage = null;
    
    if (jsonData) {

      jsonData = Array.isArray(jsonData) ? jsonData : [jsonData];

      console.log('[Background] JSON data:', jsonData);

      for (const data of jsonData) {
        responseMessage = {
          id: Date.now(),
          agent: responseAgent,
          content: data.response,
          projectId: message.projectId,
          blockId: BlockService.getCurrentBlockId(projectFolder),
          timestamp: new Date().toISOString(),
          inReplyTo: messageId,
          for: data.for || null,
        };
        ChatService.addMessage(message.projectId, responseMessage);
      }
    } else {

      console.log('[Background] No JSON data:', result.output.trim());
      // No JSON found, use raw output
      // console.log('[Background] Using raw output (no JSON found)');
      responseMessage = {
        id: Date.now(),
        agent: responseAgent,
        content: result.output.trim(),
        projectId: message.projectId,
        blockId: BlockService.getCurrentBlockId(projectFolder),
        timestamp: new Date().toISOString(),
        inReplyTo: messageId
      };
      ChatService.addMessage(message.projectId, responseMessage);
    }
    
    console.log(`[Background] Claude command completed successfully for message ${messageId}`);
  } catch (error) {
    console.error(`[Background] Error executing claude command for message ${messageId}:`, error);
    
    // Add error message to chat
    const projectFolder = ProjectService.getProjectFolder(message.projectId);
    const errorMessage = {
      id: Date.now(),
      agent: 'system',
      content: `Error executing command: ${error.error || error.output || 'Unknown error'}`,
      projectId: message.projectId,
      blockId: BlockService.getCurrentBlockId(projectFolder),
      timestamp: new Date().toISOString(),
      inReplyTo: messageId
    };
    
    ChatService.addMessage(message.projectId, errorMessage);
  }
}

/**
 * POST /api/process/:messageId?projectId=<id>
 * Process a message (execute claude command)
 */
router.post('/:messageId', async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const projectId = req.query.projectId || req.body.projectId || null;
    
    // Find the message
    const message = ChatService.findMessageById(projectId, messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Respond immediately
    // res.json({ success: true, status: 'processing', messageId });
    
    // Execute in background (fire and forget)
    await executeInBackground(message, messageId)

    // Respond immediately
    res.json({ success: true, status: 'success', messageId });
    
  } catch (error) {
    console.error('Error processing message:', error);
    
    // Only send response if not already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing message' });
    }
  }
});

module.exports = router;

