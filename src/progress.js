const $ = (selector, element = document) =>
  Array.from(element.querySelectorAll(selector));

/**
 * @param {string} tag
 * @param {string} id
 * @param {string[]} classList
 * @param {Record<string, string>} style
 */
const _ = (tag = 'div', id, style = {}, content = '', classList = []) => {
  classList.push('tieba-image-save');
  const el = document.createElement(tag);
  if (id) el.id = idPrefix + id;
  classList.forEach((c) => el.classList.add(c));
  Object.keys(style).forEach((k) => {
    el.style[k] = style[k];
  });
  el.innerText = content;
  return el;
};

const isAtEnd = (el) => el.offsetHeight + el.scrollTop === el.scrollHeight;

const globalStyle = document.createElement('style');
globalStyle.innerHTML = `
`;

/** @type {HTMLDivElement} */
let container = null;

const body = document.getElementsByTagName('body')[0];

const idPrefix = 'tieba-image-save-';

const ALL_STATE = {
  WAITING: 0,
  GOING: 1,
  SUCCESS: 2,
  FAILED: 3,
};

const STATE_COLOR = {
  [ALL_STATE.WAITING]: 'grey',
  [ALL_STATE.GOING]: 'blue',
  [ALL_STATE.SUCCESS]: 'green',
  [ALL_STATE.FAILED]: 'red',
};

const STATE_SIGN = {
  [ALL_STATE.WAITING]: '…',
  [ALL_STATE.GOING]: '•',
  [ALL_STATE.SUCCESS]: '✔',
  [ALL_STATE.FAILED]: '✘',
};

const createProgress = () => {
  if (container && container.parentElement) {
    container.parentElement.removeChild(container);
  }
  body.appendChild(globalStyle);

  container = _('div', 'container', {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    width: '100vw',
    opacity: 0,
    transition: 'opacity 0.1s ease-in-out',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  setTimeout(() => {
    container.style.opacity = 1;
  });
  body.appendChild(container);

  const mask = _('div', 'mask', {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100vh',
    width: '100vw',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: -1,
  });
  container.appendChild(mask);

  const innerContainer = _('div', 'inner-container', {
    borderRadius: '5px',
    fontSize: '1.2em',
    backgroundColor: 'white',
    padding: '1.5em',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 'min(720px, 80vw)',
  });
  container.appendChild(innerContainer);

  const title = _(
    'h2',
    'title',
    {
      fontFamily: 'sans',
      marginBottom: '1em',
    },
    '打包下载',
  );
  innerContainer.appendChild(title);

  const stepList = _('div', 'step-list', {
    fontFamily: 'sans',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  });
  innerContainer.appendChild(stepList);

  const imageList = _('div', 'image-list', {
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    margin: '1em 0',
    flexWrap: 'wrap',
    width: '50em',
  });
  innerContainer.appendChild(imageList);

  const showLog = _(
    'div',
    'show-log',
    {
      fontFamily: 'sans',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      color: 'navy',
    },
    '展开详细日志',
  );
  innerContainer.appendChild(showLog);

  const detailLogs = _('div', 'detail-logs', {
    fontFamily: 'monospace',
    fontSize: '0.8em',
    whiteSpace: 'pre',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    height: '2em',
    overflow: 'hidden',
    transition: 'height 0.1s ease-in-out',
    maxWidth: '100%',
  });
  innerContainer.appendChild(detailLogs);
  let scrollLogNextTime = false;
  {
    let next;
    const collapse = () => {
      detailLogs.style.overflow = 'hidden';
      detailLogs.style.height = '2em';
      showLog.innerText = '展开详细日志';
      detailLogs.scroll(0, Number.MAX_SAFE_INTEGER);
      scrollLogNextTime = true;
      next = expand;
    };
    const expand = () => {
      detailLogs.style.overflow = 'auto';
      detailLogs.style.height = '20em';
      showLog.innerText = '收起详细日志';
      next = collapse;
    };
    next = expand;
    showLog.onclick = () => {
      next();
    };
  }

  const logs = [];
  const allSteps = {};
  const allImages = {};

  return {
    remove() {
      container.style.opacity = 0;
      setTimeout(() => {
        container.parentElement.removeChild(container);
        globalStyle.parentElement.removeChild(globalStyle);
      }, 100);
    },
    addStep(id, _text, progressBar = false) {
      if (allSteps[id]) {
        const oldStep = allSteps[id].step;
        oldStep.parentElement.removeChild(oldStep);
      }
      const step = _('div', null, {
        display: 'flex',
        flexDirection: 'row',
        background: 'transparent',
        alignItems: 'center',
      });
      const state = _('div', null);
      step.appendChild(state);
      const text = _('div', null, { marginLeft: '8px' }, _text);
      step.appendChild(text);
      stepList.appendChild(step);
      allSteps[id] = { state, step, text };
      if (progressBar) {
        const progress = _('div', null, {
          width: '5em',
          padding: '0 8px',
          marginLeft: '1em',
          borderRadius: '5px',
          background: '#f2f2f2',
          height: '0.8em',
          textAlign: 'center',
        });
        step.appendChild(progress);
        const stateText = _('div', null, {
          marginLeft: '1em',
          color: 'grey',
        });
        step.appendChild(stateText);
        allSteps[id].progress = progress;
        allSteps[id].stateText = stateText;
      }
      this.changeStepState(id, ALL_STATE.WAITING);
      return allSteps[id];
    },
    changeStepState(id, _state) {
      const { state } = allSteps[id];
      state.style.color = STATE_COLOR[_state];
      state.innerText = STATE_SIGN[_state];
    },
    updateStepProgress(id, percent, text) {
      const { progress, stateText } = allSteps[id];
      if (!progress) return;
      progress.style.background = `linear-gradient(90deg, #e6e6e6 0%, #e6e6e6 ${percent}%, #f2f2f2 ${percent}%, #f2f2f2 100%)`;
      stateText.innerText = text;
    },
    addImage(id) {
      if (allImages[id]) {
        const oldImage = allImages[id].image;
        oldImage.parentElement.removeChild(oldImage);
      }
      const image = _('div', null, {
        width: '3em',
        display: 'flex',
        flexDirection: 'row',
        padding: '0 8px',
        justifyContent: 'space-between',
        marginRight: '1em',
        marginBottom: '0.5em',
        borderRadius: '5px',
        background: '#f2f2f2',
      });
      image.appendChild(_('div', null, {}, id));
      const state = _('div', null);
      image.appendChild(state);
      imageList.appendChild(image);
      allImages[id] = { image, state };
      this.changeImageState(id, ALL_STATE.WAITING);
      return allImages[id];
    },
    changeImageState(id, _state) {
      const { state } = allImages[id];
      state.style.color = STATE_COLOR[_state];
      state.innerText = STATE_SIGN[_state];
    },
    updateImageProgress(id, percent) {
      const { image } = allImages[id];
      image.style.background = `linear-gradient(90deg, #e6e6e6 0%, #e6e6e6 ${percent}%, #f2f2f2 ${percent}%, #f2f2f2 100%);`;
    },
    addLog(log) {
      let shouldScroll = isAtEnd(detailLogs);
      logs.push(log);
      detailLogs.innerText = logs.join('\n');
      if (shouldScroll || scrollLogNextTime) {
        scrollLogNextTime = false;
        detailLogs.scroll(0, Number.MAX_SAFE_INTEGER);
      }
    },
  };
};

module.exports = { $, createProgress, ALL_STATE };
