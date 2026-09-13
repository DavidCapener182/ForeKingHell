"""Bounded, sequential OSM downloads for existing local courses; cached and reproducible."""
import pathlib,json,math,subprocess,xml.etree.ElementTree as E,hashlib,time
root=pathlib.Path.cwd();cache=root/'tools/course-twin-blender/.cache/context';cache.mkdir(exist_ok=True,parents=True)
report=[];total=0
for path in sorted((root/'src/generated/course-twins').glob('*.json')):
 m=json.loads(path.read_text())
 if not m.get('course') or not m.get('origin'): continue
 origin=m['origin'];points=[p for f in m['features'] if f['type'] in ['green','fairway','tee'] for ring in f['rings'] for p in ring]
 if not points: points=[p for h in m.get("holes",[]) for p in [h["tee"],h["green"]]]
 if not points: continue
 sx=111320*math.cos(math.radians(origin['latitude']));sy=111320
 bbox=[origin['longitude']+(min(p[0] for p in points)-100)/sx,origin['latitude']-(max(p[2] for p in points)+100)/sy,origin['longitude']+(max(p[0] for p in points)+100)/sx,origin['latitude']-(min(p[2] for p in points)-100)/sy]
 if (bbox[2]-bbox[0])*(bbox[3]-bbox[1])>.01: continue
 file=cache/f'{path.stem}.osm';url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(f'{n:.7f}' for n in bbox)
 if not file.exists():
  result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','25','--max-filesize','16000000','-A','ForeKingHellOfflineCourseContext/1.0',url,'-o',str(file)],capture_output=True)
  if result.returncode: report.append({'course':path.stem,'status':'unavailable'});print(path.stem,'unavailable',flush=True);continue
 total+=file.stat().st_size
 if total>160000000: break
 try: doc=E.parse(file).getroot()
 except E.ParseError: continue
 nodes={n.get('id'):{'lat':float(n.get('lat')),'lon':float(n.get('lon'))} for n in doc.findall('node')};elements=[]
 for w in doc.findall('way'):
  tags={t.get('k'):t.get('v') for t in w.findall('tag')};refs=[n.get('ref') for n in w.findall('nd')]
  if len(refs)<2 or not all(n in nodes for n in refs): continue
  is_road=tags.get('highway') in ['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street','pedestrian','footway','path','cycleway','track']
  if not is_road and (len(refs)<4 or refs[0]!=refs[-1]):continue
  kind=tags.get('golf')
  if kind not in ['green','bunker','tee','fairway','rough'] and 'building' not in tags and not is_road and tags.get('amenity')!='parking':continue
  if tags.get('building') in ['no','construction']:continue
  elements.append({'id':w.get('id'),'tags':tags,'geometry':[nodes[n] for n in refs]})
 output={'courseId':m['course']['id'],'sourceUrl':url,'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(file.stat().st_mtime)),'elements':elements}
 (cache/f'{path.stem}-context.json').write_text(json.dumps(output))
 report.append({'course':path.stem,'status':'downloaded','features':len(elements),'bytes':file.stat().st_size});print(path.stem,len(elements),'features',flush=True)
(cache/'download-report.json').write_text(json.dumps(report,indent=2))
