const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(projectRoot, ".runtime");
const instanceFile = path.join(runtimeRoot, "dev-instance.json");

fs.mkdirSync(runtimeRoot, { recursive: true });

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function readExistingInstancePid() {
  if (!fs.existsSync(instanceFile)) {
    return null;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(instanceFile, "utf8"));
    const pid = Number(payload?.pid);
    if (isPidRunning(pid)) {
      return pid;
    }
  } catch {
    // Ignore stale or malformed lock payloads.
  }

  try {
    fs.unlinkSync(instanceFile);
  } catch {
    // Ignore stale cleanup errors.
  }

  return null;
}

const existingPid = readExistingInstancePid();
if (existingPid) {
  console.log(`Sticky Lupin Reader is already running (pid ${existingPid}).`);
  process.exit(0);
}

const electronBinary = require("electron");
const child = spawn(electronBinary, [projectRoot], {
  cwd: projectRoot,
  stdio: "inherit"
});

fs.writeFileSync(instanceFile, JSON.stringify({
  pid: child.pid,
  launcherPid: process.pid,
  startedAt: Date.now()
}));

child.on("error", (error) => {
  try {
    fs.unlinkSync(instanceFile);
  } catch {
    // Ignore cleanup errors during startup failures.
  }

  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  try {
    fs.unlinkSync(instanceFile);
  } catch {
    // Ignore cleanup errors after the child exits.
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
