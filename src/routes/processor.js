const express = require('express');
const MessageProcessor = require('../processor/MessageProcessor');
const BlockService = require('../services/BlockService');
const ChatService = require('../services/ChatService');
const OllamaMiddleware = require('../middleware-agents/OllamaMiddleware');

const router = express.Router();

// Initialize Ollama middleware
const ollamaMiddleware = new OllamaMiddleware({
  ollamaUrl: 'http://localhost:11434',
  model: 'erukude/omni-json:1b'
});

/**
 * Execute message in background (async, non-blocking)
 */
async function executeInBackground(message, messageId) {
  console.log(`[Background] Starting execution for message ${messageId}`);
  
  try {
    const processor = new MessageProcessor(message);
    const result = await processor.execute();
    
    console.log(`[Background] Command executed, processing with Ollama middleware...`);
    
    // Process output through Ollama middleware to extract JSON
    const processedResult = await ollamaMiddleware.process(result.output.trim());
    
    let finalContentText = '';
    let finalContentJson = null;
    let extractedFields = null;
    
    if (processedResult.success && processedResult.parsed) {
      console.log(`[Background] Successfully extracted JSON via Ollama`);
      
      // Extract fields from JSON (for, blockId, response)
      extractedFields = ollamaMiddleware.extractFields(processedResult);
      
      // Use the 'response' field as content, or fall back to full JSON string
      finalContentText = extractedFields.response || processedResult.content;

      try {
        finalContentJson = JSON.parse(finalContentText);
        console.log(`[Background] Parsed JSON:`, finalContentJson);
      } catch (error) {
        console.error(`[Background] Error parsing JSON:`, error);
        finalContentJson = null;
      }
      
      console.log(`[Background] Extracted fields:`, extractedFields);
    } else {
      console.log(`[Background] Using raw output (Ollama processing failed or returned unparsed)`);
      finalContentText = processedResult.content;
    }
    
    // Determine response agent
    const responseAgent = Array.isArray(message.for) ? message.for[0] : message.for || 'system';
    
    let responseMessage = null;

    // Get project folder for blockId detection
    const projectFolder = ChatService.getProjectFolder(message.projectId);
    
    if (finalContentJson) {
      responseMessage = {
        id: Date.now(),
        agent: responseAgent,
        content: finalContentJson.response,
        projectId: message.projectId,
        blockId: BlockService.getCurrentBlockId(projectFolder),
        timestamp: new Date().toISOString(),
        inReplyTo: messageId,
        for: finalContentJson.for,
      };
    } else {
      responseMessage = {
        id: Date.now(),
        agent: responseAgent,
        content: finalContentText,
        projectId: message.projectId,
        blockId: BlockService.getCurrentBlockId(projectFolder),
        timestamp: new Date().toISOString(),
        inReplyTo: messageId
      };
      // Add extracted fields as metadata if available
      if (extractedFields) {
        responseMessage.metadata = {
          extractedFor: extractedFields.for,
          extractedBlockId: extractedFields.blockId,
          extractedAction: extractedFields.action,
          extractedExecutionOrder: extractedFields.executionOrder
        };
      }
    }
    
    ChatService.addMessage(message.projectId, responseMessage);
    
    console.log(`[Background] Claude command completed successfully for message ${messageId}`);
  } catch (error) {
    console.error(`[Background] Error executing claude command for message ${messageId}:`, error);
    
    // Add error message to chat
    const projectFolder = ChatService.getProjectFolder(message.projectId);
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

