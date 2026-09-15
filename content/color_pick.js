/**
 * 网页取色悬浮层：截屏采样 + 放大镜 + 连续取色
 */
(function () {
  if (window.__my_helper_color_pick__) {
    window.__my_helper_color_pick__.restart();
    return;
  }

  var ROOT_ID = 'my_helper_color_root';
  var HIST_KEY = 'color_pick_history';
  var HIST_MAX = 10;
  var LOUPE_SIZE = 11;
  var LOUPE_SCALE = 8;
  var loop_on = false;
  var active = false;
  var shot_canvas = null;
  var shot_ctx = null;
  var root = null;
  var loupe = null;
  var loupe_canvas = null;
  var loupe_ctx = null;
  var tip_el = null;
  var swatch_el = null;
  var hex_el = null;

  function normalize_hex(hex) {
    var h = String(hex || '').trim();
    if (!h) {
      return '';
    }
    if (h.charAt(0) !== '#') {
      h = '#' + h;
    }
    return h.toUpperCase();
  }

  function pixel_hex(x, y) {
    if (!shot_ctx) {
      return '#000000';
    }
    x = Math.max(0, Math.min(shot_canvas.width - 1, x));
    y = Math.max(0, Math.min(shot_canvas.height - 1, y));
    var d = shot_ctx.getImageData(x, y, 1, 1).data;
    return ('#' +
      d[0].toString(16).padStart(2, '0') +
      d[1].toString(16).padStart(2, '0') +
      d[2].toString(16).padStart(2, '0')).toUpperCase();
  }

  function push_history(hex) {
    hex = normalize_hex(hex);
    chrome.storage.local.get([HIST_KEY], (data) => {
      var list = Array.isArray(data[HIST_KEY]) ? data[HIST_KEY] : [];
      list.unshift({
        hex: hex,
        rgb: '',
        source: 'page',
        ts: Date.now()
      });
      var next = {};
      next[HIST_KEY] = list.slice(0, HIST_MAX);
      chrome.storage.local.set(next);
    });
  }

  function copy_hex(hex) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(hex);
    }
    return Promise.resolve();
  }

  function build_ui() {
    destroy_ui();
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML =
      '<style>' +
      '#' + ROOT_ID + '{all:initial;position:fixed;inset:0;z-index:2147483646;cursor:crosshair;font-family:Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;}' +
      '#' + ROOT_ID + ' *{box-sizing:border-box;}' +
      '#' + ROOT_ID + ' .mh_mask{position:absolute;inset:0;background:rgba(15,23,42,.08);}' +
      '#' + ROOT_ID + ' .mh_bar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:rgba(15,23,42,.92);color:#e2e8f0;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:2;}' +
      '#' + ROOT_ID + ' .mh_swatch{width:22px;height:22px;border-radius:5px;border:1px solid #94a3b8;background:#334155;}' +
      '#' + ROOT_ID + ' .mh_hex{font-family:Consolas,Courier New,monospace;font-size:13px;min-width:72px;}' +
      '#' + ROOT_ID + ' .mh_tip{font-size:12px;color:#94a3b8;}' +
      '#' + ROOT_ID + ' .mh_btn{padding:4px 10px;border:1px solid #475569;border-radius:6px;background:#1e293b;color:#e2e8f0;font-size:12px;cursor:pointer;}' +
      '#' + ROOT_ID + ' .mh_btn.on{background:#2563eb;border-color:#2563eb;}' +
      '#' + ROOT_ID + ' .mh_loupe{position:fixed;z-index:3;pointer-events:none;padding:8px;border:2px solid #fff;border-radius:12px;background:#0f172a;box-shadow:0 10px 28px rgba(15,23,42,.4);display:none;}' +
      '#' + ROOT_ID + ' .mh_loupe_view{position:relative;width:' + (LOUPE_SIZE * LOUPE_SCALE) + 'px;height:' + (LOUPE_SIZE * LOUPE_SCALE) + 'px;overflow:hidden;border-radius:6px;background:#000;}' +
      '#' + ROOT_ID + ' .mh_loupe_view canvas{display:block;width:100%;height:100%;image-rendering:pixelated;}' +
      '#' + ROOT_ID + ' .mh_loupe_cross{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(#fff,#fff) left center / calc(50% - 7px) 2px no-repeat,linear-gradient(#fff,#fff) right center / calc(50% - 7px) 2px no-repeat,linear-gradient(#fff,#fff) center top / 2px calc(50% - 7px) no-repeat,linear-gradient(#fff,#fff) center bottom / 2px calc(50% - 7px) no-repeat;filter:drop-shadow(0 0 1px rgba(15,23,42,.9));}' +
      '#' + ROOT_ID + ' .mh_loupe_view::after{content:"";position:absolute;left:50%;top:50%;z-index:2;width:10px;height:10px;border:2px solid #f43f5e;box-shadow:0 0 0 1px rgba(255,255,255,.95);transform:translate(-50%,-50%);pointer-events:none;}' +
      '#' + ROOT_ID + ' .mh_loupe_hex{display:block;margin-top:6px;text-align:center;font-family:Consolas,Courier New,monospace;font-size:12px;color:#e2e8f0;}' +
      '</style>' +
      '<div class="mh_mask"></div>' +
      '<div class="mh_loupe"><div class="mh_loupe_view"><canvas width="' + LOUPE_SIZE + '" height="' + LOUPE_SIZE + '"></canvas><span class="mh_loupe_cross"></span></div><span class="mh_loupe_hex">#000000</span></div>' +
      '<div class="mh_bar">' +
      '<span class="mh_swatch"></span>' +
      '<span class="mh_hex">—</span>' +
      '<button class="mh_btn" type="button" data_act="loop">连续取色</button>' +
      '<button class="mh_btn" type="button" data_act="close">退出 Esc</button>' +
      '<span class="mh_tip">移动预览 · 点击取色</span>' +
      '</div>';
    document.documentElement.appendChild(root);
    loupe = root.querySelector('.mh_loupe');
    loupe_canvas = loupe.querySelector('canvas');
    loupe_ctx = loupe_canvas.getContext('2d', { willReadFrequently: true });
    tip_el = root.querySelector('.mh_tip');
    swatch_el = root.querySelector('.mh_swatch');
    hex_el = root.querySelector('.mh_hex');

    root.addEventListener('mousemove', on_move);
    root.addEventListener('click', on_click);
    root.querySelector('[data_act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      stop();
    });
    root.querySelector('[data_act="loop"]').addEventListener('click', (e) => {
      e.stopPropagation();
      loop_on = !loop_on;
      e.currentTarget.classList.toggle('on', loop_on);
      tip_el.textContent = loop_on ? '连续取色中 · Esc 退出' : '移动预览 · 点击取色';
    });
  }

  function destroy_ui() {
    var old = document.getElementById(ROOT_ID);
    if (old) {
      old.remove();
    }
    root = null;
  }

  function screen_xy(e) {
    var dpr = window.devicePixelRatio || 1;
    return {
      x: Math.floor(e.clientX * dpr),
      y: Math.floor(e.clientY * dpr)
    };
  }

  function update_loupe(e, hex) {
    if (!shot_ctx) {
      return;
    }
    var pos = screen_xy(e);
    var half = Math.floor(LOUPE_SIZE / 2);
    var sx = Math.max(0, Math.min(shot_canvas.width - LOUPE_SIZE, pos.x - half));
    var sy = Math.max(0, Math.min(shot_canvas.height - LOUPE_SIZE, pos.y - half));
    var img = shot_ctx.getImageData(sx, sy, LOUPE_SIZE, LOUPE_SIZE);
    loupe_ctx.putImageData(img, 0, 0);
    loupe.querySelector('.mh_loupe_hex').textContent = hex;
    loupe.style.display = 'block';
    var left = e.clientX + 18;
    var top = e.clientY + 18;
    var box = LOUPE_SIZE * LOUPE_SCALE + 40;
    if (left + box > window.innerWidth) {
      left = e.clientX - box;
    }
    if (top + box > window.innerHeight) {
      top = e.clientY - box;
    }
    loupe.style.left = left + 'px';
    loupe.style.top = top + 'px';
  }

  function on_move(e) {
    if (!active || !shot_ctx) {
      return;
    }
    var pos = screen_xy(e);
    var hex = pixel_hex(pos.x, pos.y);
    swatch_el.style.background = hex;
    hex_el.textContent = hex;
    update_loupe(e, hex);
  }

  function on_click(e) {
    if (!active || !shot_ctx) {
      return;
    }
    if (e.target.closest('.mh_bar')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var pos = screen_xy(e);
    var hex = pixel_hex(pos.x, pos.y);
    swatch_el.style.background = hex;
    hex_el.textContent = hex;
    push_history(hex);
    copy_hex(hex);
    tip_el.textContent = '已复制 ' + hex + (loop_on ? ' · 继续点击' : '');
    if (!loop_on) {
      setTimeout(stop, 180);
    }
  }

  function on_key(e) {
    if (!active) {
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
    }
  }

  function load_shot(data_url) {
    return new Promise((resolve, reject) => {
      var img = new Image();
      img.onload = () => {
        shot_canvas = document.createElement('canvas');
        shot_canvas.width = img.width;
        shot_canvas.height = img.height;
        shot_ctx = shot_canvas.getContext('2d', { willReadFrequently: true });
        shot_ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = data_url;
    });
  }

  function start(data_url) {
    build_ui();
    active = true;
    loop_on = false;
    document.addEventListener('keydown', on_key, true);
    load_shot(data_url).then(() => {
      tip_el.textContent = '移动预览 · 点击取色 · Esc 退出';
    }).catch(() => {
      tip_el.textContent = '截屏加载失败';
    });
  }

  function stop() {
    active = false;
    loop_on = false;
    document.removeEventListener('keydown', on_key, true);
    destroy_ui();
    shot_canvas = null;
    shot_ctx = null;
  }

  function restart() {
    chrome.runtime.sendMessage({ type: 'color_pick_capture' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        return;
      }
      start(res.data_url);
    });
  }

  window.__my_helper_color_pick__ = {
    start: start,
    stop: stop,
    restart: restart
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'color_pick_start' && msg.data_url) {
      start(msg.data_url);
    }
  });
})();
