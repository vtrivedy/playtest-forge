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
# The current image mounts every top-level .mjs helper. Recognize that exact
# loop/destination shape without importing Modal or executing its configuration.
for loop in ast.walk(manifest):
    if not isinstance(loop, ast.For) or not isinstance(loop.target, ast.Name):
        continue
    globs = [node for node in ast.walk(loop.iter) if isinstance(node, ast.Call)
             and isinstance(node.func, ast.Attribute) and node.func.attr == 'glob'
             and isinstance(node.func.value, ast.BinOp) and isinstance(node.func.value.op, ast.Div)
             and isinstance(node.func.value.left, ast.Name) and node.func.value.left.id == 'ROOT'
             and isinstance(node.func.value.right, ast.Constant) and node.func.value.right.value == 'tools'
             and len(node.args) == 1 and isinstance(node.args[0], ast.Constant) and node.args[0].value == '*.mjs']
    if not globs:
        continue
    for call in ast.walk(loop):
        if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute)
                and call.func.attr == 'add_local_file' and len(call.args) > 1):
            continue
        destination = call.args[1]
        if (isinstance(destination, ast.JoinedStr) and len(destination.values) == 2
                and isinstance(destination.values[0], ast.Constant) and destination.values[0].value == '/opt/browser/'
                and isinstance(destination.values[1], ast.FormattedValue)
                and ast.unparse(destination.values[1].value) == f'{loop.target.id}.name'):
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
