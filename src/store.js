const fs = require('fs');

class SeenStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.seen = new Set();
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const ids = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.seen = new Set(ids);
    } catch {
      this.seen = new Set();
    }
  }

  has(id) {
    return this.seen.has(id);
  }

  add(id) {
    this.seen.add(id);
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.seen)), 'utf8');
  }
}

module.exports = { SeenStore };
