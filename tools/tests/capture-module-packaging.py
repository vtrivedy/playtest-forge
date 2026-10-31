"""Check literal capture-module dependencies against Modal mounts without importing either runtime."""
import ast
import posixpath
import re
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'tools'
manifest = ast.parse((TOOLS / 'modal/gpu_capture.py').read_text())
# Run only the local-file mount block against a recorder. No Modal import,
# image build, browser, network, or real environment access occurs.
class ImageRecorder:
    def __init__(self):
        self.mounts = {}

    def add_local_file(self, local, remote):
        assert Path(local).is_file(), f'Missing mounted source: {local}'
        if remote in self.mounts:
            raise AssertionError(f'Duplicate capture mount: {remote}')
        self.mounts[remote] = Path(local).resolve()
        return self

recorder = ImageRecorder()
blocks = [node for node in manifest.body
          if isinstance(node, ast.If) and ast.unparse(node.test) == 'modal.is_local()']
if len(blocks) != 1:
    raise AssertionError('Expected one local capture-file mount block')
scope = {'ROOT': ROOT, 'Path': Path, 'image': recorder,
         'os': SimpleNamespace(environ={})}
exec(compile(ast.Module(body=blocks[0].body, type_ignores=[]),
             str(TOOLS / 'modal/gpu_capture.py'), 'exec'), scope)
mounts = recorder.mounts
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
    if remote not in mounts or mounts[remote] != local:
        missing.append((str(local.relative_to(ROOT)), remote))
    for specifier in imports.findall(local.read_text()):
        pending.append((local.parent / specifier, posixpath.normpath(posixpath.join(posixpath.dirname(remote), specifier))))
if missing:
    raise AssertionError(f'Unpackaged capture modules: {missing}')
print(f'PASS: {len(visited)} capture modules packaged; no browser or Modal runtime started')
