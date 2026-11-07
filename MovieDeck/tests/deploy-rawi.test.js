'use strict';

var assert = global.RawiTest.assert;
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var root = path.join(__dirname, '..', '..');
var hosts = ['powershell.exe', 'pwsh.exe'].filter(function (host) {
  return childProcess.spawnSync(host, ['-NoProfile', '-Command', 'exit 0']).status === 0;
});

assert.ok(hosts.length, 'Deployment helper tests require PowerShell.');

hosts.forEach(function (host) {
  var workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rawi-deploy-test-'));
  var project = path.join(workspace, 'MovieDeck');
  var tools = path.join(workspace, 'tools');
  var profile = path.join(workspace, 'home');
  var sdk = path.join(profile, 'tizen-studio', 'tools');
  var localConfigPath = path.join(workspace, 'rawi.local.json');
  var callsPath = path.join(workspace, 'native-calls.txt');
  var config;

  function run(args) {
    return childProcess.spawnSync(host, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(tools, 'Deploy-Rawi.ps1')
    ].concat(args), {
      encoding: 'utf8',
      cwd: profile,
      env: Object.assign({}, process.env, { USERPROFILE: profile }),
      timeout: 30000
    });
  }

  function expectFailure(args, message) {
    var result = run(args);
    assert.ifError(result.error);
    assert.notStrictEqual(result.status, 0, host + ': expected a failed deployment');
    assert.ok((result.stdout + result.stderr).indexOf(message) !== -1, result.stdout + result.stderr);
    assert.strictEqual(fs.readFileSync(path.join(project, 'config.xml'), 'utf8'), config);
    assert.strictEqual(fs.existsSync(path.join(workspace, 'dist')), false);
  }

  try {
    fs.mkdirSync(path.join(project, 'js'), { recursive: true });
    fs.mkdirSync(tools);
    fs.mkdirSync(path.join(sdk, 'ide', 'bin'), { recursive: true });
    var script = fs.readFileSync(path.join(root, 'tools', 'Deploy-Rawi.ps1'), 'utf8');
    var sdbPath = 'tizen-studio\\tools\\sdb.exe';
    assert.strictEqual(script.split(sdbPath).length, 2, 'Expected one SDB path to replace with the test stub.');
    fs.writeFileSync(
      path.join(tools, 'Deploy-Rawi.ps1'),
      script.replace(sdbPath, 'tizen-studio\\tools\\sdb.bat')
    );
    fs.copyFileSync(path.join(root, 'MovieDeck', 'config.xml'), path.join(project, 'config.xml'));
    fs.copyFileSync(path.join(root, 'MovieDeck', 'js', 'api.js'), path.join(project, 'js', 'api.js'));
    ['LICENSE', 'THIRD_PARTY_NOTICES.md'].forEach(function (file) {
      fs.copyFileSync(path.join(root, file), path.join(workspace, file));
    });
    config = fs.readFileSync(path.join(project, 'config.xml'), 'utf8');

    fs.writeFileSync(path.join(sdk, 'sdb.bat'), [
      '@echo off',
      'echo sdb %*>>"' + callsPath + '"',
      'if "%~1"=="devices" echo List of devices attached',
      'exit /b 0',
      ''
    ].join('\r\n'));
    fs.writeFileSync(path.join(sdk, 'ide', 'bin', 'tizen.bat'), [
      '@echo off',
      'echo tizen %*>>"' + callsPath + '"',
      'if not "%~1"=="package" exit /b 0',
      'if not exist "%~9\\LICENSE" exit /b 32',
      'if not exist "%~9\\THIRD_PARTY_NOTICES.md" exit /b 33',
      'if exist "%~9\\rawi.local.json" exit /b 34',
      'echo package-test>"%~7\\Rawi.wgt"',
      'exit /b 0',
      ''
    ].join('\r\n'));

    expectFailure(['-SigningProfile', 'TestProfile'], 'Specify -Target');
    expectFailure(['-PackageOnly'], 'Specify -SigningProfile');

    [
      { json: '{invalid', message: 'Invalid JSON' },
      { json: '[{}]', message: 'JSON object' },
      { json: '{"target":42}', message: 'must be a string' },
      { json: '{"signingProfle":"Typo"}', message: 'Unknown local setting' }
    ].forEach(function (testCase) {
      fs.writeFileSync(localConfigPath, testCase.json);
      expectFailure(['-PackageOnly', '-SigningProfile', 'TestProfile'], testCase.message);
    });

    fs.writeFileSync(localConfigPath, JSON.stringify({
      target: '192.0.2.10:26101',
      signingProfile: 'LocalProfile'
    }));
    expectFailure(['-Target', ' '], 'Specify -Target');

    var result = run(['-NoVersionIncrement', '-Launch']);
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    var calls = fs.readFileSync(callsPath, 'utf8');
    assert.ok(calls.indexOf('package -t wgt -s LocalProfile') !== -1, calls);
    assert.ok(calls.indexOf('sdb connect 192.0.2.10:26101') !== -1, calls);
    assert.ok(calls.indexOf('install -n Rawi.wgt -s 192.0.2.10:26101') !== -1, calls);
    assert.ok(calls.indexOf('run -p JfMovieTV1.MovieDeck -s 192.0.2.10:26101') !== -1, calls);

    fs.writeFileSync(callsPath, '');
    result = run([
      '-Target', '192.0.2.20:26101',
      '-SigningProfile', 'OverrideProfile',
      '-NoVersionIncrement'
    ]);
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    calls = fs.readFileSync(callsPath, 'utf8');
    assert.ok(calls.indexOf('package -t wgt -s OverrideProfile') !== -1, calls);
    assert.ok(calls.indexOf('sdb connect 192.0.2.20:26101') !== -1, calls);
    assert.ok(calls.indexOf('install -n Rawi.wgt -s 192.0.2.20:26101') !== -1, calls);
    assert.strictEqual(calls.indexOf('LocalProfile'), -1);
    assert.strictEqual(calls.indexOf('192.0.2.10:26101'), -1);
    assert.strictEqual(calls.indexOf('run -p'), -1);

    fs.unlinkSync(localConfigPath);
    result = run(['-PackageOnly', '-SigningProfile', 'TestProfile', '-NoVersionIncrement']);
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(path.join(workspace, 'dist', 'Rawi.wgt')));
    assert.strictEqual(fs.readFileSync(path.join(project, 'config.xml'), 'utf8'), config);
    ['LICENSE', 'THIRD_PARTY_NOTICES.md'].forEach(function (file) {
      assert.strictEqual(
        fs.readFileSync(path.join(project, file), 'utf8'),
        fs.readFileSync(path.join(workspace, file), 'utf8')
      );
    });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
