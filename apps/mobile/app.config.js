const fs = require('node:fs');
const path = require('node:path');
const base = require('./app.json');

module.exports = () => {
  const expo = { ...base.expo, android: { ...base.expo.android } };
  // Local development and source audits must still work before Firebase is
  // provisioned. Production EAS builds automatically include the native
  // Firebase configuration as soon as this private file is present.
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    expo.android.googleServicesFile = './google-services.json';
  }
  return { expo };
};
