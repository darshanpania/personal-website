"""A folded paper plane (the classic dart). It is the test model for the
Blender -> glTF -> three.js pipeline.

Materials: `paper` (the wings) and `accent` (the keel; the site tints it).
"""

from lib import make_material, make_mesh


def build():
    paper = make_material("paper", "#f6f3ee", roughness=0.9)
    accent = make_material("accent", "#3d5a80", roughness=0.8)

    nose = (0.0, -1.0, 0.0)
    root_left = (-0.035, 1.0, 0.0)
    root_right = (0.035, 1.0, 0.0)
    tip_left = (-0.72, 1.0, 0.10)
    tip_right = (0.72, 1.0, 0.10)
    keel = (0.0, 0.92, -0.30)

    verts = [nose, root_left, root_right, tip_left, tip_right, keel]
    faces = [
        (0, 1, 3),  # left wing, faces up
        (0, 4, 2),  # right wing, faces up
        (0, 1, 5),  # left side of the keel
        (0, 5, 2),  # right side of the keel
    ]
    plane = make_mesh(
        "paper-plane",
        verts,
        faces,
        materials=(paper, accent),
        face_materials=(0, 0, 1, 1),
    )

    # Give the sheet a real thickness. The exporter applies the modifier.
    solidify = plane.modifiers.new("Solidify", "SOLIDIFY")
    solidify.thickness = 0.016
    solidify.offset = 0.0
    return plane
