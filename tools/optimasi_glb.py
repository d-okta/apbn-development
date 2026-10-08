"""Mengecilkan model GLB satu-mesh untuk web tanpa mengubah bentuknya.

- koordinat tekstur (UV) dibuang karena model dipakai tanpa tekstur,
- posisi disimpan sebagai bilangan bulat 16-bit (KHR_mesh_quantization),
- normal disimpan sebagai bilangan bulat 8-bit,
- indeks memakai 16-bit bila jumlah titik < 65.536.

Pemakaian:
    python tools/optimasi_glb.py masukan.glb assets/model/pesawat.glb
"""
import json
import struct
import sys

import numpy as np

COMPONENT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "bukan file GLB"
    json_len, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + json_len])
    offset = 20 + json_len
    bin_len, _ = struct.unpack_from("<II", data, offset)
    return gltf, data[offset + 8:offset + 8 + bin_len]


def accessor(gltf, binary, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    dtype = COMPONENT[acc["componentType"]]
    width = WIDTH[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", 0)
    item = np.dtype(dtype).itemsize * width
    if stride and stride != item:
        raw = np.frombuffer(binary, np.uint8, count=stride * acc["count"], offset=start).reshape(-1, stride)[:, :item]
        return np.frombuffer(raw.tobytes(), dtype).reshape(acc["count"], width)
    return np.frombuffer(binary, dtype, count=acc["count"] * width, offset=start).reshape(acc["count"], width)


def main(src, dst):
    gltf, binary = read_glb(src)
    meshes = gltf["meshes"]
    assert len(meshes) == 1 and len(meshes[0]["primitives"]) == 1, "hanya mendukung satu mesh satu primitif"
    prim = meshes[0]["primitives"][0]

    positions = accessor(gltf, binary, prim["attributes"]["POSITION"]).astype(np.float64)
    normals = accessor(gltf, binary, prim["attributes"]["NORMAL"]).astype(np.float64)
    indices = accessor(gltf, binary, prim["indices"]).reshape(-1)

    # posisi: bilangan bulat 16-bit, skala seragam agar arah normal tetap benar
    low, high = positions.min(0), positions.max(0)
    center = (low + high) / 2
    half = float(((high - low) / 2).max())
    q_pos = np.round((positions - center) / half * 32767).astype(np.int16)
    pos_block = np.zeros((len(q_pos), 4), np.int16)  # 3 komponen + 1 pengisi (kelipatan 4 byte)
    pos_block[:, :3] = q_pos

    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    lengths[lengths == 0] = 1
    q_nrm = np.round(normals / lengths * 127).astype(np.int8)
    nrm_block = np.zeros((len(q_nrm), 4), np.int8)
    nrm_block[:, :3] = q_nrm

    idx_type = 5123 if len(positions) < 65536 else 5125
    idx_block = indices.astype(np.uint16 if idx_type == 5123 else np.uint32)

    chunks, views = [], []
    offset = 0
    for block, stride, target in ((idx_block, None, 34963), (pos_block, 8, 34962), (nrm_block, 4, 34962)):
        raw = block.tobytes()
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target}
        if stride:
            view["byteStride"] = stride
        views.append(view)
        pad = (-len(raw)) % 4
        chunks.append(raw + b"\0" * pad)
        offset += len(raw) + pad
    new_bin = b"".join(chunks)

    material = gltf.get("materials", [{}])[0]
    out = {
        "asset": {"version": "2.0", "generator": "APBP tools/optimasi_glb.py"},
        "extensionsUsed": ["KHR_mesh_quantization"],
        "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{
            "name": "pesawat",
            "mesh": 0,
            "translation": [float(v) for v in center],
            "scale": [half / 32767] * 3,
        }],
        "meshes": [{"name": "pesawat", "primitives": [{
            "attributes": {"POSITION": 1, "NORMAL": 2},
            "indices": 0,
            "mode": 4,
            "material": 0,
        }]}],
        "materials": [{"name": "badan", "pbrMetallicRoughness": {
            "baseColorFactor": [1, 1, 1, 1],
            "metallicFactor": 0,
            "roughnessFactor": material.get("pbrMetallicRoughness", {}).get("roughnessFactor", 0.8),
        }}],
        "accessors": [
            {"bufferView": 0, "componentType": idx_type, "count": int(len(idx_block)), "type": "SCALAR"},
            {"bufferView": 1, "componentType": 5122, "count": int(len(q_pos)), "type": "VEC3",
             "min": [int(v) for v in q_pos.min(0)], "max": [int(v) for v in q_pos.max(0)]},
            {"bufferView": 2, "componentType": 5120, "normalized": True, "count": int(len(q_nrm)), "type": "VEC3"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(new_bin)}],
    }

    json_bytes = json.dumps(out, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(new_bin)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(new_bin), 0x004E4942))
        f.write(new_bin)

    # periksa ketelitian: selisih posisi setelah dikembalikan ke ukuran asli
    restored = q_pos.astype(np.float64) / 32767 * half + center
    error = np.abs(restored - positions).max() / (high - low).max()
    print(f"{src} -> {dst}: {len(open(src, 'rb').read()) / 1024:.0f} KB -> {total / 1024:.0f} KB, "
          f"titik {len(positions)}, segitiga {len(indices) // 3}, galat posisi maks {error:.2e} (relatif)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
