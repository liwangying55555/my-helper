/**
 * 后台：安装初始化 + 网页取色 + 整页截图
 * JPG 输出 / 超长页拆分 / 内层滚动裁剪
 */
importScripts(chrome.runtime.getURL('shared/tool_list.js'));

var pending_full_shot = null;
var full_shot_busy = false;
var full_shot_abort = false;
var MAX_SHOTS = 80;
var MAX_EDGE = 16384;
var JPG_QUALITY = 0.98;
/** 相邻屏重叠（CSS 像素），拼接时裁掉，消除接缝 */
var STITCH_OVERLAP = 72;
var RESULT_PATH = 'pages/full_shot/index.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([PANEL_PINS_KEY, TOOL_ORDER_KEY], (exist) => {
    var data = {};
    data[PANEL_PINS_KEY] = Array.isArray(exist[PANEL_PINS_KEY])
      ? normalize_pins(exist[PANEL_PINS_KEY])
      : DEFAULT_PINS.slice();
    data[TOOL_ORDER_KEY] = normalize_order(exist[TOOL_ORDER_KEY]);
    chrome.storage.local.set(data);
  });
});

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function capture_tab(window_id) {
  return new Promise(function (resolve) {
    chrome.tabs.captureVisibleTab(window_id, { format: 'png' }, function (data_url) {
      if (chrome.runtime.lastError || !data_url) {
        resolve({
          ok: false,
          error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || '截屏失败'
        });
        return;
      }
      resolve({ ok: true, data_url: data_url });
    });
  });
}

function send_tab(tab_id, message) {
  return new Promise(function (resolve) {
    chrome.tabs.sendMessage(tab_id, message, function (res) {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message || '页面通信失败'
        });
        return;
      }
      resolve(res || { ok: false, error: '无响应' });
    });
  });
}

function inject_file(tab_id, file) {
  return new Promise(function (resolve) {
    chrome.scripting.executeScript(
      { target: { tabId: tab_id }, files: [file] },
      function () {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message || '脚本注入失败'
          });
          return;
        }
        resolve({ ok: true });
      }
    );
  });
}

function activate_tab(tab_id) {
  return new Promise(function (resolve) {
    chrome.tabs.update(tab_id, { active: true }, function () {
      resolve(!chrome.runtime.lastError);
    });
  });
}

function inject_and_start_color(tab_id, data_url, send_response) {
  chrome.scripting.executeScript(
    { target: { tabId: tab_id }, files: ['content/color_pick.js'] },
    () => {
      if (chrome.runtime.lastError) {
        send_response({
          ok: false,
          error: chrome.runtime.lastError.message || '无法注入取色层'
        });
        return;
      }
      chrome.tabs.sendMessage(
        tab_id,
        { type: 'color_pick_start', data_url: data_url },
        () => {
          if (chrome.runtime.lastError) {
            send_response({
              ok: false,
              error: chrome.runtime.lastError.message || '启动取色失败'
            });
            return;
          }
          send_response({ ok: true });
        }
      );
    }
  );
}

function build_axis(page, view, overlap) {
  var list = [];
  if (page <= view) return [0];
  overlap = Math.max(0, Math.min(overlap || 0, Math.floor(view / 3)));
  var step = Math.max(1, view - overlap);
  var pos = 0;
  while (pos + view < page) {
    list.push(pos);
    pos += step;
  }
  var last = Math.max(0, page - view);
  if (!list.length || Math.abs(list[list.length - 1] - last) > 1) {
    list.push(last);
  } else {
    list[list.length - 1] = last;
  }
  return list;
}

async function data_url_to_bitmap(data_url) {
  var res = await fetch(data_url);
  var blob = await res.blob();
  return createImageBitmap(blob);
}

function blob_to_data_url(blob) {
  return blob.arrayBuffer().then(function (buffer) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    var binary = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    var mime = blob.type || 'image/jpeg';
    return 'data:' + mime + ';base64,' + btoa(binary);
  });
}

function open_result_page() {
  var page_url = chrome.runtime.getURL(RESULT_PATH);
  chrome.tabs.query({ url: [page_url, page_url + '*'] }, function (tabs) {
    var found = tabs && tabs[0];
    if (found && found.id) {
      chrome.tabs.update(
        found.id,
        { active: true, url: page_url + '?t=' + Date.now() },
        function () {
          if (found.windowId) chrome.windows.update(found.windowId, { focused: true });
        }
      );
      return;
    }
    chrome.tabs.create({ url: page_url });
  });
}

/** 按裁剪区取出内容；用截图像素比裁剪，避免 DPR 偏差二次缩放发糊 */
async function crop_capture(data_url, crop, win_w, win_h) {
  var bmp = await data_url_to_bitmap(data_url);
  if (!crop) return bmp;
  var css_w = win_w || crop.width || bmp.width;
  var css_h = win_h || crop.height || bmp.height;
  var scale_x = bmp.width / css_w;
  var scale_y = bmp.height / css_h;
  var sx = Math.max(0, Math.round((crop.x || 0) * scale_x));
  var sy = Math.max(0, Math.round((crop.y || 0) * scale_y));
  var sw = Math.min(bmp.width - sx, Math.max(1, Math.round((crop.width || css_w) * scale_x)));
  var sh = Math.min(bmp.height - sy, Math.max(1, Math.round((crop.height || css_h) * scale_y)));
  if (sx <= 0 && sy <= 0 && sw >= bmp.width - 1 && sh >= bmp.height - 1) {
    return bmp;
  }
  var cropped = await createImageBitmap(bmp, sx, sy, sw, sh);
  bmp.close();
  return cropped;
}

function make_parts(full_w, full_h) {
  var parts = [];
  var y = 0;
  var index = 0;
  while (y < full_h) {
    var h = Math.min(MAX_EDGE, full_h - y);
    var canvas = new OffscreenCanvas(full_w, h);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, full_w, h);
    parts.push({
      index: index,
      y0: y,
      canvas: canvas,
      ctx: ctx,
      width: full_w,
      height: h
    });
    y += h;
    index += 1;
  }
  return parts;
}

function draw_to_parts(parts, bmp, sx, sy, sw, sh, dx, dy, dw, dh) {
  // 1:1 拷贝关平滑，避免文字发糊；缩小时才开高质量插值
  var same = Math.abs(dw - sw) < 0.51 && Math.abs(dh - sh) < 0.51;
  parts.forEach(function (part) {
    var y0 = part.y0;
    var y1 = part.y0 + part.height;
    if (dy + dh <= y0 || dy >= y1) return;
    var dst_y0 = Math.max(dy, y0);
    var dst_y1 = Math.min(dy + dh, y1);
    var dst_h = dst_y1 - dst_y0;
    if (dst_h < 1) return;

    part.ctx.imageSmoothingEnabled = !same;
    if (!same) part.ctx.imageSmoothingQuality = 'high';

    if (same) {
      var src_y0 = Math.round(sy + (dst_y0 - dy));
      var src_h = Math.round(dst_h);
      part.ctx.drawImage(
        bmp,
        Math.round(sx),
        src_y0,
        Math.round(sw),
        src_h,
        Math.round(dx),
        Math.round(dst_y0 - y0),
        Math.round(dw),
        src_h
      );
      return;
    }

    var t0 = (dst_y0 - dy) / dh;
    var t1 = (dst_y1 - dy) / dh;
    part.ctx.drawImage(
      bmp,
      sx,
      sy + sh * t0,
      sw,
      sh * (t1 - t0),
      dx,
      dst_y0 - y0,
      dw,
      dst_h
    );
  });
}

async function export_parts(parts, meta, extra) {
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var blob = await p.canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPG_QUALITY
    });
    var data_url = await blob_to_data_url(blob);
    out.push({
      data_url: data_url,
      width: p.width,
      height: p.height,
      index: i
    });
  }
  pending_full_shot = Object.assign(
    {
      format: 'jpeg',
      parts: out,
      // 兼容旧字段：首张
      data_url: out[0] && out[0].data_url,
      width: out[0] && out[0].width,
      height: out.reduce(function (sum, item) {
        return sum + item.height;
      }, 0),
      title: (meta && meta.title) || '',
      url: (meta && meta.url) || '',
      created_at: Date.now(),
      split: out.length > 1
    },
    extra || {}
  );
  open_result_page();
}

async function run_full_shot(tab) {
  if (full_shot_busy) return;
  full_shot_busy = true;
  full_shot_abort = false;

  var fail = async function (error) {
    try {
      await send_tab(tab.id, { type: 'full_shot_cmd', cmd: 'restore' });
    } catch (_e) {}
    pending_full_shot = { error: error || '整页截图失败' };
    open_result_page();
  };

  var parts = null;
  var scale_x = 1;
  var scale_y = 1;
  var full_w = 0;
  var full_h = 0;
  var capture_w = 0;
  var capture_h = 0;
  var drawn_right = 0;
  var drawn_bottom = 0;
  var shot_count = 0;
  var meta = null;
  var page_w = 0;
  var page_h = 0;

  try {
    var inject = await inject_file(tab.id, 'content/full_shot.js');
    if (!inject.ok) {
      await fail(inject.error);
      return;
    }

    await activate_tab(tab.id);
    meta = await send_tab(tab.id, { type: 'full_shot_cmd', cmd: 'prepare' });
    if (!meta || !meta.ok) {
      await fail((meta && meta.error) || '无法读取页面尺寸');
      return;
    }

    page_w = meta.page_width;
    page_h = meta.page_height;
    var xs = build_axis(page_w, meta.view_width, STITCH_OVERLAP);
    var ys = build_axis(page_h, meta.view_height, STITCH_OVERLAP);
    var total = xs.length * ys.length;
    if (total > MAX_SHOTS) {
      await fail('页面过长（约 ' + total + ' 屏），请缩小页面或分段截取');
      return;
    }

    var index = 0;
    var stopped = false;
    var dpr = meta.dpr || 1;
    var frozen = false;

    outer: for (var yi = 0; yi < ys.length; yi++) {
      for (var xi = 0; xi < xs.length; xi++) {
        if (full_shot_abort) {
          stopped = true;
          break outer;
        }

        index += 1;
        var x = xs[xi];
        var y = ys[yi];
        await send_tab(tab.id, {
          type: 'full_shot_cmd',
          cmd: 'progress',
          payload: {
            title: '整页截图中',
            text: '正在截取 ' + index + ' / ' + total,
            current: index - 1,
            total: total
          }
        });

        var scrolled = await send_tab(tab.id, {
          type: 'full_shot_cmd',
          cmd: 'scroll',
          payload: { x: x, y: y }
        });
        if (!scrolled || !scrolled.ok) {
          await fail((scrolled && scrolled.error) || '滚动失败');
          return;
        }

        // 懒加载可能撑高页面，动态扩展纵向轴与画布分段
        if (scrolled.page_height && scrolled.page_height > page_h + 2) {
          page_h = scrolled.page_height;
          var extra = build_axis(page_h, meta.view_height, STITCH_OVERLAP);
          extra.forEach(function (pos) {
            if (ys.indexOf(pos) === -1) ys.push(pos);
          });
          ys.sort(function (a, b) {
            return a - b;
          });
          total = xs.length * ys.length;
          if (parts) {
            var need_h = Math.round(page_h * scale_y);
            if (need_h > full_h) {
              var more = make_parts(full_w, need_h - full_h);
              more.forEach(function (p) {
                p.y0 += full_h;
                p.index = parts.length;
                parts.push(p);
              });
              full_h = need_h;
            }
          }
        }

        var real_x = typeof scrolled.x === 'number' ? scrolled.x : x;
        var real_y = typeof scrolled.y === 'number' ? scrolled.y : y;
        var crop = scrolled.crop || meta.crop;

        // 首屏之后：冻结/隐藏 fixed，避免顶栏画进接缝
        if (frozen) {
          await send_tab(tab.id, { type: 'full_shot_cmd', cmd: 'freeze_fixed' });
        }

        await activate_tab(tab.id);
        var before = await send_tab(tab.id, {
          type: 'full_shot_cmd',
          cmd: 'before_capture'
        });
        if (before && before.crop) crop = before.crop;
        await sleep(40);

        if (full_shot_abort) {
          stopped = true;
          break outer;
        }

        var cap = await capture_tab(tab.windowId);
        await send_tab(tab.id, {
          type: 'full_shot_cmd',
          cmd: 'after_capture',
          payload: {
            title: '整页截图中',
            text: '正在截取 ' + index + ' / ' + total,
            current: index,
            total: total
          }
        });
        if (!cap.ok) {
          await fail(cap.error || '截屏失败');
          return;
        }

        var tile = await crop_capture(
          cap.data_url,
          crop,
          meta.win_width || meta.view_width,
          meta.win_height || meta.view_height
        );
        if (!parts) {
          // 用裁剪后的实际像素 / 裁剪 CSS 尺寸，保证 1:1 设备像素
          var crop_w = (crop && crop.width) || meta.view_width;
          var crop_h = (crop && crop.height) || meta.view_height;
          scale_x = tile.width / crop_w;
          scale_y = tile.height / crop_h;
          full_w = Math.round(page_w * scale_x);
          full_h = Math.round(page_h * scale_y);
          var width_fit = full_w > MAX_EDGE ? MAX_EDGE / full_w : 1;
          if (width_fit < 1) {
            scale_x *= width_fit;
            scale_y *= width_fit;
            full_w = Math.max(1, Math.floor(full_w * width_fit));
            full_h = Math.max(1, Math.floor(full_h * width_fit));
          }
          parts = make_parts(full_w, full_h);
          capture_w = tile.width;
          capture_h = tile.height;
        }

        var base_sx = capture_w / ((crop && crop.width) || meta.view_width);
        var base_sy = capture_h / ((crop && crop.height) || meta.view_height);
        var dx = Math.round(real_x * scale_x);
        var dy = Math.round(real_y * scale_y);
        var dw = Math.round(tile.width * (scale_x / base_sx));
        var dh = Math.round(tile.height * (scale_y / base_sy));
        if (!isFinite(dw) || dw <= 0) dw = tile.width;
        if (!isFinite(dh) || dh <= 0) dh = tile.height;
        // 未缩宽时强制与源同尺寸，杜绝亚像素拉伸
        if (Math.abs(scale_x - base_sx) < 0.001) {
          dw = tile.width;
          dh = tile.height;
        }

        // 叠缝：后续屏裁掉与上一屏重叠的顶/左边，盖住接缝残留
        var src_x = 0;
        var src_y = 0;
        var src_w = tile.width;
        var src_h = tile.height;
        var out_dx = dx;
        var out_dy = dy;
        var out_dw = dw;
        var out_dh = dh;
        var cut_y = Math.min(
          Math.round(STITCH_OVERLAP * scale_y),
          Math.floor(tile.height / 5)
        );
        var cut_x = Math.min(
          Math.round(STITCH_OVERLAP * scale_x),
          Math.floor(tile.width / 5)
        );
        if (yi > 0 && cut_y > 0) {
          src_y = cut_y;
          src_h = tile.height - cut_y;
          out_dy = dy + cut_y;
          out_dh = dh - cut_y;
        }
        if (xi > 0 && cut_x > 0) {
          src_x = cut_x;
          src_w = tile.width - cut_x;
          out_dx = dx + cut_x;
          out_dw = dw - cut_x;
        }

        draw_to_parts(
          parts,
          tile,
          src_x,
          src_y,
          src_w,
          src_h,
          out_dx,
          out_dy,
          out_dw,
          out_dh
        );
        tile.close();
        shot_count += 1;
        drawn_right = Math.max(drawn_right, out_dx + out_dw);
        drawn_bottom = Math.max(drawn_bottom, out_dy + out_dh);

        // 首屏拍完立刻冻结，后续滚动不再带顶栏
        if (!frozen) {
          await send_tab(tab.id, { type: 'full_shot_cmd', cmd: 'freeze_fixed' });
          frozen = true;
        }
      }
    }

    await send_tab(tab.id, {
      type: 'full_shot_cmd',
      cmd: 'progress',
      payload: {
        title: stopped ? '正在停止' : '即将完成',
        text: stopped ? '正在生成已截取图片…' : '正在生成 JPG…',
        stopping: true
      }
    });

    if (!parts || shot_count === 0) {
      await fail(stopped ? '已取消截图' : '没有可用截图像');
      return;
    }

    // 停止时裁掉未画到的尾部分段
    if (stopped) {
      var keep_h = Math.max(1, Math.ceil(drawn_bottom));
      parts = parts.filter(function (p) {
        return p.y0 < keep_h;
      });
      var last = parts[parts.length - 1];
      if (last && last.y0 + last.height > keep_h) {
        var nh = Math.max(1, keep_h - last.y0);
        var cut = new OffscreenCanvas(last.width, nh);
        var cctx = cut.getContext('2d');
        cctx.drawImage(last.canvas, 0, 0, last.width, nh, 0, 0, last.width, nh);
        last.canvas = cut;
        last.height = nh;
      }
    }

    await send_tab(tab.id, { type: 'full_shot_cmd', cmd: 'restore' });
    await export_parts(parts, meta, {
      partial: stopped,
      dpr: dpr,
      capture_w: capture_w,
      capture_h: capture_h,
      inner_scroll: !!(meta && meta.inner_scroll),
      width_scaled: full_w < Math.round(page_w * (capture_w / meta.view_width)) - 1
    });
  } catch (err) {
    await fail((err && err.message) || '整页截图失败');
  } finally {
    full_shot_busy = false;
    full_shot_abort = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, send_response) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'color_pick_capture') {
    capture_tab(sender.tab && sender.tab.windowId).then(send_response);
    return true;
  }

  if (msg.type === 'color_pick_open') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        send_response({ ok: false, error: '未找到当前标签页' });
        return;
      }
      if (!/^https?:/i.test(tab.url || '') && !/^file:/i.test(tab.url || '')) {
        send_response({ ok: false, error: '当前页面不支持取色（如 chrome:// 页面）' });
        return;
      }
      capture_tab(tab.windowId).then((cap) => {
        if (!cap.ok) {
          send_response(cap);
          return;
        }
        inject_and_start_color(tab.id, cap.data_url, send_response);
      });
    });
    return true;
  }

  if (msg.type === 'full_shot_open') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        send_response({ ok: false, error: '未找到当前标签页' });
        return;
      }
      if (!/^https?:/i.test(tab.url || '') && !/^file:/i.test(tab.url || '')) {
        send_response({ ok: false, error: '当前页面不支持截图（如 chrome:// 页面）' });
        return;
      }
      if (full_shot_busy) {
        send_response({ ok: false, error: '正在截图中，请稍候' });
        return;
      }
      send_response({ ok: true });
      run_full_shot(tab);
    });
    return true;
  }

  if (msg.type === 'full_shot_stop') {
    if (full_shot_busy) {
      full_shot_abort = true;
      send_response({ ok: true });
      return;
    }
    send_response({ ok: false, error: '当前没有进行中的截图' });
    return;
  }

  if (msg.type === 'full_shot_take') {
    if (!pending_full_shot) {
      send_response({ ok: false, error: '' });
      return;
    }
    var job = pending_full_shot;
    pending_full_shot = null;
    send_response({ ok: true, job: job });
    return;
  }
});
