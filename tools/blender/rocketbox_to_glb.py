"""Rocketbox (MIT) avatar + animations -> optimised GLB, run with Blender-as-module (bpy 5.0).
usage: python convert.py <avatar.fbx> <textures dir> <out.glb> <texsize> [anim_dir]"""
import bpy, sys, os, re, math
from PIL import Image

fbx, texdir, out, texsize = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
animdir = sys.argv[5] if len(sys.argv) > 5 else None
work = os.path.join(os.path.dirname(out) or '.', '_tex_' + os.path.splitext(os.path.basename(out))[0])
os.makedirs(work, exist_ok=True)

CLIPS = [  # (clip name, file, max frames, frame step)
    ('idle', 'm_idle_neutral_01', 351, 1), ('idle_look', 'm_idle_look_around_01', 140, 1), ('breathe', 'm_idle_breathe_01', 83, 1),
    ('walk', 'm_walk_neutral_02', 33, 1), ('walk_slow', 'm_walk_slow_01', 45, 1), ('walk_cool', 'm_walk_cool_01', 39, 1),
    ('run', 'm_run_neutral_01', 23, 1), ('sprint', 'm_run_fast_01', 19, 1),
    ('walk_start', 'm_walk_start', 30, 1), ('walk_stop', 'm_walk_stop', 61, 1), ('run_stop', 'm_run_stop', 39, 1),
    ('door_out', 'm_try_door_outwards', 187, 1), ('door_in', 'm_try_door_inwards', 187, 1), ('knock', 'm_knock_door', 241, 2),
    ('crouch_in', 'm_crouch_in', 136, 1), ('crouch_out', 'm_crouch_out', 136, 1),
    ('sit', 'm_sit_chair_idle_neutral_01', 300, 2), ('wave', 'm_wave_01', 86, 1),
    ('wait', 'm_idle_waiting_01', 360, 2), ('wait2', 'm_idle_waiting_02', 300, 2), ('phone', 'm_cell_phone_talk_01', 300, 2),
    ('bag', 'm_hold_bag_idle', 240, 2), ('talk', 'm_gestic_talk_neutral_01', 300, 2), ('work', 'm_work_table', 340, 2),
    ('trolley', 'm_trolley_idle', 240, 2),
]
FACE = re.compile(r'Eye|Jaw|Lip|Mouth|Cheek|brow|Nose|Masseter|Caninus|Tongue|Blink', re.I)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.fbx(filepath=fbx)
A = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
A.animation_data_clear()
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]

# ---- textures: downsize, convert specular -> roughness, rebuild simple PBR materials
def tex(name):
    for ext in ('.tga', '.png', '.jpg'):
        p = os.path.join(texdir, name + ext)
        if os.path.exists(p):
            return p
    return None

def save_img(src, dst, size, mode='RGB', fn=None):
    im = Image.open(src).convert(mode)
    if fn: im = fn(im)
    im = im.resize((size, size), Image.LANCZOS)
    if dst.endswith('.png'): im.save(dst, optimize=True)
    else: im.save(dst, quality=86, optimize=True)
    return bpy.data.images.load(dst)

def rough_from_spec(im):
    g = im.convert('L')
    return g.point(lambda v: int(255 * min(0.95, max(0.32, 0.92 - (v / 255) * 0.75)))).convert('RGB')

for mat in mesh.data.materials:
    base = mat.name  # e.g. m024_body
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], outn.inputs['Surface'])
    stem = os.path.join(work, base)
    if base.endswith('_opacity'):
        p = tex(base + '_color')
        img = save_img(p, stem + '_color.png', min(512, texsize), 'RGBA')
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
        bsdf.inputs['Roughness'].default_value = 0.8
        continue
    c = tex(base + '_color'); nrm = tex(base + '_normal'); spec = tex(base + '_specular')
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = save_img(c, stem + '_color.jpg', texsize)
    nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if nrm:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = save_img(nrm, stem + '_normal.jpg', texsize); tn.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if spec:
        tr = nt.nodes.new('ShaderNodeTexImage'); tr.image = save_img(spec, stem + '_rough.jpg', max(256, texsize // 2), fn=rough_from_spec); tr.image.colorspace_settings.name = 'Non-Color'
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tr.outputs['Color'], sep.inputs['Color']); nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = 0.75
    bsdf.inputs['Metallic'].default_value = 0.0

# ---- animations: world-space rotation retarget from each clip's own Biped rig, baked onto the avatar rig
if animdir:
    A.animation_data_create()
    body = [pb for pb in A.pose.bones if not FACE.search(pb.name)]
    for clip, fname, maxf, step in CLIPS:
        path = os.path.join(animdir, fname + '.fbx')
        if not os.path.exists(path):
            print('skip', clip); continue
        before = set(bpy.data.objects); acts_before = set(bpy.data.actions)
        bpy.ops.import_scene.fbx(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        B = [o for o in new if o.type == 'ARMATURE'][0]
        act = B.animation_data.action
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        f1 = min(f1, f0 + maxf - 1)
        cons = []
        for pb in body:
            if pb.name not in B.pose.bones: continue
            c = pb.constraints.new('COPY_ROTATION'); c.target = B; c.subtarget = pb.name
            c.target_space = 'WORLD'; c.owner_space = 'WORLD'; cons.append((pb, c))
            if pb.name == 'Bip01 Pelvis':
                c2 = pb.constraints.new('COPY_LOCATION'); c2.target = B; c2.subtarget = pb.name
                c2.target_space = 'WORLD'; c2.owner_space = 'WORLD'; cons.append((pb, c2))
        bpy.context.view_layer.objects.active = A
        for o in bpy.context.view_layer.objects: o.select_set(o == A)
        bpy.ops.object.mode_set(mode='POSE')
        for pb in A.pose.bones:
            sel = not FACE.search(pb.name)
            if hasattr(pb, 'select'): pb.select = sel
            else: pb.bone.select = sel
        bpy.ops.nla.bake(frame_start=f0, frame_end=f1, step=step, only_selected=True, visual_keying=True,
                         clear_constraints=True, clear_parents=False, use_current_action=False, bake_types={'POSE'})
        bpy.ops.object.mode_set(mode='OBJECT')
        baked = A.animation_data.action
        baked.name = clip
        # shift to start at frame 0
        track = A.animation_data.nla_tracks.new(); track.name = clip
        strip = track.strips.new(clip, f0, baked); strip.name = clip
        A.animation_data.action = None
        for o in new: bpy.data.objects.remove(o)
        for a in list(bpy.data.actions):
            if a not in acts_before and a is not baked: bpy.data.actions.remove(a)
        for pb in A.pose.bones:
            for c in list(pb.constraints): pb.constraints.remove(c)
            pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0)
        print('baked', clip, f0, f1, step)

bpy.context.view_layer.update()
for o in list(bpy.context.scene.objects):
    if o is not None: o.select_set(o.name in (A.name, mesh.name))
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_animations=bool(animdir), export_animation_mode='NLA_TRACKS', export_force_sampling=True,
    export_optimize_animation_size=True, export_anim_single_armature=True, export_def_bones=False,
    export_image_format='AUTO', export_jpeg_quality=86, export_yup=True, export_skins=True,
    export_morph=False, export_extras=False, export_apply=False)
print('EXPORTED', out, os.path.getsize(out))
