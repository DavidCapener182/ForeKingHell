"""Offline only. Blender Z-up (x,-z,y) -> glTF Y-up (x,y,z), metres."""
import bpy
import json
import math
import bmesh
import random
import numpy as np
import pathlib
import sys
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OUT = REPO / 'public/course-twins/common/blender-v1'
OUT.mkdir(parents=True, exist_ok=True)
SCENES = ROOT / 'scenes'
SCENES.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1

def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

source = collection('Source assets (hidden)')
exports = collection('Shared web exports - unit height')
terrain_collection = collection('Authoritative terrain reference - metres')
routes = collection('Mapped source polygons and hole routes')
decor = collection('Decorative vegetation - inferred, no collision authority')

def move(obj, coll):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)

report = []
for asset, triangle_budget in [('tree_small_02', 14000), ('shrub_04', 2200)]:
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=str(ROOT / '.cache' / asset / f'{asset}_1k.gltf'))
    meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not meshes: raise RuntimeError(f'No meshes imported: {asset}')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = asset
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Importer has already converted glTF axes. Centre XY, put root on Z=0, normalise height.
    points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    height = high.z - low.z
    if height <= 0: raise RuntimeError('Invalid asset height')
    for vertex in obj.data.vertices:
        p = obj.matrix_world @ vertex.co
        vertex.co = Vector((p.x - (low.x + high.x) / 2, p.y - (low.y + high.y) / 2, p.z - low.z)) / height
    obj.matrix_world.identity()
    original = obj.copy(); original.data = obj.data.copy(); source.objects.link(original)
    original.hide_set(True); original.hide_render = True
    move(obj, exports)
    for material in obj.data.materials:
        if not material or not material.use_nodes: continue
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                img = node.image
                if max(img.size) > 512: img.scale(512, 512)
                if 'leaves_diff' in img.name and 'alpha_prepared' not in img.name:
                    # New leaf planes need an alpha channel; the source mesh had cutout geometry.
                    prepared = img.copy(); prepared.name = img.name + '_alpha_prepared'
                    pixels = np.array(prepared.pixels[:], dtype=np.float32).reshape(-1, 4)
                    pixels[:,3] = np.clip((pixels[:,:3].max(axis=1)-0.015)/0.025, 0, 1)
                    prepared.pixels.foreach_set(pixels.ravel()); prepared.update()
                    prepared.file_format = 'PNG'; prepared.pack(); node.image = prepared
                    shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                    material.node_tree.links.new(node.outputs['Alpha'], shader.inputs['Alpha'])
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Roughness'].default_value = 0.88
                node.inputs['Metallic'].default_value = 0
    for lod, budget in [('near', triangle_budget), ('mid', triangle_budget // 3)]:
        copy = obj.copy(); copy.data = obj.data.copy(); exports.objects.link(copy)
        copy.name = f'{asset}_{lod}'
        bpy.ops.object.select_all(action='DESELECT'); copy.select_set(True)
        bpy.context.view_layer.objects.active = copy
        # Separate material islands so a million leaf triangles cannot starve the trunk budget.
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
        pieces = [o for o in bpy.context.selected_objects if o.type == 'MESH']
        for piece in pieces:
            bpy.ops.object.select_all(action='DESELECT'); piece.select_set(True)
            bpy.context.view_layer.objects.active = piece
            triangles = sum(max(0, len(p.vertices)-2) for p in piece.data.polygons)
            leaf = any(m and 'leav' in m.name.lower() for m in piece.data.materials)
            piece_budget = (42000 if lod == 'near' else 12000) if leaf else (1800 if lod == 'near' else 700)
            if asset == 'shrub_04': piece_budget = budget
            if leaf:
                # Preserve each leaf silhouette as a small plane instead of collapsing it
                # to a sliver. Sample whole islands with a stable seed and compensate area.
                import numpy as np
                bm = bmesh.new(); bm.from_mesh(piece.data)
                uv_layer = bm.loops.layers.uv.active
                seen = set(); rng = random.Random(1729); verts = []; faces = []; uvs = []
                keep = 0.32 if lod == 'near' else 0.12
                for vertex in bm.verts:
                    if vertex in seen: continue
                    island = []; pending = [vertex]; seen.add(vertex)
                    while pending:
                        v = pending.pop(); island.append(v)
                        for edge in v.link_edges:
                            other = edge.other_vert(v)
                            if other not in seen: seen.add(other); pending.append(other)
                    if len(island) < 3 or rng.random() > keep: continue
                    coords = np.array([tuple(v.co) for v in island]); center = coords.mean(axis=0)
                    _, axes = np.linalg.eigh((coords-center).T @ (coords-center))
                    major, minor = axes[:,2], axes[:,1]
                    u = max(abs((coords-center) @ major)); v = max(abs((coords-center) @ minor))
                    scale = min(2.8, 1/math.sqrt(keep))
                    corners = [center+major*u*scale, center+minor*v*scale, center-major*u*scale, center-minor*v*scale]
                    base = len(verts); verts.extend(tuple(p) for p in corners); faces.append(tuple(base+i for i in range(4)))
                    for p in corners:
                        nearest = island[int(np.argmin(((coords-p)**2).sum(axis=1)))]
                        uvs.append(tuple(nearest.link_loops[0][uv_layer].uv) if uv_layer and nearest.link_loops else (0,0))
                new_mesh = bpy.data.meshes.new('Silhouette-preserving leaf planes')
                new_mesh.from_pydata(verts, [], faces)
                for m in piece.data.materials: new_mesh.materials.append(m)
                uv = new_mesh.uv_layers.new(name='UVMap')
                for polygon in new_mesh.polygons:
                    for li in polygon.loop_indices: uv.data[li].uv = uvs[new_mesh.loops[li].vertex_index]
                old = piece.data; piece.data = new_mesh; bm.free()
                if old.users == 0: bpy.data.meshes.remove(old)
                continue
            modifier = piece.modifiers.new('Web material triangle budget', 'DECIMATE')
            modifier.ratio = min(1, piece_budget / max(1, triangles))
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            actual = sum(len(p.vertices)-2 for p in piece.data.polygons)
            if leaf and actual > piece_budget * 1.15:
                bm = bmesh.new(); bm.from_mesh(piece.data)
                rng = random.Random(1729)
                keep = piece_budget / actual
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if rng.random() > keep], context='FACES')
                # Enlarge surviving leaf islands to preserve canopy coverage at distance.
                seen = set()
                for vertex in bm.verts:
                    if vertex in seen: continue
                    island = []; pending = [vertex]; seen.add(vertex)
                    while pending:
                        v = pending.pop(); island.append(v)
                        for edge in v.link_edges:
                            other = edge.other_vert(v)
                            if other not in seen: seen.add(other); pending.append(other)
                    center = sum((v.co for v in island), Vector()) / len(island)
                    for v in island: v.co = center + (v.co-center) * min(2.0, 1/math.sqrt(keep))
                bm.to_mesh(piece.data); bm.free()
        bpy.ops.object.select_all(action='DESELECT')
        for piece in pieces: piece.select_set(True)
        bpy.context.view_layer.objects.active = pieces[0]
        if len(pieces) > 1: bpy.ops.object.join()
        copy = bpy.context.object
        # Leaf-plane coverage changes can extend the crown; re-normalise export bounds.
        clean = bmesh.new(); clean.from_mesh(copy.data)
        bmesh.ops.delete(clean, geom=[v for v in clean.verts if not v.link_faces], context='VERTS')
        clean.to_mesh(copy.data); clean.free()
        low_z = min(v.co.z for v in copy.data.vertices)
        span_z = max(v.co.z for v in copy.data.vertices) - low_z
        for vertex in copy.data.vertices:
            vertex.co.z -= low_z; vertex.co /= span_z
        copy.name = f'{asset}_{lod}'
        path = OUT / f'{asset}-{lod}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
            export_yup=True, export_animations=False, export_cameras=False, export_lights=False,
            export_image_format='AUTO', export_extras=True)
        report.append({'asset': asset, 'lod': lod, 'file': path.name, 'bytes': path.stat().st_size,
            'triangles': sum(len(p.vertices)-2 for p in copy.data.polygons), 'unitHeightM': 1,
            'originalHeightM': height, 'decorativeOnly': True})
        copy.hide_set(True); copy.hide_render = True
    obj.hide_set(True); obj.hide_render = True

# A web-compatible sand material prepared and packed by Blender, without altering terrain.
image = bpy.data.images.load(str(ROOT / '.cache/sand_01/sand_01_diff_1k.jpg'))
image.scale(1024, 1024)
image.filepath_raw = str(OUT / 'sand-colour.png'); image.file_format = 'PNG'; image.save()
material = bpy.data.materials.new('CC0 Sand 01 - mapped bunkers'); material.use_nodes = True
node = material.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image
bsdf = material.node_tree.nodes.get('Principled BSDF')
material.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.94

environment = bpy.data.images.load(str(ROOT / '.cache/kiara_5_noon/kiara_5_noon_1k.hdr'))
environment.scale(512, 256)
environment.filepath_raw = str(OUT / 'daylight.hdr'); environment.file_format = 'HDR'; environment.save()
world = bpy.data.worlds.new('Poly Haven daylight'); world.use_nodes = True
bpy.context.scene.world = world
node = world.node_tree.nodes.new('ShaderNodeTexEnvironment'); node.image = environment
world.node_tree.links.new(node.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35

# Editable showcase reads the existing immutable package and heightfield directly.
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
package = pathlib.Path(args[0]) if args else REPO / 'src/generated/course-twins/arscott-v1.json'
manifest = json.loads(package.read_text())
hm = manifest['terrain']['heightmap']
import struct
raw = (REPO / 'public' / hm['url'].lstrip('/')).read_bytes()
samples = struct.unpack('<' + 'f' * (len(raw) // 4), raw)
if len(samples) != hm['width'] * hm['height']: raise RuntimeError('Heightfield size mismatch')
bounds = hm['localBounds']; w = hm['width']; h = hm['height']
def sample(x, z):
    gx = max(0, min(w-1, (x-bounds['minX'])/(bounds['maxX']-bounds['minX'])*(w-1)))
    gz = max(0, min(h-1, (z-bounds['minZ'])/(bounds['maxZ']-bounds['minZ'])*(h-1)))
    x0, z0 = int(gx), int(gz); x1, z1 = min(w-1,x0+1), min(h-1,z0+1)
    tx, tz = gx-x0, gz-z0
    return (samples[z0*w+x0]*(1-tx)+samples[z0*w+x1]*tx)*(1-tz)+(samples[z1*w+x0]*(1-tx)+samples[z1*w+x1]*tx)*tz
vertices = [(bounds['minX'] + x/(w-1)*(bounds['maxX']-bounds['minX']),
             -(bounds['minZ'] + z/(h-1)*(bounds['maxZ']-bounds['minZ'])), samples[z*w+x])
            for z in range(h) for x in range(w)]
faces = [(z*w+x, (z+1)*w+x, (z+1)*w+x+1, z*w+x+1) for z in range(h-1) for x in range(w-1)]
mesh = bpy.data.meshes.new('Unmodified heightfield'); mesh.from_pydata(vertices, [], faces)
obj = bpy.data.objects.new('Authoritative terrain reference', mesh); terrain_collection.objects.link(obj)
obj['sourceSha256'] = hm['sha256']; obj['qualityGrade'] = manifest['quality']['grade']
for feature in manifest['features']:
    for ring in feature['rings']:
        curve = bpy.data.curves.new(feature['id'], 'CURVE'); curve.dimensions = '3D'
        spline = curve.splines.new('POLY'); spline.points.add(len(ring)-1)
        for p, co in zip(spline.points, ring): p.co = (co[0], -co[2], co[1], 1)
        obj = bpy.data.objects.new(feature['type'], curve); routes.objects.link(obj)
        obj['source'] = feature.get('source', 'unknown')
placement_file = SCENES / f'{package.stem}-placements.json'
if not placement_file.exists(): raise RuntimeError('Run the shared TypeScript placement exporter first')
placements = json.loads(placement_file.read_text())
import hashlib
if placements['sourceSha256'] != hashlib.sha256(package.read_bytes()).hexdigest(): raise RuntimeError('Placement package mismatch')
for key, asset in [('trees', 'tree_small_02'), ('bushes', 'shrub_04')]:
    prototype = bpy.data.objects[f'{asset}_mid']
    for index, p in enumerate(placements[key]):
        instance = bpy.data.objects.new(f'{key}_{index:04d}', prototype.data)
        decor.objects.link(instance)
        instance.location = (p['x'], -p['z'], p['y'])
        instance.rotation_euler.z = -p['rotation']
        instance.scale = (p['height']*p['widthScale'], p['height']*p['widthScale'], p['height'])
        instance['inferred'] = True; instance['collisionAuthority'] = False
# Keep original sources locally; the showcase can be moved with its packed textures.
bpy.ops.file.pack_all()
bpy.context.scene['coursePackage'] = str(package.relative_to(REPO))
bpy.context.scene['coordinateConvention'] = 'Blender (east, north, up) = browser (x, -z, y); glTF exporter converts once'
bpy.context.scene['manualVisualQaComplete'] = False
bpy.ops.wm.save_as_mainfile(filepath=str(SCENES / f"{package.stem}.blend"))
(OUT / 'exports.json').write_text(json.dumps({'schemaVersion': 1, 'exports': report}, indent=2) + '\n')
print('COURSE_TWIN_BLENDER_SUCCESS', json.dumps(report))
