"""Original 2 m rough-turf occlusion tile, no colour or direct sunlight.
Cycles AO bake from deterministic blade clusters onto a flat receiver. AO is
applied only to close-range indirect diffuse in rough; never alters elevations.
"""
import bpy,random,math,pathlib,hashlib,json
root=pathlib.Path.cwd();out=root/'public/course-twins/common/blender-v1'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_plane_add(size=2);ground=bpy.context.object;ground.name='Two metre rough AO receiver'
image=bpy.data.images.new('Rough AO linear',width=512,height=512,alpha=False);image.colorspace_settings.name='Non-Color'
mat=bpy.data.materials.new('AO receiver');mat.use_nodes=True;ground.data.materials.append(mat)
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
rng=random.Random(721);verts=[];faces=[]
# Periodic copies across the tile edge preserve seamless occlusion at UV boundaries.
for _ in range(150):
 x=rng.uniform(-1,1);y=rng.uniform(-1,1);h=rng.uniform(.025,.09);w=.008;a=rng.random()*math.tau
 for ox in [-2,0,2]:
  for oy in [-2,0,2]:
   i=len(verts);verts.extend([(x+ox-w,y+oy,0),(x+ox+w,y+oy,0),(x+ox+math.cos(a)*.025,y+oy+math.sin(a)*.025,h)]);faces.append((i,i+1,i+2))
mesh=bpy.data.meshes.new('Blade occluders');mesh.from_pydata(verts,[],faces);obj=bpy.data.objects.new('Blade occluders',mesh);bpy.context.collection.objects.link(obj)
bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.bake.margin=4
bpy.ops.wm.save_as_mainfile(filepath=str(root/'tools/course-twin-blender/scenes/rough-ao.blend'))
bpy.ops.object.bake(type='AO')
image.filepath_raw=str(out/'rough-ao.png');image.file_format='PNG';image.save()
data=(out/'rough-ao.png').read_bytes();(out/'rough-ao.json').write_text(json.dumps(dict(licence='CC0-1.0',author='ForeKingHell original procedural bake',file='rough-ao.png',sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),channels='linear R ambient occlusion; no sunlight or albedo',metresPerTile=2,preset='neutral daylight; indirect only; fades 30 to 90 m'),indent=2)+'\n')
