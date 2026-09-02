'use strict';

var assert = global.RawiTest.assert;
var childProcess = require('child_process');
var path = require('path');

function runFixtureArgs(args) {
  return childProcess.spawnSync(
    process.execPath,
    [path.join(__dirname, 'run-tests.js')].concat(args),
    {
      cwd: __dirname,
      encoding: 'utf8'
    }
  );
}

(function runExplicitSelectorAndWaitsForRegisteredAsyncTestsBeforePrintingSuccess() {
  var result = runFixtureArgs(['runner-fixtures\\async-pass.test.js']);
  var settledIndex = result.stdout.indexOf('fixture settled');
  var successIndex = result.stdout.indexOf('All Rawi tests passed.');

  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.notStrictEqual(settledIndex, -1, result.stdout);
  assert.notStrictEqual(successIndex, -1, result.stdout);
  assert(successIndex > settledIndex, result.stdout);
}());

(function rejectsRunnerWhenRegisteredAsyncTestsFail() {
  var result = runFixtureArgs(['runner-fixtures\\async-fail.test.js']);
  var output = result.stdout + '\n' + result.stderr;

  assert.notStrictEqual(result.status, 0, output);
  assert.strictEqual(result.stdout.indexOf('All Rawi tests passed.'), -1, output);
  assert.notStrictEqual(output.indexOf('fixture rejection'), -1, output);
}());

(function rejectsExplicitSelectorsWhenRequestedFilesAreMissingOrNotTests() {
  var result = runFixtureArgs(['missing.test.js', 'run-tests.js']);
  var output = result.stdout + '\n' + result.stderr;

  assert.notStrictEqual(result.status, 0, output);
  assert.strictEqual(result.stdout.indexOf('All Rawi tests passed.'), -1, output);
  assert.notStrictEqual(output.indexOf('missing.test.js'), -1, output);
  assert.notStrictEqual(output.indexOf('run-tests.js'), -1, output);
  assert.notStrictEqual(output.indexOf('recognized test filename'), -1, output);
}());
