// server/models/Suggestion.js
const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  name:     { type: String },
  barcode:      { type: Number },
  img:  { type: String },
  count:    { type: Number,  }  
});

module.exports = mongoose.model('Suggestion', SuggestionSchema);
