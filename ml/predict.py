import sys, json
from pathlib import Path
try:
    import joblib
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)

# Simple prediction script that loads model.pkl and returns a dummy prediction
model_path = Path(__file__).parent / 'model.pkl'
if not model_path.exists():
    print(json.dumps({'error':'model not found', 'expected': str(model_path)}))
    sys.exit(1)

# Load model (unused here) and return a sample
try:
    model = joblib.load(model_path)
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)

payload = {}
if len(sys.argv) > 1:
    try:
        payload = json.loads(sys.argv[1])
    except Exception:
        payload = {'raw': sys.argv[1]}

# Dummy predictedDelay
predicted = {'predictedDelay': 24, 'input': payload}
print(json.dumps(predicted))
