"""
The sixteen categories shared by the photo networks and the drawing network
(Geirhos et al. 2018's sixteen), with each one's name in Open Images and in
Quick, Draw!, and the extra part-structured drawing categories for Part 2.

Spec §3.1. The mapping is confirmed against the live category lists by
`download_quickdraw.py` (every Quick, Draw! name must be in categories.txt)
and `prepare_openimages.py` (every Open Images name must be a boxable class).
"""

# (name on screen, Open Images display name, Quick, Draw! category)
SIXTEEN = [
    ("airplane", "Fixed-wing aircraft", "airplane"),
    ("bear", "Bear", "bear"),
    ("bicycle", "Bicycle", "bicycle"),
    ("bird", "Bird", "bird"),
    ("boat", "Boat", "sailboat"),
    ("bottle", "Bottle", "wine bottle"),
    ("car", "Car", "car"),
    ("cat", "Cat", "cat"),
    ("chair", "Chair", "chair"),
    ("clock", "Clock", "clock"),
    ("dog", "Dog", "dog"),
    ("elephant", "Elephant", "elephant"),
    ("keyboard", "Computer keyboard", "keyboard"),
    ("knife", "Knife", "knife"),
    ("oven", "Oven", "oven"),
    ("truck", "Truck", "truck"),
]

# Part-structured categories for Part 2, drawings only. Each is an object
# whose identity depends on where one part sits relative to another.
EXTRA_DRAWING = [
    ("mushroom", "mushroom"),
    ("ice cream", "ice cream"),
    ("coffee cup", "coffee cup"),
    ("bucket", "bucket"),
    ("umbrella", "umbrella"),
    ("snowman", "snowman"),
    ("floor lamp", "floor lamp"),
    ("wine glass", "wine glass"),
]

SCREEN_NAMES_16 = [s[0] for s in SIXTEEN]
QUICKDRAW_24 = [(s[0], s[2]) for s in SIXTEEN] + EXTRA_DRAWING
SCREEN_NAMES_24 = [q[0] for q in QUICKDRAW_24]
OPENIMAGES_16 = [(s[0], s[1]) for s in SIXTEEN]
