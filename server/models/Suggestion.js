const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
  },
  category: { type: String, required: true },
  icon: {
    light: { type: String, required: true },
    dark: { type: String, required: true },
  },
  key: { type: String, unique: true, required: true },
});

module.exports = mongoose.model('Suggestion', SuggestionSchema);
