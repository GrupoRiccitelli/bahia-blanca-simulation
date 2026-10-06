"""Procedural version-1.0 bundle checks (stdlib; deliberately not a JSON Schema engine).

The published schema covers local shapes. This module and the browser additionally
check IDs, references, source/review bindings, ordered intervals and coverage.
Neither imported bundle validator authenticates hashes or a publisher.
"""
import datetime as dt
import math
import re

HASH = re.compile(r'^[a-fA-F0-9]{64}$')
STAMP = re.compile('^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$')
EVENTS = [None, 'planned_pilot_time', 'planned_tug_time', 'movement_intention', 'narrative_intention', 'reported_berth_arrival', 'reported_anchorage_arrival']


def require(value, fields):
    if not isinstance(value, dict) or any(field not in value for field in fields):
        raise ValueError('Missing required evidence fields')


def text(value):
    return isinstance(value, str) and bool(value.strip())


def timestamp(value):
    if not isinstance(value, str) or not STAMP.fullmatch(value):
        raise ValueError('Invalid timestamp')
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('Invalid timestamp') from error


def string_array(value, nonempty=False):
    return isinstance(value, list) and all(text(v) if nonempty else isinstance(v, str) for v in value)


def check_time(value):
    if value is None:
        return
    require(value, ['original', 'precision', 'earliest', 'latest', 'timezone', 'timezone_evidence'])
    if not isinstance(value['original'], str) or value['precision'] not in ['date', 'datetime'] or not text(value['timezone']) or value['timezone_evidence'] not in ['assumed', 'confirmed']:
        raise ValueError('Invalid time provenance')
    a = timestamp(value['earliest']) if value['earliest'] is not None else None
    b = timestamp(value['latest']) if value['latest'] is not None else None
    if a is not None and b is not None and b < a:
        raise ValueError('Reversed time interval')


def validate_records(bundle, reviewed=True):
    """Check shared normalized/final records; pending inventory is only allowed before review."""
    for key in ['sources', 'observations', 'intentions', 'assertions', 'inventory']:
        if not isinstance(bundle.get(key), list):
            raise ValueError('Missing section ' + key)
    sources = {}
    for source in bundle['sources']:
        require(source, ['id', 'sha256', 'status', 'retrieved_at'])
        if not text(source['id']) or source['id'] in sources or source['status'] != 'verified' or not isinstance(source['sha256'], str) or not HASH.fullmatch(source['sha256']):
            raise ValueError('Invalid or duplicate source')
        timestamp(source['retrieved_at'])
        sources[source['id']] = source['sha256']
    if not {'position', 'vts'}.issubset(sources):
        raise ValueError('Missing required sources')
    assertions = set()
    for row in bundle['assertions']:
        require(row, ['id', 'source_id', 'source_sha256', 'page', 'section', 'row', 'field', 'original_text', 'parsed_value', 'units', 'precision', 'quality_warnings', 'evidence', 'status', 'event_type'])
        if not text(row['id']) or row['id'] in assertions or not text(row['source_id']) or row['source_sha256'] != sources.get(row['source_id']) or row['evidence'] != 'reported' or row['status'] not in ['observation', 'planned', 'unknown']:
            raise ValueError('Invalid assertion source, evidence or status')
        check_provenance(row)
        if not text(row['field']) or (row['units'] is not None and not isinstance(row['units'], str)) or row['precision'] not in [None, 'date', 'datetime'] or row['event_type'] not in EVENTS or not string_array(row['quality_warnings']):
            raise ValueError('Invalid assertion provenance')
        assertions.add(row['id'])
    for key in ['observations', 'intentions', 'inventory']:
        ids = set()
        for row in bundle[key]:
            require(row, ['id'])
            if not text(row['id']) or row['id'] in ids:
                raise ValueError('Invalid or duplicate record ID')
            ids.add(row['id'])
            if key != 'inventory':
                require(row, ['name', 'terminal', 'assertion_ids'])
                if not text(row['name']) or (row['terminal'] is not None and not text(row['terminal'])):
                    raise ValueError('Invalid record name or terminal')
            if 'assertion_ids' in row and (not string_array(row['assertion_ids'], True) or not set(row['assertion_ids']).issubset(assertions)):
                raise ValueError('Invalid assertion references')
            for dimension in ['length_m', 'beam_m', 'tonnage']:
                value = row.get(dimension)
                if value is not None and (type(value) not in [int, float] or not math.isfinite(value) or value <= 0):
                    raise ValueError('Invalid positive dimension ' + dimension)
            for field in ['arrival_time', 'pilot_time', 'tug_time']:
                check_time(row.get(field))
            if key == 'observations':
                require(row, ['vessel_id', 'in_scope', 'state'])
                if not text(row['vessel_id']) or type(row['in_scope']) is not bool or row['state'] not in ['reported-alongside', 'reported-anchorage', 'unknown']:
                    raise ValueError('Invalid observation identity or state')
            elif key == 'intentions':
                require(row, ['direction', 'pilot_time', 'tug_time', 'tugs'])
                if row['direction'] not in ['ENTRADA', 'ZARPADA'] or not string_array(row['tugs'], True):
                    raise ValueError('Invalid intention direction or tugs')
            else:
                require(row, ['source_id', 'page', 'section', 'row', 'original_text', 'disposition', 'review_status'])
                check_provenance(row)
                statuses = ['reviewed', 'retained-context-reviewed', 'approved'] + ([] if reviewed else ['pending'])
                if row['source_id'] not in sources or row['disposition'] not in ['parsed', 'retained-unparsed', 'excluded-with-reason'] or row['review_status'] not in statuses:
                    raise ValueError('Invalid inventory source or disposition')
                if row['disposition'] == 'excluded-with-reason' and not text(row.get('reason') or row.get('exclusion_reason')):
                    raise ValueError('Excluded row requires a reason')


def check_provenance(row):
    if not text(row['source_id']) or any(type(row[key]) is not int or row[key] < 1 for key in ['page', 'row']) or not text(row['section']) or not isinstance(row['original_text'], str):
        raise ValueError('Invalid row provenance')


def validate_bundle_contract(bundle):
    require(bundle, ['schema_version', 'scenario_kind', 'id', 'report_date', 'coverage', 'review', 'bundle_hash', 'metric_eligibility', 'assumptions', 'unresolved_issues'])
    if bundle['schema_version'] != '1.0' or bundle['scenario_kind'] != 'published_snapshot' or not text(bundle['id']):
        raise ValueError('Unsupported bundle version/kind or missing ID')
    date = bundle['report_date']
    if not isinstance(date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        raise ValueError('Invalid report date')
    dt.date.fromisoformat(date)
    for key in ['assumptions', 'unresolved_issues']:
        if not string_array(bundle[key]):
            raise ValueError('Invalid evidence annotations')
    for key in ['bundle_hash', 'normalization_hash', 'review_hash', 'schema_hash']:
        value = bundle.get(key)
        if (key == 'bundle_hash' or value is not None) and (not isinstance(value, str) or not HASH.fullmatch(value)):
            raise ValueError('Invalid hash ' + key)
    require(bundle['review'], ['status'])
    review = bundle['review']
    if review['status'] not in ['approved', 'reviewed'] or review.get('schema_version') not in [None, '1.0']:
        raise ValueError('Invalid review status or version')
    metrics = bundle['metric_eligibility']
    if not isinstance(metrics, dict) or any(type(v) is not bool or (v and k not in ['reported_vessel_count', 'reported_count', 'plan_count', 'coverage']) for k, v in metrics.items()):
        raise ValueError('Invalid evidence metric eligibility')
    require(bundle['coverage'], ['start', 'end', 'observation_cutoff'])
    start, end = [timestamp(bundle['coverage'][k]) for k in ['start', 'end']]
    if end < start or bundle['coverage']['observation_cutoff'] is not None:
        raise ValueError('Invalid coverage or unknown observation cutoff')
    validate_records(bundle)
    if 'source_hashes' in review:
        require(review['source_hashes'], ['position', 'vts'])
        if any(review['source_hashes'].get(s['id']) != s['sha256'] for s in bundle['sources']):
            raise ValueError('Review source hashes mismatch')
    for key in ['observations', 'intentions', 'inventory']:
        for row in bundle[key]:
            for field in ['pilot_time', 'tug_time']:
                value = row.get(field)
                if value is not None and value['earliest'] is not None:
                    a = timestamp(value['earliest'])
                    b = timestamp(value['latest']) if value['latest'] is not None else a
                    if a < start or b > end:
                        raise ValueError('Milestone outside coverage')
    return bundle
