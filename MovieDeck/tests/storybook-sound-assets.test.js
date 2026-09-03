'use strict';

var assert = global.RawiTest.assert;
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

var root = path.join(__dirname, '..', '..');
var committed = path.join(root, 'MovieDeck', 'audio');
var generated = fs.mkdtempSync(path.join(os.tmpdir(), 'rawi-storybook-sounds-'));
var names = [
  'storybook-focus.wav',
  'storybook-confirm.wav',
  'storybook-back.wav',
  'storybook-magic.wav'
];

try {
  var result = childProcess.spawnSync(
    process.execPath,
    [path.join(root, 'tools', 'Generate-StorybookSounds.js'), '--output', generated],
    { encoding: 'utf8' }
  );

  assert.strictEqual(result.status, 0, (result.stdout || '') + (result.stderr || ''));
  names.forEach(function (name) {
    var actual = fs.readFileSync(path.join(committed, name));
    var regenerated = fs.readFileSync(path.join(generated, name));

    assert.strictEqual(actual.slice(0, 4).toString('ascii'), 'RIFF');
    assert.strictEqual(actual.slice(8, 12).toString('ascii'), 'WAVE');
    assert(actual.length > 1000, name + ' should contain audible PCM data');
    assert.deepStrictEqual(regenerated, actual, name + ' must be reproducible');
  });
} finally {
  names.forEach(function (name) {
    var file = path.join(generated, name);
    if (fs.existsSync(file)) { fs.unlinkSync(file); }
  });
  fs.rmdirSync(generated);
}
