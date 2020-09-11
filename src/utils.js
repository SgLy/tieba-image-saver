const logSteps = [];
const appendLogStep = (fn) => {
  logSteps.push(fn);
};

const log = (s) => {
  const msg = `[${new Date().toISOString()}] ` + s;
  logSteps.forEach((fn) => {
    fn(msg);
  });
};

const isDebug = false;
if (isDebug) {
  appendLogStep((s) => {
    // eslint-disable-next-line no-console
    console.log(s);
  });
}

const _logs = [];
appendLogStep((s) => {
  _logs.push(s);
});

/**
 * return a new asynchronous function which has same functionality as `func`,
 * but can at most run `maxCount` instance concurrently, exceeded calls will
 * be pend and run when old calls end.
 * @param {number} maxCount
 * @param {(...args: any[]) => Promise<any>} func
 * @returns {(...args: any[]) => Promise<any>}
 */
function limit(maxCount, func) {
  let currentCount = 0;
  let totalCount = 0;
  const pendingRun = [];
  return async function (...args) {
    const run = async function (...args) {
      currentCount++;
      const current = totalCount++;
      log(`[#${current}] Requesting ${args[0]}\n`);
      const ret = await func(...args);
      const waitTime = Math.random() * 1000;
      log(`[#${current}] Done, waiting ${waitTime}\n`);
      setTimeout(async () => {
        currentCount--;
        if (pendingRun.length > 0) {
          const pending = pendingRun.shift();
          (async () => {
            const ret = await pending.func(...pending.args);
            pending.resolve(ret);
          })();
        }
      }, waitTime);
      return ret;
    };
    if (currentCount >= maxCount) {
      return new Promise((resolve) => {
        pendingRun.push({ func: run, args, resolve });
      });
    } else {
      return await run(...args);
    }
  };
}

const zipFiles = async (files, onProgress) => {
  const zip = new JSZip();
  Object.keys(files).forEach((name) => {
    zip.file(name, files[name]);
  });
  return await zip.generateAsync({ type: 'blob' }, onProgress);
};

module.exports = { limit, log, appendLogStep, zipFiles };
