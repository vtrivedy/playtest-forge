# Hero v2 rig stage — exec'd inside build_hero_v2.py after the look/anim stages, right before export.
# Converts the CC0-derived skeleton into the game rig contract
# (playtest-forge-artifacts/sprint2/fox/RIG-CONTRACT.md, games/fox-spirit/src/foxRig.ts):
# three.js-safe names, root at the ground, pelvis + 4-bone spine, scapulae on the chest, ears on the head,
# toe-tip paw bones, normalised rolls (local +X = fox's left on every chain bone).
# Every clip is re-baked exactly: each new bone keeps the deformation (pose @ rest^-1) of its source bone.

RENAME = {
    "Back": "pelvis", "Torso": "spine_01", "Torso2": "spine_02", "Torso3": "spine_04",
    "Neck1": "neck_01", "Neck2": "neck_02", "Neck3": "neck_03", "Head": "head",
    "FxNeck": "fx_nape", "FxBib": "fx_bib",
    "FxPlumeA": "fx_plume_a", "FxPlumeB": "fx_plume_b", "FxPlumeC": "fx_plume_c",
}
for i in range(1, 9): RENAME[f"Tail{i}"] = f"tail_{i:02d}"
for S in "LR":
    s = S.lower()
    for i in range(1, 5): RENAME[f"Ear{i}.{S}"] = f"ear_{i:02d}_{s}"
    RENAME.update({
        f"FxEar.{S}": f"fx_ear_{s}", f"FxCheek.{S}": f"fx_cheek_{s}",
        f"FrontShoulder.{S}": f"scapula_{s}", f"FrontUpperLeg.{S}": f"upperarm_{s}",
        f"FrontLowerLeg.{S}": f"forearm_{s}", f"FrontPaw.{S}": f"front_paw_{s}",
        f"BackShoulder.{S}": f"hip_{s}", f"BackLeg.{S}": f"thigh_{s}", f"BackUpperLeg.{S}": f"shin_{s}",
        f"BackLowerLeg.{S}": f"hind_foot_{s}", f"BackPaw.{S}": f"hind_paw_{s}",
    })
# new bones: name -> source bone whose deformation they inherit in the re-bake (None = static)
SRC = {new: old for old, new in RENAME.items()}
SRC.update({"root": None, "spine_03": "Torso2"})

assert arm.matrix_world == Matrix.Identity(4), "rig stage assumes an identity armature transform"
MESHES = [o for o in sc.objects if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]

# ---------------------------------------------------------------- 1. record every clip in armature space
OLD_REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
CLIPS = {}
for act in [a for a in bpy.data.actions if not a.name.endswith("_AnimalArmature")]:
    f0, f1 = (int(round(x)) for x in act.frame_range)
    arm.animation_data.action = act
    frames = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        frames.append({pb.name: pb.matrix.copy() for pb in arm.pose.bones})
    CLIPS[act.name] = (f0, frames)
arm.animation_data.action = None
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
sc.frame_set(0)

# ---------------------------------------------------------------- 2. restructure the skeleton
GROUND = min((o.matrix_world @ v.co).z for o in MESHES if o.name == "SpiritFox_Body" for v in o.data.vertices)
def toe_y(group):  # most forward (-y) point of a paw's skin = toe tip
    o = fox; gi = o.vertex_groups[group].index
    return min(v.co.y for v in o.data.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups))
TOE = {n: toe_y(n) for S in "LR" for n in (f"FrontPaw.{S}", f"BackPaw.{S}")}

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
EB = arm.data.edit_bones
for b in [b for b in EB if b.name not in RENAME and b.name != "Body"]:
    EB.remove(b)  # IK / pole helpers of the CC0 rig (no deform weights)
root = EB.new("root"); root.head = (0, 0, GROUND); root.tail = (0, -0.4, GROUND); root.roll = 0
root.use_deform = False
EB["Back"].parent = root
EB["Back"].tail = EB["Torso"].head.copy()  # pelvis points forward into the spine
EB.remove(EB["Body"])
t2 = EB["Torso2"]; mid = (t2.head + t2.tail) / 2
s3 = EB.new("spine_03"); s3.head = mid; s3.tail = t2.tail.copy(); s3.parent = t2; s3.use_deform = True
t2.tail = mid; s3.use_connect = True
EB["Torso3"].parent = s3
for S in "LR":
    EB[f"Ear1.{S}"].parent = EB["Head"]
    sh = EB[f"FrontShoulder.{S}"]; ua = EB[f"FrontUpperLeg.{S}"]
    sh.parent = EB["Torso3"]
    sh.head = Vector((ua.head.x * 0.55, ua.head.y + 0.14, ua.head.z + 0.42)); sh.tail = ua.head.copy()  # blade from the withers
    for p in (f"FrontPaw.{S}", f"BackPaw.{S}"):
        b = EB[p]; b.tail = Vector((b.head.x, TOE[p], GROUND))
X = Vector((1, 0, 0))
for b in EB:
    d = (b.tail - b.head).normalized()
    if abs(d.dot(X)) < 0.85: b.align_roll(X.cross(d))  # local +X = fox's left (lateral hip/fx stubs keep theirs)
for old, new in RENAME.items(): EB[old].name = new
bpy.ops.object.mode_set(mode="OBJECT")
NEW_REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
assert set(NEW_REST) == set(SRC), set(NEW_REST) ^ set(SRC)

# ---------------------------------------------------------------- 3. skin weights follow the contract
sp2 = arm.data.bones["spine_02"]; H = sp2.head_local; T = sp2.tail_local + (sp2.tail_local - sp2.head_local)
for o in MESHES:
    for old, new in RENAME.items():
        g = o.vertex_groups.get(old)
        if g: g.name = new
    body_g = o.vertex_groups.get("Body")
    if body_g: o.vertex_groups.remove(body_g)  # no skin on the CC0 root (checked)
    g2 = o.vertex_groups.get("spine_02")
    if not g2: continue
    g3 = o.vertex_groups.new(name="spine_03")
    for v in o.data.vertices:
        w = next((g.weight for g in v.groups if g.group == g2.index), 0.0)
        if w <= 0: continue
        co = o.matrix_world @ v.co
        k = smooth(0.3, 0.7, (co - H).dot(T - H) / (T - H).length_squared)  # along the old Torso2 length
        g2.add([v.index], w * (1 - k), "REPLACE"); g3.add([v.index], w * k, "REPLACE")

# ---------------------------------------------------------------- 4. re-bake the clips
ORDER = [b.name for b in arm.data.bones]  # parents before children
PARENT = {b.name: b.parent.name if b.parent else None for b in arm.data.bones}
for name, (f0, frames) in CLIPS.items():
    act = bpy.data.actions.new(name); act.use_fake_user = True; act.id_root = "OBJECT"
    fcs = {}
    for bn in ORDER:
        for path, n in (("location", 3), ("rotation_quaternion", 4), ("scale", 3)):
            for i in range(n):
                fc = act.fcurves.new(f'pose.bones["{bn}"].{path}', index=i, action_group=bn)
                fc.keyframe_points.add(len(frames)); fcs[(bn, path, i)] = fc
    prevq = {}
    for fi, old in enumerate(frames):
        pose = {}
        for bn in ORDER:
            src = SRC[bn]
            pose[bn] = NEW_REST[bn] if src is None else old[src] @ OLD_REST[src].inverted() @ NEW_REST[bn]
            par = PARENT[bn]
            local = NEW_REST[bn].inverted() @ (pose[bn] if par is None else
                                                NEW_REST[par] @ pose[par].inverted() @ pose[bn])
            loc, q, scl_ = local.decompose()
            if bn in prevq and q.dot(prevq[bn]) < 0: q.negate()
            prevq[bn] = q
            for path, vals in (("location", loc), ("rotation_quaternion", q), ("scale", scl_)):
                for i, val in enumerate(vals):
                    fcs[(bn, path, i)].keyframe_points[fi].co = (f0 + fi, val)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
        fc.update()
for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"; pb.matrix_basis.identity()
print("RIG", len(ORDER), "bones,", len(CLIPS), "clips re-baked, ground", round(GROUND, 3))
