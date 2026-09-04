/**
 * Base64 编解码：按当前模式自动转换，支持上下分栏
 */
var stack_el = document.getElementById('base_stack');
var status_el = document.getElementById('status_tip');
var encode_btn = document.getElementById('encode_btn');
var decode_btn = document.getElementById('decode_btn');
var split_btn = document.getElementById('split_btn');
var DEFAULT_SPLIT = 2;
var MAX_SPLIT = 4;
var last_action = 'decode';
var panels = [];
var active_panel = null;
var MODE_COPY = {
  decode: {
    input_title: '解码文本',
    input_ph: '粘贴要解码的 Base64',
    output_title: '解码结果',
    output_ph: '原文将显示在这里'
  },
  encode: {
    input_title: '编码文本',
    input_ph: '输入要编码的原文',
    output_title: '编码结果',
    output_ph: 'Base64 将显示在这里'
  }
};

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function bytes_from_text(text) {
  return new TextEncoder().encode(text);
}

function text_from_bytes(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function bytes_to_base64(bytes) {
  var bin = '';
  bytes.forEach((n) => {
    bin += String.fromCharCode(n);
  });
  return btoa(bin);
}

function base64_to_bytes(text) {
  var clean = text.replace(/\s/g, '');
  var bin = atob(clean);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function create_panel() {
  var root = document.createElement('section');
  root.className = 'base_module';
  root.innerHTML =
    '<div class="pane_wrap">' +
      '<section class="pane_box pane_input">' +
        '<div class="pane_head"></div>' +
        '<div class="editor_box">' +
          '<textarea class="code_area" spellcheck="false"></textarea>' +
        '</div>' +
      '</section>' +
      '<section class="pane_box pane_output">' +
        '<div class="pane_head"></div>' +
        '<div class="editor_box">' +
          '<textarea class="code_area" spellcheck="false"></textarea>' +
        '</div>' +
      '</section>' +
    '</div>';

  var heads = root.querySelectorAll('.pane_head');
  var areas = root.querySelectorAll('.code_area');
  var panel = {
    root: root,
    input_head: heads[0],
    output_head: heads[1],
    input: areas[0],
    output: areas[1],
    timer: null
  };

  panel.input.addEventListener('focus', () => {
    active_panel = panel;
  });
  panel.output.addEventListener('focus', () => {
    active_panel = panel;
  });
  panel.input.addEventListener('input', () => {
    active_panel = panel;
    schedule_panel(panel);
  });
  panel.input.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      run_panel(panel);
    }
  });

  apply_mode_copy(panel);
  return panel;
}

function apply_mode_copy(panel) {
  var copy = MODE_COPY[last_action];
  panel.input_head.textContent = copy.input_title;
  panel.output_head.textContent = copy.output_title;
  panel.input.placeholder = copy.input_ph;
  panel.output.placeholder = copy.output_ph;
}

function run_panel(panel, silent) {
  if (!panel.input.value.trim()) {
    panel.output.value = '';
    if (!silent) {
      set_status('', true);
    }
    return;
  }
  try {
    if (last_action === 'decode') {
      var raw = panel.input.value.trim();
      try {
        raw = decodeURIComponent(raw);
      } catch (err) {}
      panel.output.value = text_from_bytes(base64_to_bytes(raw));
      if (!silent) {
        set_status('解码成功', true);
      }
    } else {
      panel.output.value = bytes_to_base64(bytes_from_text(panel.input.value));
      if (!silent) {
        set_status('编码成功', true);
      }
    }
  } catch (err) {
    panel.output.value = '';
    if (!silent) {
      set_status(
        last_action === 'decode' ? '解码失败，请检查 Base64 格式' : '编码失败：' + err.message,
        false
      );
    }
  }
}

function run_all() {
  panels.forEach((panel, idx) => {
    run_panel(panel, idx !== panels.length - 1);
  });
}

function schedule_panel(panel) {
  clearTimeout(panel.timer);
  panel.timer = setTimeout(() => {
    run_panel(panel);
  }, 200);
}

function set_mode(mode) {
  last_action = mode;
  encode_btn.classList.toggle('is_active', mode === 'encode');
  decode_btn.classList.toggle('is_active', mode === 'decode');
  panels.forEach(apply_mode_copy);
  run_all();
}

function render_stack(count) {
  var keep = panels.slice(0, count).map((panel) => ({
    input: panel.input.value,
    output: panel.output.value
  }));
  stack_el.innerHTML = '';
  panels = [];
  for (var i = 0; i < count; i++) {
    var panel = create_panel();
    if (keep[i]) {
      panel.input.value = keep[i].input;
      panel.output.value = keep[i].output;
    }
    stack_el.appendChild(panel.root);
    panels.push(panel);
  }
  active_panel = panels[0] || null;
  stack_el.classList.toggle('is_split', count > 1);
  sync_split_btn();
  run_all();
}

function sync_split_btn() {
  split_btn.disabled = panels.length >= MAX_SPLIT;
}

function add_split() {
  if (panels.length >= MAX_SPLIT) {
    return;
  }
  var panel = create_panel();
  stack_el.appendChild(panel.root);
  panels.push(panel);
  active_panel = panel;
  stack_el.classList.add('is_split');
  sync_split_btn();
  set_status('已添加分栏 ' + panels.length + '/' + MAX_SPLIT, true);
}

decode_btn.addEventListener('click', () => {
  set_mode('decode');
});

encode_btn.addEventListener('click', () => {
  set_mode('encode');
});

split_btn.addEventListener('click', add_split);

document.getElementById('clear_btn').addEventListener('click', () => {
  panels.forEach((panel) => {
    panel.input.value = '';
    panel.output.value = '';
  });
  set_status('', true);
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  var mode = params.get('mode') === 'encode' ? 'encode' : 'decode';
  render_stack(DEFAULT_SPLIT);
  if (text && panels[0]) {
    panels[0].input.value = text;
  }
  set_mode(mode);
})();
