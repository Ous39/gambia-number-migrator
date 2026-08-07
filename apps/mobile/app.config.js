const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const expo = {
    ...config,
    android: {
      ...config.android,
    },
  };

  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    expo.android.googleServicesFile = './google-services.json';
  }

  return expo;
};