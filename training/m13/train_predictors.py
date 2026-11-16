"""
Part 4's two networks (spec §8.5, §8.6), trained offline on the one corpus
the TypeScript generator wrote (corpus/corpus.txt), with Lab 8's pattern:
PyTorch on Jon's Mac, exported to the lab's own format and run by the
lab's own TypeScript runtime (src/sim/language/predictors/runtime/).

  transformer   2 layers, 2 attention computations per layer, model width 32,
                positions up to 32, a feed-forward layer of width 128 with
                the tanh-approximate GELU, pre-layer-norm, untied output
                weights; every position attends only to itself and earlier
                positions (the scale of Mao, Huebner and Willits, 2025)
  srn           Elman's simple recurrent network: a one-hot token in, a
                hidden layer of HIDDEN tanh units with its own previous
                activity fed back, a softmax over the vocabulary out; the
                hidden state starts at zero at each sentence

Both are trained to predict the next token with cross-entropy, AdamW, on
the first TRAIN_SENTENCES of the corpus, with the rest held out. A
snapshot of each is saved at SNAPSHOTS updates (the first before any
training). For each snapshot: held-out next-token accuracy, and agreement
by depth on corpus/probes.json. Agreement fixtures for the runtime's test
(next-token probabilities and attention weights on FIXTURE_PROMPTS prompts)
are written from the final weights. Seed 1.

  python -I train_predictors.py <repo_dir> [--updates N]
"""
import sys, os, json, math, time, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

SEED = 1
D_MODEL, N_LAYERS, N_HEADS, MAX_LEN, D_FF = 32, 2, 2, 32, 128
HIDDEN = 64
TRAIN_SENTENCES = 9000
BATCH = 32
LR = 1e-3
SNAPSHOTS = [0, 50, 200, 500, 1000, 3000, 10000, 20000]
FIXTURE_PROMPTS = 30


class Transformer(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.tok = nn.Embedding(vocab, D_MODEL)
        self.pos = nn.Embedding(MAX_LEN, D_MODEL)
        self.layers = nn.ModuleList()
        for _ in range(N_LAYERS):
            self.layers.append(nn.ModuleDict({
                "ln1": nn.LayerNorm(D_MODEL), "qkv": nn.Linear(D_MODEL, 3 * D_MODEL), "o": nn.Linear(D_MODEL, D_MODEL),
                "ln2": nn.LayerNorm(D_MODEL), "fc": nn.Linear(D_MODEL, D_FF), "proj": nn.Linear(D_FF, D_MODEL),
            }))
        self.lnf = nn.LayerNorm(D_MODEL)
        self.out = nn.Linear(D_MODEL, vocab)

    def forward(self, x, return_all=False):
        B, T = x.shape
        h = self.tok(x) + self.pos(torch.arange(T, device=x.device))[None]
        attn_all, hidden_all = [], [h]
        mask = torch.tril(torch.ones(T, T, device=x.device, dtype=torch.bool))
        for L in self.layers:
            a = L["ln1"](h)
            qkv = L["qkv"](a).view(B, T, 3, N_HEADS, D_MODEL // N_HEADS).permute(2, 0, 3, 1, 4)
            q, k, v = qkv[0], qkv[1], qkv[2]
            s = (q @ k.transpose(-1, -2)) / math.sqrt(D_MODEL // N_HEADS)
            s = s.masked_fill(~mask, float("-inf"))
            w = s.softmax(-1)
            attn_all.append(w)
            ctx = (w @ v).transpose(1, 2).reshape(B, T, D_MODEL)
            h = h + L["o"](ctx)
            m = L["ln2"](h)
            h = h + L["proj"](F.gelu(L["fc"](m), approximate="tanh"))
            hidden_all.append(h)
        logits = self.out(self.lnf(h))
        if return_all:
            return logits, attn_all, hidden_all
        return logits


class Srn(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.w_ih = nn.Linear(vocab, HIDDEN)
        self.w_hh = nn.Linear(HIDDEN, HIDDEN, bias=False)
        self.out = nn.Linear(HIDDEN, vocab)
        self.vocab = vocab

    def forward(self, x, return_all=False):
        B, T = x.shape
        h = torch.zeros(B, HIDDEN, device=x.device)
        onehot = F.one_hot(x, self.vocab).float()
        hs, logits = [], []
        for t in range(T):
            h = torch.tanh(self.w_ih(onehot[:, t]) + self.w_hh(h))
            hs.append(h)
            logits.append(self.out(h))
        logits = torch.stack(logits, 1)
        if return_all:
            return logits, torch.stack(hs, 1)
        return logits


def load_corpus(repo):
    d = os.path.join(repo, "training", "m13", "corpus")
    vocab = json.load(open(os.path.join(d, "vocabulary.json")))["tokens"]
    idx = {t: i for i, t in enumerate(vocab)}
    sents = [l.split() for l in open(os.path.join(d, "corpus.txt")) if l.strip()]
    probes = json.load(open(os.path.join(d, "probes.json")))
    return vocab, idx, sents, probes


def batches(sents, idx, rng, pad):
    """Pad to the longest in the batch with `pad`; targets are the next token, with pad positions ignored."""
    order = rng.permutation(len(sents))
    for i in range(0, len(order), BATCH):
        chunk = [sents[j] for j in order[i : i + BATCH]]
        T = max(len(s) for s in chunk)
        x = torch.full((len(chunk), T), pad, dtype=torch.long)
        for r, s in enumerate(chunk):
            x[r, : len(s)] = torch.tensor([idx[t] for t in s])
        yield x


def loss_on(model, x, pad):
    logits = model(x[:, :-1])
    tgt = x[:, 1:].clone()
    tgt[x[:, 1:] == pad] = -100
    # The first-token positions are real; pad inputs beyond a sentence's end are masked through the targets.
    return F.cross_entropy(logits.reshape(-1, logits.shape[-1]), tgt.reshape(-1), ignore_index=-100)


@torch.no_grad()
def held_out_accuracy(model, sents, idx, pad):
    model.eval()
    right = total = 0
    for s in sents:
        x = torch.tensor([[idx[t] for t in s]])
        logits = model(x[:, :-1])
        pred = logits.argmax(-1)[0]
        tgt = x[0, 1:]
        right += int((pred == tgt).sum())
        total += len(tgt)
    model.train()
    return right / total


@torch.no_grad()
def agreement(model, probes, idx):
    model.eval()
    by = {0: [0, 0], 1: [0, 0], 2: [0, 0], 3: [0, 0]}
    for p in probes:
        x = torch.tensor([[idx[t] for t in p["prefix"]]])
        probs = model(x)[0, -1].softmax(-1)
        ok = float(probs[idx[p["agreeing"]]]) > float(probs[idx[p["other"]]])
        by[p["depth"]][0] += ok
        by[p["depth"]][1] += 1
    model.train()
    return {d: (c / n if n else None) for d, (c, n) in by.items()}


def export(model, kind, out_dir, name, vocab):
    """The lab's format: a JSON description of the tensors and one float32 binary per snapshot; the description is shared across snapshots."""
    tensors, chunks, offset = {}, [], 0
    for pname, p in model.state_dict().items():
        arr = np.ascontiguousarray(p.detach().cpu().numpy().astype(np.float32))
        tensors[pname] = {"dtype": "f32", "offset": offset, "shape": list(arr.shape)}
        data = arr.tobytes()
        chunks.append(data)
        offset += len(data)
    with open(os.path.join(out_dir, f"{name}.bin"), "wb") as f:
        for c in chunks:
            f.write(c)
    return tensors


def main(repo, total_updates):
    torch.manual_seed(SEED)
    rng = np.random.default_rng(SEED)
    vocab, idx, sents, probes = load_corpus(repo)
    pad = len(vocab)  # one extra index for padding; never a model output of interest
    train, held = sents[:TRAIN_SENTENCES], sents[TRAIN_SENTENCES:]
    train_set = set(" ".join(s) for s in train)
    overlap = sum(1 for s in held if " ".join(s) in train_set) / len(held)
    out_dir = os.path.join(repo, "public", "m13", "models")
    os.makedirs(out_dir, exist_ok=True)
    report = {"seed": SEED, "vocab": len(vocab), "trainSentences": len(train), "heldOutSentences": len(held), "heldOutAlsoInTrain": overlap, "batch": BATCH, "lr": LR, "snapshots": SNAPSHOTS, "models": {}}
    for kind, Model in [("transformer", Transformer), ("srn", Srn)]:
        torch.manual_seed(SEED)
        model = Model(len(vocab) + 1)
        opt = torch.optim.AdamW(model.parameters(), lr=LR)
        n_params = sum(p.numel() for p in model.parameters())
        snaps, updates, t0 = [], 0, time.time()
        losses = []

        def snapshot():
            name = f"{kind}_{updates:05d}"
            tensors = export(model, kind, out_dir, name, vocab)
            snaps.append({"updates": updates, "weightsFile": f"{name}.bin", "heldOutAccuracy": held_out_accuracy(model, held, idx, pad), "agreementByDepth": agreement(model, probes, idx), "loss": float(np.mean(losses[-100:])) if losses else None})
            print(kind, updates, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in snaps[-1].items() if k != "weightsFile"}, flush=True)
            return tensors

        tensors = snapshot()
        done = False
        while not done:
            for x in batches(train, idx, rng, pad):
                loss = loss_on(model, x, pad)
                opt.zero_grad()
                loss.backward()
                opt.step()
                losses.append(float(loss))
                updates += 1
                if updates in SNAPSHOTS:
                    snapshot()
                if updates >= total_updates:
                    done = True
                    break
        if updates not in SNAPSHOTS:
            snapshot()
        desc = {"name": kind, "kind": kind, "vocab": vocab, "pad": pad, "dModel": D_MODEL, "nLayers": N_LAYERS, "nHeads": N_HEADS, "maxLen": MAX_LEN, "dFF": D_FF, "hidden": HIDDEN, "tensors": tensors, "snapshots": snaps, "params": n_params, "trainingSeconds": round(time.time() - t0, 1)}
        json.dump(desc, open(os.path.join(out_dir, f"{kind}.json"), "w"), indent=1)
        report["models"][kind] = {"params": n_params, "seconds": round(time.time() - t0, 1), "snapshots": snaps}
        # Fixtures from the final weights: prompts from the held-out sentences, every prefix length, plus the two sentences the screens show.
        fx_dir = os.path.join(repo, "src", "sim", "language", "predictors", "fixtures")
        os.makedirs(fx_dir, exist_ok=True)
        prompts = [["boys", "who", "Mary", "chases"], ["boys", "who", "the", "dog", "chases"] if "the" in idx else ["boys", "who", "dogs", "chase"], ["dog", "chases", "cat"], ["cat", "chases", "dog"]]
        frng = np.random.default_rng(7)
        for s in [held[i] for i in frng.choice(len(held), FIXTURE_PROMPTS, replace=False)]:
            n = int(frng.integers(1, len(s)))
            prompts.append(s[:n])
        model.eval()
        fixtures = []
        with torch.no_grad():
            for p in prompts:
                x = torch.tensor([[idx[t] for t in p]])
                if kind == "transformer":
                    logits, attn, hidden = model(x, return_all=True)
                    fixtures.append({"prompt": p, "probs": logits[0].softmax(-1)[:, : len(vocab)].tolist(), "attention": [a[0].tolist() for a in attn], "last": hidden[-1][0].tolist()})
                else:
                    logits, hs = model(x, return_all=True)
                    fixtures.append({"prompt": p, "probs": logits[0].softmax(-1)[:, : len(vocab)].tolist(), "hidden": hs[0].tolist()})
        json.dump(fixtures, open(os.path.join(fx_dir, f"{kind}.json"), "w"))
        print(kind, "params", n_params, "fixtures", len(fixtures), flush=True)
    json.dump(report, open(os.path.join(out_dir, "training.json"), "w"), indent=1)
    print(json.dumps({k: v for k, v in report.items() if k != "models"}))


if __name__ == "__main__":
    repo = sys.argv[1]
    total = int(sys.argv[sys.argv.index("--updates") + 1]) if "--updates" in sys.argv else SNAPSHOTS[-1]
    main(repo, total)
