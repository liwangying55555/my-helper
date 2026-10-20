/**
 * 加密引擎交叉验证脚本（node scripts/verify-crypt.mjs）
 * 用 Node 内置 crypto 作为标准实现，与页面引擎互验：
 * 1. AES五种块/流模式（crypto-js）与 GCM（Web Crypto）双向互认
 * 2. 密钥长度 / 解密失败等错误分支
 * 3. RSA OAEP（Web Crypto）与 node crypto 互认（SHA-256 / SHA-1，Base64 / Hex）
 * 4. PKCS#1 密钥 PEM 经转换后可供 Web Crypto 使用
 * 注：jsencrypt 的 PKCS#1 v1.5 路径依赖浏览器环境，在扩展页面中人工验证
 */
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
  constants as crypto_constants
} from 'crypto';
import { aes_run } from '../pages/crypt/crypt_aes.js';
import { rsa_oaep } from '../pages/crypt/crypt_oaep.js';
import { bytes_to_b64, bytes_to_hex } from '../pages/crypt/crypt_aes.js';

// Node 18 无全局 crypto，用 webcrypto 垫片（浏览器端天然存在，无需处理）
import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

var SAMPLE = 'Hello 我的助手 $#@! 中文加解密测试 123';
var failed = 0;

function ok(name) {
  console.log('[PASS] ' + name);
}

function fail(name, detail) {
  failed += 1;
  console.error('[FAIL] ' + name + ' :: ' + detail);
}

function assert_eq(name, actual, expect) {
  if (actual === expect) {
    ok(name);
  } else {
    fail(name, 'expect <' + expect + '> got <' + actual + '>');
  }
}

async function expect_throw(name, fn, keyword) {
  try {
    await fn();
    fail(name, 'should throw but resolved');
  } catch (err) {
    if (err instanceof Error && err.message.indexOf(keyword) !== -1) {
      ok(name);
    } else {
      fail(name, 'unexpected error: ' + err.message);
    }
  }
}

function random_hex_text(size) {
  var bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes_to_hex(bytes);
}

// ===== AES：与 node crypto 双向互验 =====

var AES_CASES = [
  { mode: 'CBC', node_alg: 'aes-128-cbc', key_len: 16, padding: 'Pkcs7' },
  { mode: 'CBC', node_alg: 'aes-256-cbc', key_len: 32, padding: 'Pkcs7' },
  { mode: 'ECB', node_alg: 'aes-128-ecb', key_len: 16, padding: 'Pkcs7' },
  { mode: 'CTR', node_alg: 'aes-128-ctr', key_len: 16, padding: 'NoPadding' },
  { mode: 'CFB', node_alg: 'aes-128-cfb', key_len: 16, padding: 'NoPadding' },
  { mode: 'OFB', node_alg: 'aes-128-ofb', key_len: 16, padding: 'NoPadding' }
];

async function verify_aes() {
  for (var i = 0; i < AES_CASES.length; i++) {
    var item = AES_CASES[i];
    var key = random_hex_text(item.key_len);
    var iv = random_hex_text(16);
    var params = {
      key: key,
      keyCodec: 'hex',
      iv: iv,
      ivCodec: 'hex',
      mode: item.mode,
      padding: item.padding,
      codec: 'base64'
    };
    var has_iv = item.mode !== 'ECB';

    // 引擎加密 → node 解密
    var engine_out;
    try {
      engine_out = await aes_run('encrypt', SAMPLE, params);
      var decipher = createDecipheriv(item.node_alg, Buffer.from(key, 'hex'), has_iv ? Buffer.from(iv, 'hex') : null);
      decipher.setAutoPadding(item.padding === 'Pkcs7');
      var plain = Buffer.concat([decipher.update(Buffer.from(engine_out, 'base64')), decipher.final()]);
      assert_eq('AES ' + item.mode + ' ' + item.key_len * 8 + ' 引擎→node', plain.toString('utf8'), SAMPLE);
    } catch (err) {
      fail('AES ' + item.mode + ' 引擎→node', err.message);
      continue;
    }

    // node 加密 → 引擎解密（换 Hex 编码同验）
    try {
      var cipher = createCipheriv(item.node_alg, Buffer.from(key, 'hex'), has_iv ? Buffer.from(iv, 'hex') : null);
      cipher.setAutoPadding(item.padding === 'Pkcs7');
      var node_out = Buffer.concat([cipher.update(Buffer.from(SAMPLE, 'utf8')), cipher.final()]);
      params.codec = 'hex';
      var engine_plain = await aes_run('decrypt', node_out.toString('hex'), params);
      assert_eq('AES ' + item.mode + ' ' + item.key_len * 8 + ' node→引擎', engine_plain, SAMPLE);
    } catch (err) {
      fail('AES ' + item.mode + ' node→引擎', err.message);
    }
  }
}

// ===== AES GCM：与 node crypto 双向互验 =====

async function verify_gcm() {
  var key = random_hex_text(32);
  var iv = random_hex_text(12);
  var params = { key: key, keyCodec: 'hex', iv: iv, ivCodec: 'hex', mode: 'GCM', padding: 'NoPadding', codec: 'base64' };

  var engine_out = await aes_run('encrypt', SAMPLE, params);
  var raw = Buffer.from(engine_out, 'base64');
  var body = raw.subarray(0, raw.length - 16);
  var tag = raw.subarray(raw.length - 16);
  var decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(tag);
  var plain = Buffer.concat([decipher.update(body), decipher.final()]);
  assert_eq('AES GCM 引擎→node', plain.toString('utf8'), SAMPLE);

  var cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  var body2 = Buffer.concat([cipher.update(Buffer.from(SAMPLE, 'utf8')), cipher.final()]);
  var node_out = Buffer.concat([body2, cipher.getAuthTag()]).toString('base64');
  params.codec = 'base64';
  var engine_plain = await aes_run('decrypt', node_out, params);
  assert_eq('AES GCM node→引擎', engine_plain, SAMPLE);
}

// ===== AES 错误分支 =====

async function verify_aes_errors() {
  await expect_throw('AES 非16/24/32字节密钥报错', function () {
    return aes_run('encrypt', 'test', {
      key: random_hex_text(15), keyCodec: 'hex', iv: random_hex_text(16), ivCodec: 'hex',
      mode: 'CBC', padding: 'Pkcs7', codec: 'base64'
    });
  }, '16 / 24 / 32');

  await expect_throw('AES 错误密钥解密报错', async function () {
    var params = {
      key: 'abcdef0123456789abcdef0123456789', keyCodec: 'hex',
      iv: '000102030405060708090a0b0c0d0e0f', ivCodec: 'hex',
      mode: 'CBC', padding: 'Pkcs7', codec: 'base64'
    };
    var bad = await aes_run('encrypt', SAMPLE, {
      key: '00112233445566778899aabbccddeeff', keyCodec: 'hex',
      iv: '000102030405060708090a0b0c0d0e0f', ivCodec: 'hex',
      mode: 'CBC', padding: 'Pkcs7', codec: 'base64'
    });
    return aes_run('decrypt', bad, params);
  }, '解密失败');

  await expect_throw('AES 空 IV 报错', function () {
    return aes_run('encrypt', 'test', {
      key: random_hex_text(16), keyCodec: 'hex', iv: '', ivCodec: 'hex',
      mode: 'CBC', padding: 'Pkcs7', codec: 'base64'
    });
  }, 'IV');

  await expect_throw('AES 非法 Hex 密文报错', function () {
    return aes_run('decrypt', 'xyz-not-hex!!', {
      key: random_hex_text(16), keyCodec: 'hex', iv: random_hex_text(16), ivCodec: 'hex',
      mode: 'CBC', padding: 'Pkcs7', codec: 'hex'
    });
  }, 'Hex');
}

// ===== RSA OAEP：与 node crypto 双向互验（含 PKCS#1 PEM 转换） =====

function der_to_pem_lines(der, label) {
  var b64 = bytes_to_b64(new Uint8Array(der));
  var lines = b64.replace(/(.{64})/g, '$1\n').split('\n');
  return '-----BEGIN ' + label + '-----\n' + lines.join('\n') + '\n-----END ' + label + '-----\n';
}

async function verify_rsa_oaep() {
  var pair = generateKeyPairSync('rsa', { modulusLength: 2048 });

  // SPKI / PKCS#8 标准 PEM
  var pub_spki_pem = der_to_pem_lines(pair.publicKey.export({ format: 'der', type: 'spki' }), 'PUBLIC KEY');
  var priv_pkcs8_pem = der_to_pem_lines(pair.privateKey.export({ format: 'der', type: 'pkcs8' }), 'PRIVATE KEY');
  // PKCS#1 PEM（走引擎内部转换路径）
  var pub_pkcs1_pem = der_to_pem_lines(pair.publicKey.export({ format: 'der', type: 'pkcs1' }), 'RSA PUBLIC KEY');
  var priv_pkcs1_pem = der_to_pem_lines(pair.privateKey.export({ format: 'der', type: 'pkcs1' }), 'RSA PRIVATE KEY');

  var hash_list = [
    { lib: 'SHA-256', node: 'sha256', flag: crypto_constants.RSA_PKCS1_OAEP_PADDING },
    { lib: 'SHA-1', node: 'sha1', flag: crypto_constants.RSA_PKCS1_OAEP_PADDING }
  ];

  for (var i = 0; i < hash_list.length; i++) {
    var hash = hash_list[i];

    // 引擎（PKCS#1 PEM + 转换）加密 → node 解密
    var engine_out = await rsa_oaep('encrypt', SAMPLE, {
      publicKey: pub_pkcs1_pem, privateKey: '', hash: hash.lib, codec: 'base64'
    });
    var plain = privateDecrypt(
      { key: pair.privateKey, padding: hash.flag, oaepHash: hash.node },
      Buffer.from(engine_out, 'base64')
    );
    assert_eq('RSA OAEP ' + hash.lib + ' PKCS#1公钥 引擎→node', plain.toString('utf8'), SAMPLE);

    // node 加密 → 引擎（PKCS#8 PEM）解密
    var node_out = publicEncrypt(
      { key: pair.publicKey, padding: hash.flag, oaepHash: hash.node },
      Buffer.from(SAMPLE, 'utf8')
    );
    var engine_plain = await rsa_oaep('decrypt', node_out.toString('base64'), {
      publicKey: '', privateKey: priv_pkcs8_pem, hash: hash.lib, codec: 'base64'
    });
    assert_eq('RSA OAEP ' + hash.lib + ' PKCS#8私钥 node→引擎', engine_plain, SAMPLE);

    // 引擎（PKCS#1 私钥 + 转换）自闭环，Hex 编码
    var hex_out = await rsa_oaep('encrypt', SAMPLE, {
      publicKey: pub_spki_pem, privateKey: '', hash: hash.lib, codec: 'hex'
    });
    var hex_plain = await rsa_oaep('decrypt', hex_out, {
      publicKey: '', privateKey: priv_pkcs1_pem, hash: hash.lib, codec: 'hex'
    });
    assert_eq('RSA OAEP ' + hash.lib + ' Hex + PKCS#1私钥闭环', hex_plain, SAMPLE);
  }

  await expect_throw('RSA OAEP 明文超长报错', function () {
    var long_text = 'a'.repeat(300);
    return rsa_oaep('encrypt', long_text, {
      publicKey: pub_spki_pem, privateKey: '', hash: 'SHA-256', codec: 'base64'
    });
  }, '失败');
}

// ===== 汇总 =====

try {
  console.log('=== 加密引擎交叉验证开始 ===');
  await verify_aes();
  await verify_gcm();
  await verify_aes_errors();
  await verify_rsa_oaep();
  console.log('=== 验证结束：' + (failed === 0 ? '全部通过' : failed + ' 项失败') + ' ===');
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error('[FAIL] 未预期的中断 :: ' + err.message);
  process.exit(1);
}