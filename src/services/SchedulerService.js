const ProjectService = require('./ProjectService');
const ChatService = require('./ChatService');
const MessageProcessor = require('../processor/MessageProcessor');
const BlockService = require('./BlockService');
const { jsonrepair } = require('jsonrepair');


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
   * Extract JSON from text using jsonrepair
   * 
   * @param {string} text - Raw text output
   * @returns {Object|null} Parsed JSON or null
   */
  extractJson(text) {
    try {
      // Try to find JSON in the text (look for { or [ at the start)
      const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      
      if (!jsonMatch) {
        console.log('[Scheduler] No JSON found in output');
        return null;
      }
      
      const jsonText = jsonMatch[0];
      console.log('[Scheduler] Found JSON in output, attempting to repair...');
      
      // Use jsonrepair to fix any JSON syntax issues
      const repairedJson = jsonrepair(jsonText);
      const parsed = JSON.parse(repairedJson);
      
      console.log('[Scheduler] Successfully parsed JSON:', parsed);
      return parsed;
    } catch (error) {
      console.error('[Scheduler] Error extracting/repairing JSON:', error.message);
      return null;
    }
  }
  /**
   * Process a message (execute claude command)
   * 
   * @param {Object} message - Message to process
   * @param {string} projectId - Project ID
   */
  async processMessage(message, projectId) {
        console.log(`[Background] Starting execution for message ${message.id}`);

        // Skip if already processing or completed
        if (message.status == 'processing' || message.status == 'completed') {
            console.log(`[Background] Message ${message.id} already in status: ${message.status}`);
            return;
        }
        
        try {

            // Update status to processing
            message.status = 'processing';
            ChatService.editMessage(message.projectId, message);

            const processor = new MessageProcessor(message);
            const result = await processor.execute();

            message.status = 'completed';
            ChatService.editMessage(message.projectId, message);
            
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

                    if (data.action == 'execute') {
                        for (const agent of data.executionOrder) {
                            responseMessage = {
                                id: Date.now(),
                                agent: responseAgent,
                                content: "",
                                projectId: message.projectId,
                                blockId: data.blockId,
                                timestamp: new Date().toISOString(),
                                inReplyTo: message.id,
                                for: agent,
                                status: 'waiting'
                            };
                            ChatService.addMessage(message.projectId, responseMessage);
                            break;
                        }
                    } else if (data.action == 'ask-to-user') {
                        // nothing yet
                    } else {
                        responseMessage = {
                            id: Date.now(),
                            agent: responseAgent,
                            content: data.response,
                            projectId: message.projectId,
                            blockId: data.blockId,
                            timestamp: new Date().toISOString(),
                            inReplyTo: message.id,
                            for: data.for || null,
                        };
                        ChatService.addMessage(message.projectId, responseMessage);
                    }
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
                    inReplyTo: message.id
                };
                ChatService.addMessage(message.projectId, responseMessage);
            }
            
            console.log(`[Background] Claude command completed successfully for message ${message.id}`);
            } catch (error) {
            console.error(`[Background] Error executing claude command for message ${message.id}:`, error);
            
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

