#!/usr/bin/env python3
"""One command: parallel Modal gait, honest route and stills, then labelled sheets.

python3 tools/review-capture.py s2-loco
Requires the target ref to contain the gait gym commit. No local browser runs.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from uuid import uuid4
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def contact_sheet(folder: Path):
    from PIL import Image, ImageDraw, ImageOps
    script_file = folder / 'gait-script.json'
    if script_file.exists():
        script = json.loads(script_file.read_text())
        entries = []
        for frame in script['keyFrames']:
            segment = next(s for s in script['segments'] if s['start'] <= frame < s['end'])
            entries.append((folder / f'gait-{frame:05d}.png', f"{segment['name']} | frame {frame}"))
    else:
        entries = [(p, p.stem) for p in sorted(folder.glob('*.png')) if 'contact' not in p.stem and p.stem not in {'cube', 'hardware-probe'}]
    entries = [(p, label) for p, label in entries if p.exists()]
    if not entries:
        return None
    cols, cell_w, cell_h = 4, 480, 300
    sheet = Image.new('RGB', (cols * cell_w, ((len(entries) + cols - 1) // cols) * cell_h), '#211b16')
    draw = ImageDraw.Draw(sheet)
    for index, (p, label) in enumerate(entries):
        x, y = index % cols * cell_w, index // cols * cell_h
        with Image.open(p) as source:
            thumb = ImageOps.contain(source.convert('RGB'), (cell_w, cell_h - 30))
            sheet.paste(thumb, (x + (cell_w - thumb.width) // 2, y + 26))
        draw.text((x + 8, y + 8), label, fill='#eadfc8')
    target = folder / 'contact-sheet.png'
    sheet.save(target)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ref', nargs='?', default='main')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--shots', default='gait,route,stills')
    parser.add_argument('--route-seconds', type=int, default=120)
    parser.add_argument('--sheet-only', type=Path, help='Build a sheet for an existing capture directory')
    args = parser.parse_args()
    if args.sheet_only:
        for folder in [args.sheet_only, *sorted(p for p in args.sheet_only.iterdir() if p.is_dir())]:
            sheet = contact_sheet(folder)
            if sheet:
                print(sheet)
        return
    shots = args.shots.split(',')
    if not shots or not set(shots) <= {'gait', 'route', 'stills', 'perf', 'orbit', 'probe', 'fox'}:
        parser.error('Unknown shot')
    # Exact remote branch name; immutable SHA inputs are also accepted.
    remote = subprocess.check_output(['git', 'ls-remote', '--heads', 'origin', f'refs/heads/{args.ref}'], cwd=ROOT, text=True).splitlines()
    matches = [line.split()[0] for line in remote if line.split()[1] == f'refs/heads/{args.ref}']
    if len(matches) == 1:
        ref = matches[0]
    elif re.fullmatch(r'[0-9a-fA-F]{40}', args.ref):
        ref = args.ref
    else:
        ref = subprocess.check_output(['git', 'rev-parse', '--verify', f'{args.ref}^{{commit}}'], cwd=ROOT, text=True).strip()
    print(f'Reviewing remote ref {args.ref} at immutable commit {ref}', flush=True)
    destination = args.out.resolve() if args.out else Path('/workspace/siyu/playtest-forge-artifacts/sprint2/capture') / f"{re.sub(r'[^a-zA-Z0-9_.-]', '_', args.ref)}-{datetime.now():%Y%m%d-%H%M%S}-{uuid4().hex[:6]}"
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'review.json').write_text(json.dumps({'ref': args.ref, 'commit': ref, 'shots': args.shots}, indent=2))

    def capture(shot):
        folder = destination / shot
        folder.mkdir(parents=True, exist_ok=True)
        command = ['modal', 'run', 'tools/modal/gpu_capture.py', '--ref', ref, '--shots', shot, '--route-seconds', str(args.route_seconds), '--out', str(folder)]
        print(f'Starting {shot}: {folder}', flush=True)
        with (folder / 'modal.log').open('w') as log:
            result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        sheet, sheet_error = None, None
        try:
            sheet = contact_sheet(folder)
            metadata = json.loads((folder / 'run.json').read_text())
            if metadata['commit'] != ref or metadata['shots'] != shot:
                raise ValueError('Fetched capture belongs to a different commit or shot')
        except Exception as error:
            sheet_error = str(error)
        print(f"{shot}: exit={result.returncode or (1 if sheet_error else 0)}; sheet={sheet}; files={folder}; error={sheet_error}", flush=True)
        return {'shot': shot, 'exit': result.returncode or (1 if sheet_error else 0), 'sheetError': sheet_error, 'path': str(folder), 'sheet': str(sheet) if sheet else None}

    with ThreadPoolExecutor(max_workers=min(3, len(shots))) as pool:
        results = list(pool.map(capture, shots))
    (destination / 'results.json').write_text(json.dumps(results, indent=2))
    print(f'Review commit: {ref}\nArtifacts: {destination}', flush=True)
    if any(result['exit'] for result in results):
        sys.exit(1)


if __name__ == '__main__':
    main()
