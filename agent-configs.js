/**
 * Single source of truth for Salesforce Embedded Service (Chat/Messaging)
 * deployments, keyed by nav mode. Loaded before the inline SDK blocks on the
 * embedded-* pages so deployment IDs / site URLs live in exactly one place.
 *
 * Consumers:
 *   window.AgentConfigs.active()            -> config for the current mode (window.__navMode, set by nav.js)
 *   window.AgentConfigs.configFor(mode)     -> config for an explicit mode
 *   window.AgentConfigs.deploymentFor(mode) -> just the deploymentName (used by the session-ids bridge)
 *   window.AgentConfigs.all                 -> the raw map
 *
 * Only 'noel-leeming' is wired to a real deployment. 'twg' and 'tws' are
 * placeholder modes with no config — nav.js intentionally does not navigate
 * to them (see validModes there), so configFor() never needs to resolve them.
 */
(function (global) {
    'use strict';

    const DEFAULT_MODE = 'noel-leeming';

    const AGENT_CONFIGS = {
        'noel-leeming': {
            orgId: '00DBn00000BpIe5',
            deploymentName: 'TWG_AG_NL_Web',
            siteUrl: 'https://twg--agentforce.sandbox.my.site.com/ESWTWGAGNLWeb1791378486755',
            scrt2URL: 'https://twg--agentforce.sandbox.my.salesforce-scrt.com',
            bootstrapJs: 'https://twg--agentforce.sandbox.my.site.com/ESWTWGAGNLWeb1791378486755/assets/js/bootstrap.min.js',
            prechat: {}
        }
    };

    function configFor(mode) {
        return AGENT_CONFIGS[mode] || AGENT_CONFIGS[DEFAULT_MODE];
    }

    global.AgentConfigs = {
        all: AGENT_CONFIGS,
        configFor: configFor,
        active: function () {
            return configFor(global.__navMode || DEFAULT_MODE);
        },
        deploymentFor: function (mode) {
            return configFor(mode || DEFAULT_MODE).deploymentName;
        },
        prechatFor: function (mode) {
            return configFor(mode || DEFAULT_MODE).prechat || {};
        }
    };
})(window);
