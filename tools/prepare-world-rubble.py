"""Prepare small CC0 Poly Haven rubble silhouettes; no textures needed by the realm material.
Vertex clustering in a 4%-of-width grid retains the uneven silhouette at dressing scale.
"""
import json, struct, math
from pathlib import Path
source = Path('assets/library/models/nature/rock_moss_set_01.glb')
b = source.read_bytes()
n, _ = struct.unpack_from('<II', b, 12)
j = json.loads(b[20:20+n])
data = b[28+n:]

def read(index):
    a = j['accessors'][index]; v = j['bufferViews'][a['bufferView']]
    count = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
    step = v.get('byteStride', struct.calcsize(fmt) * count)
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<'+fmt*count, data, offset+i*step) for i in range(a['count'])]

out = bytearray(); views=[]; access=[]; meshes=[]
def add(values, kind):
    while len(out)%4: out.append(0)
    flat = [x for row in values for x in row]
    raw = struct.pack('<'+'f'*len(flat), *flat)
    views.append({'buffer':0,'byteOffset':len(out),'byteLength':len(raw)})
    out.extend(raw)
    a={'bufferView':len(views)-1,'componentType':5126,'count':len(values),'type':kind}
    if kind=='VEC3': a.update(min=[min(row[k] for row in values) for k in range(3)], max=[max(row[k] for row in values) for k in range(3)])
    access.append(a); return len(access)-1

for mesh in j['meshes']:
    prim=mesh['primitives'][0]; points=read(prim['attributes']['POSITION']); inds=[x[0] for x in read(prim['indices'])]
    lo=[min(p[k] for p in points) for k in range(3)]; hi=[max(p[k] for p in points) for k in range(3)]
    cell=max(hi[0]-lo[0],hi[2]-lo[2])*.04
    groups={}; remap=[]
    for p in points:
        key=tuple(round(x/cell) for x in p)
        if key not in groups:groups[key]=[len(groups),[0.,0.,0.],0]
        g=groups[key]; remap.append(g[0]);g[2]+=1
        for k in range(3):g[1][k]+=p[k]
    verts=[tuple(x/g[2] for x in g[1]) for g in groups.values()]
    ps=[]; ns=[]; seen=set()
    for i in range(0,len(inds),3):
        ids=tuple(remap[x] for x in inds[i:i+3])
        if len(set(ids))<3 or tuple(sorted(ids)) in seen:continue
        seen.add(tuple(sorted(ids)))
        a,c,d=[verts[x] for x in ids];u=[c[k]-a[k] for k in range(3)];v=[d[k]-a[k] for k in range(3)]
        norm=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(x*x for x in norm))
        if length<1e-10:continue
        normal=tuple(x/length for x in norm)
        ps.extend([a,c,d]);ns.extend([normal]*3)
    meshes.append({'name':mesh['name'],'primitives':[{'attributes':{'POSITION':add(ps,'VEC3'),'NORMAL':add(ns,'VEC3')}}]})
    print(mesh['name'],len(inds)//3,'->',len(ps)//3,'triangles')
new={'asset':{'version':'2.0','generator':'CC0 Poly Haven rubble clustering'},'buffers':[{'byteLength':len(out)}],'bufferViews':views,'accessors':access,'meshes':meshes,'nodes':j['nodes'],'scenes':j['scenes'],'scene':j.get('scene',0)}
raw=json.dumps(new,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);out+=b'\0'*((-len(out))%4)
result=struct.pack('<III',0x46546C67,2,28+len(raw)+len(out))+struct.pack('<II',len(raw),0x4E4F534A)+raw+struct.pack('<II',len(out),0x004E4942)+out
Path('assets/library/models/ruins/moss_rubble.glb').write_bytes(result)
