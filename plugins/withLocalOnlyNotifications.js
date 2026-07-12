// expo-notifications' config plugin always adds the `aps-environment`
// (remote push) entitlement, but Organize only schedules LOCAL
// notifications — the morning digest — which need no push capability.
// The entitlement would force a new provisioning profile with Push
// enabled and breaks CI signing, so strip it back out. Plugin hooks run
// in reverse array order, so this must be listed FIRST in app.json's
// plugins array to run after expo-notifications (verified via prebuild).
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withLocalOnlyNotifications(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
