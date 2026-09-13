"""Original procedural tuft, metres, low-poly blades; no downloaded dependencies."""
import bpy, math, random, pathlib
from mathutils import Quaternion, Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(1729)
vertices=[]; faces=[]
for i in range(80):
    angle=rng.random()*math.tau; radius=math.sqrt(rng.random())*1.5
    x,y=math.cos(angle)*radius,math.sin(angle)*radius
    width=rng.uniform(.025,.06); h=rng.uniform(.35,1)
    bend=rng.uniform(.1,.4); direction=rng.random()*math.tau
    dx,dy=math.cos(direction),math.sin(direction)
    start=len(vertices)
    vertices.extend([(x-dy*width,y+dx*width,0),(x+dy*width,y-dx*width,0),(x+dx*bend+dy*width*.45,y+dy*bend-dx*width*.45,h*.55),(x+dx*bend-dy*width*.45,y+dy*bend+dx*width*.45,h*.55),(x+dx*bend*1.8,y+dy*bend*1.8,h)])
    faces.extend([(start,start+1,start+2,start+3),(start+3,start+2,start+4)])
mesh=bpy.data.meshes.new('Bent grass blades');mesh.from_pydata(vertices,[],faces)
obj=bpy.data.objects.new('Rough grass tuft - decorative',mesh);bpy.context.collection.objects.link(obj)
for name,color in [('fresh',(0.19,.27,.075,1)),('dry tips',(.31,.32,.12,1)),('shade',(.11,.18,.05,1))]:
    mat=bpy.data.materials.new(name);mat.diffuse_color=color;mat.use_nodes=True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
    mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95
    mesh.materials.append(mat)
for polygon in mesh.polygons: polygon.material_index=rng.randrange(3)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
out=pathlib.Path.cwd()/'public/course-twins/common/blender-v1'
for lod in ['near','mid']:
    bpy.ops.export_scene.gltf(filepath=str(out/f'rough_grass-{lod}.glb'),export_format='GLB',use_selection=True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.clip_end=10000
            area.spaces.active.shading.color_type='MATERIAL'
            area.spaces.active.region_3d.view_distance=5
            area.spaces.active.region_3d.view_location=Vector((0,0,.4))
bpy.ops.wm.save_as_mainfile(filepath=str(pathlib.Path.cwd()/'tools/course-twin-blender/scenes/rough-grass.blend'))
print('Grass: 240 triangles per tuft')
