'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function loadBrowserScript(relativePath, additions) {
  var values = additions || {};
  var context = {
    console: console,
    window: values.window || {},
    localStorage: values.localStorage,
    document: values.document
  };
  context.window.window = context.window;
  context.window.localStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
  return context.window;
}

global.RawiTest = {
  assert: require('assert'),
  loadBrowserScript: loadBrowserScript
};

[
  'animations.test.js',
  'storage.test.js',
  'storybook-app.test.js',
  'storybook-preferences.test.js',
  'storybook-model.test.js',
  'storybook-view.test.js',
  'copy.test.js'
].forEach(function (file) {
  var fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) { require(fullPath); }
});

console.log('All Rawi tests passed.');
