"""Manual, bounded acquisition of official PDFs; never synthesizes failed inputs."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.request

SOURCES = {
    'position': 'https://puertobahiablanca.com/situacion_operativa/posicion.pdf',
    'vts': 'https://puertobahiablanca.com/vts/movimientos.pdf',
}


def fetch(output_root):
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder = Path(output_root) / stamp
    folder.mkdir(parents=True, exist_ok=False)
    manifest = {'schema_version': 1, 'snapshots': [], 'errors': []}
    for source, url in SOURCES.items():
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'GrupoRiccitelli-port-data-audit/0.1'})
            with urllib.request.urlopen(request, timeout=25) as response:
                content_type = response.headers.get('Content-Type', '')
                payload = response.read(10 * 1024 * 1024 + 1)
                if len(payload) > 10 * 1024 * 1024:
                    raise ValueError('Report exceeds 10 MiB limit')
                if 'application/pdf' not in content_type.lower() or not payload.startswith(b'%PDF-'):
                    raise ValueError('Response is not a PDF')
                metadata = {k: response.headers.get(k) for k in ('ETag', 'Last-Modified')}
                final_url = response.url
            filename = f'{source}.pdf'
            (folder / filename).write_bytes(payload)
            manifest['snapshots'].append({
                'source': source, 'url': url, 'final_url': final_url,
                'file': filename, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload),
                'content_type': content_type, 'http_metadata': metadata,
                'issue_time': None, 'issue_time_status': 'requires_payload_extraction',
                'source_timezone': None, 'reuse_status': 'unverified',
            })
        except Exception as error:
            manifest['errors'].append({'source': source, 'url': url, 'error': str(error)})
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(folder)
    for error in manifest['errors']:
        print(f"ERROR {error['source']}: {error['error']}")
    return 1 if manifest['errors'] else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='data/raw/snapshots')
    raise SystemExit(fetch(parser.parse_args().output))
