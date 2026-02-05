const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * MessageProcessor class to execute Claude commands
 * Takes a message and executes the corresponding claude command
 */
class MessageProcessor {
  constructor(message) {
    this.message = message;
  }

  /**
   * Build the claude command from message data
   * @returns {Object} Command and arguments
   */
  buildCommand() {
    // Determine the agent to use (from "for" field)
    let agent = 'developer'; // default
    if (this.message.for) {
      // If "for" is an array, use the first one
      agent = Array.isArray(this.message.for) ? this.message.for[0] : this.message.for;
    }

    // Build the -p parameter JSON
    // Get project folder from projectId
    const ChatService = require('../services/ChatService');
    const projectFolder = ChatService.getProjectFolder(this.message.projectId);
    
    const params = {
      from: this.message.agent,
      blockId: this.message.blockId || 0,
      context: this.message.content,
      projectFolder: projectFolder
    };

    if (this.message.for == 'project-manager') {
      params["available-agents"] = ["project-manager", "lead-developer", "developer"];
    }

    const paramsJson = JSON.stringify(params);

    // Build the command arguments
    const args = [
      '--permission-mode=bypassPermissions',
      '--tools=default',
      '--allow-dangerously-skip-permissions',
      `--agent=${agent}`,
      '-p',
      '"' + paramsJson.replaceAll('"', '\\"') + '"'
    ];

    return { command: 'claude', args };
  }

  /**
   * Execute the command and capture stdout
   * @returns {Promise<Object>} Result with success status and output
   */
  async execute() {
    return new Promise((resolve, reject) => {
      const { command, args } = this.buildCommand();
      
      const cwd = this.message.projectFolder || process.cwd();
      
      console.log('='.repeat(80));
      console.log('[EXECUTE] Starting command execution');
      console.log('[EXECUTE] Command:', command);
      console.log('[EXECUTE] Args:', JSON.stringify(args, null, 2));
      console.log('[EXECUTE] Working directory:', cwd);
      console.log('[EXECUTE] PATH:', process.env.PATH);
      console.log('='.repeat(80));
      
      // Build full command string for shell
      const fullCommand = `${command} ${args.join(' ')}`;
      console.log('[EXECUTE] Full command:', fullCommand);
      
      const spawnProcess = spawn(fullCommand, [], {
        cwd: cwd,
        env: {
          ...process.env,  // Utiliser toutes les variables d'environnement
          PWD: cwd
        },
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']  // stdin: ignore, stdout: pipe, stderr: pipe
      });

      console.log('[EXECUTE] Process spawned, PID:', spawnProcess.pid);

      let stdout = '';
      let stderr = '';
      let hasOutput = false;

      spawnProcess.stdout.on('data', (data) => {
        hasOutput = true;
        const chunk = data.toString();
        stdout += chunk;
        console.log('[STDOUT]', chunk);
      });

      spawnProcess.stderr.on('data', (data) => {
        hasOutput = true;
        const chunk = data.toString();
        stderr += chunk;
        console.log('[STDERR]', chunk);
      });

      spawnProcess.on('close', (code) => {
        console.log('[EXECUTE] Process closed');
        console.log('[EXECUTE] Exit code:', code);
        console.log('[EXECUTE] Has output:', hasOutput);
        console.log('[EXECUTE] Stdout length:', stdout.length);
        console.log('[EXECUTE] Stderr length:', stderr.length);
        console.log('='.repeat(80));
        
        if (code === 0) {
          resolve({ success: true, output: stdout, error: stderr });
        } else {
          reject({ success: false, output: stdout, error: stderr, exitCode: code });
        }
      });

      spawnProcess.on('error', (err) => {
        console.log('[EXECUTE] Process error:', err);
        reject({ success: false, error: err.message });
      });

      spawnProcess.on('spawn', () => {
        console.log('[EXECUTE] Process spawn event triggered');
      });

      // Timeout de sécurité (5 minutes)
      const timeout = setTimeout(() => {
        console.log('[EXECUTE] TIMEOUT - Killing process after 5 minutes');
        spawnProcess.kill();
        reject({ success: false, error: 'Command timeout after 5 minutes' });
      }, 5 * 60 * 1000);

      spawnProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }
}

module.exports = MessageProcessor;

