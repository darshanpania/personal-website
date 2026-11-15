"""Helpers for the model scripts. They run inside Blender (bpy).

Conventions for every model:
- 1 unit = 1 unit in the three.js scene.
- Z is up and the front of the model points to -Y. The glTF exporter turns
  this into Y up and front to +Z, which is what `Object3D.lookAt` expects.
- Colours are sRGB hex strings, the same form as the site tokens.
- A material name is a contract with the site: a theme can find a material
  by its name and tint it (for example with the accent colour of the site).
"""

import os

import bpy


def hex_to_linear(hex_color):
    """'#rrggbb' (sRGB) -> (r, g, b) in linear light, as Blender wants it."""
    value = hex_color.lstrip("#")
    channels = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels
    )


def reset_scene():
    """Start from an empty file, so no model depends on user settings."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, color, roughness=0.85, metallic=0.0, double_sided=False):
    material = bpy.data.materials.new(name)
    bsdf = next(n for n in material.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*hex_to_linear(color), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    material.use_backface_culling = not double_sided
    return material


def make_mesh(name, verts, faces, materials=(), face_materials=None, smooth=False):
    """Make a mesh object from raw points and faces, and link it to the scene.

    `face_materials` gives the index into `materials` for each face.
    """
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for material in materials:
        mesh.materials.append(material)
    if face_materials:
        for polygon, index in zip(mesh.polygons, face_materials):
            polygon.material_index = index
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def export_glb(path, compress=True):
    """Write the scene as one .glb file. Returns the file size in bytes.

    Modifiers are applied on export. Meshopt compression keeps the files
    small; three.js decodes it with MeshoptDecoder (no extra files to host).
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=False,
        export_meshopt_compression_enable=compress,
    )
    return os.path.getsize(path)
