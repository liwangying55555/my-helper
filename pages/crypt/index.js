/**
 * 加密解密页：AES/RSA 参数配置、配置方案存取（本地）、加解密执行
 */
import { aes_run, rsa_run, rsa_gen_keypair, random_hex, AES_STREAM_MODES } from './crypt_algo.js';

var PLANS_KEY = 'crypt_plans';

var status_el = document.getElementById('status_tip');
var input_area = document.getElementById('input_area');
var output_area = document.getElementById('output_area');
var algo_aes_btn = document.getElementById('algo_aes_btn');
var algo_rsa_btn = document.getElementById('algo_rsa_btn');
var aes_panel = document.getElementById('aes_panel');
var rsa_panel = document.getElementById('rsa_panel');
var plan_select = document.getElementById('plan_select');

var active_algo = 'aes';
var plans = [];
var busy = false;

// 当前输出操作相对应的代码名（提示用）
function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function set_val(id, value) {
  var el = document.getElementById(id);
  if (el !== null && value !== undefined && value !== null) {
    el.value = String(value);
  }
}

function set_select(id, value) {
  var el = document.getElementById(id);
  if (el === null) {
    return;
  }
  var found = Array.prototype.some.call(el.options, function (opt) {
    return opt.value === value;
  });
  if (found) {
    el.value = value;
  }
}

function set_hidden(id, hidden) {
  var el = document.getElementById(id);
  if (el !== null) {
    el.hidden = hidden;
  }
}

// ===== 参数收集 / 回填（保存方案与执行共用） =====

function collect_params() {
  return {
    algo: active_algo,
    aes: {
      key: val('aes_key'),
      keyCodec: val('aes_key_format'),
      keySize: val('aes_key_size'),
      iv: val('aes_iv'),
      ivCodec: val('aes_iv_format'),
      mode: val('aes_mode'),
      padding: effective_padding(),
      codec: val('aes_codec')
    },
    rsa: {
      keySize: val('rsa_key_size'),
      publicKey: val('rsa_public_key'),
      privateKey: val('rsa_private_key'),
      padding: val('rsa_padding'),
      hash: val('rsa_hash'),
      codec: val('rsa_codec')
    }
  };
}

/** 流式模式与 GCM 固定无填充，UI 记录原选择 */
function effective_padding() {
  var mode = val('aes_mode');
  if (mode === 'GCM' || AES_STREAM_MODES.indexOf(mode) !== -1) {
    return 'NoPadding';
  }
  return val('aes_pad');
}

function apply_params(params) {
  if (!params || (params.algo !== 'aes' && params.algo !== 'rsa')) {
    return;
  }
  var aes = params.aes || {};
  set_val('aes_key', aes.key);
  set_select('aes_key_format', aes.keyCodec);
  set_select('aes_key_size', aes.keySize);
  set_val('aes_iv', aes.iv);
  set_select('aes_iv_format', aes.ivCodec);
  set_select('aes_mode', aes.mode);
  set_select('aes_pad', aes.padding);
  set_select('aes_codec', aes.codec);
  var rsa = params.rsa || {};
  set_select('rsa_key_size', rsa.keySize);
  set_val('rsa_public_key', rsa.publicKey);
  set_val('rsa_private_key', rsa.privateKey);
  set_select('rsa_padding', rsa.padding);
  set_select('rsa_hash', rsa.hash);
  set_select('rsa_codec', rsa.codec);
  switch_algo(params.algo);
  sync_mode_ui();
}

// ===== 界面联动 =====

function switch_algo(algo) {
  active_algo = algo;
  aes_panel.hidden = algo !== 'aes';
  rsa_panel.hidden = algo !== 'rsa';
  algo_aes_btn.classList.toggle('is_active', algo === 'aes');
  algo_rsa_btn.classList.toggle('is_active', algo === 'rsa');
}

/** ECB 不需要 IV；流式模式与 GCM 填充固定无填充；OAEP 才有哈希选择 */
function sync_mode_ui() {
  var mode = val('aes_mode');
  var needs_iv = mode !== 'ECB';
  set_hidden('aes_iv_item', !needs_iv);
  set_hidden('aes_iv_format_item', !needs_iv);
  document.getElementById('aes_gen_iv_btn').disabled = !needs_iv;

  var pad_disabled = mode === 'GCM' || AES_STREAM_MODES.indexOf(mode) !== -1;
  var pad_el = document.getElementById('aes_pad');
  pad_el.disabled = pad_disabled;
  pad_el.title = pad_disabled ? '该模式下固定无填充' : '';

  var oaep = val('rsa_padding') === 'OAEP';
  set_hidden('rsa_hash_item', !oaep);
}

// ===== 配置方案：本地存取 =====

function normalize_plans(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter(function (item) {
    return item && typeof item.name === 'string' && item.params && typeof item.params === 'object';
  });
}

function render_plans(selected_id) {
  plan_select.innerHTML = '';
  var tip = document.createElement('option');
  tip.value = '';
  tip.textContent = plans.length ? '选择方案…' : '暂无方案';
  plan_select.appendChild(tip);

  plans.forEach(function (plan) {
    var opt = document.createElement('option');
    opt.value = plan.id;
    opt.textContent = plan.name;
    plan_select.appendChild(opt);
  });
  plan_select.value = selected_id || '';
}

function load_plans() {
  chrome.storage.local.get([PLANS_KEY], function (data) {
    plans = normalize_plans(data[PLANS_KEY]);
    render_plans();
  });
}

function save_plan() {
  var name = val('plan_name').trim();
  if (!name) {
    set_status('请先输入方案名', false);
    return;
  }
  var params = collect_params();
  var exist = null;
  plans.forEach(function (plan) {
    if (plan.name === name) {
      exist = plan;
    }
  });
  if (exist) {
    exist.params = params;
    exist.updateTime = Date.now();
  } else {
    plans.push({ id: 'p' + Date.now(), name: name, params: params, updateTime: Date.now() });
  }
  var data = {};
  data[PLANS_KEY] = plans;
  chrome.storage.local.set(data, function () {
    if (chrome.runtime.lastError) {
      set_status('方案保存失败', false);
      return;
    }
    render_plans(exist ? exist.id : plans[plans.length - 1].id);
    set_status(exist ? '已更新方案「' + name + '」' : '已保存方案「' + name + '」', true);
  });
}

function delete_plan() {
  var id = plan_select.value;
  if (!id) {
    set_status('请先选择要删除的方案', false);
    return;
  }
  var removed_name = '';
  plans = plans.filter(function (plan) {
    if (plan.id === id) {
      removed_name = plan.name;
      return false;
    }
    return true;
  });
  var data = {};
  data[PLANS_KEY] = plans;
  chrome.storage.local.set(data, function () {
    if (chrome.runtime.lastError) {
      set_status('方案删除失败', false);
      return;
    }
    render_plans();
    set_status('已删除方案「' + removed_name + '」', true);
  });
}

function use_plan() {
  var id = plan_select.value;
  if (!id) {
    return;
  }
  var found = null;
  plans.forEach(function (plan) {
    if (plan.id === id) {
      found = plan;
    }
  });
  if (found === null) {
    return;
  }
  apply_params(found.params);
  set_status('已应用方案「' + found.name + '」', true);
}

// ===== 执行加解密 =====

function set_busy(state) {
  busy = state;
  document.getElementById('encrypt_btn').disabled = state;
  document.getElementById('decrypt_btn').disabled = state;
}

async function run(op) {
  if (busy) {
    return;
  }
  var input = input_area.value;
  if (!input.trim()) {
    set_status('请先在左侧输入内容', false);
    return;
  }
  set_busy(true);
  try {
    var params = collect_params();
    var run_params = active_algo === 'aes' ? params.aes : params.rsa;
    var exec = active_algo === 'aes' ? aes_run : rsa_run;
    var result = await exec(op, input, run_params);
    output_area.value = result;
    set_status(op === 'encrypt' ? '加密成功' : '解密成功', true);
  } catch (err) {
    output_area.value = '';
    set_status(err && err.message ? err.message : '操作失败', false);
  } finally {
    set_busy(false);
  }
}

// ===== 密钥生成 =====

function gen_aes_key() {
  var size = parseInt(val('aes_key_size'), 10);
  if (size !== 16 && size !== 24 && size !== 32) {
    set_status('密钥长度不合法', false);
    return;
  }
  set_val('aes_key', random_hex(size));
  set_select('aes_key_format', 'hex');
  set_status('已生成 ' + size * 8 + ' 位密钥（Hex）', true);
}

function gen_aes_iv() {
  set_val('aes_iv', random_hex(16));
  set_select('aes_iv_format', 'hex');
  set_status('已生成 128 位 IV（Hex）', true);
}

async function gen_rsa_keypair() {
  var bits = parseInt(val('rsa_key_size'), 10);
  var btn = document.getElementById('rsa_gen_btn');
  if (busy) {
    return;
  }
  busy = true;
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    var pair = await rsa_gen_keypair(bits);
    set_val('rsa_public_key', pair.publicKey);
    set_val('rsa_private_key', pair.privateKey);
    set_status('已生成 ' + bits + ' 位密钥对', true);
  } catch (err) {
    set_status('密钥对生成失败，请重试', false);
  } finally {
    busy = false;
    btn.disabled = false;
    btn.textContent = '生成密钥对';
  }
}

// ===== 输出区操作 =====

function swap_output() {
  var output = output_area.value;
  if (!output) {
    set_status('输出为空，无法转输入', false);
    return;
  }
  input_area.value = output;
  output_area.value = '';
  set_status('已将输出转入输入，可直接解密', true);
}

function copy_output() {
  var output = output_area.value;
  if (!output) {
    set_status('输出为空，无法复制', false);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(output).then(
      function () {
        set_status('已复制到剪贴板', true);
      },
      function () {
        set_status('复制失败', false);
      }
    );
    return;
  }
  output_area.select();
  document.execCommand('copy');
  set_status('已复制到剪贴板', true);
}

function clear_all() {
  input_area.value = '';
  output_area.value = '';
  set_status('', true);
}

// ===== 事件绑定 =====

algo_aes_btn.addEventListener('click', function () {
  switch_algo('aes');
});

algo_rsa_btn.addEventListener('click', function () {
  switch_algo('rsa');
});

document.getElementById('aes_mode').addEventListener('change', sync_mode_ui);
document.getElementById('rsa_padding').addEventListener('change', sync_mode_ui);

document.getElementById('encrypt_btn').addEventListener('click', function () {
  run('encrypt');
});

document.getElementById('decrypt_btn').addEventListener('click', function () {
  run('decrypt');
});

document.getElementById('aes_gen_key_btn').addEventListener('click', gen_aes_key);
document.getElementById('aes_gen_iv_btn').addEventListener('click', gen_aes_iv);
document.getElementById('rsa_gen_btn').addEventListener('click', gen_rsa_keypair);

document.getElementById('swap_btn').addEventListener('click', swap_output);
document.getElementById('copy_btn').addEventListener('click', copy_output);
document.getElementById('clear_btn').addEventListener('click', clear_all);

plan_select.addEventListener('change', use_plan);
document.getElementById('plan_save_btn').addEventListener('click', save_plan);
document.getElementById('plan_del_btn').addEventListener('click', delete_plan);

input_area.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    run('encrypt');
  }
});

// ===== 启动 =====
switch_algo('aes');
sync_mode_ui();
load_plans();