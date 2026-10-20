/**
 * RSA 密钥 PEM/DER 解析与格式转换
 * jsencrypt 原生识别 PKCS#1/PKCS#8 私钥、SPKI/PKCS#1 公钥；
 * Web Crypto（OAEP）仅接受 SPKI 公钥与 PKCS#8 私钥，
 * 因此这里只做「缺失格式补齐」：PKCS#1 → PKCS#8 / SPKI。
 */
var PEM_BEGIN_RE = /-----BEGIN[A-Z0-9 ]*-----/;
var PEM_END_RE = /-----END[A-Z0-9 ]*-----/;

/** PEM 文本 → DER 字节；兼容带/不带头尾行 */
export function pem_to_der(text) {
  var raw = String(text || '').trim();
  if (!raw) {
    throw new Error('密钥内容为空');
  }
  if (PEM_BEGIN_RE.test(raw)) {
    raw = raw.replace(PEM_BEGIN_RE, '').replace(PEM_END_RE, '');
  }
  raw = raw.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    throw new Error('密钥不是有效的 PEM / Base64 格式');
  }
  var bin = atob(raw);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/** 读取一个 DER TLV：返回 { tag, content, len, next } */
function der_read_tlv(bytes, pos) {
  if (pos + 2 > bytes.length) {
    throw new Error('密钥结构损坏');
  }
  var tag = bytes[pos];
  var first = bytes[pos + 1];
  var header;
  var len;
  if (first < 0x80) {
    header = 2;
    len = first;
  } else {
    var count = first & 0x7f;
    if (count === 0 || count > 4 || pos + 2 + count > bytes.length) {
      throw new Error('密钥结构损坏');
    }
    header = 2 + count;
    len = 0;
    for (var i = 0; i < count; i++) {
      len = len * 256 + bytes[pos + 2 + i];
    }
  }
  if (pos + header + len > bytes.length) {
    throw new Error('密钥结构损坏');
  }
  return { tag: tag, content: pos + header, len: len, next: pos + header + len };
}

/** 枚举顶层 SEQUENCE 的直接子节点 */
function der_children(bytes) {
  var outer = der_read_tlv(bytes, 0);
  var list = [];
  var pos = outer.content;
  var end = outer.content + outer.len;
  while (pos < end) {
    var tlv = der_read_tlv(bytes, pos);
    list.push(tlv);
    pos = tlv.next;
  }
  return list;
}

/** DER 长度编码 + TLV 组装 */
function der_build_tlv(tag, content) {
  var len = content.length;
  var header;
  if (len < 0x80) {
    header = [len];
  } else {
    var len_bytes = [];
    var rest = len;
    while (rest > 0) {
      len_bytes.unshift(rest & 0xff);
      rest = Math.floor(rest / 256);
    }
    header = [0x80 | len_bytes.length].concat(len_bytes);
  }
  var bytes = new Uint8Array(1 + header.length + len);
  bytes[0] = tag;
  for (var i = 0; i < header.length; i++) {
    bytes[1 + i] = header[i];
  }
  bytes.set(content, 1 + header.length);
  return bytes;
}

function der_concat(list) {
  var total = 0;
  list.forEach(function (item) {
    total += item.length;
  });
  var out = new Uint8Array(total);
  var offset = 0;
  list.forEach(function (item) {
    out.set(item, offset);
    offset += item.length;
  });
  return out;
}

/**
 * 识别 DER 密钥结构类型
 * pkcs1_private: SEQUENCE{version,n,e,d,p,q,dmp1,dmq1,coeff}
 * pkcs8_private: SEQUENCE{version,AlgorithmID,OCTET STRING}
 * spki_public:  SEQUENCE{AlgorithmID,BIT STRING}
 * pkcs1_public: SEQUENCE{n,e}
 */
function der_key_type(bytes) {
  var kids = der_children(bytes);
  if (kids.length === 9 && kids[0].tag === 0x02) {
    return 'pkcs1_private';
  }
  if (kids.length === 3 && kids[0].tag === 0x02 && kids[1].tag === 0x30 && kids[2].tag === 0x04) {
    return 'pkcs8_private';
  }
  if (kids.length === 2 && kids[0].tag === 0x30 && kids[1].tag === 0x03) {
    return 'spki_public';
  }
  if (kids.length === 2 && kids[0].tag === 0x02 && kids[1].tag === 0x02) {
    return 'pkcs1_public';
  }
  return '';
}

/** AlgorithmIdentifier（rsaEncryption + NULL）TLV */
function rsa_alg_id() {
  var oid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  var null_tlv = new Uint8Array([0x05, 0x00]);
  return der_build_tlv(0x30, der_concat([oid, null_tlv]));
}

/** PKCS#1 私钥 DER → PKCS#8 私钥 DER */
export function pkcs1_private_to_pkcs8(pkcs1) {
  var version = new Uint8Array([0x02, 0x01, 0x00]);
  var octet = der_build_tlv(0x04, pkcs1);
  return der_build_tlv(0x30, der_concat([version, rsa_alg_id(), octet]));
}

/** PKCS#1 公钥 DER → SPKI DER */
export function pkcs1_public_to_spki(pkcs1) {
  var unused_bits = new Uint8Array([0x00]);
  var bit_content = der_concat([unused_bits, pkcs1]);
  var bit_string = der_build_tlv(0x03, bit_content);
  return der_build_tlv(0x30, der_concat([rsa_alg_id(), bit_string]));
}

/** 公钥 PEM → SPKI DER（Web Crypto importKey 可用） */
export function rsa_public_der(text) {
  var der = pem_to_der(text);
  var type = der_key_type(der);
  if (type === 'spki_public') {
    return der;
  }
  if (type === 'pkcs1_public') {
    return pkcs1_public_to_spki(der);
  }
  throw new Error('无法识别的公钥格式（需为 SPKI 或 PKCS#1）');
}

/** 私钥 PEM → PKCS#8 DER（Web Crypto importKey 可用） */
export function rsa_private_der(text) {
  var der = pem_to_der(text);
  var type = der_key_type(der);
  if (type === 'pkcs8_private') {
    return der;
  }
  if (type === 'pkcs1_private') {
    return pkcs1_private_to_pkcs8(der);
  }
  throw new Error('无法识别的私钥格式（需为 PKCS#8 或 PKCS#1）');
}