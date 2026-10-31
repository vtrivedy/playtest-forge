"""Check literal capture-module dependencies against Modal mounts without importing either runtime."""
import ast
import posixpath
import re
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'tools'
manifest = ast.parse((TOOLS / 'modal/gpu_capture.py').read_text())
mounts = set()
class RecordingImage:
    def add_local_file(self, local, remote):
        assert Path(local).is_file(), f'Missing mounted source: {local}'
        assert remote not in mounts, f'Duplicate capture mount: {remote}'
        mounts.add(remote)
        return self

mount_blocks = [node for node in manifest.body if isinstance(node, ast.If)
                and ast.unparse(node.test) == 'modal.is_local()']
assert len(mount_blocks) == 1, 'Expected one local capture-module mount block'
# Execute only mount declarations with inert stubs, never the Modal runtime or real environment.
exec(compile(ast.Module(body=mount_blocks, type_ignores=[]), '<capture-mount-check>', 'exec'), {
    'ROOT': ROOT, 'Path': Path, 'image': RecordingImage(),
    'modal': SimpleNamespace(is_local=lambda: True),
    'os': SimpleNamespace(environ={}),
})
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
