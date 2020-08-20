const { limit, log, appendLogStep, zipFiles } = require('./utils');
const { registerMenuCommand, request } = require('./GM');
const { $, createProgress, ALL_STATE } = require('./progress');

const get = limit(10, request);

/** @type {ReturnType<createProgress>} */
let progress;

const getFirstPicId = async ({ tid }) => {
  progress.addStep('fetchPhotoPage', '获取首图ID');
  progress.changeStepState('fetchPhotoPage', ALL_STATE.GOING);
  log(`获取图楼页，帖子ID：${tid}`);
  try {
    const photoPage = await get('https://tieba.baidu.com/photo/p', {
      params: {
        tid: tid,
      },
    });
    progress.changeStepState('fetchPhotoPage', ALL_STATE.SUCCESS);
    const firstIdGroup = photoPage.match(/url_pic_id = "([0-9a-f]{40})"/);
    if (firstIdGroup === null) {
      // 没有图楼
      log('错误：没有图楼');
      progress.changeStepState('fetchPhotoPage', ALL_STATE.FAILED);
      return;
    }
    const firstId = firstIdGroup[1];
    log(`首图ID：${firstId}`);
    return firstId;
  } catch (e) {
    progress.changeStepState('fetchPhotoPage', ALL_STATE.FAILED);
    throw e;
  }
};

async function getSinglePage({ tid, lastId, index }) {
  try {
    log(`获取第${index}页，上一页末图ID：${lastId}`);
    const res = await get('https://tieba.baidu.com/photo/bw/picture/guide', {
      responseType: 'json',
      params: {
        kw: '',
        tid: tid,
        see_lz: 1,
        from_page: 0,
        alt: 'jview',
        next: 15,
        prev: 15,
        pic_id: lastId,
        _: Date.now(),
      },
    });
    return res.data;
  } catch (e) {
    log(`获取第${index}页出错`);
    throw e;
  }
}

async function getAllPage({ tid, firstId }) {
  const allPic = {};
  let index = 1;
  let lastId = firstId;
  let total = 0;
  let maxId = -1;
  do {
    const page = await getSinglePage({ tid, lastId, index });
    total = Math.max(total, page.pic_amount);
    Object.keys(page.pic_list).forEach((k) => {
      allPic[k] = page.pic_list[k];
      const currentId = parseInt(k.replace(/^#/, ''));
      if (currentId > maxId) {
        maxId = currentId;
        lastId = allPic[k].img.original.id;
      }
    });
    if (Object.keys(allPic).length >= total) break;
    index += 1;
  } while (true);
  return allPic;
}

async function getList({ tid, firstId }) {
  try {
    log('获取图片列表');
    progress.addStep('fetchPhotoList', '获取图片列表');
    progress.changeStepState('fetchPhotoList', ALL_STATE.GOING);
    const list = await getAllPage({ tid, firstId });
    if (!list) {
      log('图片列表为空');
      progress.changeStepState('fetchPhotoList', ALL_STATE.FAILED);
      return;
    }
    progress.changeStepState('fetchPhotoList', ALL_STATE.SUCCESS);
    log(`图片列表：${JSON.stringify(list)}`);
    return list;
  } catch (e) {
    progress.changeStepState('fetchPhotoList', ALL_STATE.FAILED);
    throw e;
  }
}

async function getImage({ list, id }) {
  progress.addImage(id);
  let url;
  try {
    log(`获取图片 ${id}`);
    url = list[id].img.original.waterurl;
    progress.changeImageState(id, ALL_STATE.GOING);
    const img = await get(url, {
      responseType: 'arraybuffer',
      onProgress: (e) => {
        if (e.lengthComputable) {
          progress.updateImageProgress(id, (e.loaded / e.total) * 100);
        }
      },
    });
    const ext = url.match(/(\.[a-zA-Z0-9]+)$/)[1];
    progress.changeImageState(id, ALL_STATE.SUCCESS);
    return { name: `${id.slice(1)}${ext}`, content: img };
  } catch (e) {
    log(`获取图片失败：ID=${id}, URL=${url}`);
    progress.changeImageState(id, ALL_STATE.FAILED);
    throw e;
  }
}

async function getAllImage({ list }) {
  try {
    progress.addStep('fetchAllImage', '获取所有图片');
    progress.changeStepState('fetchAllImage', ALL_STATE.GOING);
    const imageList = await Promise.all(
      Object.keys(list).map((id) => getImage({ list, id })),
    );
    progress.changeStepState('fetchAllImage', ALL_STATE.SUCCESS);
    const allImages = {};
    imageList.forEach((image) => {
      allImages[image.name] = image.content;
    });
    return allImages;
  } catch (e) {
    progress.changeStepState('fetchAllImage', ALL_STATE.FAILED);
    throw e;
  }
}

async function zip({ allFiles }) {
  try {
    log('全部获取完成，压缩中');
    progress.addStep('zip', '压缩', true);
    progress.changeStepState('zip', ALL_STATE.GOING);
    progress.changeStepState('zip', ALL_STATE.SUCCESS);
    return await zipFiles(allFiles, (e) => {
      progress.updateStepProgress('zip', e.percent, e.currentFile);
    });
  } catch (e) {
    progress.changeStepState('zip', ALL_STATE.FAILED);
    throw e;
  }
}

async function save({ name, file }) {
  try {
    log('压缩完毕，下载');
    progress.addStep('download', '下载');
    progress.changeStepState('download', ALL_STATE.GOING);
    saveAs(file, name);
    progress.changeStepState('download', ALL_STATE.SUCCESS);
  } catch (e) {
    progress.changeStepState('download', ALL_STATE.FAILED);
    throw e;
  }
}

async function fetchThread({ title, tid }) {
  try {
    log(`开始获取，标题：${title}，帖子ID：${tid}`);
    const allFiles = {};
    const firstId = await getFirstPicId({ tid });
    const list = await getList({ tid, firstId });
    allFiles['meta.json'] = JSON.stringify(list, null, 2);
    const allImages = await getAllImage({ list });
    Object.keys(allImages).forEach((name) => {
      allFiles[name] = allImages[name];
    });
    const zipFile = await zip({ allFiles });
    await save({ name: title + '.zip', file: zipFile });
  } catch (e) {
    log(`错误：${e}`);
    log('获取失败，流程结束');
  }
}

const getTid = () => {
  const path = new URL(document.URL).pathname;
  return path.match(/(\d+)/)[0];
};

const getTitle = () => {
  try {
    return $('#j_core_title_wrap h3')[0].title;
  } catch (e) {
    log('can not get title');
    return document.title;
  }
};

const main = async () => {
  progress = createProgress();
  appendLogStep((s) => {
    progress.addLog(s);
  });
  await fetchThread({
    title: getTitle(),
    tid: getTid(),
  });
};

registerMenuCommand('Download', main);
