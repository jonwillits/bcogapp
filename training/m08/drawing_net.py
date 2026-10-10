"""
The drawing network: four blocks of convolution, ReLU and 2 × 2 max pooling,
then one linear layer. Kept plain so every block can be shown in the layer
strip, and small enough (about 300,000 weights) to run in plain TypeScript.

Input 1 × 64 × 64, ink = 1 on 0.
"""
import torch
import torch.nn as nn

CHANNELS = [16, 32, 64, 96]

class DrawingNet(nn.Module):
    def __init__(self, n_classes):
        super().__init__()
        blocks = []
        c_in = 1
        for c in CHANNELS:
            blocks.append(nn.Sequential(nn.Conv2d(c_in, c, 3, padding=1), nn.ReLU(inplace=True), nn.MaxPool2d(2)))
            c_in = c
        self.blocks = nn.ModuleList(blocks)
        self.fc = nn.Linear(CHANNELS[-1] * 4 * 4, n_classes)

    def forward(self, x, return_layers=False):
        layers = []
        for b in self.blocks:
            x = b(x)
            layers.append(x)
        logits = self.fc(x.flatten(1))
        return (logits, layers) if return_layers else logits

    def conv_and_pooled(self, x):
        """Every intermediate map, for the layer strip: [(conv+relu map, pooled map)] per block."""
        out = []
        for b in self.blocks:
            conv = b[1](b[0](x))
            x = b[2](conv)
            out.append((conv, x))
        return out, self.fc(x.flatten(1))
