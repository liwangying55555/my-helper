/**
 * RSA 加密解密引擎
 * PKCS#1 v1.5 由 jsencrypt 处理（国内联调主流）；
 * OAEP 由 crypt_oaep.js 处理（Web Crypto，独立可验证）
 */
import { JSEncrypt } from 'jsencrypt';
import {
  bytes_to_b64,
  bytes_to_hex,
  b64_to_bytes,
  hex_to_bytes
} from './crypt_aes.js';
import { rsa_oaep, RSA_HASH_LIST } from './crypt_oaep.js';

export { RSA_HASH_LIST };

/** 状态字典：RSA 填充 */
export var RSA_PAD_LIST = ['PKCS1v15', 'OAEP'];
/** 状态字典：生成密钥位长 */
export var RSA_KEY_SIZES = [1024, 2048, 4096];

/** 创建已装载密钥的 jsencrypt 实例，解析失败给明确提示 */
function build_jscrypt(key_pem) {
  var crypt = new JSEncrypt();
  crypt.setKey(key_pem);
  if (!crypt.key || !crypt.key.n) {
    throw new Error('密钥格式无效，请检查 PEM 内容');
  }
  return crypt;
}

/** RSA PKCS#1 v1.5：单块明文上限 = 密钥字节数 - 11 */
function check_pkcs1_input(crypt, input) {
  var bits = crypt.key.n.bitLength();
  var max_bytes = Math.floor(bits / 8) - 11;
  var data = new TextEncoder().encode(input);
  if (data.length > max_bytes) {
    throw new Error(
      '明文超出该 ' + bits + ' 位密钥单块上限（约 ' + max_bytes + ' 字节，当前 ' + data.length + ' 字节），请分块或更换更长密钥'
    );
  }
}

/** PKCS#1 v1.5 加解密（jsencrypt） */
function rsa_pkcs1(op, input, params) {
  if (op === 'encrypt') {
    var pem = String(params.publicKey || '').trim() || String(params.privateKey || '').trim();
    if (!pem) {
      throw new Error('请先填入公钥（或私钥，含公钥参数也可加密）');
    }
    var crypt = build_jscrypt(pem);
    check_pkcs1_input(crypt, input);
    var b64 = crypt.encrypt(input);
    if (!b64) {
      throw new Error('加密失败，请检查密钥与文本内容');
    }
    return params.codec === 'hex' ? bytes_to_hex(b64_to_bytes(b64)) : b64;
  }
  var private_pem = String(params.privateKey || '').trim();
  if (!private_pem) {
    throw new Error('解密需要私钥，请先填入私钥');
  }
  var decryptor = build_jscrypt(private_pem);
  var b64_input = params.codec === 'hex' ? bytes_to_b64(hex_to_bytes(input)) : String(input).trim();
  var plain = decryptor.decrypt(b64_input);
  if (plain === false || plain === null) {
    throw new Error('解密失败：私钥与密文不匹配或密文已损坏');
  }
  return plain;
}

/**
 * RSA 统一入口
 * @param op 'encrypt' | 'decrypt'
 */
export async function rsa_run(op, input, params) {
  if (!String(input || '').trim()) {
    throw new Error('请输入要处理的文本');
  }
  if (params.padding === 'OAEP') {
    return rsa_oaep(op, input, params);
  }
  return rsa_pkcs1(op, input, params);
}

/** 生成 RSA 密钥对（jsencrypt 异步生成，返回 PKCS#1 私钥 / SPKI 公钥） */
export function rsa_gen_keypair(bits) {
  return new Promise(function (resolve) {
    var crypt = new JSEncrypt({ default_key_size: bits });
    crypt.getKey(function () {
      resolve({
        publicKey: crypt.getPublicKey(),
        privateKey: crypt.getPrivateKey()
      });
    });
  });
}