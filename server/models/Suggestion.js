// server/models/Suggestion.js
const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true }
  },
  category: { type: String, required: true },
  icon: {
    light: { type: String, required: true },
    dark:  { type: String, required: true }
  },
  key:    { type: String, unique: true, required: true },
  price:  { type: Number, required: true, default: 0 }  // ← new!
}, {
  timestamps: true  // optional: adds createdAt & updatedAt
});

module.exports = mongoose.model('Suggestion', SuggestionSchema);
