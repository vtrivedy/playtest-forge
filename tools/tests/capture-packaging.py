"""CPU-only guard for statically imported GPU capture helper packaging."""
import ast
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
entrypoint = root / 'tools/modal/gpu_capture.py'
tree = ast.parse(entrypoint.read_text())
mounts = {}
for node in ast.walk(tree):
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute) or node.func.attr != 'add_local_file':
        continue
    destination = ast.literal_eval(node.args[1])
    mounts.setdefault(destination, []).append(node.args[0])
assert all(len(sources) == 1 for sources in mounts.values()), 'Duplicate Modal file destination'
pending = [root / 'tools/gpu-capture.mjs']
visited = set()
while pending:
    module = pending.pop()
    if module in visited:
        continue
    visited.add(module)
    assert module.is_file(), f'Missing imported source: {module}'
    for relative in re.findall(r'''(?:from\s*|import\s*)['"](\./[^'"]+\.mjs)['"]''', module.read_text()):
        source = (module.parent / relative).resolve()
        destination = '/opt/browser/' + source.name
        assert destination in mounts, f'Unpackaged static capture import: {source.name}'
        expression = mounts[destination][0]
        assert isinstance(expression, ast.BinOp) and isinstance(expression.op, ast.Div), f'Expected explicit repo source for {destination}'
        assert isinstance(expression.left, ast.Name) and expression.left.id == 'ROOT'
        packaged_source = root / ast.literal_eval(expression.right)
        assert packaged_source.resolve() == source, f'Wrong source mounted for {destination}'
        pending.append(source)
print(f'Capture packaging PASS: {len(visited)-1} imported helper modules, unique mounts, existing matching sources, Python syntax.')
