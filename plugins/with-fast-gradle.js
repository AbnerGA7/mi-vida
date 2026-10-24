// Ajustes de Gradle para compilar la APK más rápido en mi PC.
// Van en un plugin porque /android se genera con `expo prebuild` y no se edita a mano.
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  // Reusa tareas ya compiladas entre builds (también después de un prebuild --clean).
  'org.gradle.caching': 'true',
  'org.gradle.parallel': 'true',
  // llama.rn, SQLCipher y ML Kit son pesados: con 2 GB Gradle se queda sin memoria y va lento.
  'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'kotlin.daemon.jvmargs': '-Xmx2048m',
};

module.exports = function withFastGradle(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
