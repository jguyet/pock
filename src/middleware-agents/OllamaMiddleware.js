const axios = require('axios');

/**
 * OllamaMiddleware - Middleware to extract JSON from Claude responses using Ollama
 */
class OllamaMiddleware {
  constructor(config = {}) {
    this.ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    this.model = config.model || 'erukude/omni-json:1b';
    this.systemPrompt = config.systemPrompt || 'You are a strict JSON echo tool. Return ONLY the exact JSON string from the user\'s last message, byte-for-byte identical.Do not add, remove, reorder, normalize, pretty-print, wrap, or fix anything. No extra keys, no metadata, no commentary, no code fences. If the input is not valid strict JSON, output exactly: INVALID_JSON';
  }

  /**
   * Process raw output from Claude and extract JSON using Ollama
   * 
   * @param {string} rawOutput - Raw output from Claude command
   * @returns {Promise<Object>} Extracted JSON object
   */
  async process(rawOutput) {
    console.log('[OllamaMiddleware] Processing output...');
    console.log('[OllamaMiddleware] Raw output length:', rawOutput.length);
    
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/chat`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt
            },
            {
              role: 'user',
              content: rawOutput
            }
          ],
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 seconds timeout
        }
      );

      console.log('[OllamaMiddleware] Ollama response received');
      
      if (!response.data || !response.data.message || !response.data.message.content) {
        throw new Error('Invalid Ollama response structure');
      }

      const extractedContent = response.data.message.content;
      console.log('[OllamaMiddleware] Extracted content:', extractedContent);

      // Try to parse as JSON to validate
      let parsedJson;
      try {
        parsedJson = JSON.parse(extractedContent);
        console.log('[OllamaMiddleware] Successfully parsed JSON');
      } catch (parseError) {
        console.error('[OllamaMiddleware] Failed to parse extracted content as JSON:', parseError);
        // Return raw content if parsing fails
        return {
          success: true,
          content: extractedContent,
          parsed: false,
          rawOutput: rawOutput
        };
      }

      return {
        success: true,
        content: extractedContent,
        parsed: true,
        json: parsedJson,
        rawOutput: rawOutput
      };

    } catch (error) {
      console.error('[OllamaMiddleware] Error processing with Ollama:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error('[OllamaMiddleware] Cannot connect to Ollama. Is it running?');
      }

      // Return raw output if middleware fails
      return {
        success: false,
        content: rawOutput,
        parsed: false,
        error: error.message,
        rawOutput: rawOutput
      };
    }
  }

  /**
   * Check if Ollama is available
   * 
   * @returns {Promise<boolean>} True if Ollama is reachable
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('[OllamaMiddleware] Ollama not available:', error.message);
      return false;
    }
  }

  /**
   * Extract specific fields from parsed JSON
   * Useful for extracting 'for', 'blockId', 'response' fields
   * 
   * @param {Object} processedResult - Result from process()
   * @returns {Object} Extracted fields
   */
  extractFields(processedResult) {
    if (!processedResult.parsed || !processedResult.json) {
      return null;
    }

    const json = processedResult.json;

    return {
      for: json.for || null,
      blockId: json.blockId !== undefined ? json.blockId : null,
      response: json.response || json.content || json.message || processedResult.content,
      action: json.action || null,
      executionOrder: json.executionOrder || null
    };
  }
}

module.exports = OllamaMiddleware;

