// Chat state management
class ChatState {
  constructor() {
    this.conversations = new Map();
  }

  // Initialize or get conversation state
  getConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        state: 'initial',
        criteria: {
          productType: null,
          size: null,
          price: null,
          location: null,
          style: null
        },
        lastInteraction: Date.now()
      });
    }
    return this.conversations.get(userId);
  }

  // Update conversation state
  updateConversation(userId, updates) {
    const current = this.getConversation(userId);
    this.conversations.set(userId, {
      ...current,
      ...updates,
      lastInteraction: Date.now()
    });
  }

  // Clean up old conversations (can be called periodically)
  cleanup(maxAge = 30 * 60 * 1000) { // Default 30 minutes
    const now = Date.now();
    for (const [userId, convo] of this.conversations.entries()) {
      if (now - convo.lastInteraction > maxAge) {
        this.conversations.delete(userId);
      }
    }
  }
}

module.exports = new ChatState();