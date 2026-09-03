'use strict';

var fs = require('fs');
var path = require('path');

var SAMPLE_RATE = 22050;

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function envelope(t, duration, attack, release) {
  var attackGain = attack > 0 ? Math.min(1, t / attack) : 1;
  var releaseGain = release > 0 ? Math.min(1, (duration - t) / release) : 1;
  return Math.max(0, Math.min(attackGain, releaseGain));
}

function sine(frequency, t) {
  return Math.sin(Math.PI * 2 * frequency * t);
}

function render(duration, createSample) {
  var frames = Math.floor(SAMPLE_RATE * duration);
  var pcm = Buffer.alloc(frames * 2);
  var sample = createSample();
  var i;
  var value;

  for (i = 0; i < frames; i += 1) {
    value = clamp(sample(i / SAMPLE_RATE, duration));
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  return pcm;
}

function wav(pcm) {
  var output = Buffer.alloc(44 + pcm.length);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + pcm.length, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(pcm.length, 40);
  pcm.copy(output, 44);
  return output;
}

function focusFactory() {
  return function (t, duration) {
    var body = sine(740, t) * 0.52 + sine(1110, t) * 0.18;
    return body * envelope(t, duration, 0.004, 0.07) * Math.exp(-18 * t);
  };
}

function confirmFactory() {
  return function (t, duration) {
    var second = t >= 0.11 ? sine(659.25, t - 0.11) * Math.exp(-7 * (t - 0.11)) : 0;
    var first = sine(523.25, t) * Math.exp(-6 * t);
    var warmth = sine(261.63, t) * 0.20 * Math.exp(-8 * t);
    return (first * 0.38 + second * 0.32 + warmth) * envelope(t, duration, 0.01, 0.12);
  };
}

function backFactory() {
  var seed = 24681357;
  var smoothed = 0;
  return function (t, duration) {
    seed = (seed * 48271) % 2147483647;
    smoothed = smoothed * 0.82 + ((seed / 2147483647) * 2 - 1) * 0.18;
    return smoothed * 0.32 * envelope(t, duration, 0.015, 0.16);
  };
}

function magicFactory() {
  var notes = [
    { start: 0.00, frequency: 783.99 },
    { start: 0.09, frequency: 987.77 },
    { start: 0.18, frequency: 1174.66 }
  ];
  return function (t, duration) {
    var total = 0;
    notes.forEach(function (note) {
      var local = t - note.start;
      if (local >= 0) {
        total += sine(note.frequency, local) * Math.exp(-8 * local);
        total += sine(note.frequency * 2, local) * 0.12 * Math.exp(-11 * local);
      }
    });
    return total * 0.22 * envelope(t, duration, 0.006, 0.13);
  };
}

var DEFINITIONS = [
  { name: 'storybook-focus.wav', duration: 0.09, factory: focusFactory },
  { name: 'storybook-confirm.wav', duration: 0.42, factory: confirmFactory },
  { name: 'storybook-back.wav', duration: 0.28, factory: backFactory },
  { name: 'storybook-magic.wav', duration: 0.52, factory: magicFactory }
];

function generate(outputDirectory) {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  DEFINITIONS.forEach(function (definition) {
    fs.writeFileSync(
      path.join(outputDirectory, definition.name),
      wav(render(definition.duration, definition.factory))
    );
  });
}

function outputArgument(argv) {
  var index = argv.indexOf('--output');
  if (index === -1 || !argv[index + 1]) {
    throw new Error('Usage: node tools\\Generate-StorybookSounds.js --output <directory>');
  }
  return path.resolve(argv[index + 1]);
}

if (require.main === module) {
  generate(outputArgument(process.argv.slice(2)));
}

module.exports = {
  generate: generate
};
