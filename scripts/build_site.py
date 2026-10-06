"""Stage only browser assets; private evidence never enters the Pages artifact."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
output = root / 'dist'
if output.exists():
    shutil.rmtree(output)
output.mkdir()
shutil.copy2(root / 'index.html', output / 'index.html')
for name in ('src', 'vendor'):
    shutil.copytree(root / name, output / name, dirs_exist_ok=True)
(output / '.nojekyll').touch()
print(output)
