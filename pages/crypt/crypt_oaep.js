/**
 * RSA-OAEP 加密解密（浏览器原生 Web Crypto，SHA-1 / SHA-256）
 * 独立于 jsencrypt，纯 Web Crypto + PEM 转换，可跨环境验证
 */
import {
  bytes_to_b64,
  bytes_to_hex,
  b64_to_bytes,
  hex_to_bytes
} from './crypt_aes.js';
import { rsa_public_der, rsa_private_der } from './crypt_pem.js';

export var RSA_HASH_LIST = ['SHA-256', 'SHA-1'];

/**
 * OAEP 加解密
 * @param op 'encrypt' | 'decrypt'
 * @param input 明文文本或密文（按 codec 解码）
 * @param params { publicKey, privateKey, hash, codec }
 */
export async function rsa_oaep(op, input, params) {
  var algo = { name: 'RSA-OAEP', hash: params.hash === 'SHA-1' ? 'SHA-1' : 'SHA-256' };
  try {
    if (op === 'encrypt') {
      var pub_pem = String(params.publicKey || '').trim();
      if (!pub_pem) {
        throw new Error('请先填入公钥');
      }
      var pub_key = await crypto.subtle.importKey(
        'spki',
        rsa_public_der(pub_pem),
        algo,
        false,
        ['encrypt']
      );
      var data = new TextEncoder().encode(input);
      var out = new Uint8Array(await crypto.subtle.encrypt(algo, pub_key, data));
      return params.codec === 'hex' ? bytes_to_hex(out) : bytes_to_b64(out);
    }
    var priv_pem = String(params.privateKey || '').trim();
    if (!priv_pem) {
      throw new Error('解密需要私钥，请先填入私钥');
    }
    var priv_key = await crypto.subtle.importKey(
      'pkcs8',
      rsa_private_der(priv_pem),
      algo,
      false,
      ['decrypt']
    );
    var raw = params.codec === 'hex' ? hex_to_bytes(input) : b64_to_bytes(input);
    var plain = await crypto.subtle.decrypt(algo, priv_key, raw);
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch (err) {
    if (err instanceof Error && err.message.indexOf('请先填入') !== -1) {
      throw err;
    }
    throw new Error('OAEP ' + (op === 'encrypt' ? '加密' : '解密') + '失败：密钥不兼容或明文超出单块上限');
  }
}