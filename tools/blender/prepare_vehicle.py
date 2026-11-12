"""Prepare a downloaded car for UZBEK LIFE in Blender (run on your PC, background mode):
  "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b -P tools/blender/prepare_vehicle.py -- in.glb out.glb 4.48 150000
Arguments: input (.glb/.gltf/.fbx/.obj), output .glb, real length in metres, target max triangle count.
Does: import → delete cameras/lights → apply transforms → scale to the given length → origin at the
bottom centre → decimate meshes above the budget (wheels kept separate) → shrink textures > 2048 px → export GLB (Draco).
UNTESTED in the development sandbox (Blender is not available there); test once on your machine."""
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
length = float(argv[2]) if len(argv) > 2 else 4.5
budget = int(argv[3]) if len(argv) > 3 else 150000
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src)
elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
else: raise SystemExit(f'unsupported format {ext}')
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
# bounds of the whole car
import mathutils
pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
mn = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
size = mx - mn
k = length / max(size.x, size.y)
centre = mathutils.Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
for o in bpy.data.objects:
    if o.parent is None:
        o.location = (o.location - centre) * k
        o.scale = o.scale * k
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
if tris > budget:
    ratio = budget / tris
    for o in meshes:
        if 'wheel' in o.name.lower() or 'tire' in o.name.lower() or 'tyre' in o.name.lower():
            continue
        m = o.modifiers.new('decimate', 'DECIMATE'); m.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
for img in bpy.data.images:
    if img.size[0] > 2048: img.scale(2048, int(2048 * img.size[1] / img.size[0]))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_draco_mesh_compression_enable=True, export_apply=True)
print(f'[prepare_vehicle] {src} -> {dst}: {tris} tris before, length {length} m')
