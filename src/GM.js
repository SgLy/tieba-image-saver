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
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url: target.href,
      method: 'GET',
      responseType,
      onload: (res) => {
        resolve(res.response);
      },
      onerror: (res) => {
        log(`Request error: ${res}`);
        reject(res);
      },
      onprogress: onProgress,
    });
  });
};

module.exports = { registerMenuCommand, request };
