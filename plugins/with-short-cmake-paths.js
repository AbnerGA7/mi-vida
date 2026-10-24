// En Windows, el ninja del CMake 3.22 del SDK no crea carpetas de más de ~250 caracteres y el
// código nativo de gesture-handler/screens queda muy hondo. Uso CMake 3.31 (ninja 1.12 sí
// soporta rutas largas; requiere LongPathsEnabled=1 en Windows).
const { withAppBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const BLOCK = `
    externalNativeBuild {
        cmake {
            version "${CMAKE_VERSION}"
        }
    }`;

module.exports = function withShortCmakePaths(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(`version "${CMAKE_VERSION}"`)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/\nandroid\s*\{/, (m) => m + BLOCK);
    }
    return cfg;
  });
};
