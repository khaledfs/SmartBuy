const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce verbose logging
config.reporter = {
  update: () => {
    // Suppress update messages
  },
  terminal: {
    // Reduce terminal output
    log: (message) => {
      // Only log important messages
      if (message.includes('error') || message.includes('warning') || message.includes('bundling')) {
        console.log(message);
      }
    },
    info: (message) => {
      // Only log important info
      if (message.includes('error') || message.includes('warning')) {
        console.info(message);
      }
    },
    warn: (message) => {
      console.warn(message);
    },
    error: (message) => {
      console.error(message);
    }
  }
};

// Optimize bundling
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Reduce file watching
config.watchFolders = [__dirname];

module.exports = config; 