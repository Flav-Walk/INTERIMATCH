"""Read-only guard for staged files and committed blobs; never prints values."""
import re
import subprocess
import sys

def git(*args):
    return subprocess.run(['git', *args], capture_output=True, check=True).stdout

patterns = [rb'sb_secret_[A-Za-z0-9_-]+', rb'xkeysib-[A-Za-z0-9_-]+',
            rb'(?m)^[ \t]*(?:DB_PASSWORD|DEMO_PASSWORD|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|BREVO_API_KEY)[ \t]*=[ \t]*[^\s#]+']
bad = []
for line in git('ls-files', '-s', '-z').split(b'\0'):
    if not line:
        continue
    metadata, path = line.split(b'\t', 1)
    blob = git('cat-file', 'blob', metadata.split()[1].decode())
    if any(re.search(pattern, blob) for pattern in patterns):
        bad.append(path.decode(errors='replace'))
history = subprocess.run(['git', 'rev-list', '--objects', '--all'], capture_output=True).stdout
for line in history.splitlines():
    oid = line.split()[0].decode()
    kind = git('cat-file', '-t', oid).strip()
    if kind == b'blob' and any(re.search(p, git('cat-file', 'blob', oid)) for p in patterns):
        bad.append('historical blob ' + oid)
if bad:
    print('Secret scan failed (values hidden):', ', '.join(bad))
    sys.exit(1)
print('Secret scan OK: index and committed blobs.')
