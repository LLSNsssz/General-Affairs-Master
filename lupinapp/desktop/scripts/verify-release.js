const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(projectRoot, ".runtime-release-verify");
const verifyFile = path.join(runtimeRoot, "release-verify.json");
const electronBinary = require("electron");

const VERIFY_TIMEOUT_MS = 20000;
const VERIFY_POLL_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupVerifyFile() {
  try {
    fs.unlinkSync(verifyFile);
  } catch {
    // Ignore stale cleanup failures.
  }
}

async function waitForVerifyFile() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < VERIFY_TIMEOUT_MS) {
    if (fs.existsSync(verifyFile)) {
      return;
    }

    await sleep(VERIFY_POLL_MS);
  }

  throw new Error("Release verification timed out before the app reported a ready window.");
}

async function waitForExit(child) {
  await new Promise((resolve, reject) => {
    child.once("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Release verification exited with code ${code}.`));
        return;
      }

      resolve();
    });

    child.once("error", reject);
  });
}

async function main() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  cleanupVerifyFile();

  const child = spawn(electronBinary, [projectRoot, "--release-verify"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      STICKY_RELEASE_VERIFY: "1"
    }
  });

  try {
    await waitForVerifyFile();
    await waitForExit(child);
    console.log("Release verification passed.");
  } catch (error) {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // Ignore cleanup failures after verification errors.
      }
    }

    throw error;
  } finally {
    cleanupVerifyFile();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
