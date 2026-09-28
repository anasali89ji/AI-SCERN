"""
Aiscern Detection Worker — PDF Digital Signature Verification
(MODULE 29)

Giant-Level Optimization Spec, Section 3.5 item 3: "Document Verification —
digital signature validation, certificate chain, revocation status".

Audit note + why this is buildable NOW
---------------------------------------
Module 27 flagged signature verification as open because it needs X.509
parsing. `cryptography>=42.0.0` is pinned in requirements.txt (Module 15 made
it a declared direct dependency for the C2PA embedded-certificate check), and
46.0.6 is what actually resolves. So the cryptographic half of this is
buildable offline today. Nothing in the repo does any of it: grep for
ByteRange / pkcs7 / SignerInfo across signal-worker returns nothing.

What "verifying a PDF signature" actually decomposes into
--------------------------------------------------------
People say "is the signature valid?" as if it were one question. It is four,
with very different requirements:

  Q1  INTEGRITY — do the signed bytes still hash to the value the signer
      committed to?  Needs: the file, a hash function. Offline. DONE HERE.
  Q2  COVERAGE  — does the signature actually cover the WHOLE file, or was
      content appended after signing?  Needs: the file. Offline. DONE HERE.
  Q3  AUTHENTICITY — does the signer's public key verify the signature over
      the signed attributes?  Needs: the file + the embedded cert. Offline.
      DONE HERE.
  Q4  TRUST — does the signer's certificate chain to a trusted root, and has
      it been revoked?  Needs: a trusted-root store AND live OCSP/CRL
      network access. NOT DONE — see the honest gap below.

Q1-Q3 are the part that catches real tampering. A document whose bytes were
edited after signing fails Q1 or Q2 no matter how trusted the signer is. So
scoping down to Q1-Q3 is not a token gesture — it is the majority of the
forensic value, and it is fully verifiable in this environment.

The honest gap: Q4 (trust and revocation)
-----------------------------------------
NOT IMPLEMENTED, and deliberately not faked:
  * Chain-to-trusted-root requires a curated trust store. The OS bundle is
    the wrong one — PDF signature trust uses the Adobe Approved Trust List
    (AATL) / EUTL, which are separate curated lists this worker does not
    ship and cannot fetch here.
  * Revocation requires a live OCSP responder or CRL distribution point
    fetch at verification time. The sandbox has no egress to those hosts,
    and a revocation check that silently "passes" because the network call
    failed is worse than no check at all — it converts an unknown into a
    false assurance.
So `trust_status` is reported as "not_evaluated" with the reason attached,
and the module NEVER reports a signature as fully valid. The strongest thing
it will say is `cryptographically_intact_untrusted_chain`. What IS extracted
offline from the embedded chain: subject/issuer, validity window vs. signing
time, self-signed detection, signature-algorithm strength, key size, basic
constraints, and whether a CRL/OCSP endpoint is even advertised.

Implementation note — the minimal DER reader
--------------------------------------------
`cryptography` exposes `pkcs7.load_der_pkcs7_certificates()`, which returns
the certificate bag but NOT the SignerInfo: no messageDigest attribute, no
signature value, no signed-attribute DER. Those are exactly what Q1 and Q3
need. Rather than add a new dependency (asn1crypto / pyhanko), this module
includes a ~120-line read-only DER walker sufficient to reach the four
fields required. It parses structure only — it performs no crypto itself and
hands every actual cryptographic operation to `cryptography`. Depth- and
length-bounded against malformed input.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# OIDs we need to recognise, as dotted strings.
_OID_DATA = "1.2.840.113549.1.7.1"
_OID_SIGNED_DATA = "1.2.840.113549.1.7.2"
_OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4"
_OID_CONTENT_TYPE = "1.2.840.113549.1.9.3"
_OID_SIGNING_TIME = "1.2.840.113549.1.9.5"
_OID_TIMESTAMP_TOKEN = "1.2.840.113549.1.9.16.2.14"

_DIGEST_OIDS = {
    "1.3.14.3.2.26": "sha1",
    "2.16.840.1.101.3.4.2.1": "sha256",
    "2.16.840.1.101.3.4.2.2": "sha384",
    "2.16.840.1.101.3.4.2.3": "sha512",
    "2.16.840.1.101.3.4.2.4": "sha224",
}

# Digest algorithms considered broken for signature purposes.
_WEAK_DIGESTS = {"md5", "sha1"}

_MAX_DER_DEPTH = 24
_MAX_SIGNATURES = 16


def _unavailable(reason: str, **extra: Any) -> Dict[str, Any]:
    details = {"reason": reason}
    details.update(extra)
    return {"score": 0.5, "confidence": 0.0, "status": "unavailable", "details": details}


def _result(score: float, confidence: float, **details: Any) -> Dict[str, Any]:
    return {
        "score": round(max(0.0, min(1.0, score)), 4),
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "status": "ok",
        "details": details,
    }


# ════════════════════════════════════════════════════════════════════════════
# Minimal read-only DER walker
# ════════════════════════════════════════════════════════════════════════════

class _DERNode:
    __slots__ = ("tag", "start", "header_len", "length", "data", "constructed")

    def __init__(self, tag: int, start: int, header_len: int, length: int, data: bytes):
        self.tag = tag
        self.start = start
        self.header_len = header_len
        self.length = length
        self.data = data                      # content octets only
        self.constructed = bool(tag & 0x20)

    @property
    def full(self) -> bytes:
        """The complete TLV, header included — needed for re-encoding."""
        return bytes([self.tag]) + _encode_length(self.length) + self.data


def _encode_length(length: int) -> bytes:
    if length < 0x80:
        return bytes([length])
    encoded = length.to_bytes((length.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(encoded)]) + encoded


def _der_read(buf: bytes, offset: int = 0) -> Optional[Tuple[_DERNode, int]]:
    """Read one TLV at `offset`. Returns (node, next_offset) or None."""
    if offset >= len(buf):
        return None
    tag = buf[offset]
    idx = offset + 1
    # Multi-byte tag numbers — we never need them, but skip them correctly.
    if tag & 0x1F == 0x1F:
        while idx < len(buf) and buf[idx] & 0x80:
            idx += 1
        idx += 1
    if idx >= len(buf):
        return None

    first = buf[idx]
    idx += 1
    if first & 0x80 == 0:
        length = first
    else:
        num_bytes = first & 0x7F
        if num_bytes == 0 or num_bytes > 4 or idx + num_bytes > len(buf):
            return None                        # indefinite length is illegal in DER
        length = int.from_bytes(buf[idx:idx + num_bytes], "big")
        idx += num_bytes

    if length < 0 or idx + length > len(buf):
        return None
    return _DERNode(tag, offset, idx - offset, length, buf[idx:idx + length]), idx + length


def _der_children(node: _DERNode, depth: int = 0) -> List[_DERNode]:
    if not node.constructed or depth > _MAX_DER_DEPTH:
        return []
    out: List[_DERNode] = []
    offset = 0
    while offset < len(node.data) and len(out) < 4096:
        step = _der_read(node.data, offset)
        if step is None:
            break
        child, offset = step
        out.append(child)
    return out


def _decode_oid(content: bytes) -> str:
    if not content:
        return ""
    first = content[0]
    parts = [str(first // 40), str(first % 40)]
    value = 0
    for byte in content[1:]:
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            parts.append(str(value))
            value = 0
    return ".".join(parts)


def _find_signed_data(root: _DERNode) -> Optional[_DERNode]:
    """ContentInfo ::= SEQUENCE { contentType OID, content [0] EXPLICIT }."""
    children = _der_children(root)
    if len(children) < 2:
        return None
    if _decode_oid(children[0].data) != _OID_SIGNED_DATA:
        return None
    explicit = children[1]
    inner = _der_children(explicit)
    return inner[0] if inner else None


def _parse_signer_info(signed_data: _DERNode) -> Dict[str, Any]:
    """
    SignedData ::= SEQUENCE {
        version, digestAlgorithms SET, encapContentInfo,
        certificates [0] IMPLICIT OPTIONAL, crls [1] OPTIONAL,
        signerInfos SET OF SignerInfo }

    SignerInfo ::= SEQUENCE {
        version, sid, digestAlgorithm,
        signedAttrs [0] IMPLICIT OPTIONAL, signatureAlgorithm,
        signature OCTET STRING, unsignedAttrs [1] IMPLICIT OPTIONAL }
    """
    out: Dict[str, Any] = {
        "parsed": False,
        "digest_algorithm": None,
        "message_digest": None,
        "signature_value": None,
        "signed_attrs_der": None,
        "signing_time": None,
        "has_timestamp_token": False,
        "signed_attr_oids": [],
    }

    children = _der_children(signed_data)
    if len(children) < 4:
        return out

    # signerInfos is the last SET (tag 0x31) in the SignedData sequence.
    signer_infos = [c for c in children if c.tag == 0x31]
    if not signer_infos:
        return out
    signers = _der_children(signer_infos[-1])
    if not signers:
        return out

    signer = signers[0]
    fields = _der_children(signer)
    if len(fields) < 5:
        return out

    for idx, field in enumerate(fields):
        # digestAlgorithm: the first SEQUENCE after sid
        if field.tag == 0x30 and out["digest_algorithm"] is None and idx >= 2:
            sub = _der_children(field)
            if sub and sub[0].tag == 0x06:
                out["digest_algorithm"] = _DIGEST_OIDS.get(_decode_oid(sub[0].data))
        # signedAttrs: context-specific constructed [0]
        elif field.tag == 0xA0:
            # For signature verification the [0] IMPLICIT tag must be
            # re-encoded as a universal SET (0x31) — RFC 5652 §5.4.
            out["signed_attrs_der"] = bytes([0x31]) + _encode_length(field.length) + field.data
            for attr in _der_children(field):
                parts = _der_children(attr)
                if len(parts) < 2 or parts[0].tag != 0x06:
                    continue
                oid = _decode_oid(parts[0].data)
                out["signed_attr_oids"].append(oid)
                values = _der_children(parts[1])
                if not values:
                    continue
                if oid == _OID_MESSAGE_DIGEST:
                    out["message_digest"] = values[0].data
                elif oid == _OID_SIGNING_TIME:
                    out["signing_time"] = _decode_time(values[0])
        # unsignedAttrs: context-specific constructed [1] — timestamp lives here
        elif field.tag == 0xA1:
            for attr in _der_children(field):
                parts = _der_children(attr)
                if parts and parts[0].tag == 0x06 and _decode_oid(parts[0].data) == _OID_TIMESTAMP_TOKEN:
                    out["has_timestamp_token"] = True
        # signature OCTET STRING — the last primitive OCTET STRING
        elif field.tag == 0x04:
            out["signature_value"] = field.data

    out["parsed"] = bool(out["signature_value"])
    return out


def _decode_time(node: _DERNode) -> Optional[str]:
    raw = node.data.decode("ascii", "replace").strip()
    try:
        if node.tag == 0x17 and len(raw) >= 12:       # UTCTime YYMMDDHHMMSSZ
            year = int(raw[0:2])
            year += 2000 if year < 50 else 1900
            dt = datetime(year, int(raw[2:4]), int(raw[4:6]), int(raw[6:8]),
                          int(raw[8:10]), int(raw[10:12]), tzinfo=timezone.utc)
        elif node.tag == 0x18 and len(raw) >= 14:     # GeneralizedTime
            dt = datetime(int(raw[0:4]), int(raw[4:6]), int(raw[6:8]), int(raw[8:10]),
                          int(raw[10:12]), int(raw[12:14]), tzinfo=timezone.utc)
        else:
            return None
    except ValueError:
        return None
    return dt.isoformat()


# ════════════════════════════════════════════════════════════════════════════
# PDF signature field extraction
# ════════════════════════════════════════════════════════════════════════════

_BYTERANGE_RE = re.compile(rb"/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]")
_CONTENTS_RE = re.compile(rb"/Contents\s*<([0-9A-Fa-f\s]+)>")


def _extract_signatures(raw: bytes) -> List[Dict[str, Any]]:
    """
    Locate every signature dictionary by its /ByteRange, and pair it with the
    /Contents hex string that follows it. Done on raw bytes rather than
    through the object graph because a signature dictionary must be in a
    plain (non-object-stream) section by spec, and raw scanning still finds
    signatures in files whose xref a tamperer has broken.
    """
    signatures: List[Dict[str, Any]] = []
    for match in _BYTERANGE_RE.finditer(raw):
        if len(signatures) >= _MAX_SIGNATURES:
            break
        a, b, c, d = (int(match.group(i)) for i in range(1, 5))

        contents_match = _CONTENTS_RE.search(raw, match.end(), match.end() + 200000)
        if contents_match is None:
            # /Contents can precede /ByteRange; look backwards too.
            window_start = max(0, match.start() - 200000)
            candidates = list(_CONTENTS_RE.finditer(raw, window_start, match.start()))
            contents_match = candidates[-1] if candidates else None
        if contents_match is None:
            signatures.append({"byte_range": [a, b, c, d], "contents_found": False})
            continue

        hex_blob = re.sub(rb"\s+", b"", contents_match.group(1))
        if len(hex_blob) % 2:
            hex_blob = hex_blob[:-1]
        try:
            der = bytes.fromhex(hex_blob.decode("ascii"))
        except ValueError:
            signatures.append({"byte_range": [a, b, c, d], "contents_found": False})
            continue

        der = der.rstrip(b"\x00")   # /Contents is zero-padded to a fixed size
        signatures.append(
            {
                "byte_range": [a, b, c, d],
                "contents_found": True,
                "der": der,
                "der_bytes": len(der),
            }
        )
    return signatures


def _coverage_analysis(byte_range: List[int], file_len: int) -> Dict[str, Any]:
    """
    Q2. ByteRange is [start1 len1 start2 len2]: the two spans of the file the
    signature covers, with the gap between them holding /Contents itself.
    """
    a, b, c, d = byte_range
    covered = b + d
    gap_start = a + b
    gap_end = c
    signed_end = c + d
    trailing = file_len - signed_end

    return {
        "byte_range": byte_range,
        "covered_bytes": covered,
        "file_bytes": file_len,
        "gap_start": gap_start,
        "gap_end": gap_end,
        "starts_at_file_start": a == 0,
        "signed_region_ends_at": signed_end,
        "trailing_unsigned_bytes": trailing,
        # Whitespace/EOL slack after the final %%EOF is normal; anything
        # larger means a real appended revision.
        "covers_whole_file": a == 0 and trailing <= 4,
        "content_appended_after_signing": trailing > 4,
        "gap_consistent": gap_end >= gap_start,
    }


def _digest_signed_ranges(raw: bytes, byte_range: List[int], algorithm: str) -> Optional[bytes]:
    a, b, c, d = byte_range
    if a < 0 or b < 0 or c < 0 or d < 0:
        return None
    if a + b > len(raw) or c + d > len(raw) or c < a + b:
        return None
    try:
        hasher = hashlib.new(algorithm)
    except ValueError:
        return None
    hasher.update(raw[a:a + b])
    hasher.update(raw[c:c + d])
    return hasher.digest()


# ════════════════════════════════════════════════════════════════════════════
# Certificate inspection (offline half of Q4)
# ════════════════════════════════════════════════════════════════════════════

def _inspect_certificates(der: bytes, signing_time_iso: Optional[str]) -> Dict[str, Any]:
    try:
        from cryptography.hazmat.primitives.serialization import pkcs7
        from cryptography import x509
    except ImportError as e:  # pragma: no cover - dependency is pinned
        return {"available": False, "reason": f"cryptography_unavailable: {e}"}

    try:
        certs = pkcs7.load_der_pkcs7_certificates(der)
    except Exception as e:
        return {"available": False, "reason": f"pkcs7_parse_failed: {e}"}

    if not certs:
        return {"available": True, "certificate_count": 0, "signer": None}

    # The signer's leaf is the certificate that is not an issuer of any other
    # certificate in the bag.
    issuers = {c.issuer for c in certs}
    leaves = [c for c in certs if c.subject not in issuers]
    signer = leaves[0] if leaves else certs[0]

    def name(value: Any) -> str:
        try:
            return value.rfc4514_string()[:200]
        except Exception:
            return str(value)[:200]

    try:
        not_before = signer.not_valid_before_utc
        not_after = signer.not_valid_after_utc
    except AttributeError:  # cryptography < 42 naming
        not_before = signer.not_valid_before.replace(tzinfo=timezone.utc)
        not_after = signer.not_valid_after.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    valid_at_signing = None
    if signing_time_iso:
        try:
            signed_at = datetime.fromisoformat(signing_time_iso)
            valid_at_signing = not_before <= signed_at <= not_after
        except ValueError:
            valid_at_signing = None

    key_size = None
    try:
        pub = signer.public_key()
        key_size = getattr(pub, "key_size", None)
    except Exception:
        pass

    crl_points: List[str] = []
    ocsp_urls: List[str] = []
    try:
        ext = signer.extensions.get_extension_for_class(x509.CRLDistributionPoints).value
        for point in ext:
            for gn in (point.full_name or []):
                crl_points.append(str(getattr(gn, "value", gn))[:200])
    except Exception:
        pass
    try:
        aia = signer.extensions.get_extension_for_class(x509.AuthorityInformationAccess).value
        for desc in aia:
            if desc.access_method == x509.oid.AuthorityInformationAccessOID.OCSP:
                ocsp_urls.append(str(getattr(desc.access_location, "value", ""))[:200])
    except Exception:
        pass

    is_ca = None
    try:
        bc = signer.extensions.get_extension_for_class(x509.BasicConstraints).value
        is_ca = bool(bc.ca)
    except Exception:
        pass

    sig_hash = None
    try:
        sig_hash = signer.signature_hash_algorithm.name if signer.signature_hash_algorithm else None
    except Exception:
        pass

    return {
        "available": True,
        "certificate_count": len(certs),
        "signer": {
            "subject": name(signer.subject),
            "issuer": name(signer.issuer),
            "serial_hex": format(signer.serial_number, "x")[:64],
            "not_before": not_before.isoformat(),
            "not_after": not_after.isoformat(),
            "expired_now": not_after < now,
            "not_yet_valid_now": not_before > now,
            "valid_at_signing_time": valid_at_signing,
            "self_signed": signer.subject == signer.issuer,
            "is_ca": is_ca,
            "key_size_bits": key_size,
            "signature_hash_algorithm": sig_hash,
            "weak_signature_hash": bool(sig_hash and sig_hash.lower() in _WEAK_DIGESTS),
            "weak_key": bool(key_size and key_size < 2048),
        },
        "chain_length": len(certs),
        "chain_complete_to_self_signed_root": any(c.subject == c.issuer for c in certs),
        "crl_distribution_points": crl_points[:5],
        "ocsp_responders": ocsp_urls[:5],
        "revocation_endpoints_advertised": bool(crl_points or ocsp_urls),
    }


def _verify_signature_value(der: bytes, signer_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Q3. Verify the signature over the re-encoded signedAttrs using the signer
    certificate's public key. RSA (PKCS#1 v1.5 and PSS) and ECDSA are handled;
    anything else is reported as unsupported rather than silently passed.
    """
    out: Dict[str, Any] = {"attempted": False, "verified": None, "reason": None}

    signed_attrs = signer_info.get("signed_attrs_der")
    signature = signer_info.get("signature_value")
    digest_name = signer_info.get("digest_algorithm")
    if not (signed_attrs and signature and digest_name):
        out["reason"] = "missing_signed_attrs_signature_or_digest_algorithm"
        return out

    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding, ec, rsa
        from cryptography.hazmat.primitives.serialization import pkcs7
    except ImportError as e:  # pragma: no cover
        out["reason"] = f"cryptography_unavailable: {e}"
        return out

    try:
        certs = pkcs7.load_der_pkcs7_certificates(der)
    except Exception as e:
        out["reason"] = f"pkcs7_parse_failed: {e}"
        return out
    if not certs:
        out["reason"] = "no_certificates_in_bag"
        return out

    issuers = {c.issuer for c in certs}
    leaves = [c for c in certs if c.subject not in issuers]
    signer = leaves[0] if leaves else certs[0]

    hash_cls = {
        "sha1": hashes.SHA1, "sha224": hashes.SHA224, "sha256": hashes.SHA256,
        "sha384": hashes.SHA384, "sha512": hashes.SHA512,
    }.get(digest_name)
    if hash_cls is None:
        out["reason"] = f"unsupported_digest:{digest_name}"
        return out

    public_key = signer.public_key()
    out["attempted"] = True

    try:
        if isinstance(public_key, rsa.RSAPublicKey):
            try:
                public_key.verify(signature, signed_attrs, padding.PKCS1v15(), hash_cls())
                out["verified"] = True
                out["scheme"] = "rsa_pkcs1v15"
                return out
            except Exception:
                public_key.verify(
                    signature,
                    signed_attrs,
                    padding.PSS(mgf=padding.MGF1(hash_cls()), salt_length=padding.PSS.AUTO),
                    hash_cls(),
                )
                out["verified"] = True
                out["scheme"] = "rsa_pss"
                return out
        elif isinstance(public_key, ec.EllipticCurvePublicKey):
            public_key.verify(signature, signed_attrs, ec.ECDSA(hash_cls()))
            out["verified"] = True
            out["scheme"] = "ecdsa"
            return out
        else:
            out["attempted"] = False
            out["reason"] = f"unsupported_key_type:{type(public_key).__name__}"
            return out
    except Exception as e:
        out["verified"] = False
        out["reason"] = f"signature_verification_failed: {type(e).__name__}"
        return out


# ════════════════════════════════════════════════════════════════════════════
# Per-signature orchestration
# ════════════════════════════════════════════════════════════════════════════

def _analyze_one(raw: bytes, sig: Dict[str, Any], index: int) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "index": index,
        # Seeded up front: this function has three early returns for malformed
        # signatures, and the caller indexes entry["status"] unconditionally.
        # A smoke fixture with an unreadable /Contents hex string crashed the
        # whole analyzer with a KeyError before this was hoisted out of the
        # tail. Every exit path now carries a status.
        "status": "indeterminate",
        "coverage": _coverage_analysis(sig["byte_range"], len(raw)),
        "cms_parsed": False,
        "integrity": {"checked": False, "matched": None, "reason": None},
        "authenticity": {"attempted": False, "verified": None, "reason": None},
        "certificates": {"available": False},
        "trust_status": "not_evaluated",
        "trust_reason": (
            "Chain-to-trusted-root requires the AATL/EUTL trust store and "
            "revocation requires live OCSP/CRL egress; neither is available "
            "to this worker. Not evaluated rather than assumed."
        ),
        "issues": [],
    }

    if not sig.get("contents_found"):
        entry["issues"].append("signature_contents_unreadable")
        return entry

    step = _der_read(sig["der"])
    if step is None:
        entry["issues"].append("cms_der_unparseable")
        return entry

    signed_data = _find_signed_data(step[0])
    if signed_data is None:
        entry["issues"].append("not_a_pkcs7_signeddata")
        return entry

    signer_info = _parse_signer_info(signed_data)
    entry["cms_parsed"] = signer_info["parsed"]
    entry["signing_time"] = signer_info.get("signing_time")
    entry["digest_algorithm"] = signer_info.get("digest_algorithm")
    entry["has_timestamp_token"] = signer_info.get("has_timestamp_token", False)

    if signer_info.get("digest_algorithm") in _WEAK_DIGESTS:
        entry["issues"].append(f"weak_digest_algorithm:{signer_info['digest_algorithm']}")

    # Q1 — integrity.
    digest_name = signer_info.get("digest_algorithm")
    expected = signer_info.get("message_digest")
    if digest_name and expected:
        actual = _digest_signed_ranges(raw, sig["byte_range"], digest_name)
        if actual is None:
            entry["integrity"] = {"checked": False, "matched": None, "reason": "byte_range_out_of_bounds"}
            entry["issues"].append("byte_range_out_of_bounds")
        else:
            matched = actual == expected
            entry["integrity"] = {
                "checked": True,
                "matched": matched,
                "algorithm": digest_name,
                "expected_prefix": expected[:8].hex(),
                "actual_prefix": actual[:8].hex(),
                "reason": None,
            }
            if not matched:
                entry["issues"].append("signed_content_digest_mismatch")
    else:
        entry["integrity"]["reason"] = "message_digest_attribute_absent"

    # Q3 — authenticity.
    entry["authenticity"] = _verify_signature_value(sig["der"], signer_info)
    if entry["authenticity"].get("verified") is False:
        entry["issues"].append("signature_value_verification_failed")

    # Q4 (offline half) — certificate inspection.
    certs = _inspect_certificates(sig["der"], signer_info.get("signing_time"))
    entry["certificates"] = certs
    signer_cert = (certs or {}).get("signer") or {}
    if signer_cert.get("self_signed"):
        entry["issues"].append("self_signed_certificate")
    if signer_cert.get("expired_now"):
        entry["issues"].append("certificate_expired")
    if signer_cert.get("valid_at_signing_time") is False:
        entry["issues"].append("certificate_not_valid_at_signing_time")
    if signer_cert.get("weak_signature_hash"):
        entry["issues"].append("weak_certificate_signature_hash")
    if signer_cert.get("weak_key"):
        entry["issues"].append("weak_key_size")
    if certs.get("available") and not certs.get("revocation_endpoints_advertised"):
        entry["issues"].append("no_revocation_endpoint_advertised")

    # Q2 — coverage.
    if entry["coverage"]["content_appended_after_signing"]:
        entry["issues"].append("content_appended_after_signing")
    if not entry["coverage"]["starts_at_file_start"]:
        entry["issues"].append("byte_range_does_not_start_at_file_start")

    # Overall per-signature status. Deliberately capped: this module will
    # never emit "valid", only "cryptographically intact, trust not evaluated".
    integrity_ok = entry["integrity"].get("matched") is True
    authenticity_ok = entry["authenticity"].get("verified") is True
    coverage_ok = entry["coverage"]["covers_whole_file"]

    if integrity_ok and authenticity_ok and coverage_ok:
        entry["status"] = "cryptographically_intact_untrusted_chain"
    elif integrity_ok is False or entry["authenticity"].get("verified") is False:
        entry["status"] = "invalid_document_altered_or_signature_broken"
    elif integrity_ok and authenticity_ok and not coverage_ok:
        entry["status"] = "intact_but_incomplete_coverage"
    else:
        entry["status"] = "indeterminate"

    return entry


# ════════════════════════════════════════════════════════════════════════════
# Public entry point
# ════════════════════════════════════════════════════════════════════════════

def analyze_pdf_signatures(file_bytes: bytes) -> Dict[str, Any]:
    """
    Verify every embedded PDF digital signature's integrity, coverage and
    authenticity. Never raises.

    Score convention matches Modules 27-28: 0.5 is no information, higher is
    more suspicious. An unsigned document is 0.5/0.0 — the overwhelming
    majority of real documents are unsigned and that is not evidence of
    anything.
    """
    if not file_bytes:
        return _unavailable("empty_input")
    if not file_bytes.lstrip()[:5].startswith(b"%PDF-"):
        return _unavailable("not_a_pdf_header")

    try:
        signatures = _extract_signatures(file_bytes)
    except Exception as e:  # pragma: no cover - defensive
        logger.error("[PDFSignatureVerification] extraction failed: %s", e, exc_info=True)
        return {"score": 0.5, "confidence": 0.0, "status": "error",
                "details": {"reason": f"extraction_failed: {e}"}}

    if not signatures:
        return _unavailable(
            "no_signature_fields_present",
            signature_count=0,
            note=(
                "Most documents are unsigned. Absence of a signature is not "
                "evidence of tampering and is scored as no-information."
            ),
        )

    try:
        analyses = [_analyze_one(file_bytes, sig, i) for i, sig in enumerate(signatures)]
    except Exception as e:  # pragma: no cover - defensive
        logger.error("[PDFSignatureVerification] analysis failed: %s", e, exc_info=True)
        return {"score": 0.5, "confidence": 0.0, "status": "error",
                "details": {"reason": f"unexpected_error: {e}"}}

    score = 0.5
    findings: List[str] = []
    notes: List[str] = []

    severity = {
        "signed_content_digest_mismatch": 0.35,
        "signature_value_verification_failed": 0.30,
        "content_appended_after_signing": 0.20,
        "byte_range_does_not_start_at_file_start": 0.15,
        "byte_range_out_of_bounds": 0.15,
        "cms_der_unparseable": 0.10,
        "not_a_pkcs7_signeddata": 0.10,
        "signature_contents_unreadable": 0.08,
        "certificate_not_valid_at_signing_time": 0.10,
        "self_signed_certificate": 0.08,
        "weak_digest_algorithm:sha1": 0.05,
        "weak_digest_algorithm:md5": 0.10,
        "weak_certificate_signature_hash": 0.05,
        "weak_key_size": 0.05,
        "certificate_expired": 0.03,
        "no_revocation_endpoint_advertised": 0.02,
    }

    for entry in analyses:
        for issue in entry["issues"]:
            score += severity.get(issue, 0.02)
            findings.append(f"sig{entry['index']}:{issue}")
        if entry["status"] == "cryptographically_intact_untrusted_chain":
            # Real credit, but bounded — trust was never evaluated.
            score -= 0.12
            notes.append(f"sig{entry['index']}:integrity_coverage_and_authenticity_all_verified")
        if entry.get("has_timestamp_token"):
            notes.append(f"sig{entry['index']}:rfc3161_timestamp_token_present_not_verified")

    intact = sum(1 for e in analyses if e["status"] == "cryptographically_intact_untrusted_chain")
    broken = sum(1 for e in analyses if e["status"] == "invalid_document_altered_or_signature_broken")

    # Confidence is high when we actually completed the cryptographic checks,
    # low when the CMS wouldn't parse.
    parsed = sum(1 for e in analyses if e["cms_parsed"])
    confidence = 0.15 + 0.6 * (parsed / max(1, len(analyses)))
    confidence = min(0.85, confidence)

    return _result(
        score,
        confidence,
        signature_count=len(analyses),
        signatures_intact=intact,
        signatures_broken=broken,
        signatures=analyses,
        findings=findings,
        consistency_notes=notes,
        trust_evaluation={
            "performed": False,
            "chain_to_trusted_root": "not_evaluated",
            "revocation_status": "not_evaluated",
            "reason": (
                "PDF signature trust is anchored in the Adobe Approved Trust "
                "List / EU Trusted List, which this worker does not ship and "
                "cannot fetch here, and revocation requires live OCSP/CRL "
                "egress the sandbox does not have. A revocation check that "
                "'passes' because the network call failed would convert an "
                "unknown into a false assurance, so it is not attempted."
            ),
        },
        interpretation=(
            "Verifies signature INTEGRITY (do the signed bytes still hash to "
            "the committed value), COVERAGE (was anything appended after "
            "signing) and AUTHENTICITY (does the embedded public key verify "
            "the signature). It does NOT establish TRUST. The strongest "
            "verdict this module can return is "
            "'cryptographically_intact_untrusted_chain' — it will never "
            "report a signature as simply valid."
        ),
    )


def run_all(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Uniform entry point, matching analyzers/*.run_all in Modules 21-28."""
    return {"pdf_signature_verification": analyze_pdf_signatures(file_bytes)}
