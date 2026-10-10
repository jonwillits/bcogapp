"""
Export a trained network to the app's own format: a JSON description of its
layers as a list of operations over named tensors, plus one binary file of
weights. `src/sim/objects/net.ts` runs it. There is no third-party runtime
in the browser: the drawing network is small, every intermediate map has to
be readable for the layer strip, and the photo networks are MobileNetV3-small,
whose few kinds of layer a few hundred lines of TypeScript can run.

Batch normalization is folded into the convolution before it. Photo-network
weights are stored as float16 (half the download); the agreement fixtures
are computed from the weights as stored, so the browser is compared with
the numbers it actually has.

  python -I export_model.py drawing <models_dir>/drawing_a.pt <out_dir> <name>
  python -I export_model.py photo <models_dir>/photo_standard.pt <out_dir> <name>
"""
import sys, os, json
import numpy as np
import torch
import torch.nn as nn
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import SCREEN_NAMES_16, SCREEN_NAMES_24
from drawing_net import DrawingNet, CHANNELS
from photo_net import build as build_photo, RES, MEAN, STD

class Writer:
    def __init__(self, dtype):
        self.dtype = dtype
        self.chunks = []
        self.tensors = {}
        self.offset = 0

    def add(self, name, arr):
        arr = np.ascontiguousarray(arr.detach().cpu().numpy().astype(np.float32))
        stored = arr.astype(np.float16) if self.dtype == "f16" else arr
        data = stored.tobytes()
        self.tensors[name] = {"dtype": self.dtype, "offset": self.offset, "shape": list(arr.shape)}
        self.chunks.append(data)
        self.offset += len(data)
        # Return what the browser will see, for the fixtures.
        return torch.from_numpy(stored.astype(np.float32))

def fold_bn(conv, bn):
    w = conv.weight
    b = conv.bias if conv.bias is not None else torch.zeros(w.shape[0])
    g = bn.weight / torch.sqrt(bn.running_var + bn.eps)
    return w * g.reshape(-1, 1, 1, 1), (b - bn.running_mean) * g + bn.bias

def round_to_stored(model, dtype):
    """Round every parameter to the stored precision, in place, so Python's fixtures match the browser's weights."""
    if dtype == "f16":
        with torch.no_grad():
            for p in model.parameters():
                p.copy_(p.half().float())
            for m in model.modules():
                if isinstance(m, nn.BatchNorm2d):
                    pass  # folded weights are rounded at export; see below

def export_drawing(pt, out_dir, name):
    model = DrawingNet(len(SCREEN_NAMES_24))
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    w = Writer("f32")
    ops = []
    cur = "input"
    for i, block in enumerate(model.blocks):
        conv = block[0]
        w.add(f"conv{i}.w", conv.weight)
        w.add(f"conv{i}.b", conv.bias)
        ops.append({"op": "conv", "in": cur, "out": f"conv{i}", "w": f"conv{i}.w", "b": f"conv{i}.b", "k": 3, "stride": 1, "pad": 1, "groups": 1})
        ops.append({"op": "relu", "in": f"conv{i}", "out": f"relu{i}"})
        ops.append({"op": "maxpool2", "in": f"relu{i}", "out": f"pool{i}"})
        cur = f"pool{i}"
    w.add("fc.w", model.fc.weight)
    w.add("fc.b", model.fc.bias)
    ops.append({"op": "linear", "in": cur, "out": "logits", "w": "fc.w", "b": "fc.b"})
    ops.append({"op": "softmax", "in": "logits", "out": "probs"})
    desc = {
        "name": name,
        "kind": "drawing",
        "input": {"channels": 1, "size": 64, "mean": 0.0, "std": 1.0},
        "labels": SCREEN_NAMES_24,
        "layers": [{"id": f"relu{i}", "pooled": f"pool{i}", "title": f"block {i+1}", "channels": c} for i, c in enumerate(CHANNELS)],
        "outputs": {"logits": "logits", "probs": "probs", "penultimate": cur},
        "ops": ops,
        "tensors": w.tensors,
        "weightsFile": f"{name}.bin",
    }
    write(out_dir, name, desc, w)
    return model

def export_photo(pt, out_dir, name):
    model = build_photo(len(SCREEN_NAMES_16), pretrained=False)
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    w = Writer("f16")
    ops = []
    counter = [0]
    def tname(prefix):
        counter[0] += 1
        return f"{prefix}{counter[0]}"
    def conv_bn_act(seq, cur, tag):
        """torchvision's Conv2dNormActivation: conv, bn, optional activation."""
        conv, bn = seq[0], seq[1]
        act = seq[2] if len(seq) > 2 else None
        wt, bt = fold_bn(conv, bn)
        # Round to stored precision and write the rounded values back, so the
        # Python fixtures are computed on exactly the browser's weights.
        wt_s = w.add(f"{tag}.w", wt)
        bt_s = w.add(f"{tag}.b", bt)
        with torch.no_grad():
            conv.weight.copy_(wt_s)
            if conv.bias is None:
                conv.bias = nn.Parameter(bt_s.clone())
            else:
                conv.bias.copy_(bt_s)
            bn.weight.fill_(1.0); bn.bias.fill_(0.0); bn.running_mean.fill_(0.0); bn.running_var.fill_(1.0 - bn.eps)
        out = tname("t")
        ops.append({"op": "conv", "in": cur, "out": out, "w": f"{tag}.w", "b": f"{tag}.b", "k": conv.kernel_size[0], "stride": conv.stride[0], "pad": conv.padding[0], "groups": conv.groups})
        if act is not None:
            a = {"ReLU": "relu", "Hardswish": "hardswish"}[type(act).__name__]
            out2 = tname("t")
            ops.append({"op": a, "in": out, "out": out2})
            out = out2
        return out
    def se(mod, cur, tag):
        w1 = w.add(f"{tag}.fc1.w", mod.fc1.weight.reshape(mod.fc1.weight.shape[0], -1))
        b1 = w.add(f"{tag}.fc1.b", mod.fc1.bias)
        w2 = w.add(f"{tag}.fc2.w", mod.fc2.weight.reshape(mod.fc2.weight.shape[0], -1))
        b2 = w.add(f"{tag}.fc2.b", mod.fc2.bias)
        with torch.no_grad():
            mod.fc1.weight.copy_(w1.reshape(mod.fc1.weight.shape)); mod.fc1.bias.copy_(b1)
            mod.fc2.weight.copy_(w2.reshape(mod.fc2.weight.shape)); mod.fc2.bias.copy_(b2)
        out = tname("t")
        ops.append({"op": "se", "in": cur, "out": out, "w1": f"{tag}.fc1.w", "b1": f"{tag}.fc1.b", "w2": f"{tag}.fc2.w", "b2": f"{tag}.fc2.b"})
        return out
    cur = "input"
    for i, f in enumerate(model.features):
        tn = type(f).__name__
        if tn == "Conv2dNormActivation":
            cur = conv_bn_act(f, cur, f"f{i}")
        elif tn == "InvertedResidual":
            start = cur
            for j, m in enumerate(f.block):
                mn = type(m).__name__
                if mn == "Conv2dNormActivation":
                    cur = conv_bn_act(m, cur, f"f{i}.{j}")
                elif mn == "SqueezeExcitation":
                    cur = se(m, cur, f"f{i}.{j}")
                else:
                    raise ValueError(mn)
            if f.use_res_connect:
                out = tname("t")
                ops.append({"op": "add", "in": cur, "other": start, "out": out})
                cur = out
        else:
            raise ValueError(tn)
    ops.append({"op": "gap", "in": cur, "out": "pooled"})
    l0, l3 = model.classifier[0], model.classifier[3]
    w0 = w.add("c0.w", l0.weight); b0 = w.add("c0.b", l0.bias)
    w3 = w.add("c3.w", l3.weight); b3 = w.add("c3.b", l3.bias)
    with torch.no_grad():
        l0.weight.copy_(w0); l0.bias.copy_(b0); l3.weight.copy_(w3); l3.bias.copy_(b3)
    ops.append({"op": "linear", "in": "pooled", "out": "c0", "w": "c0.w", "b": "c0.b"})
    ops.append({"op": "hardswish", "in": "c0", "out": "penultimate"})
    ops.append({"op": "linear", "in": "penultimate", "out": "logits", "w": "c3.w", "b": "c3.b"})
    ops.append({"op": "softmax", "in": "logits", "out": "probs"})
    desc = {
        "name": name,
        "kind": "photo",
        "input": {"channels": 1, "size": RES, "mean": MEAN, "std": STD},
        "labels": SCREEN_NAMES_16,
        "outputs": {"logits": "logits", "probs": "probs", "penultimate": "penultimate"},
        "ops": ops,
        "tensors": w.tensors,
        "weightsFile": f"{name}.bin",
    }
    write(out_dir, name, desc, w)
    return model

def penultimate_of(model, x):
    """The 1024-unit layer the readout reads, computed as the browser computes it."""
    f = model.features(x)
    f = model.avgpool(f).flatten(1)
    return model.classifier[1](model.classifier[0](f))

def write(out_dir, name, desc, w):
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{name}.bin"), "wb") as f:
        for c in w.chunks:
            f.write(c)
    json.dump(desc, open(os.path.join(out_dir, f"{name}.json"), "w"))
    print(f"{name}: {len(desc['ops'])} ops, {w.offset/1e6:.2f} MB of weights ({w.dtype})")

if __name__ == "__main__":
    kind, pt, out_dir, name = sys.argv[1:5]
    (export_drawing if kind == "drawing" else export_photo)(pt, out_dir, name)
