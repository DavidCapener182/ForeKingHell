"""Bake matching albedo/opacity impostors. No sun, environment or AO in colour.
Run from repository root with Blender --background --factory-startup --python.
Editable files stay in ignored scenes/. Outputs use the source models' CC0 licence.
"""
import bpy, pathlib, json, hashlib
from mathutils import Vector
root=pathlib.Path.cwd(); out=root/'public/course-twins/common/blender-v1'
ledger={a['id']:a for a in json.loads((root/'tools/course-twin-blender/assets.json').read_text())['assets']}
entries=[]
for asset in ['tree_small_02','shrub_04']:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    source=out/f'{asset}-near.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in meshes:
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes: continue
            nodes=mat.node_tree.nodes; links=mat.node_tree.links
            bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
            output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
            if not bsdf or not output: continue
            emission=nodes.new('ShaderNodeEmission'); emission.inputs['Strength'].default_value=1
            color=bsdf.inputs['Base Color']; alpha=bsdf.inputs['Alpha']
            if color.is_linked: links.new(color.links[0].from_socket,emission.inputs['Color'])
            else: emission.inputs['Color'].default_value=color.default_value
            transparent=nodes.new('ShaderNodeBsdfTransparent'); mix=nodes.new('ShaderNodeMixShader')
            if alpha.is_linked: links.new(alpha.links[0].from_socket,mix.inputs[0])
            else: mix.inputs[0].default_value=alpha.default_value
            links.new(transparent.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.samples=16; scene.cycles.transparent_max_bounces=32
    scene.render.film_transparent=True
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    camera_data=bpy.data.cameras.new('Albedo orthographic');camera=bpy.data.objects.new('Albedo orthographic',camera_data);scene.collection.objects.link(camera)
    camera.location=(0,-3,.5);camera.rotation_euler=(Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=1.05;scene.camera=camera
    scene.render.filepath=str(out/f'{asset}-impostor.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(root/f'tools/course-twin-blender/scenes/{asset}-impostor.blend'))
    bpy.ops.render.render(write_still=True)
    path=pathlib.Path(scene.render.filepath);data=path.read_bytes()
    entries.append(dict(file=path.name,source=source.name,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),licence='CC0-1.0',sourceUrl=ledger[asset]['sourcePage'],licenceReference=ledger[asset]['licenceReference'],channels='sRGB albedo + linear opacity; no direct lighting or AO',use='Matching distant vegetation'))
(out/'impostors.json').write_text(json.dumps(dict(schemaVersion=1,assets=entries),indent=2)+'\n')
