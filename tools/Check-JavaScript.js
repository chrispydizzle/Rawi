'use strict';

var acorn = require('acorn');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var scriptsPath = path.join(root, 'MovieDeck', 'js');
var files = fs.readdirSync(scriptsPath).filter(function (name) {
  return /\.js$/.test(name);
}).sort().map(function (name) {
  return path.join(scriptsPath, name);
});

files.push(path.join(root, 'MovieDeck', 'config', 'copy-overrides.example.js'));

files.forEach(function (file) {
  try {
    acorn.parse(fs.readFileSync(file, 'utf8'), {
      ecmaVersion: 5,
      sourceType: 'script'
    });
  } catch (error) {
    if (!(error instanceof SyntaxError)) { throw error; }
    console.error(path.relative(root, file) + ': ' + error.message);
    process.exitCode = 1;
  }
});

if (!process.exitCode) {
  console.log('ES5 syntax checked in ' + files.length + ' first-party browser scripts.');
}
