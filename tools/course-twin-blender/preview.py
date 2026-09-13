"""Prepare a visible, textured inspection copy without altering source terrain."""
import bpy, pathlib, json, math
from mathutils import Vector, Euler
root=pathlib.Path.cwd()
bpy.ops.wm.open_mainfile(filepath=str(root/'tools/course-twin-blender/scenes/arscott-v1.blend'))
m=json.loads((root/'src/generated/course-twins/arscott-v1.json').read_text())
terrain=bpy.data.objects['Authoritative terrain reference']; mesh=terrain.data
bounds=m['terrain']['heightmap']['localBounds']
uv=mesh.uv_layers.new(name='Course aerial coordinates') if not mesh.uv_layers else mesh.uv_layers[0]
for p in mesh.polygons:
 for loop in p.loop_indices:
  co=mesh.vertices[mesh.loops[loop].vertex_index].co
  uv.data[loop].uv=((co.x-bounds['minX'])/(bounds['maxX']-bounds['minX']), (co.y+bounds['maxZ'])/(bounds['maxZ']-bounds['minZ']))
mat=bpy.data.materials.new('Source aerial terrain preview');mat.use_nodes=True
image=bpy.data.images.load(str(root/'public'/m['terrain']['imagery']['url'].lstrip('/')))
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
mesh.materials.clear();mesh.materials.append(mat)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   space=area.spaces.active;space.clip_end=10000;space.clip_start=.1
   space.shading.type='MATERIAL';space.overlay.show_overlays=False
   space.region_3d.view_location=Vector((100,0,25));space.region_3d.view_distance=1400
   space.region_3d.view_rotation=Euler((math.radians(35),0,math.radians(-15))).to_quaternion()
bpy.ops.object.select_all(action='DESELECT');terrain.select_set(True);bpy.context.view_layer.objects.active=terrain
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'tools/course-twin-blender/scenes/arscott-preview.blend'))
