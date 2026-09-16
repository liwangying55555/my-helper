/**
 * 整页截图：内层滚动 / 延迟加载 / 稳妥 fixed / 进度与停止
 */
(function () {
  var ROOT_ID = 'my_helper_full_shot_root';
  var STYLE_ID = 'my_helper_full_shot_style';

  var stale_root = document.getElementById(ROOT_ID);
  if (stale_root) stale_root.remove();
  var stale_style = document.getElementById(STYLE_ID);
  if (stale_style) stale_style.remove();
  if (window.__my_helper_full_shot__ && typeof window.__my_helper_full_shot__.destroy === 'function') {
    try {
      window.__my_helper_full_shot__.destroy();
    } catch (_e) {}
  }

  var fixed_list = [];
  var saved_win_x = 0;
  var saved_win_y = 0;
  var saved_el_x = 0;
  var saved_el_y = 0;
  var prepared = false;
  var fixed_frozen = false;
  var stop_sent = false;
  var key_bound = false;
  // null = window 滚动；否则为内层滚动容器
  var scroll_el = null;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function is_scrollable(el) {
    if (!el || el.nodeType !== 1) return false;
    var st = window.getComputedStyle(el);
    var ox = st.overflowX;
    var oy = st.overflowY;
    var can_y = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 40;
    var can_x = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && el.scrollWidth > el.clientWidth + 40;
    return can_y || can_x;
  }

  /** 选面积最大的可滚动容器；文档本身更能滚则用 window */
  function pick_scroll_el() {
    var doc_el = document.scrollingElement || document.documentElement;
    var doc_room = Math.max(
      0,
      (doc_el.scrollHeight || 0) - (doc_el.clientHeight || 0),
      (doc_el.scrollWidth || 0) - (doc_el.clientWidth || 0)
    );

    var best = null;
    var best_room = 0;
    var best_area = 0;
    var nodes = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.id === ROOT_ID || (el.closest && el.closest('#' + ROOT_ID))) continue;
      if (!is_scrollable(el)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) continue;
      var room = Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth);
      var area = rect.width * rect.height;
      if (room > best_room || (room === best_room && area > best_area)) {
        best = el;
        best_room = room;
        best_area = area;
      }
    }

    // 内层明显比文档更能滚时才采用
    if (best && best_room > doc_room + 80) {
      return best;
    }
    return null;
  }

  function view_size() {
    if (scroll_el) {
      return {
        width: scroll_el.clientWidth || 1,
        height: scroll_el.clientHeight || 1
      };
    }
    // 与 captureVisibleTab / capture_rect 对齐，避免 clientWidth 差滚动条导致缩放发糊
    return {
      width: window.innerWidth || document.documentElement.clientWidth || 1,
      height: window.innerHeight || document.documentElement.clientHeight || 1
    };
  }

  function page_size() {
    if (scroll_el) {
      return {
        width: Math.max(scroll_el.clientWidth, scroll_el.scrollWidth),
        height: Math.max(scroll_el.clientHeight, scroll_el.scrollHeight)
      };
    }
    var body = document.body;
    var html = document.documentElement;
    var view = view_size();
    return {
      width: Math.max(view.width, html.scrollWidth || 0, body ? body.scrollWidth || 0 : 0),
      height: Math.max(view.height, html.scrollHeight || 0, body ? body.scrollHeight || 0 : 0)
    };
  }

  /** 滚动容器在视口中的裁剪区域（CSS 像素） */
  function capture_rect() {
    if (!scroll_el) {
      return {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
    var r = scroll_el.getBoundingClientRect();
    var x = Math.max(0, Math.floor(r.left));
    var y = Math.max(0, Math.floor(r.top));
    var right = Math.min(window.innerWidth, Math.ceil(r.right));
    var bottom = Math.min(window.innerHeight, Math.ceil(r.bottom));
    return {
      x: x,
      y: y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y)
    };
  }

  function ensure_style() {
    var old = document.getElementById(STYLE_ID);
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'html.mh_full_shot_lock,body.mh_full_shot_lock{scroll-behavior:auto!important;}' +
      'html.mh_full_shot_lock::-webkit-scrollbar,body.mh_full_shot_lock::-webkit-scrollbar{width:0!important;height:0!important;}' +
      '#' + ROOT_ID + '{' +
      'position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;' +
      'width:100%!important;height:auto!important;z-index:2147483646!important;display:block!important;' +
      'margin:0!important;padding:0 0 28px!important;border:none!important;background:transparent!important;' +
      'pointer-events:none!important;font-family:Segoe UI,PingFang SC,Microsoft YaHei,sans-serif!important;' +
      '}' +
      '#' + ROOT_ID + ' *{box-sizing:border-box!important;}' +
      '#' + ROOT_ID + ' .mh_dock{position:relative!important;margin:0 auto!important;pointer-events:auto!important;width:min(440px,calc(100vw - 32px))!important;}' +
      '#' + ROOT_ID + ' .mh_panel{padding:14px 16px!important;border-radius:14px!important;' +
      'background:linear-gradient(160deg,rgba(15,23,42,.97),rgba(30,41,59,.95))!important;color:#e2e8f0!important;' +
      'box-shadow:0 16px 40px rgba(0,0,0,.45)!important;border:1px solid rgba(148,163,184,.28)!important;}' +
      '#' + ROOT_ID + ' .mh_row{display:flex!important;align-items:center!important;gap:12px!important;}' +
      '#' + ROOT_ID + ' .mh_scan{position:relative!important;flex-shrink:0!important;width:36px!important;height:36px!important;' +
      'border-radius:10px!important;background:rgba(59,130,246,.2)!important;overflow:hidden!important;}' +
      '#' + ROOT_ID + ' .mh_scan::before{content:""!important;position:absolute!important;inset:6px!important;' +
      'border:2px solid rgba(147,197,253,.6)!important;border-radius:6px!important;}' +
      '#' + ROOT_ID + ' .mh_scan::after{content:""!important;position:absolute!important;left:4px!important;right:4px!important;height:3px!important;' +
      'border-radius:2px!important;background:linear-gradient(90deg,transparent,#93c5fd,transparent)!important;' +
      'animation:mh_full_scan 1.2s ease-in-out infinite!important;}' +
      '#' + ROOT_ID + ' .mh_info{flex:1!important;min-width:0!important;}' +
      '#' + ROOT_ID + ' .mh_title{font-size:13px!important;font-weight:600!important;color:#f8fafc!important;line-height:1.3!important;}' +
      '#' + ROOT_ID + ' .mh_text{margin-top:2px!important;font-size:12px!important;color:#94a3b8!important;' +
      'white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}' +
      '#' + ROOT_ID + ' .mh_hint{margin-top:6px!important;font-size:11px!important;color:#64748b!important;}' +
      '#' + ROOT_ID + ' .mh_stop{flex-shrink:0!important;height:30px!important;padding:0 12px!important;' +
      'border:1px solid rgba(248,113,113,.5)!important;border-radius:8px!important;' +
      'background:rgba(239,68,68,.18)!important;color:#fecaca!important;font-size:12px!important;cursor:pointer!important;}' +
      '#' + ROOT_ID + ' .mh_stop:hover{background:rgba(239,68,68,.3)!important;}' +
      '#' + ROOT_ID + ' .mh_stop:disabled{opacity:.55!important;cursor:wait!important;}' +
      '#' + ROOT_ID + ' .mh_track{margin-top:12px!important;height:6px!important;border-radius:999px!important;' +
      'background:rgba(148,163,184,.22)!important;overflow:hidden!important;}' +
      '#' + ROOT_ID + ' .mh_fill{height:100%!important;width:0%!important;border-radius:999px!important;' +
      'background:linear-gradient(90deg,#38bdf8,#3b82f6,#6366f1)!important;transition:width .2s ease!important;}' +
      '#' + ROOT_ID + ' .mh_fill.is_pulse{width:35%!important;animation:mh_full_pulse 1s ease-in-out infinite!important;}' +
      '#' + ROOT_ID + ' .mh_key_trap{position:fixed!important;left:8px!important;top:8px!important;width:18px!important;height:18px!important;' +
      'opacity:0!important;border:0!important;padding:0!important;margin:0!important;outline:none!important;pointer-events:none!important;}' +
      '#' + ROOT_ID + '.is_capturing{visibility:hidden!important;opacity:0!important;}' +
      '@keyframes mh_full_scan{0%{top:4px}50%{top:28px}100%{top:4px}}' +
      '@keyframes mh_full_pulse{0%,100%{opacity:.55}50%{opacity:1}}';
    document.documentElement.appendChild(style);
  }

  function request_stop() {
    if (stop_sent) return;
    stop_sent = true;
    var root = document.getElementById(ROOT_ID);
    if (root) {
      var btn = root.querySelector('.mh_stop');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '停止中';
      }
      var title = root.querySelector('.mh_title');
      var text = root.querySelector('.mh_text');
      var hint = root.querySelector('.mh_hint');
      var fill = root.querySelector('.mh_fill');
      if (title) title.textContent = '正在停止';
      if (text) text.textContent = '将输出已截取部分…';
      if (hint) hint.textContent = '请稍候';
      if (fill) fill.classList.add('is_pulse');
      root.classList.remove('is_capturing');
    }
    chrome.runtime.sendMessage({ type: 'full_shot_stop' }, function () {
      void chrome.runtime.lastError;
    });
  }

  function on_key_down(e) {
    if (!prepared || stop_sent) return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    e.preventDefault();
    e.stopPropagation();
    request_stop();
  }

  function focus_trap() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var trap = root.querySelector('.mh_key_trap');
    if (!trap) return;
    try {
      trap.focus({ preventScroll: true });
    } catch (_e) {
      trap.focus();
    }
  }

  function bind_keys() {
    if (key_bound) return;
    key_bound = true;
    window.addEventListener('keydown', on_key_down, true);
    document.addEventListener('keydown', on_key_down, true);
  }

  function unbind_keys() {
    if (!key_bound) return;
    key_bound = false;
    window.removeEventListener('keydown', on_key_down, true);
    document.removeEventListener('keydown', on_key_down, true);
  }

  function ensure_panel() {
    ensure_style();
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML =
      '<input class="mh_key_trap" type="text" readonly tabindex="0" aria-hidden="true" />' +
      '<div class="mh_dock"><div class="mh_panel"><div class="mh_row">' +
      '<div class="mh_scan" aria-hidden="true"></div>' +
      '<div class="mh_info">' +
      '<div class="mh_title">整页截图中</div>' +
      '<div class="mh_text">准备中…</div>' +
      '<div class="mh_hint">按任意键停止 · 或点击停止</div>' +
      '</div><button class="mh_stop" type="button">停止</button></div>' +
      '<div class="mh_track"><div class="mh_fill"></div></div></div></div>';
    document.documentElement.appendChild(root);
    root.querySelector('.mh_stop').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      request_stop();
    });
    root.querySelector('.mh_key_trap').addEventListener('keydown', on_key_down, true);
    return root;
  }

  function show_progress(payload) {
    var root = ensure_panel();
    root.classList.remove('is_capturing');
    bind_keys();
    focus_trap();
    var data = typeof payload === 'string' ? { text: payload } : payload || {};
    var fill = root.querySelector('.mh_fill');
    var stop_btn = root.querySelector('.mh_stop');
    var hint = root.querySelector('.mh_hint');
    root.querySelector('.mh_title').textContent = data.title || '整页截图中';
    root.querySelector('.mh_text').textContent = data.text || '正在截取整页…';
    if (data.stopping || stop_sent) {
      stop_sent = true;
      stop_btn.disabled = true;
      stop_btn.textContent = '停止中';
      hint.textContent = '请稍候';
      fill.classList.add('is_pulse');
      return;
    }
    stop_btn.disabled = false;
    stop_btn.textContent = '停止';
    hint.textContent = '按任意键停止 · 或点击停止';
    fill.classList.remove('is_pulse');
    var total = data.total || 0;
    var current = data.current || 0;
    if (total > 0) {
      fill.style.width = Math.max(0, Math.min(100, Math.round((current / total) * 100))) + '%';
    } else {
      fill.style.width = '12%';
      fill.classList.add('is_pulse');
    }
  }

  function before_capture() {
    ensure_panel().classList.add('is_capturing');
    return { ok: true, crop: capture_rect() };
  }

  function after_capture(payload) {
    show_progress(payload || { text: '正在截取整页…' });
    return { ok: true };
  }

  function remove_progress() {
    unbind_keys();
    var root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  }

  function hide_el(el) {
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  /** 须在 scroll=0 时采集，记录首屏位置，避免第二屏把顶栏钉错 */
  function collect_fixed() {
    fixed_list = [];
    var nodes = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.id === ROOT_ID || (el.closest && el.closest('#' + ROOT_ID))) continue;
      var st = window.getComputedStyle(el);
      var pos = st.position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      fixed_list.push({
        el: el,
        css: el.style.cssText,
        pos: pos,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom
        }
      });
    }
  }

  /**
   * 顶/底栏直接隐藏（已在首屏拍过）；其余钉到首屏文档坐标。
   * 每次滚动后可再调：已冻结则只清扫仍粘在视口边缘的栏。
   */
  function freeze_fixed() {
    var win_w = window.innerWidth || 1;
    var win_h = window.innerHeight || 1;

    if (!fixed_frozen) {
      if (!fixed_list.length) collect_fixed();
      fixed_list.forEach(function (item) {
        var el = item.el;
        var r = item.rect;
        var area = r.width * r.height;
        var cover = area / (win_w * win_h);
        var is_top_bar = r.top <= 8 && r.width >= win_w * 0.45 && r.height <= win_h * 0.4;
        var is_bottom_bar =
          (typeof r.bottom === 'number' ? r.bottom : r.top + r.height) >= win_h - 8 &&
          r.width >= win_w * 0.45 &&
          r.height <= win_h * 0.35;
        if (
          cover > 0.5 ||
          is_top_bar ||
          is_bottom_bar ||
          (r.width >= win_w * 0.9 && r.height >= win_h * 0.3 && item.pos === 'fixed')
        ) {
          hide_el(el);
          return;
        }
        // 钉在首屏文档坐标（采集时 scroll≈0），勿用当前 scroll
        el.style.setProperty('position', 'absolute', 'important');
        el.style.setProperty('top', r.top + 'px', 'important');
        el.style.setProperty('left', r.left + 'px', 'important');
        el.style.setProperty('right', 'auto', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
        el.style.setProperty('width', r.width + 'px', 'important');
        el.style.setProperty('height', r.height + 'px', 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('inset', 'auto', 'important');
        el.style.setProperty('z-index', '1', 'important');
      });
      fixed_frozen = true;
    }

    // 每屏前清扫：仍贴视口边缘的 fixed/sticky（含滚动后新出现的 sticky）
    var nodes = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < nodes.length; i++) {
      var el2 = nodes[i];
      if (el2.id === ROOT_ID || (el2.closest && el2.closest('#' + ROOT_ID))) continue;
      var st2 = window.getComputedStyle(el2);
      if (st2.position !== 'fixed' && st2.position !== 'sticky') continue;
      // 已被钉成 absolute 的跳过（computed 已是 absolute）
      if (st2.position === 'absolute') continue;
      var r2 = el2.getBoundingClientRect();
      if (r2.width < 1 || r2.height < 1) continue;
      var edge =
        r2.top <= 4 ||
        r2.bottom >= win_h - 4 ||
        (r2.width >= win_w * 0.5 && r2.height <= win_h * 0.35 && (r2.top <= 8 || r2.bottom >= win_h - 8));
      if (!edge) continue;
      var already = false;
      for (var j = 0; j < fixed_list.length; j++) {
        if (fixed_list[j].el === el2) {
          already = true;
          break;
        }
      }
      if (!already) {
        fixed_list.push({
          el: el2,
          css: el2.style.cssText,
          pos: st2.position,
          rect: {
            top: r2.top,
            left: r2.left,
            width: r2.width,
            height: r2.height,
            bottom: r2.bottom
          }
        });
      }
      hide_el(el2);
    }

    return { ok: true };
  }

  function restore_fixed() {
    fixed_list.forEach(function (item) {
      item.el.style.cssText = item.css;
    });
    fixed_list = [];
    fixed_frozen = false;
  }

  function hard_reset_dom() {
    restore_fixed();
    remove_progress();
    document.documentElement.classList.remove('mh_full_shot_lock');
    if (document.body) document.body.classList.remove('mh_full_shot_lock');
    var style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    prepared = false;
    stop_sent = false;
    scroll_el = null;
  }

  function metrics() {
    var page = page_size();
    var view = view_size();
    var crop = capture_rect();
    return {
      ok: true,
      page_width: page.width,
      page_height: page.height,
      view_width: view.width,
      view_height: view.height,
      win_width: window.innerWidth || view.width,
      win_height: window.innerHeight || view.height,
      dpr: window.devicePixelRatio || 1,
      title: document.title || '',
      url: location.href,
      inner_scroll: !!scroll_el,
      crop: crop
    };
  }

  function in_view(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }

  /** 滚动后等待懒加载与高度稳定 */
  async function wait_lazy() {
    var base_h = page_size().height;
    await sleep(180);

    var pending = [];
    var imgs = document.images || [];
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete) continue;
      if (!in_view(img)) continue;
      pending.push(
        new Promise(function (resolve) {
          var done = function () {
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
      );
    }
    if (pending.length) {
      await Promise.race([Promise.all(pending), sleep(1200)]);
    }

    for (var n = 0; n < 6; n++) {
      await sleep(80);
      var h = page_size().height;
      if (Math.abs(h - base_h) < 2) break;
      base_h = h;
    }
  }

  async function prepare() {
    hard_reset_dom();
    stop_sent = false;
    saved_win_x = window.scrollX || window.pageXOffset || 0;
    saved_win_y = window.scrollY || window.pageYOffset || 0;
    scroll_el = pick_scroll_el();
    if (scroll_el) {
      saved_el_x = scroll_el.scrollLeft || 0;
      saved_el_y = scroll_el.scrollTop || 0;
    }
    document.documentElement.classList.add('mh_full_shot_lock');
    if (document.body) document.body.classList.add('mh_full_shot_lock');
    show_progress({
      title: '整页截图中',
      text: scroll_el ? '检测到内层滚动，正在准备…' : '正在准备页面…'
    });
    if (scroll_el) {
      scroll_el.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
    await wait_lazy();
    // 首屏位置采集 fixed/sticky，供后续屏冻结
    collect_fixed();
    prepared = true;
    focus_trap();
    return metrics();
  }

  async function scroll_to(x, y) {
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove('is_capturing');
    focus_trap();
    x = Math.max(0, x);
    y = Math.max(0, y);
    if (scroll_el) {
      scroll_el.scrollTo(x, y);
    } else {
      window.scrollTo(x, y);
    }
    await wait_lazy();
    focus_trap();
    var cur_x = scroll_el ? scroll_el.scrollLeft || 0 : window.scrollX || window.pageXOffset || 0;
    var cur_y = scroll_el ? scroll_el.scrollTop || 0 : window.scrollY || window.pageYOffset || 0;
    return {
      ok: true,
      x: cur_x,
      y: cur_y,
      crop: capture_rect(),
      page_height: page_size().height,
      page_width: page_size().width
    };
  }

  function restore() {
    restore_fixed();
    remove_progress();
    document.documentElement.classList.remove('mh_full_shot_lock');
    if (document.body) document.body.classList.remove('mh_full_shot_lock');
    var style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    if (scroll_el) {
      scroll_el.scrollTo(saved_el_x, saved_el_y);
    }
    window.scrollTo(saved_win_x, saved_win_y);
    prepared = false;
    fixed_frozen = false;
    stop_sent = false;
    scroll_el = null;
    return { ok: true };
  }

  function destroy() {
    unbind_keys();
    hard_reset_dom();
  }

  function handle_message(msg, _sender, send_response) {
    if (!msg || msg.type !== 'full_shot_cmd') return;
    var cmd = msg.cmd;
    var payload = msg.payload || {};
    if (cmd === 'prepare') {
      prepare().then(send_response);
      return true;
    }
    if (cmd === 'metrics') {
      send_response(metrics());
      return;
    }
    if (cmd === 'scroll') {
      scroll_to(payload.x || 0, payload.y || 0).then(send_response);
      return true;
    }
    if (cmd === 'freeze_fixed') {
      send_response(freeze_fixed());
      return;
    }
    if (cmd === 'hide_fixed') {
      // 兼容旧消息名
      send_response(freeze_fixed());
      return;
    }
    if (cmd === 'progress') {
      show_progress(payload);
      send_response({ ok: true });
      return;
    }
    if (cmd === 'before_capture') {
      send_response(before_capture());
      return;
    }
    if (cmd === 'after_capture') {
      send_response(after_capture(payload));
      return;
    }
    if (cmd === 'restore') {
      send_response(restore());
      return;
    }
  }

  if (!window.__mh_full_shot_msg_bound__) {
    window.__mh_full_shot_msg_bound__ = true;
    chrome.runtime.onMessage.addListener(function (msg, sender, send_response) {
      var api = window.__my_helper_full_shot__;
      if (!api || typeof api.handle !== 'function') return;
      return api.handle(msg, sender, send_response);
    });
  }

  window.__my_helper_full_shot__ = {
    ready: true,
    destroy: destroy,
    handle: handle_message
  };
})();
