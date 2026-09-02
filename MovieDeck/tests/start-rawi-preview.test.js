'use strict';

var assert = global.RawiTest.assert;
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var powerShellInvocationId = 0;
var currentPowerShellHost = null;
var powerShellHosts = detectPowerShellHosts();

assert.notStrictEqual(
  powerShellHosts.length,
  0,
  'Expected at least one available PowerShell host for preview helper tests.'
);

function joinOutput(result) {
  return (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '');
}

function detectPowerShellHosts() {
  var hosts = [
    {
      command: 'powershell.exe',
      invocationArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass'],
      probeArgs: ['-NoProfile', '-Command', '$PSVersionTable.PSEdition']
    },
    {
      command: 'pwsh.exe',
      invocationArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass'],
      probeArgs: ['-NoProfile', '-Command', '$PSVersionTable.PSEdition']
    }
  ];

  return hosts.filter(function (host) {
    var probe = childProcess.spawnSync(host.command, host.probeArgs, {
      stdio: 'ignore'
    });

    if (probe.error || probe.status !== 0) {
      console.log('Skipping preview helper ownership tests for ' + host.command + ': host unavailable.');
      return false;
    }

    return true;
  });
}

function activePowerShellHost() {
  return currentPowerShellHost || powerShellHosts[0];
}

function withPowerShellHost(host, run) {
  currentPowerShellHost = host;
  try {
    run();
  } finally {
    currentPowerShellHost = null;
  }
}

function hostLabel() {
  return '[' + activePowerShellHost().command + '] ';
}

function deleteTree(root) {
  var stat;

  if (!fs.existsSync(root)) { return; }
  stat = fs.statSync(root);
  if (!stat.isDirectory()) {
    fs.unlinkSync(root);
    return;
  }

  fs.readdirSync(root).forEach(function (entry) {
    deleteTree(path.join(root, entry));
  });
  fs.rmdirSync(root);
}

function makeWorkspace() {
  var workspace = path.join(
    __dirname,
    'preview-helper-work-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  );

  fs.mkdirSync(workspace);
  fs.mkdirSync(path.join(workspace, 'shared-temp'));
  return workspace;
}

function createPreviewCopy(workspace, name, marker) {
  var root = path.join(workspace, name);
  var movieDeck = path.join(root, 'MovieDeck');
  var tools = path.join(root, 'tools');

  fs.mkdirSync(root);
  fs.mkdirSync(movieDeck);
  fs.mkdirSync(tools);
  fs.copyFileSync(
    path.join(__dirname, '..', '..', 'tools', 'Start-RawiPreview.ps1'),
    path.join(tools, 'Start-RawiPreview.ps1')
  );
  fs.writeFileSync(
    path.join(movieDeck, 'index.html'),
    '<!doctype html><html><body>' + marker + '</body></html>'
  );
  return root;
}

function previewEnvironment(sharedTemp) {
  var env = {};

  Object.keys(process.env).forEach(function (name) {
    env[name] = process.env[name];
  });
  env.TEMP = sharedTemp;
  env.TMP = sharedTemp;
  env['ProgramFiles(x86)'] = path.join(sharedTemp, 'no-edge-x86');
  env.ProgramFiles = path.join(sharedTemp, 'no-edge');
  return env;
}

function runPowerShell(commandArgs, env) {
  var host = activePowerShellHost();
  var tempRoot = env && env.TEMP ? env.TEMP : __dirname;
  var invocationId = powerShellInvocationId + 1;
  var stdoutPath = path.join(tempRoot, 'run-powershell-' + process.pid + '-' + invocationId + '.stdout.txt');
  var stderrPath = path.join(tempRoot, 'run-powershell-' + process.pid + '-' + invocationId + '.stderr.txt');
  var stdoutHandle;
  var stderrHandle;
  var result;

  powerShellInvocationId = invocationId;
  stdoutHandle = fs.openSync(stdoutPath, 'w');
  stderrHandle = fs.openSync(stderrPath, 'w');

  try {
    result = childProcess.spawnSync(
      host.command,
      host.invocationArgs.concat(commandArgs),
      {
        env: env,
        stdio: ['ignore', stdoutHandle, stderrHandle]
      }
    );
  } finally {
    fs.closeSync(stdoutHandle);
    fs.closeSync(stderrHandle);
  }

  result.stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
  result.stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
  if (fs.existsSync(stdoutPath)) { fs.unlinkSync(stdoutPath); }
  if (fs.existsSync(stderrPath)) { fs.unlinkSync(stderrPath); }
  return result;
}

function runPreview(root, env, args) {
  return runPowerShell(
    ['-File', path.join(root, 'tools', 'Start-RawiPreview.ps1'), '-NoBrowser'].concat(args || []),
    env
  );
}

function browserCapablePreviewEnvironment(sharedTemp) {
  var env = previewEnvironment(sharedTemp);

  if (process.env['ProgramFiles(x86)']) {
    env['ProgramFiles(x86)'] = process.env['ProgramFiles(x86)'];
  } else {
    delete env['ProgramFiles(x86)'];
  }
  if (process.env.ProgramFiles) {
    env.ProgramFiles = process.env.ProgramFiles;
  } else {
    delete env.ProgramFiles;
  }
  return env;
}

function runPowerShellCommand(command, env) {
  return runPowerShell(['-Command', command], env);
}

function readPreviewStateFile(filePath, env) {
  var attempt;
  var value;

  for (attempt = 0; attempt < 20; attempt += 1) {
    try {
      value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return value;
    } catch (error) {
      if (error && error.code !== 'EPERM' && error.code !== 'EBUSY') {
        throw error;
      }
    }
    runPowerShellCommand('Start-Sleep -Milliseconds 100', env);
  }

  return null;
}

function getPreviewState(root, env) {
  var appPath = path.join(root, 'MovieDeck');
  var stateRoot = path.join(env.TEMP, 'rawi-preview');
  var match = null;

  if (!fs.existsSync(stateRoot)) { return null; }
  fs.readdirSync(stateRoot).forEach(function (entry) {
    var filePath;
    var value;

    if (match || !/\.json$/i.test(entry)) { return; }
    filePath = path.join(stateRoot, entry);
    value = readPreviewStateFile(filePath, env);
    if (value && value.AppPath === appPath) {
      match = value;
    }
  });
  return match;
}

function getListenerPid(port, env) {
  var result = runPowerShellCommand(
    '(Get-NetTCPConnection -State Listen -LocalPort ' + port + ' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1)',
    env
  );
  var value;

  assert.strictEqual(result.status, 0, joinOutput(result));
  value = String(result.stdout || '').trim();
  return value ? Number(value) : null;
}

function isProcessAlive(pid, env) {
  var result;
  var value;

  if (!pid) { return false; }
  result = runPowerShellCommand(
    '$process = Get-Process -Id ' + pid + ' -ErrorAction SilentlyContinue; if ($process) { $process.Id }',
    env
  );
  value = String(result.stdout || '').trim();
  return value ? Number(value) === pid : false;
}

function waitForProcessState(pid, env, expectedAlive) {
  var attempt;
  var alive;

  for (attempt = 0; attempt < 20; attempt += 1) {
    alive = isProcessAlive(pid, env);
    if (alive === expectedAlive) {
      return true;
    }
    runPowerShellCommand('Start-Sleep -Milliseconds 200', env);
  }

  return false;
}

function forceStopProcess(pid, env) {
  if (!pid) { return; }
  runPowerShellCommand('Stop-Process -Id ' + pid + ' -Force -ErrorAction SilentlyContinue', env);
}

function getOwnedPreviewProcessIds(root, env) {
  var appPath = path.join(root, 'MovieDeck').replace(/'/g, "''");
  var result = runPowerShellCommand(
    "$appPath = '" + appPath + "'; " +
      "Get-CimInstance Win32_Process | " +
      "Where-Object { $_.CommandLine -and $_.CommandLine -like ('*' + $appPath + '*') -and $_.CommandLine -match 'http\\\\.server' } | " +
      'Select-Object -ExpandProperty ProcessId',
    env
  );
  var output;

  assert.strictEqual(result.status, 0, joinOutput(result));
  output = String(result.stdout || '').trim();
  if (!output) { return []; }
  return output.split(/\r?\n/).filter(Boolean).map(function (value) {
    return Number(String(value).trim());
  });
}

function forceStopOwnedPreviewProcesses(root, env) {
  getOwnedPreviewProcessIds(root, env).forEach(function (pid) {
    forceStopProcess(pid, env);
  });
}

function findInstalledEdgePath(env) {
  var result = runPowerShellCommand(
    '$edge = "${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe"; ' +
      'if (!(Test-Path $edge)) { $edge = "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe" }; ' +
      'if (Test-Path $edge) { $edge }',
    env
  );

  assert.strictEqual(result.status, 0, joinOutput(result));
  return String(result.stdout || '').trim();
}

function getBrowserProcessIdsForUrl(url, env) {
  var needle = String(url).replace(/'/g, "''");
  var result = runPowerShellCommand(
    "$needle = '" + needle + "'; " +
      'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ' +
      'Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($needle) } | ' +
      'Select-Object -ExpandProperty ProcessId',
    env
  );
  var output;

  assert.strictEqual(result.status, 0, joinOutput(result));
  output = String(result.stdout || '').trim();
  if (!output) { return []; }
  return output.split(/\r?\n/).filter(Boolean).map(function (value) {
    return Number(String(value).trim());
  });
}

function getPreviewStatusCode(url, env) {
  var result = runPowerShellCommand(
    "(Invoke-WebRequest '" + String(url).replace(/'/g, "''") + "' -UseBasicParsing -TimeoutSec 10).StatusCode",
    env
  );
  var value;

  assert.strictEqual(result.status, 0, joinOutput(result));
  value = String(result.stdout || '').trim();
  return value ? Number(value) : null;
}

function getProcessTreeWindowHandles(pid, env) {
  var result = runPowerShellCommand(
    '$target = ' + pid + '; ' +
      '$ids = New-Object System.Collections.Generic.List[int]; ' +
      '$ids.Add($target); ' +
      "Get-CimInstance Win32_Process -Filter ('ParentProcessId=' + $target) -ErrorAction SilentlyContinue | " +
      'ForEach-Object { $ids.Add([int]$_.ProcessId) }; ' +
      'foreach ($id in $ids) { ' +
      '$process = Get-Process -Id $id -ErrorAction SilentlyContinue; ' +
      "if ($process) { '' + $process.Id + '=' + [int64]$process.MainWindowHandle } }",
    env
  );
  var output;

  assert.strictEqual(result.status, 0, joinOutput(result));
  output = String(result.stdout || '').trim();
  if (!output) { return []; }
  return output.split(/\r?\n/).map(function (value) {
    return String(value).trim();
  }).filter(Boolean);
}

function getFreePort() {
  var result = runPowerShellCommand(
    '$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0); ' +
      '$listener.Start(); ' +
      'try { $listener.LocalEndpoint.Port } finally { $listener.Stop() }'
  );
  var value;

  assert.strictEqual(result.status, 0, joinOutput(result));
  value = String(result.stdout || '').trim();
  assert.notStrictEqual(value, '', joinOutput(result));
  return Number(value);
}

function testReusesOwnedPreviewForStorybookPhase3Routes() {
  var workspace = makeWorkspace();
  var sharedTemp = path.join(workspace, 'shared-temp');
  var root = createPreviewCopy(workspace, 'owner-a', 'Owner A');
  var env = previewEnvironment(sharedTemp);
  var port = getFreePort();
  var listenerPid = null;

  try {
    var initial = runPreview(root, env, ['-Port', String(port), '-StorybookMock']);
    var initialState;
    var magicRoute;
    var categoryRoute;
    var detailsRoute;
    var stopResult;

    assert.strictEqual(initial.status, 0, hostLabel() + joinOutput(initial));
    initialState = getPreviewState(root, env);
    listenerPid = Number(initialState.ProcessId);
    assert(listenerPid, 'expected preview state metadata after starting the preview');
    assert.strictEqual(waitForProcessState(listenerPid, env, true), true);

    magicRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'magic']);
    assert.strictEqual(magicRoute.status, 0, hostLabel() + joinOutput(magicRoute));
    assert.notStrictEqual(joinOutput(magicRoute).indexOf('storybookScreen=magic'), -1, hostLabel() + joinOutput(magicRoute));
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(magicRoute));

    categoryRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'category', '-StorybookCategoryKey', 'animals']);
    assert.strictEqual(categoryRoute.status, 0, hostLabel() + joinOutput(categoryRoute));
    assert.notStrictEqual(joinOutput(categoryRoute).indexOf('storybookScreen=category&storybookCategoryKey=animals'), -1, hostLabel() + joinOutput(categoryRoute));
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(categoryRoute));

    detailsRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'details', '-StorybookItemId', 'bluey']);
    assert.strictEqual(detailsRoute.status, 0, hostLabel() + joinOutput(detailsRoute));
    assert.notStrictEqual(
      joinOutput(detailsRoute).indexOf(
        'Rawi preview: http://127.0.0.1:' + port + '/?preview=storybook&storybookScreen=details&storybookItemId=bluey'
      ),
      -1,
      hostLabel() + joinOutput(detailsRoute)
    );
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(detailsRoute));

    stopResult = runPreview(root, env, ['-Port', String(port), '-Stop']);
    assert.strictEqual(stopResult.status, 0, hostLabel() + joinOutput(stopResult));
    assert.strictEqual(waitForProcessState(listenerPid, env, false), true, hostLabel() + joinOutput(stopResult));
    assert.strictEqual(getPreviewState(root, env), null, hostLabel() + joinOutput(stopResult));
    assert.deepStrictEqual(getOwnedPreviewProcessIds(root, env), [], hostLabel() + joinOutput(stopResult));
    listenerPid = null;
  } finally {
    forceStopOwnedPreviewProcesses(root, env);
    forceStopProcess(listenerPid, env);
    deleteTree(workspace);
  }
}

function testNoBrowserServesStorybookPhase3RoutesWithoutOpeningAnInstalledBrowser() {
  var workspace = makeWorkspace();
  var sharedTemp = path.join(workspace, 'shared-temp');
  var root = createPreviewCopy(workspace, 'owner-a', 'Owner A');
  var env = browserCapablePreviewEnvironment(sharedTemp);
  var port = getFreePort();
  var listenerPid = null;

  try {
    var edgePath = findInstalledEdgePath(env);
    var baseUrl = 'http://127.0.0.1:' + port + '/';
    var magicUrl = baseUrl + '?preview=storybook&storybookScreen=magic';
    var start;
    var magicRoute;
    var stopResult;

    assert.notStrictEqual(
      edgePath,
      '',
      hostLabel() + 'expected a real installed Microsoft Edge so -NoBrowser is proven without faking ProgramFiles.'
    );

    start = runPreview(root, env, ['-Port', String(port), '-StorybookMock']);
    assert.strictEqual(start.status, 0, hostLabel() + joinOutput(start));
    listenerPid = Number(getPreviewState(root, env).ProcessId);
    assert(listenerPid, 'expected preview state metadata after starting the preview with -NoBrowser');
    assert.strictEqual(waitForProcessState(listenerPid, env, true), true);

    magicRoute = runPreview(root, env, ['-Port', String(port), '-StorybookMock', '-StorybookScreen', 'magic']);
    assert.strictEqual(magicRoute.status, 0, hostLabel() + joinOutput(magicRoute));
    assert.notStrictEqual(
      joinOutput(magicRoute).indexOf('Rawi preview: ' + magicUrl),
      -1,
      hostLabel() + joinOutput(magicRoute)
    );
    assert.strictEqual(Number(getPreviewState(root, env).ProcessId), listenerPid, hostLabel() + joinOutput(magicRoute));
    assert.strictEqual(getPreviewStatusCode(magicUrl, env), 200, hostLabel() + joinOutput(magicRoute));
    assert.deepStrictEqual(
      getBrowserProcessIdsForUrl(baseUrl, env),
      [],
      hostLabel() + '-NoBrowser must not launch ' + edgePath + ' for ' + baseUrl
    );
    assert.deepStrictEqual(
      getProcessTreeWindowHandles(listenerPid, env).filter(function (entry) {
        return !/=0$/.test(entry);
      }),
      [],
      hostLabel() + 'expected the owned preview listener tree to have no visible window.'
    );

    stopResult = runPreview(root, env, ['-Port', String(port), '-Stop']);
    assert.strictEqual(stopResult.status, 0, hostLabel() + joinOutput(stopResult));
    assert.strictEqual(waitForProcessState(listenerPid, env, false), true, hostLabel() + joinOutput(stopResult));
    assert.strictEqual(getPreviewState(root, env), null, hostLabel() + joinOutput(stopResult));
    assert.deepStrictEqual(getOwnedPreviewProcessIds(root, env), [], hostLabel() + joinOutput(stopResult));
    listenerPid = null;
  } finally {
    forceStopOwnedPreviewProcesses(root, env);
    forceStopProcess(listenerPid, env);
    deleteTree(workspace);
  }
}

function testRefusesDifferentAppPathOwnershipAndStopsOnlyOwnedPreview() {
  var workspace = makeWorkspace();
  var sharedTemp = path.join(workspace, 'shared-temp');
  var rootA = createPreviewCopy(workspace, 'owner-a', 'Owner A');
  var rootB = createPreviewCopy(workspace, 'owner-b', 'Owner B');
  var env = previewEnvironment(sharedTemp);
  var portA = getFreePort();
  var portB = getFreePort();
  var ownerAPid = null;
  var ownerBPid = null;

  try {
    var startA = runPreview(rootA, env, ['-Port', String(portA), '-StorybookMock']);
    var foreignStart;
    var foreignStartOutput;
    var foreignStop;
    var foreignStopOutput;
    var startB;
    var stopB;

    assert.strictEqual(startA.status, 0, hostLabel() + joinOutput(startA));
    ownerAPid = Number(getPreviewState(rootA, env).ProcessId);
    assert(ownerAPid, 'expected owner A to hold its preview port');
    assert.strictEqual(waitForProcessState(ownerAPid, env, true), true);

    foreignStart = runPreview(rootB, env, ['-Port', String(portA), '-StorybookMock']);
    foreignStartOutput = joinOutput(foreignStart);

    assert.notStrictEqual(foreignStart.status, 0, hostLabel() + foreignStartOutput);
    assert.notStrictEqual(
      /different AppPath|not owned|refus/i.test(foreignStartOutput),
      false,
      hostLabel() + foreignStartOutput
    );
    assert.strictEqual(waitForProcessState(ownerAPid, env, true), true, hostLabel() + foreignStartOutput);

    foreignStop = runPreview(rootB, env, ['-Port', String(portA), '-Stop']);
    foreignStopOutput = joinOutput(foreignStop);

    assert.notStrictEqual(foreignStop.status, 0, hostLabel() + foreignStopOutput);
    assert.notStrictEqual(
      /different AppPath|not owned|refus/i.test(foreignStopOutput),
      false,
      hostLabel() + foreignStopOutput
    );
    assert.strictEqual(waitForProcessState(ownerAPid, env, true), true, hostLabel() + foreignStopOutput);

    startB = runPreview(rootB, env, ['-Port', String(portB), '-StorybookMock']);
    assert.strictEqual(startB.status, 0, hostLabel() + joinOutput(startB));
    ownerBPid = Number(getPreviewState(rootB, env).ProcessId);
    assert(ownerBPid, 'expected owner B to hold its own preview port');
    assert.notStrictEqual(ownerBPid, ownerAPid);
    assert.strictEqual(waitForProcessState(ownerBPid, env, true), true);

    stopB = runPreview(rootB, env, ['-Port', String(portB), '-Stop']);
    assert.strictEqual(stopB.status, 0, hostLabel() + joinOutput(stopB));
    assert.strictEqual(waitForProcessState(ownerBPid, env, false), true, hostLabel() + joinOutput(stopB));
    assert.strictEqual(getPreviewState(rootB, env), null, hostLabel() + joinOutput(stopB));
    assert.deepStrictEqual(getOwnedPreviewProcessIds(rootB, env), [], hostLabel() + joinOutput(stopB));
    assert.strictEqual(waitForProcessState(ownerAPid, env, true), true);

    runPreview(rootA, env, ['-Port', String(portA), '-Stop']);
    assert.strictEqual(waitForProcessState(ownerAPid, env, false), true, 'expected owner A stop to end the owned listener');
    assert.deepStrictEqual(getOwnedPreviewProcessIds(rootA, env), [], 'expected owner A stop to clean its process tree');
    ownerAPid = null;
    ownerBPid = null;
  } finally {
    forceStopOwnedPreviewProcesses(rootA, env);
    forceStopOwnedPreviewProcesses(rootB, env);
    forceStopProcess(ownerAPid, env);
    forceStopProcess(ownerBPid, env);
    deleteTree(workspace);
  }
}

powerShellHosts.forEach(function (host) {
  withPowerShellHost(host, testReusesOwnedPreviewForStorybookPhase3Routes);
  withPowerShellHost(host, testNoBrowserServesStorybookPhase3RoutesWithoutOpeningAnInstalledBrowser);
  withPowerShellHost(host, testRefusesDifferentAppPathOwnershipAndStopsOnlyOwnedPreview);
});
