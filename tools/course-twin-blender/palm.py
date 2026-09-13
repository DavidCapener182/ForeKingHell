"""Original lightweight palm for tropical scenery; illustrative, not a species survey."""
import bpy, math, pathlib
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
verts=[];faces=[];materials=[]
for j in range(13):
 z=j/12*.76
 for i in range(8):
  a=i/8*math.tau;r=.028*(1-.28*j/12)
  verts.append((math.cos(a)*r+.035*(j/12)**2,math.sin(a)*r,z))
for j in range(12):
 for i in range(8):faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i));materials.append(0)
for f in range(12):
 angle=f*math.tau/12;dx,dy=math.cos(angle),math.sin(angle)
 for k in range(1,15):
  t=k/15;r=t*.47;z=.76+.17*math.sin(t*math.pi)-.13*t*t
  x=.035+dx*r;y=dy*r;length=.15*math.sin(t*math.pi)*(.85 if f%2 else 1)
  for side in [-1,1]:
   i=len(verts); tip=(x-dy*side*length+dx*.06,y+dx*side*length+dy*.06,z-.035)
   verts.extend([(x-dx*.014,y-dy*.014,z),(x+dx*.014,y+dy*.014,z),tip])
   faces.append((i,i+1,i+2));materials.append(1+f%2)
mesh=bpy.data.meshes.new('Palm trunk and fronds');mesh.from_pydata(verts,[],faces)
obj=bpy.data.objects.new('Tropical palm - inferred scenery',mesh);bpy.context.collection.objects.link(obj)
for name,col in [('bark',(.25,.17,.09,1)),('leaf',(.08,.23,.055,1)),('sun leaf',(.14,.30,.075,1))]:
 mat=bpy.data.materials.new(name);mat.diffuse_color=col;mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=col;mesh.materials.append(mat)
for p,i in zip(mesh.polygons,materials):p.material_index=i
maxz=max(v.co.z for v in mesh.vertices)
for v in mesh.vertices:v.co/=maxz
obj.select_set(True);bpy.context.view_layer.objects.active=obj
out=pathlib.Path.cwd()/'public/course-twins/common/blender-v1'
for lod in ['near','mid']:bpy.ops.export_scene.gltf(filepath=str(out/f'palm-{lod}.glb'),export_format='GLB',use_selection=True)
bpy.ops.object.camera_add(location=(1.6,-2.6,1.15));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.53))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.35
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.render.film_transparent=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(out/'palm-billboard.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(pathlib.Path.cwd()/'tools/course-twin-blender/scenes/tropical-palm.blend'))
