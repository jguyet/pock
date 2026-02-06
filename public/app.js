// Constants
const API_URL = 'http://localhost:8081/api';
let AGENTS = []; // Will be loaded dynamically from API

// DOM Elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const clearBtn = document.getElementById('clear-btn');
const suggestionsContainer = document.getElementById('suggestions');

// State
let currentProjectId = null;
let currentProject = null;
let mentionStart = -1;
let currentMessages = []; // Keep track of current messages to avoid flickering

// Extract project ID from URL
function getProjectIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/project\/([^/]+)/);
  return match ? match[1] : null;
}

// Load agents from API
async function loadAgents() {
  try {
    const response = await fetch(`${API_URL}/agents`);
    const data = await response.json();
    
    if (data.agents && Array.isArray(data.agents)) {
      AGENTS = data.agents;
    }
  } catch (error) {
    console.error('Error loading agents:', error);
    // Fallback to default agents if API fails
    AGENTS = ['user', 'project-manager', 'lead-developer', 'developer', 'tester'];
  }
}

// Load project and messages on startup
async function initializeProject() {
  // Load agents first
  await loadAgents();
  currentProjectId = getProjectIdFromUrl();
  
  if (!currentProjectId) {
    window.location.href = '/';
    return;
  }
  
  // Load project info
  try {
    const response = await fetch(`${API_URL}/projects/${currentProjectId}`);
    const data = await response.json();
    
    if (data.success) {
      currentProject = data.project;
      document.getElementById('project-title').textContent = currentProject.title;
    } else {
      alert('Projet non trouvé');
      window.location.href = '/';
      return;
    }
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Erreur lors du chargement du projet');
    return;
  }
  
  // Load messages
  loadMessages();
  
  // Auto-refresh messages every 1 second to see status updates
  setInterval(() => {
    loadMessages();
  }, 1000);
}

initializeProject();

// Event Listeners
messageInput.addEventListener('keydown', handleKeyDown);
messageInput.addEventListener('input', handleInput);
clearBtn.addEventListener('click', clearChat);

// Load messages from server
async function loadMessages() {
  try {
    const url = currentProjectId 
      ? `${API_URL}/messages?projectId=${encodeURIComponent(currentProjectId)}`
      : `${API_URL}/messages`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.messages || data.messages.length === 0) {
      if (currentMessages.length === 0) {
        messagesContainer.innerHTML = '';
        // showWelcomeMessage();
      }
      return;
    }
    
    // If this is the first load, render all messages
    if (currentMessages.length === 0) {
      messagesContainer.innerHTML = '';
      data.messages.forEach(msg => renderMessage(msg));
      currentMessages = data.messages;
      scrollToBottom();
      return;
    }
    
    // Check for new or updated messages
    const shouldScroll = isScrolledToBottom();
    
    data.messages.forEach((newMsg, index) => {
      const oldMsg = currentMessages[index];
      
      // New message added
      if (!oldMsg) {
        renderMessage(newMsg);
        currentMessages.push(newMsg);
      } 
      // Message updated (check if status or content changed)
      else if (hasMessageChanged(oldMsg, newMsg)) {
        updateMessage(newMsg);
        currentMessages[index] = newMsg;
      }
    });
    
    // Remove deleted messages (if any)
    if (currentMessages.length > data.messages.length) {
      const messagesToRemove = currentMessages.length - data.messages.length;
      for (let i = 0; i < messagesToRemove; i++) {
        const msgDiv = messagesContainer.lastElementChild;
        if (msgDiv) msgDiv.remove();
      }
      currentMessages = data.messages;
    }
    
    if (shouldScroll) {
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    if (currentMessages.length === 0) {
      // showWelcomeMessage();
    }
  }
}

// Check if a message has changed
function hasMessageChanged(oldMsg, newMsg) {
  return oldMsg.status !== newMsg.status || 
         oldMsg.content !== newMsg.content ||
         oldMsg.agent !== newMsg.agent ||
         oldMsg.thinking !== newMsg.thinking;
}

// Update an existing message in the DOM
function updateMessage(msg) {
  const messageDiv = messagesContainer.querySelector(`[data-message-id="${msg.id}"]`);
  if (!messageDiv) return;
  
  const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const agentClass = AGENTS.includes(msg.agent) ? `agent-${msg.agent}` : 'agent-custom';
  
  // Update status class
  messageDiv.className = 'message';
  if (msg.status) {
    messageDiv.classList.add(`status-${msg.status}`);
  }
  
  // Escape HTML in content (handle empty content)
  const processedContent = msg.content 
    ? msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : '';
  
  // Build "for" badge(s) if present
  let forBadge = '';
  if (msg.for) {
    if (Array.isArray(msg.for)) {
      forBadge = msg.for.map(agent => `<span class="for-badge">→ ${agent}</span>`).join(' ');
    } else {
      forBadge = `<span class="for-badge">→ ${msg.for}</span>`;
    }
  }
  
  // Build blockId badge
  const blockBadge = msg.blockId !== undefined ? `<span class="block-badge">Block ${msg.blockId}</span>` : '';
  
  // Build status badge with loading indicator
  let statusBadge = '';
  if (msg.status) {
    const statusIcons = {
      'processing': '⚙️',
      'waiting': '⏳',
      'completed': '✅',
      'error': '❌'
    };
    const statusLabels = {
      'processing': 'En cours',
      'waiting': 'En attente',
      'completed': 'Terminé',
      'error': 'Erreur'
    };
    const icon = statusIcons[msg.status] || '📝';
    const label = statusLabels[msg.status] || msg.status;
    
    const spinner = (msg.status === 'processing' || msg.status === 'waiting') 
      ? '<span class="spinner"></span>' 
      : '';
    
    statusBadge = `<span class="status-badge status-${msg.status}">${spinner}${icon} ${label}</span>`;
  }
  
  const executeBtn = msg.for ? `<button class="btn-execute" onclick="executeMessage(${msg.id})">🔄 Retry</button>` : '';
  
  // Build thinking indicator if present
  let thinkingSection = '';
  if (msg.thinking) {
    // Get last 200 characters or last few lines as preview
    const thinkingPreview = msg.thinking.length > 200 
      ? '...' + msg.thinking.slice(-200)
      : msg.thinking;
    const processedThinking = thinkingPreview
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    
    thinkingSection = `
      <div class="message-thinking-indicator">
        <div class="thinking-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <div class="thinking-text">💭 L'agent réfléchit...</div>
      </div>
      <div class="thinking-preview">${processedThinking}</div>
    `;
  }
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="agent-badge ${agentClass}">${msg.agent}</span>
      ${forBadge}
      ${blockBadge}
      ${statusBadge}
      <span class="message-time">${time}</span>
      ${msg.projectFolder ? `<span class="message-folder">📁 ${msg.projectFolder}</span>` : ''}
      ${executeBtn}
    </div>
    <div class="message-content">${processedContent || '<span class="empty-content"></span>'}</div>
    ${thinkingSection}
  `;
}

// Check if scrolled to bottom
function isScrolledToBottom() {
  const container = messagesContainer.parentElement;
  return container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
}

// Extract all @mentions from content
function extractMentions(content) {
  // Match @ only if at start of line or preceded by whitespace (not in email addresses)
  const regex = /(^|\s)@([\w-]+)/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[2]); // Group 2 contains the mention name without @
  }
  
  if (matches.length === 0) return null;
  
  // Get unique mentions
  const uniqueMentions = [...new Set(matches)];
  
  // Return array if multiple, string if single
  if (uniqueMentions.length === 1) return uniqueMentions[0];
  return uniqueMentions;
}


// Send message
async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;
  
  // Extract all @mentions as "for" field (but keep them in content)
  const forAgents = extractMentions(content);
  
  const message = {
    agent: 'user',
    content, // Keep the @mentions in the content
    projectId: currentProjectId,
    timestamp: new Date().toISOString()
  };
  
  // Add "for" field if @mentions found
  if (forAgents) {
    message.for = forAgents;
  }
  
  try {
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    const data = await response.json();
    
    if (data.success) {
      renderMessage(data.message);
      currentMessages.push(data.message); // Add to current messages to avoid duplication
      messageInput.value = '';
      messageInput.style.height = 'auto';
      scrollToBottom();
      
      // Auto-execute if message has "for" field
      if (data.message.for) {
        console.log('Auto-executing message:', data.message.id);
        setTimeout(() => {
          // Call without event (auto-execution)
          executeMessageAuto(data.message.id);
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Error sending message. Please try again.');
  }
}

// Render a single message
function renderMessage(msg) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.setAttribute('data-message-id', msg.id);
  
  // Add status class if present
  if (msg.status) {
    messageDiv.classList.add(`status-${msg.status}`);
  }
  
  const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const agentClass = AGENTS.includes(msg.agent) ? `agent-${msg.agent}` : 'agent-custom';
  
  // Escape HTML in content (handle empty content)
  const processedContent = msg.content 
    ? msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : '';
  
  // Build "for" badge(s) if present
  let forBadge = '';
  if (msg.for) {
    if (Array.isArray(msg.for)) {
      // Multiple recipients
      forBadge = msg.for.map(agent => `<span class="for-badge">→ ${agent}</span>`).join(' ');
    } else {
      // Single recipient
      forBadge = `<span class="for-badge">→ ${msg.for}</span>`;
    }
  }
  
  // Build blockId badge
  const blockBadge = msg.blockId !== undefined ? `<span class="block-badge">Block ${msg.blockId}</span>` : '';
  
  // Build status badge with loading indicator
  let statusBadge = '';
  if (msg.status) {
    const statusIcons = {
      'processing': '⚙️',
      'waiting': '⏳',
      'completed': '✅',
      'error': '❌'
    };
    const statusLabels = {
      'processing': 'En cours',
      'waiting': 'En attente',
      'completed': 'Terminé',
      'error': 'Erreur'
    };
    const icon = statusIcons[msg.status] || '📝';
    const label = statusLabels[msg.status] || msg.status;
    
    // Add spinner for processing/waiting
    const spinner = (msg.status === 'processing' || msg.status === 'waiting') 
      ? '<span class="spinner"></span>' 
      : '';
    
    statusBadge = `<span class="status-badge status-${msg.status}">${spinner}${icon} ${label}</span>`;
  }
  
  // Build execute button if message has "for" field
  const executeBtn = msg.for ? `<button class="btn-execute" onclick="executeMessage(${msg.id})">🔄 Retry</button>` : '';
  
  // Build thinking indicator if present
  let thinkingSection = '';
  if (msg.thinking) {
    // Get last 200 characters or last few lines as preview
    const thinkingPreview = msg.thinking.length > 200 
      ? '...' + msg.thinking.slice(-200)
      : msg.thinking;
    const processedThinking = thinkingPreview
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    
    thinkingSection = `
      <div class="message-thinking-indicator">
        <div class="thinking-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <div class="thinking-text">💭 L'agent réfléchit...</div>
      </div>
      <div class="thinking-preview">${processedThinking}</div>
    `;
  }
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="agent-badge ${agentClass}">${msg.agent}</span>
      ${forBadge}
      ${blockBadge}
      ${statusBadge}
      <span class="message-time">${time}</span>
      ${msg.projectFolder ? `<span class="message-folder">📁 ${msg.projectFolder}</span>` : ''}
      ${executeBtn}
    </div>
    <div class="message-content">${processedContent || '<span class="empty-content"></span>'}</div>
    ${thinkingSection}
  `;
  
  messagesContainer.appendChild(messageDiv);
}

// Execute a message (call Claude command) - called automatically
async function executeMessageAuto(messageId) {
  console.log('Executing message automatically:', messageId);
  
  try {
    // Include projectFolder in query params
    const url = currentProjectId 
      ? `${API_URL}/process/${messageId}?projectFolder=${encodeURIComponent(currentProjectId)}`
      : `${API_URL}/process/${messageId}`;
    
    const response = await fetch(url, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Message execution started');
      
      // Poll for new messages
      setTimeout(() => {
        loadMessages();
      }, 1000);
      
      // Start polling every 2 seconds for updates
      const pollInterval = setInterval(() => {
        loadMessages();
      }, 2000);
      
      // Stop polling after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 60000);
    }
  } catch (error) {
    console.error('Error executing message:', error);
  }
}

// Execute a message (call Claude command) - called from button
async function executeMessage(messageId) {
  const button = event.target;
  button.disabled = true;
  button.textContent = '⏳ Processing...';
  
  try {
    // Include projectFolder in query params
    const url = currentProjectId 
      ? `${API_URL}/process/${messageId}?projectFolder=${encodeURIComponent(currentProjectId)}`
      : `${API_URL}/process/${messageId}`;
    
    const response = await fetch(url, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      button.textContent = '✓ Retried';
      button.style.background = '#10b981';
      
      // Poll for new messages
      setTimeout(() => {
        loadMessages();
      }, 1000);
      
      // Start polling every 2 seconds for updates
      const pollInterval = setInterval(() => {
        loadMessages();
      }, 2000);
      
      // Stop polling after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 60000);
    } else {
      button.textContent = '✗ Error';
      button.style.background = '#ef4444';
      button.disabled = false;
    }
  } catch (error) {
    console.error('Error executing message:', error);
    button.textContent = '✗ Error';
    button.style.background = '#ef4444';
    button.disabled = false;
  }
}

// Highlight @mentions in content
function highlightMentions(content) {
  return content.replace(/@(\w+[-\w]*)/g, '<span class="mention">@$1</span>');
}

// Show welcome message
function showWelcomeMessage() {
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'message';
  welcomeDiv.innerHTML = `
    <div class="message-header">
      <span class="agent-badge agent-custom">System</span>
      <span class="message-time">${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
    </div>
    <div class="message-content">
      <strong>Bienvenue sur ${currentProject ? currentProject.title : 'votre projet'}! 🎯</strong><br><br>
      Utilisez @ pour mentionner des agents:<br>
      • @project-manager<br>
      • @lead-developer<br>
      • @developer<br>
      • @tester<br><br>
      Les commandes s'exécutent automatiquement après l'envoi.
    </div>
  `;
  messagesContainer.appendChild(welcomeDiv);
}

// Handle keyboard shortcuts
function handleKeyDown(e) {
  // Enter to send (without Shift)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  
  // Tab for autocomplete
  if (e.key === 'Tab' && mentionStart !== -1) {
    e.preventDefault();
    // TODO: Implement autocomplete
  }
}

// Handle input changes for @ mentions
function handleInput(e) {
  const value = e.target.value;
  const cursorPos = e.target.selectionStart;
  
  // Check for @ symbol
  const beforeCursor = value.substring(0, cursorPos);
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex !== -1) {
    const afterAt = beforeCursor.substring(lastAtIndex + 1);
    
    // Check if we're still in a mention (no spaces after @)
    if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
      mentionStart = lastAtIndex;
      showSuggestions(afterAt);
      return;
    }
  }
  
  mentionStart = -1;
  suggestionsContainer.innerHTML = '';
}

// Show agent suggestions
function showSuggestions(query) {
  const matches = AGENTS.filter(agent => 
    agent.toLowerCase().includes(query.toLowerCase())
  );
  
  if (matches.length === 0) {
    suggestionsContainer.innerHTML = '';
    return;
  }
  
  suggestionsContainer.innerHTML = matches.map(agent => 
    `<div class="suggestion" onclick="insertSuggestion('${agent}')">@${agent}</div>`
  ).join('');
}

// Insert suggestion
function insertSuggestion(agent) {
  const value = messageInput.value;
  const beforeMention = value.substring(0, mentionStart);
  const afterMention = value.substring(messageInput.selectionStart);
  
  messageInput.value = beforeMention + '@' + agent + ' ' + afterMention;
  messageInput.focus();
  
  const newCursorPos = beforeMention.length + agent.length + 2;
  messageInput.setSelectionRange(newCursorPos, newCursorPos);
  
  mentionStart = -1;
  suggestionsContainer.innerHTML = '';
}


// Clear chat
async function clearChat() {
  if (!confirm('Are you sure you want to clear all chat history for this project?')) {
    return;
  }
  
  try {
    const url = currentProjectId 
      ? `${API_URL}/messages?projectId=${encodeURIComponent(currentProjectId)}`
      : `${API_URL}/messages`;
    
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentMessages = []; // Reset current messages
      messagesContainer.innerHTML = '';
      // showWelcomeMessage();
    }
  } catch (error) {
    console.error('Error clearing chat:', error);
    alert('Error clearing chat');
  }
}

// Scroll to bottom
function scrollToBottom() {
  messagesContainer.parentElement.scrollTop = messagesContainer.parentElement.scrollHeight;
}

// Auto-resize textarea
messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// ==================== Theme Toggle ====================
const themeToggle = document.getElementById('theme-toggle');
const iconMoon = document.querySelector('.icon-moon');
const iconSun = document.querySelector('.icon-sun');
const html = document.documentElement;

// Load saved theme or default to light
const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

// Toggle theme
themeToggle.addEventListener('click', () => {
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
});

// Update theme icon
function updateThemeIcon(theme) {
  if (theme === 'dark') {
    iconMoon.style.display = 'none';
    iconSun.style.display = 'block';
  } else {
    iconMoon.style.display = 'block';
    iconSun.style.display = 'none';
  }
}

