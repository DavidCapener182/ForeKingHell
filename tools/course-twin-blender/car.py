"""Original unbranded compact car, for inferred static car-park dressing."""
import bpy,math,pathlib
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials=[]
for name,col in [('paint',(.72,.75,.78,1)),('windows',(.025,.045,.06,1)),('rubber',(.018,.019,.02,1)),('lamps',(.85,.88,.79,1))]:
 m=bpy.data.materials.new(name);m.diffuse_color=col;m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=col;m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.35 if name!='rubber' else .9;materials.append(m)
def box(name,location,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(materials[mat]);bevel=o.modifiers.new('Small body bevel','BEVEL');bevel.width=.07;bevel.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
box('Body',(0,0,.62),(1.75,4.1,.63),0);box('Cabin',(0,-.18,1.12),(1.48,2.15,.63),1);box('Roof',(0,-.20,1.46),(1.5,1.8,.08),0)
for x in [-.84,.84]:
 for y in [-1.24,1.22]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.34,depth=.20,location=(x,y,.34),rotation=(0,math.pi/2,0));bpy.context.object.data.materials.append(materials[2])
for x in [-.56,.56]:box('Headlamp',(x,2.065,.7),(.38,.04,.16),3)
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=bpy.context.selected_objects[0];bpy.ops.object.join();o=bpy.context.object;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Apply the complete world transform and normalise to unit height for shared instancing.
world=[o.matrix_world@v.co for v in o.data.vertices];base=min(v.z for v in world);height=max(v.z for v in world)-base
for v,co in zip(o.data.vertices,world):v.co=(co.x/height,co.y/height,(co.z-base)/height)
o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)
out=pathlib.Path.cwd()/'public/course-twins/common/blender-v1'
for lod in ['near','mid']:bpy.ops.export_scene.gltf(filepath=str(out/f'parked_car-{lod}.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(pathlib.Path.cwd()/'tools/course-twin-blender/scenes/parked-car.blend'))
