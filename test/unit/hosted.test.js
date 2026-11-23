const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isRuntime, hostedApp } = require('../../platform/hosted');

test('isRuntime: only java/javaw', () => {
  for (const exe of ['java', 'javaw', 'java.exe', 'JAVAW.EXE']) assert.equal(isRuntime(exe), true, exe);
  for (const exe of ['javac', 'game.exe', '', null, undefined]) assert.equal(isRuntime(exe), false, String(exe));
});

test('hostedApp: not a runtime', () => {
  assert.equal(hostedApp('game.exe', ['game.exe'], 'Game'), null);
});

test('hostedApp: Minecraft from the command line', () => {
  const args = ['javaw.exe', '-Xmx2G', '-cp', 'libs/a.jar', 'net.minecraft.client.main.Main', '--version', '1.21'];
  assert.deepEqual(hostedApp('javaw.exe', args, 'whatever'), { exe: 'minecraft', name: 'Minecraft' });
});

test('hostedApp: Minecraft from the window title when the command line is unknown', () => {
  assert.deepEqual(hostedApp('java', null, 'Minecraft 1.21.4'), { exe: 'minecraft', name: 'Minecraft' });
  assert.equal(hostedApp('java', null, 'Some other app'), null);
  assert.equal(hostedApp('java', null, null), null);
});

test('hostedApp: unknown app keyed by jar or main class', () => {
  assert.deepEqual(hostedApp('java', ['java', '-Xmx1G', '-jar', '/opt/tools/MyTool.jar'], 'T'), { exe: 'MyTool', name: null });
  assert.deepEqual(hostedApp('java', ['java', '-cp', 'x.jar', '-Dfoo=1', 'com.example.Main', 'arg'], 'T'), { exe: 'com.example.Main', name: null });
  assert.deepEqual(hostedApp('java', ['java', '-m', 'mod/com.example.App'], 'T'), { exe: 'mod/com.example.App', name: null });
  assert.deepEqual(hostedApp('java', ['java', '--module=mod/App'], 'T'), { exe: 'mod/App', name: null });
  assert.deepEqual(hostedApp('java', ['C:\\jdk\\bin\\java.exe', '-jar', 'C:\\apps\\Tool.JAR'], 'T'), { exe: 'Tool', name: null });
  assert.equal(hostedApp('java', ['java', '-version'], 'T'), null);
});
