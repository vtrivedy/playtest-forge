"""Check literal capture-module dependencies against Modal mounts without importing either runtime."""
import ast
import posixpath
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'tools'
manifest = ast.parse((TOOLS / 'modal/gpu_capture.py').read_text())
mounts = {
    call.args[1].value
    for call in ast.walk(manifest)
    if isinstance(call, ast.Call)
    and isinstance(call.func, ast.Attribute)
    and call.func.attr == 'add_local_file'
    and len(call.args) > 1
    and isinstance(call.args[1], ast.Constant)
    and isinstance(call.args[1].value, str)
}
# The canonical wrapper computes destinations from a glob. Recognize its exact
# mount expression without importing Modal or evaluating arbitrary Python.
for loop in ast.walk(manifest):
    if not isinstance(loop, ast.For) or not isinstance(loop.target, ast.Name):
        continue
    variable = loop.target.id
    expected_iterator = ast.parse("sorted((ROOT / 'tools').glob('*.mjs'))", mode='eval').body
    expected_mount = ast.parse(
        f"image.add_local_file(selected_module, f'/opt/browser/{{{variable}.name}}')", mode='eval'
    ).body
    if ast.dump(loop.iter) != ast.dump(expected_iterator):
        continue
    if any(ast.dump(node) == ast.dump(expected_mount) for node in ast.walk(loop)):
        mounts.update(f'/opt/browser/{module.name}' for module in TOOLS.glob('*.mjs'))
imports = re.compile(r'''(?:from\s*|import\s*\()\s*['"](\.{1,2}/[^'"]+\.mjs)['"]''')
pending = [(TOOLS / 'gpu-capture.mjs', '/opt/browser/gpu-capture.mjs')]
visited = set()
missing = []
while pending:
    local, remote = pending.pop()
    local = local.resolve()
    if (local, remote) in visited:
        continue
    visited.add((local, remote))
    if not local.is_relative_to(TOOLS.resolve()):
        raise AssertionError(f'Capture helper escapes tools directory: {local.name}')
    if not local.is_file():
        raise AssertionError(f'Missing source helper: {local.relative_to(ROOT)}')
    if remote not in mounts:
        missing.append((str(local.relative_to(ROOT)), remote))
    for specifier in imports.findall(local.read_text()):
        pending.append((local.parent / specifier, posixpath.normpath(posixpath.join(posixpath.dirname(remote), specifier))))
if missing:
    raise AssertionError(f'Unpackaged capture modules: {missing}')
print(f'PASS: {len(visited)} capture modules packaged; no browser or Modal runtime started')
