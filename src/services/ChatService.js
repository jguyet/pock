const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * ChatService - Service to manage chat.json files per project
 * 
 * Features:
 * - Each project has its own chat.json file in projects/<id>/
 * - Projects are managed by ProjectService
 * - ChatService only handles message CRUD operations
 */
class ChatService {
  /**
   * Get the path to the chat.json file for a specific project
   * Now uses projects/<projectId>/chat.json structure
   * 
   * @param {string} projectId - Project ID
   * @returns {string} Path to chat.json file
   */
  static getChatFilePath(projectId) {
    if (!projectId) {
      // Default chat.json in project root (fallback)
      return path.join(__dirname, '../../chat.json');
    }
    
    // Project-specific chat.json in projects/<id>/
    const projectFolder = path.join(__dirname, '../../projects', projectId);
    return path.join(projectFolder, 'chat.json');
  }

  /**
   * Get project folder path
   * 
   * @param {string} projectId - Project ID
   * @returns {string} Project folder path
   */
  static getProjectFolder(projectId) {
    if (!projectId) {
      return path.join(__dirname, '../..');
    }
    return path.join(__dirname, '../../projects', projectId);
  }

  /**
   * Initialize chat file if it doesn't exist
   * Projects are now managed by ProjectService, so we just ensure chat.json exists
   * 
   * @param {string} projectId - Project ID
   */
  static ensureChatFile(projectId) {
    const chatFile = this.getChatFilePath(projectId);
    
    // Ensure parent directory exists
    const dir = path.dirname(chatFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create chat file if it doesn't exist
    if (!fs.existsSync(chatFile)) {
      fs.writeFileSync(chatFile, JSON.stringify({ messages: [] }, null, 2));
      console.log(`[ChatService] Created new chat.json for project ${projectId || 'default'}`);
    }
  }

  /**
   * Read messages from chat file
   * 
   * @param {string} projectId - Project ID
   * @returns {Object} Chat data with messages array
   */
  static readMessages(projectId) {
    this.ensureChatFile(projectId);
    const chatFile = this.getChatFilePath(projectId);
    
    try {
      const data = fs.readFileSync(chatFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading chat file:', error);
      return { messages: [] };
    }
  }

  /**
   * Write messages to chat file
   * 
   * @param {string} projectId - Project ID
   * @param {Object} data - Chat data with messages array
   */
  static writeMessages(projectId, data) {
    this.ensureChatFile(projectId);
    const chatFile = this.getChatFilePath(projectId);
    
    try {
      fs.writeFileSync(chatFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing chat file:', error);
      throw error;
    }
  }

  /**
   * Add a message to the chat
   * 
   * @param {string} projectId - Project ID
   * @param {Object} message - Message object
   * @returns {Object} Added message
   */
  static addMessage(projectId, message) {
    const data = this.readMessages(projectId);
    data.messages.push(message);
    this.writeMessages(projectId, data);
    return message;
  }

  /**
   * Find a message by ID
   * 
   * @param {string} projectId - Project ID
   * @param {number} messageId - Message ID
   * @returns {Object|null} Message or null if not found
   */
  static findMessageById(projectId, messageId) {
    const data = this.readMessages(projectId);
    return data.messages.find(m => m.id === messageId) || null;
  }


  /**
   * Edit a message by ID
   * 
   * @param {string} projectId - Project ID
   * @param {Object} message - Message object
   * @returns {Object} Edited message
   */
  static editMessage(projectId, message) {
    const data = this.readMessages(projectId);
    const index = data.messages.findIndex(m => m.id === message.id);
    if (index !== -1) {
      data.messages[index] = message;
      this.writeMessages(projectId, data);
      return message;
    }
    return null;
  }

  /**
   * Clear all messages
   * 
   * @param {string} projectId - Project ID
   */
  static clearMessages(projectId) {
    this.writeMessages(projectId, { messages: [] });
  }
}

module.exports = ChatService;

