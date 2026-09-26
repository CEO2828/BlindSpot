"""Save a Gemini key locally without echoing it."""
import getpass
import os
from pathlib import Path
p = Path(__file__).resolve().parents[1] / '.env'
key = getpass.getpass('Paste the complete Gemini API key (hidden): ').strip()
if not key:
    raise SystemExit('Nothing saved.')
lines = p.read_text().splitlines() if p.exists() else []
lines = [line for line in lines if not line.startswith('GEMINI_API_KEY=')]
lines.append('GEMINI_API_KEY=' + key)
os.umask(0o077)
with os.fdopen(os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as f:
    f.write('\n'.join(lines) + '\n')
os.chmod(p, 0o600)
print('Saved locally. No key was printed or uploaded.')
input('Press Return to close.')
