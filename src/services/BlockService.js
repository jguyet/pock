const fs = require('fs');
const path = require('path');

/**
 * BlockService - Service to handle block detection and management
 */
class BlockService {
  /**
   * Detect current blockId from project folder
   * - If no block folder exists, returns 0
   * - If blocks exist but last is COMPLETED, returns lastBlockId + 1
   * - Otherwise returns lastBlockId
   * 
   * @param {string} projectFolder - Path to the project folder
   * @returns {number} Current block ID
   */
  static getCurrentBlockId(projectFolder) {
    if (!projectFolder) return 0;
    
    const blockFolder = path.join(projectFolder, 'block');
    
    // If block folder doesn't exist, we're at block 0
    if (!fs.existsSync(blockFolder)) {
      return 0;
    }
    
    try {
      const files = fs.readdirSync(blockFolder);
      
      // Filter for markdown files with numeric names (e.g., 1.md, 2.md)
      const blockFiles = files
        .filter(file => /^\d+\.md$/.test(file))
        .map(file => parseInt(file.match(/^(\d+)\.md$/)[1]))
        .sort((a, b) => b - a); // Sort descending
      
      // If no blocks found, we're at block 0
      if (blockFiles.length === 0) {
        return 0;
      }
      
      // Get the highest block number
      const lastBlockId = blockFiles[0];
      const lastBlockFile = path.join(blockFolder, `${lastBlockId}.md`);
      
      // Check if the last block is marked as COMPLETED
      try {
        const blockContent = fs.readFileSync(lastBlockFile, 'utf8');
        
        // Check if the file contains "Status: COMPLETED"
        if (/Status:\s*COMPLETED/i.test(blockContent) || /Status:\s*CLOSED/i.test(blockContent) || /Status:\s*DONE/i.test(blockContent)) {
          // If completed, move to next block
          return lastBlockId + 1;
        }
        
        // Otherwise, stay on current block
        return lastBlockId;
      } catch (readError) {
        console.error('Error reading block file:', readError);
        return lastBlockId;
      }
    } catch (error) {
      console.error('Error reading block folder:', error);
      return 0;
    }
  }

  /**
   * Check if a specific block is completed
   * @param {string} projectFolder - Path to the project folder
   * @param {number} blockId - Block ID to check
   * @returns {boolean} True if block is completed
   */
  static isBlockCompleted(projectFolder, blockId) {
    if (!projectFolder || blockId === 0) return false;
    
    const blockFile = path.join(projectFolder, 'block', `${blockId}.md`);
    
    if (!fs.existsSync(blockFile)) {
      return false;
    }
    
    try {
      const content = fs.readFileSync(blockFile, 'utf8');
      return /Status:\s*COMPLETED/i.test(content) || /Status:\s*CLOSED/i.test(content) || /Status:\s*DONE/i.test(content);
    } catch (error) {
      console.error('Error checking block completion:', error);
      return false;
    }
  }

  /**
   * Create block folder if it doesn't exist
   * @param {string} projectFolder - Path to the project folder
   */
  static ensureBlockFolder(projectFolder) {
    if (!projectFolder) return;
    
    const blockFolder = path.join(projectFolder, 'block');
    
    if (!fs.existsSync(blockFolder)) {
      fs.mkdirSync(blockFolder, { recursive: true });
    }
  }
}

module.exports = BlockService;

