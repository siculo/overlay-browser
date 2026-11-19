// Applications run by a generic runtime (Java): the executable is the
// runtime's (java/javaw, "OpenJDK Platform" in its version information) for
// all of them, so it would give them all one site list. The application is
// told from the process's command line instead, read by the platform module.
//
// isRuntime(exe): true if exe is such a runtime (the command line is read
// only then).
// hostedApp(exe, args, title) -> { exe, name } replacing the runtime's
// executable and name, or null if exe is not a runtime (or nothing better
// is known). exe: the executable's file name; args: the command line split
// into arguments (program first), null if not readable; title: the window
// title (or the app's name on macOS), null if unknown.

const JAVA = /^javaw?(\.exe)?$/i;

// Known applications: matched on the command line (any argument: main
// class, class path, game folder...) or, when it is not readable, on the
// window title. `exe` is the key of their site list (and of the predefined
// lists, lists/index.json).
const KNOWN = [
  // Java Edition, from the official launcher or a third-party one (Prism,
  // MultiMC, ...), vanilla or modded (Fabric, Forge, ...): the game folder,
  // libraries and main class all name it.
  { exe: 'minecraft', name: 'Minecraft', args: /minecraft/i, title: /^Minecraft\b/ },
];

// Java options followed by a separate value (not the main class).
const JAVA_VALUE_OPTIONS = new Set([
  '-cp', '-classpath', '--class-path', '-p', '--module-path', '--upgrade-module-path',
  '--add-modules', '--add-opens', '--add-exports', '--add-reads', '--patch-module',
  '--limit-modules', '--enable-native-access', '--source',
]);

const baseName = (p) => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);

// The Java application's own name: the -jar file or the main class
// (module/class with -m), null if not found.
function javaMain(args) {
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '-jar') return args[i + 1] ? baseName(args[i + 1]).replace(/\.jar$/i, '') : null;
    if (a === '-m' || a === '--module') return args[i + 1] ?? null;
    if (a.startsWith('--module=')) return a.slice('--module='.length) || null;
    if (JAVA_VALUE_OPTIONS.has(a)) { i++; continue; }
    if (a.startsWith('-') || a.startsWith('@')) continue;   // other options, argument files
    return a;
  }
  return null;
}

// true if exe is a runtime: its command line is worth reading.
const isRuntime = (exe) => !!exe && JAVA.test(exe);

function hostedApp(exe, args, title) {
  if (!isRuntime(exe)) return null;
  const known = KNOWN.find((k) => args ? args.some((a) => k.args.test(a)) : title && k.title.test(title));
  if (known) return { exe: known.exe, name: known.name };
  const main = args && javaMain(args);
  // Unknown application: its main class or jar as key, the window title as name.
  return main ? { exe: main, name: null } : null;
}

module.exports = { isRuntime, hostedApp };
