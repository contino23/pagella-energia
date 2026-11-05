// Configurazione Metro: quella standard di Expo (gestisce già il monorepo) più una regola.
// @pagella/core è TypeScript con import "./file.js" (stile ESM di Node): Metro li cerca come .ts.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const precedente = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const risolvi = precedente ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return risolvi(context, moduleName.slice(0, -3), platform);
    } catch {
      // nessun .ts con quel nome: si prova il file .js così com'è
    }
  }
  return risolvi(context, moduleName, platform);
};

module.exports = config;
