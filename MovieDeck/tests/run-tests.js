'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var pendingTests = [];
var failureReported = false;
var DEFAULT_TEST_FILES = [
  'api.test.js',
  'smart-search.test.js',
  'animations.test.js',
  'storage.test.js',
  'run-tests-runner.test.js',
  'storybook-sound-assets.test.js',
  'storybook-sound.test.js',
  'storybook-app.test.js',
  'storybook-preferences.test.js',
  'storybook-model.test.js',
  'storybook-discovery.test.js',
  'storybook-catalogue.test.js',
  'storybook-view.test.js',
  'start-rawi-preview.test.js',
  'copy.test.js'
];

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

function registerAsync(name, executor) {
  pendingTests.push(Promise.resolve().then(function () {
    return typeof executor === 'function' ? executor() : executor;
  }).catch(function (error) {
    if (error && error.message && error.message.indexOf(name + ':') !== 0) {
      error.message = name + ': ' + error.message;
    }
    throw error;
  }));
}

function reportFailure(error) {
  if (failureReported) { return; }
  failureReported = true;
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}

function testFiles() {
  var requested = process.argv.slice(2);
  if (requested.length) { return requested.map(validateRequestedTestFile); }
  return DEFAULT_TEST_FILES.slice();
}

function validateRequestedTestFile(file) {
  var normalized = path.normalize(file);
  var fullPath = path.join(__dirname, normalized);

  if (!/\.test\.js$/i.test(path.basename(normalized)) ||
      !fs.existsSync(fullPath) ||
      !fs.statSync(fullPath).isFile()) {
    throw new Error(
      'Requested test selector "' + file +
      '" does not exist or is not a recognized test filename (*.test.js).'
    );
  }

  return normalized;
}

function loadTests(files) {
  files.forEach(function (file) {
    var fullPath = path.join(__dirname, file);
    require(fullPath);
  });
}

global.RawiTest = {
  assert: require('assert'),
  loadBrowserScript: loadBrowserScript,
  registerAsync: registerAsync
};

process.on('unhandledRejection', reportFailure);

Promise.resolve().then(function () {
  loadTests(testFiles());
  return Promise.all(pendingTests);
}).then(function () {
  if (!failureReported) {
    console.log('All Rawi tests passed.');
  }
}).catch(function (error) {
  reportFailure(error);
});
