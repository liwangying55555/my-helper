/**
 * AES 加密解密引擎
 * CBC/ECB/CTR/CFB/OFB 由 crypto-js 处理（联调主流组合）；
 * GCM 由浏览器原生 Web Crypto 处理（crypto-js 不支持 GCM）。
 */
import CryptoJS from 'crypto-js';

/** 状态字典：密文编解码格式 */
export var CODEC_LIST = ['base64', 'hex'];
/** 状态字典：密钥/IV 文本格式 */
export var KEY_FORMAT_LIST = ['utf8', 'hex', 'base64'];
/** 状态字典：AES 模式 */
export var AES_MODE_LIST = ['CBC', 'ECB', 'CTR', 'CFB', 'OFB', 'GCM'];
/** 状态字典：AES 填充 */
export var AES_PAD_LIST = ['Pkcs7', 'Zero', 'NoPadding'];
/** 状态字典：有效密钥字节数（128/192/256 位） */
export var AES_KEY_BYTES = [16, 24, 32];
/** 状态字典：流式模式（固定无填充） */
export var AES_STREAM_MODES = ['CTR', 'CFB', 'OFB'];

// ===== 字节/文本编解码 =====

export function bytes_to_hex(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var hex = (bytes[i] & 0xff).toString(16);
    out += hex.length === 1 ? '0' + hex : hex;
  }
  return out;
}

export function hex_to_bytes(text) {
  var raw = String(text || '').replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]*$/.test(raw) || raw.length % 2 !== 0) {
    throw new Error('密文不是有效的 Hex 编码');
  }
  var bytes = new Uint8Array(raw.length / 2);
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(raw.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytes_to_b64(bytes) {
  var bin = '';
  for (var i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function b64_to_bytes(text) {
  var raw = String(text || '').replace(/\s+/g, '');
  if (!raw) {
    throw new Error('密文内容为空');
  }
  var bin;
  try {
    bin = atob(raw);
  } catch (err) {
    throw new Error('密文不是有效的 Base64 编码');
  }
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bytes_to_word_array(bytes) {
  var words = [];
  for (var i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function word_array_to_bytes(word_array) {
  var bytes = new Uint8Array(word_array.sigBytes);
  for (var i = 0; i < word_array.sigBytes; i++) {
    bytes[i] = (word_array.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}

/** 随机生成 n 字节数据，返回 Hex 文本 */
export function random_hex(size) {
  var bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes_to_hex(bytes);
}

// ===== 密钥 / IV 解析（支持 utf8 / hex / base64 文本） =====

function pick_codec_bytes(text, codec, label) {
  var raw = String(text || '').trim();
  if (!raw) {
    throw new Error(label + '不能为空');
  }
  if (codec === 'hex') {
    return hex_to_bytes(raw);
  }
  if (codec === 'base64') {
    return b64_to_bytes(raw);
  }
  return new TextEncoder().encode(raw);
}

function parse_material(text, codec, label) {
  return bytes_to_word_array(pick_codec_bytes(text, codec, label));
}

function check_key_size(key, label) {
  if (AES_KEY_BYTES.indexOf(key.sigBytes) === -1) {
    throw new Error(
      label + '长度需为 16 / 24 / 32 字节（当前 ' + key.sigBytes + ' 字节）'
    );
  }
}

function pick_padding(mode, padding) {
  if (AES_STREAM_MODES.indexOf(mode) !== -1 || mode === 'GCM') {
    return CryptoJS.pad.NoPadding;
  }
  if (padding === 'Zero') {
    return CryptoJS.pad.ZeroPadding;
  }
  if (padding === 'NoPadding') {
    return CryptoJS.pad.NoPadding;
  }
  return CryptoJS.pad.Pkcs7;
}

/**
 * crypto-js 模式族加解密（CBC/ECB/CTR/CFB/OFB）
 * params: { key, keyCodec, iv, ivCodec, mode, padding, codec }
 */
function aes_crypto_js(op, input, params) {
  var key = parse_material(params.key, params.keyCodec, '密钥');
  check_key_size(key, '密钥');
  var cfg = {
    mode: CryptoJS.mode[params.mode],
    padding: pick_padding(params.mode, params.padding)
  };
  if (params.mode !== 'ECB') {
    var iv = parse_material(params.iv, params.ivCodec, 'IV ');
    if (iv.sigBytes !== 16) {
      throw new Error('IV 长度需为 16 字节（当前 ' + iv.sigBytes + ' 字节）');
    }
    cfg.iv = iv;
  }
  if (op === 'encrypt') {
    var message = CryptoJS.enc.Utf8.parse(input);
    var cipher = CryptoJS.AES.encrypt(message, key, cfg);
    return params.codec === 'hex'
      ? cipher.ciphertext.toString(CryptoJS.enc.Hex)
      : cipher.ciphertext.toString(CryptoJS.enc.Base64);
  }
  var raw = pick_codec_bytes(input, params.codec, '密文');
  var cipher_params = CryptoJS.lib.CipherParams.create({
    ciphertext: bytes_to_word_array(raw)
  });
  var plain = CryptoJS.AES.decrypt(cipher_params, key, cfg);
  if (plain.sigBytes === 0) {
    throw new Error('解密失败：密钥或密文可能有误');
  }
  try {
    return CryptoJS.enc.Utf8.stringify(plain);
  } catch (err) {
    throw new Error('解密失败：密钥或密文可能有误');
  }
}

/** AES-GCM 加解密（Web Crypto） */
async function aes_gcm(op, input, params) {
  var key_bytes = pick_codec_bytes(params.key, params.keyCodec, '密钥');
  if (AES_KEY_BYTES.indexOf(key_bytes.length) === -1) {
    throw new Error('密钥长度需为 16 / 24 / 32 字节（当前 ' + key_bytes.length + ' 字节）');
  }
  var iv_bytes = pick_codec_bytes(params.iv, params.ivCodec, 'IV ');
  if (iv_bytes.length < 1 || iv_bytes.length > 64) {
    throw new Error('GCM 模式 IV 需为 1 ~ 64 字节（推荐 12 字节）');
  }
  var usage = op === 'encrypt' ? ['encrypt'] : ['decrypt'];
  var key = await crypto.subtle.importKey('raw', key_bytes, 'AES-GCM', false, usage);
  if (op === 'encrypt') {
    var data = new TextEncoder().encode(input);
    var out = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv_bytes }, key, data)
    );
    return params.codec === 'hex' ? bytes_to_hex(out) : bytes_to_b64(out);
  }
  var raw = pick_codec_bytes(input, params.codec, '密文');
  try {
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv_bytes }, key, raw);
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch (err) {
    throw new Error('解密失败：密钥、IV 或密文可能有误（含认证标签校验失败）');
  }
}

/**
 * AES 统一入口
 * @param op 'encrypt' | 'decrypt'
 */
export async function aes_run(op, input, params) {
  if (!String(input || '').trim()) {
    throw new Error('请输入要处理的文本');
  }
  if (params.mode === 'GCM') {
    return aes_gcm(op, input, params);
  }
  return aes_crypto_js(op, input, params);
}