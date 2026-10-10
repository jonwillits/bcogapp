"""
The photo networks: torchvision's MobileNetV3-small, ImageNet-pretrained,
with its first convolution folded to one grayscale input channel and its
last linear layer replaced by one over the sixteen categories.

Input 1 × RES × RES, gray in [0, 1], normalized as (g − MEAN) / STD, where
MEAN and STD are the averages of the ImageNet per-channel values the
pretrained weights expect. The penultimate layer, 1024 units after the
classifier's hardswish, is the readout's input in Part 3.
"""
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

RES = 160
MEAN = 0.449
STD = 0.226

def build(n_classes=16, pretrained=True):
    m = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None)
    conv = m.features[0][0]
    folded = nn.Conv2d(1, conv.out_channels, conv.kernel_size, conv.stride, conv.padding, bias=False)
    with torch.no_grad():
        folded.weight.copy_(conv.weight.sum(1, keepdim=True))
    m.features[0][0] = folded
    m.classifier[3] = nn.Linear(m.classifier[3].in_features, n_classes)
    return m

def penultimate(m, x):
    """The 1024-unit layer the readout reads: features → pool → linear → hardswish."""
    f = m.features(x)
    f = m.avgpool(f).flatten(1)
    return m.classifier[1](m.classifier[0](f))
