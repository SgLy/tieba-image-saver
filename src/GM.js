const { log } = require('./utils');

const registerMenuCommand = GM_registerMenuCommand;

const request = (
  url,
  { responseType = 'text', params = {}, onProgress = () => {} },
) => {
  const target = new URL(url);
  const p = new URLSearchParams();
  Object.keys(params).forEach((k) => {
    p.set(k, params[k]);
  });
  target.search = p.toString();
  let resolve;
  let reject;
  const ret = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  let retryCount = 0;
  const fire = ({ success, fail }) => {
    GM_xmlhttpRequest({
      url: target.href,
      method: 'GET',
      responseType,
      onload: (res) => {
        if (res.status !== 200) fail(`status code: ${res.status}`);
        else success(res.response);
      },
      onerror: (res) => {
        fail(`Request error: ${JSON.stringify(res)}`);
      },
      onprogress: onProgress,
    });
  };
  const success = (res) => {
    log(`Request ${target.href} ok`);
    resolve(res);
  };
  const fail = (reason) => {
    if (retryCount < 3) {
      retryCount++;
      log(
        `Request ${target.href} fail, reason: ${reason}, retrying (${
          retryCount + 1
        } attempt)`,
      );
      setTimeout(() => {
        fire({ success, fail });
      }, 3000);
    } else {
      log(
        `Request ${target.href} fail, reason: ${reason}, retrying up to 3 times, failing`,
      );
      reject(reason);
    }
  };
  fire({ success, fail });
  return ret;
};

module.exports = { registerMenuCommand, request };
