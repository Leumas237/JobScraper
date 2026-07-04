const fs = require('fs');

class SubscriptionStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      this.data = {};
    }
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  get(chatId) {
    return this.data[String(chatId)];
  }

  update(chatId, patch) {
    const key = String(chatId);
    this.data[key] = { ...(this.data[key] || {}), ...patch };
    this._save();
  }

  entries() {
    return Object.entries(this.data);
  }
}

module.exports = { SubscriptionStore };
