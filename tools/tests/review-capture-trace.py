"""Pure report reader regression: no sheet, browser, rendering or network."""
import importlib.util
import json
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('review_capture', Path(__file__).parents[1] / 'review-capture.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
trace = [{'frame': 42, 'state': {'auto': {'idx': 21, 'stalled': True}, 'deaths': 1}}]
with tempfile.TemporaryDirectory() as temporary:
    folder = Path(temporary)
    (folder / 'route.json').write_text(json.dumps({'trace': trace}))
    assert review.video_trace(folder, {'trace': trace}) == trace
    compact = {'traceFile': 'route.json', 'traceSamples': 1}
    assert review.video_trace(folder, compact) == trace
    try:
        review.video_trace(folder, {**compact, 'traceSamples': 2})
    except ValueError:
        pass
    else:
        raise AssertionError('Missing frames must fail visibly')
print('Review reader preserves exact waypoint/death/stall state for full and compact reports')
