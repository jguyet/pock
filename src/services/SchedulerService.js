const ProjectService = require('./ProjectService');
const ChatService = require('./ChatService');
const MessageProcessor = require('../processor/MessageProcessor');
const BlockService = require('./BlockService');
const OllamaMiddleware = require('../middleware-agents/OllamaMiddleware');

/**
 * SchedulerService - Service to automatically process messages
 * 
 * Features:
 * - Checks for new messages every 100ms
 * - Filters messages that need processing
 * - Processes messages in background
 */
class SchedulerService {
  constructor() {
    this.interval = null;
    this.processedMessages = new Set(); // Track processed message IDs
    this.ollamaMiddleware = new OllamaMiddleware({
      ollamaUrl: 'http://localhost:11434',
      model: 'erukude/omni-json:1b'
    });
  }

  /**
   * Start the scheduler
   * 
   * @param {number} intervalMs - Interval in milliseconds (default 100ms)
   */
  start(intervalMs = 100) {
    if (this.interval) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log(`[Scheduler] Starting with ${intervalMs}ms interval`);
    
    this.interval = setInterval(() => {
      this.checkForNewMessages().catch(err => {
        console.error('[Scheduler] Error checking messages:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Scheduler] Stopped');
    }
  }

  /**
   * Check all projects for new messages
   */
  async checkForNewMessages() {
    try {
      const projects = ProjectService.getAllProjects();
      
      for (const project of projects) {
        const messages = ChatService.readMessages(project.id).messages;
        
        // Check each message
        for (const message of messages) {
          // Skip if already processed
          if (this.processedMessages.has(message.id)) {
            continue;
          }

          // Filter: should this message be processed?
          if (this.filterIfNeedToBeProcessedMessage(message)) {
            console.log(`[Scheduler] Processing message ${message.id} in project ${project.id}`);
            
            // Mark as processed immediately to avoid double processing
            this.processedMessages.add(message.id);
            
            // Process in background
            this.processMessage(message, project.id).catch(err => {
              console.error(`[Scheduler] Error processing message ${message.id}:`, err);
              // Remove from processed set on error so it can be retried
              this.processedMessages.delete(message.id);
            });
          } else {
            // Mark as seen (no processing needed)
            this.processedMessages.add(message.id);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error in checkForNewMessages:', error);
    }
  }

  /**
   * Filter to determine if a message needs processing
   * 
   * Rules:
   * - Must have a "for" field
   * - "for" must not be "user"
   * - Must not have been replied to yet (no inReplyTo pointing to it)
   * 
   * @param {Object} message - Message to check
   * @returns {boolean} True if message should be processed
   */
  filterIfNeedToBeProcessedMessage(message) {
    // Must have "for" field
    if (!message.for) {
      return false;
    }

    // Extract "for" value (handle array or string)
    const forValue = Array.isArray(message.for) ? message.for[0] : message.for;

    // "for" must not be "user"
    if (forValue === 'user') {
      return false;
    }

    // Check if message has already been replied to
    // We need to check the chat for any message with inReplyTo === this message.id
    try {
      const messages = ChatService.readMessages(message.projectId).messages;
      const hasReply = messages.some(m => m.inReplyTo === message.id);
      
      if (hasReply) {
        return false; // Already processed
      }
    } catch (error) {
      console.error('[Scheduler] Error checking for replies:', error);
      return false;
    }

    return true;
  }

  /**
   * Process a message (execute claude command)
   * 
   * @param {Object} message - Message to process
   * @param {string} projectId - Project ID
   */
  async processMessage(message, projectId) {
    console.log(`[Scheduler] Starting execution for message ${message.id}`);
    
    try {
      const processor = new MessageProcessor(message);
      const result = await processor.execute();
      
      console.log(`[Scheduler] Command executed, processing with Ollama middleware...`);
      
      // Process output through Ollama middleware to extract JSON
      const processedResult = await this.ollamaMiddleware.process(result.output.trim());
      
      let finalContentText = '';
      let finalContentJson = null;
      let extractedFields = null;
      
      if (processedResult.success && processedResult.parsed) {
        console.log(`[Scheduler] Successfully extracted JSON via Ollama`);
        
        // Extract fields from JSON (for, blockId, response)
        extractedFields = this.ollamaMiddleware.extractFields(processedResult);
        
        // Use the 'response' field as content, or fall back to full JSON string
        finalContentText = extractedFields.response || processedResult.content;

        try {
          finalContentJson = JSON.parse(finalContentText);
          console.log(`[Scheduler] Parsed JSON:`, finalContentJson);
        } catch (error) {
          console.error(`[Scheduler] Error parsing JSON:`, error);
          finalContentJson = null;
        }
        
        console.log(`[Scheduler] Extracted fields:`, extractedFields);
      } else {
        console.log(`[Scheduler] Using raw output (Ollama processing failed or returned unparsed)`);
        finalContentText = processedResult.content;
      }
      
      // Determine response agent
      const responseAgent = Array.isArray(message.for) ? message.for[0] : message.for || 'system';
      
      let responseMessage = null;

      // Get project folder for blockId detection
      const projectFolder = ProjectService.getProjectFolder(message.projectId);
      
      if (finalContentJson) {
        responseMessage = {
          id: Date.now(),
          agent: responseAgent,
          content: finalContentJson.response,
          projectId: message.projectId,
          blockId: BlockService.getCurrentBlockId(projectFolder),
          timestamp: new Date().toISOString(),
          inReplyTo: message.id,
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
          inReplyTo: message.id
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
      
      console.log(`[Scheduler] Claude command completed successfully for message ${message.id}`);
    } catch (error) {
      console.error(`[Scheduler] Error executing claude command for message ${message.id}:`, error);
      
      // Add error message to chat
      const projectFolder = ProjectService.getProjectFolder(message.projectId);
      const errorMessage = {
        id: Date.now(),
        agent: 'system',
        content: `Error executing command: ${error.error || error.output || 'Unknown error'}`,
        projectId: message.projectId,
        blockId: BlockService.getCurrentBlockId(projectFolder),
        timestamp: new Date().toISOString(),
        inReplyTo: message.id
      };
      
      ChatService.addMessage(message.projectId, errorMessage);
    }
  }

  /**
   * Clear processed messages cache
   * Useful for testing or resetting
   */
  clearProcessedCache() {
    this.processedMessages.clear();
    console.log('[Scheduler] Cleared processed messages cache');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      isRunning: this.interval !== null,
      processedCount: this.processedMessages.size
    };
  }
}

// Export singleton instance
module.exports = new SchedulerService();

