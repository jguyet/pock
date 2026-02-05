const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * AgentService - Service to manage available agents
 */
class AgentService {
  /**
   * Get list of available agents from ~/.claude/agents
   * @returns {Array<string>} List of agent names
   */
  static getAvailableAgents() {
    try {
      const agentsDir = path.join(os.homedir(), '.claude', 'agents');
      
      // Check if directory exists
      if (!fs.existsSync(agentsDir)) {
        console.warn('[AgentService] Agents directory not found, using default agents');
        return ['project-manager', 'lead-developer', 'developer', 'tester'];
      }
      
      // Read directory and filter .md files
      const files = fs.readdirSync(agentsDir);
      const agents = files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
      
      if (agents.length === 0) {
        console.warn('[AgentService] No agents found, using default agents');
        return ['project-manager', 'lead-developer', 'developer', 'tester'];
      }
      
      return agents;
    } catch (error) {
      console.error('[AgentService] Error reading agents directory:', error);
      // Fallback to default agents
      return ['project-manager', 'lead-developer', 'developer', 'tester'];
    }
  }
}

module.exports = AgentService;

