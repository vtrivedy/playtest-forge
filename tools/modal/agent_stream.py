"""Detached CPU agent streams. See tools/modal/README.md. No secrets in images."""
from pathlib import Path
import json
import os
import re
import shlex
import subprocess
import time

import modal

app = modal.App('fox-agent-launcher')
volume = modal.Volume.from_name('fox-agent-streams', create_if_missing=True)
registry = modal.Dict.from_name('fox-agent-stream-registry', create_if_missing=True)
REPO = 'https://github.com/vtrivedy/playtest-forge.git'
ACTIVE = {'starting', 'running', 'stopping'}


def validate(stream, model, branch):
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}', stream):
        raise ValueError('stream must be 1–48 lowercase letters/digits/hyphens')
    if model not in {'sol', 'opus'}:
        raise ValueError('model must be sol or opus')
    if not re.fullmatch(r's2-[a-z0-9][a-z0-9-]{0,60}', branch):
        raise ValueError('branch must be a simple s2-* name')


def credentials():
    """Read only explicit auth sources; never return these to terminal/logs."""
    secrets = {'GH_TOKEN': os.environ.get('FOX_GH_TOKEN') or subprocess.check_output(['gh', 'auth', 'token'], text=True).strip()}
    auth = Path.home() / '.codex/auth.json'
    if auth.exists():
        secrets['FOX_CODEX_AUTH'] = auth.read_text()
    claude = Path.home() / '.config/secrets/claude.env'
    if claude.exists():
        for line in claude.read_text().splitlines():
            words = shlex.split(line, comments=True)
            if words and words[0] == 'export':
                words = words[1:]
            if len(words) == 1 and '=' in words[0]:
                key, value = words[0].split('=', 1)
                if key in {'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'}:
                    secrets[key] = value
    return secrets


def run_stream(stream: str, model: str, branch: str, brief: str, duration: int):
    """Remote worker; only runtime env carries secrets."""
    import signal
    import threading
    import shutil
    import traceback

    validate(stream, model, branch)
    out = Path('/streams') / stream
    out.mkdir(parents=True, exist_ok=True)
    shutil.chown(out, user='agent', group='agent')
    out.chmod(0o700)
    repo = Path('/home/agent/game')
    auth = Path('/home/agent/.codex/auth.json')
    ask = Path('/tmp/fox-git-askpass')
    state = dict(registry[stream])
    start = time.monotonic()
    proc = None
    thread = None
    gate = threading.RLock()
    done = threading.Event()
    log_path = out / 'agent.log'
    def interrupted(*_):
        raise SystemExit(143)
    signal.signal(signal.SIGTERM, interrupted)
    sensitive = [v for k, v in os.environ.items() if k in {
        'GH_TOKEN', 'FOX_CODEX_AUTH', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'} and v]
    def scalars(obj):
        if isinstance(obj, dict):
            for value in obj.values():
                yield from scalars(value)
        elif isinstance(obj, str) and len(obj) > 20:
            yield obj
    if os.environ.get('FOX_CODEX_AUTH'):
        sensitive.extend(scalars(json.loads(os.environ['FOX_CODEX_AUTH'])))
    sensitive.sort(key=len, reverse=True)
    def emit(message):
        for value in sensitive:
            message = message.replace(value, '[REDACTED]')
        try:
            with gate:
                fd = os.open(log_path, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o644)
                with os.fdopen(fd, 'a') as log:
                    log.write(message.rstrip() + '\n')
        except OSError:
            print('LOG_WRITE_FAILED', flush=True)
    def save(**updates):
        import tempfile
        with gate:
            state.update(updates)
            snapshot = state.copy()
            registry[stream] = snapshot
            fd, temp_name = tempfile.mkstemp(prefix='.status-', dir=out)
            with os.fdopen(fd, 'w') as handle:
                json.dump(snapshot, handle, indent=2)
            os.replace(temp_name, out / 'status.json')
            volume.commit()
            try:
                volume.reload()
            except Exception:
                emit('RELOAD_DEFERRED: an artifact may still be open; retry next heartbeat')
    env = {key: os.environ[key] for key in ('PATH', 'LANG', 'TERM', 'GH_TOKEN',
           'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN') if key in os.environ}
    env.update(GIT_ASKPASS=str(ask), GIT_TERMINAL_PROMPT='0', CODEX_HOME='/home/agent/.codex',
               HOME='/home/agent', USER='agent')
    def kill_group(pid, sig):
        try:
            os.killpg(pid, sig)
        except ProcessLookupError:
            pass
    def command(args, check=True, install=False, timeout=240):
        child_env = env
        if install:
            child_env = {key: value for key, value in env.items() if key in {'PATH', 'LANG', 'TERM', 'HOME', 'USER'}}
        child = subprocess.Popen(['runuser', '-u', 'agent', '--', *args], cwd=repo if repo.exists() else '/home/agent',
                                 env=child_env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            output, _ = child.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            kill_group(child.pid, signal.SIGKILL)
            child.stdout.close()
            child.wait(timeout=5)
            raise RuntimeError(f'{args[0]} timed out') from None
        emit(output)
        result = subprocess.CompletedProcess(args, child.returncode, output)
        if check and result.returncode:
            raise RuntimeError(f'{args[0]} exited {result.returncode}')
        return result
    def push():
        head = command(['git', 'rev-parse', 'HEAD'], check=False, timeout=20)
        if head.returncode:
            return
        sha = head.stdout.strip()
        result = command(['git', 'push', 'origin', f'{sha}:refs/heads/{branch}'], check=False, timeout=20)
        if result.returncode == 0:
            state.update(last_push=sha, last_push_at=time.time())
            emit(f'BACKUP_PUSH {branch} {sha}')
        else:
            rescue = f'{branch}-rescue-{int(state["created"])}'
            result = command(['git', 'push', 'origin', f'{sha}:refs/heads/{rescue}'], check=False, timeout=20)
            if result.returncode == 0:
                state.update(rescue_branch=rescue, last_push=sha, last_push_at=time.time())
                emit(f'RESCUE_PUSH {rescue} {sha}')
            else:
                command(['git', 'bundle', 'create', str(out / 'unpushed.bundle'), '--all'], timeout=30)
                emit('BACKUP_PUSH_FAILED; committed history preserved in unpushed.bundle')
    def terminate():
        if proc is not None:
            # Descendants can keep stdout open after their parent exits.
            kill_group(proc.pid, signal.SIGTERM)
            subprocess.run(['pkill', '-TERM', '-u', 'agent'], check=False, capture_output=True)
            done.wait(2)
            kill_group(proc.pid, signal.SIGKILL)
            subprocess.run(['pkill', '-KILL', '-u', 'agent'], check=False, capture_output=True)
            proc.wait(timeout=5)
    def stop_requested():
        return registry.get(f'{stream}:stop') is not None
    def setup_stop_check():
        if stop_requested() or time.monotonic() - start >= duration:
            state['stop_reason'] = 'requested' if stop_requested() else 'duration'
            raise SystemExit(0)
    def monitor():
        last_push = time.monotonic()
        while not done.wait(30):
            try:
                requested = stop_requested()
                expired = time.monotonic() - start >= duration
                if proc.poll() is not None:
                    emit('AGENT_EXITED; closing leftover descendants')
                    terminate()
                    return
                if requested or expired:
                    state['stop_reason'] = 'requested' if requested else 'duration'
                    emit('STOP_REQUESTED' if requested else 'DURATION_EXPIRED')
                    terminate()
                    return
                if time.monotonic() - last_push >= 300:
                    push()
                    last_push = time.monotonic()
                save(heartbeat=time.time())
            except Exception as exc:
                emit(f'HEARTBEAT_ERROR {type(exc).__name__}')
    try:
        emit(f'START {stream} {model} {branch}')
        ask.write_text('#!/bin/sh\ncase "$1" in *Username*) echo x-access-token;; *) printf "%s\\n" "$GH_TOKEN";; esac\n')
        ask.chmod(0o755)
        auth.parent.mkdir(parents=True, exist_ok=True)
        if os.environ.get('FOX_CODEX_AUTH'):
            fd = os.open(auth, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as handle:
                handle.write(os.environ.pop('FOX_CODEX_AUTH'))
            shutil.chown(auth, user='agent', group='agent')
        shutil.chown(auth.parent, user='agent', group='agent')
        save(status='starting')
        setup_stop_check()
        command(['git', 'clone', '--single-branch', '--branch', 'main', REPO, str(repo)])
        setup_stop_check()
        command(['git', 'config', 'user.name', 'Fox Remote Agent'])
        command(['git', 'config', 'user.email', 'fox-agent@users.noreply.github.com'])
        found = command(['git', 'ls-remote', '--exit-code', '--heads', 'origin', branch], check=False)
        if found.returncode == 0:
            command(['git', 'fetch', 'origin', f'{branch}:refs/remotes/origin/{branch}'])
            command(['git', 'checkout', '-b', branch, f'origin/{branch}'])
        elif found.returncode == 2:
            command(['git', 'checkout', '-b', branch, 'origin/main'])
        else:
            raise RuntimeError('Cannot determine remote branch state')
        push()
        setup_stop_check()
        command(['npm', 'ci', '--no-audit', '--no-fund'], install=True)
        setup_stop_check()
        context = f'''You are remote stream {stream}, model {model}, on branch {branch} in /home/agent/game.
Artifacts: /streams/{stream}/artifacts (persistent Modal volume). Never read/print credentials or env dumps.
Write DESIGN.md or a scoped design document before editing code. Commit often; supervisor backs up existing commits every 5min.
Work only on {branch}; never switch branches. Run tsc and fox Vite build for game changes. Never force push.
No local browser/render. For GPU review write /streams/{stream}/capture-request.json containing ref (immutable pushed SHA), shots, reason.
The driver runs tools/modal/gpu_capture.py and provides review evidence through /streams/{stream}/feedback.md.
Re-read feedback.md every few minutes if present. Do not claim visual quality or merge game changes until you personally inspect captured PNGs and window.__game reports.
If waiting for captures, commit/push and write STATUS.md; keep examining assets and code. Finish with DONE.md in artifacts.
Soft gentle animated realism; original burnt-orange fox spirit, warm autumn sepia, painterly restraint. Free/CC0 assets only, no API key.
Your task follows:\n{brief}'''
        (out / 'brief.md').write_text(context)
        command_args = (['codex', 'exec', '-m', 'gpt-6.1-sol', '--dangerously-bypass-approvals-and-sandbox', '--color', 'never', '-']
                        if model == 'sol' else ['claude', '-p', '--model', 'claude-opus-5-5', '--dangerously-skip-permissions', '--verbose', '--output-format', 'stream-json'])
        save(status='running', started=time.time())
        proc = subprocess.Popen(['runuser', '-u', 'agent', '--', *command_args], cwd=repo, env=env,
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
        proc.stdin.write(context)
        proc.stdin.close()
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()
        for line in proc.stdout:
            emit(line)
        code = proc.wait()
        done.set()
        thread.join(timeout=90)
        state.update(status='stopped' if (state.get('stop_reason') or stop_requested()) else ('complete' if code == 0 else 'failed'), exit_code=code)
    except BaseException:
        emit(traceback.format_exc())
        state['status'] = 'stopped' if state.get('stop_reason') or stop_requested() else 'failed'
        raise
    finally:
        done.set()
        if thread is not None:
            thread.join(timeout=90)
        for cleanup in (terminate, lambda: push() if (repo / '.git').exists() else None,
                        lambda: auth.unlink(missing_ok=True), lambda: ask.unlink(missing_ok=True)):
            try:
                cleanup()
            except Exception as exc:
                emit(f'CLEANUP_ERROR {type(exc).__name__}')
        # Keep checkout until container teardown; a failed final push must not delete commits.
        try:
            save(ended=time.time())
        except Exception as exc:
            emit(f'FINAL_SAVE_ERROR {type(exc).__name__}')
        finally:
            volume.commit()
            if registry.get(f'branch:{branch}') == stream:
                registry.pop(f'branch:{branch}', None)


@app.local_entrypoint()
def main(stream: str = '', model: str = 'sol', branch: str = '', brief: str = '',
         list: bool = False, stop: str = '', duration: int = 9000):
    if list:
        for name, entry in registry.items():
            if ':' in name:
                continue
            launched = registry.get(f'{name}:launch', {})
            print(json.dumps({'stream': name, **entry, **launched, 'stop_requested': registry.get(f'{name}:stop') is not None,
                              'heartbeat_age_s': round(time.time() - entry.get('heartbeat', entry['created']))}))
        return
    if stop:
        entry = registry.get(stop)
        if entry is None:
            raise ValueError('Unknown stream')
        if entry['status'] in ACTIVE:
            registry[f'{stop}:stop'] = time.time()
        entry = {**entry, **registry.get(f'{stop}:launch', {})}
        print(f'Stop requested for {stop}; allow 30s plus final push. Emergency: modal app stop {entry.get("app_id", "APP_ID")}')
        return
    branch = branch or f's2-{stream}'
    validate(stream, model, branch)
    if not 60 <= duration <= 9000:
        raise ValueError('duration must be 60–9000 seconds')
    if not brief:
        raise ValueError('--brief path-or-text is required')
    try:
        prompt = Path(brief).read_text() if '\n' not in brief and len(brief) < 240 and Path(brief).is_file() else brief
    except OSError:
        prompt = brief
    secrets = credentials()
    if model == 'sol' and 'FOX_CODEX_AUTH' not in secrets:
        raise ValueError('Missing ~/.codex/auth.json')
    if model == 'opus' and not any(key in secrets for key in {'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'}):
        raise ValueError('Missing Claude auth in ~/.config/secrets/claude.env')
    entry = {'status': 'starting', 'model': model, 'branch': branch, 'created': time.time()}
    if not registry.put(stream, entry, skip_if_exists=True):
        raise ValueError('Stream name already used; choose a new name (logs are retained)')
    branch_key = f'branch:{branch}'
    if not registry.put(branch_key, stream, skip_if_exists=True):
        registry[stream] = {**entry, 'status': 'launch-failed'}
        raise ValueError('Branch already reserved by another stream')
    call = None
    try:
        image = (modal.Image.from_registry('node:22-bookworm-slim', add_python='3.12')
                 .apt_install('git', 'curl', 'ripgrep', 'util-linux', 'ca-certificates', 'procps')
                 .run_commands('npm install -g @openai/codex@0.165.0 @anthropic-ai/claude-code@2.1.312',
                               'useradd --create-home --uid 1000 agent || useradd --create-home agent')
                 .pip_install('modal==1.6.3'))
        worker_app = modal.App(f'fox-agent-{stream}')
        worker = worker_app.function(image=image, cpu=2, memory=4096, timeout=duration + 300,
                                     volumes={'/streams': volume}, secrets=[modal.Secret.from_dict(secrets)],
                                     max_containers=1, retries=0)(run_stream)
        with modal.enable_output(), worker_app.run(detach=True):
            call = worker.spawn(stream, model, branch, prompt, duration)
            registry[f'{stream}:launch'] = {'app_id': worker_app.app_id, 'call_id': call.object_id}
            print(f'STREAM {stream} APP {worker_app.app_id} CALL {call.object_id}')
            print(f'Log: modal volume get fox-agent-streams {stream}/agent.log ./{stream}.log')
    except BaseException:
        if call is None:
            registry[stream] = {**entry, 'status': 'launch-failed'}
            if registry.get(branch_key) == stream:
                registry.pop(branch_key, None)
        raise
