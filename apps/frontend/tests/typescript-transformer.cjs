const ts = require('typescript');
module.exports = {
  process(sourceText, sourcePath) {
    return { code: ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText };
  },
};
