"""The same constructed cases run against schema, browser and offline validators.

Schema tests use full jsonschema with format checking when installed. Set up no
production dependency: plain stdlib runs still cover JS/pipeline parity and
explicitly skip the external-schema portion if jsonschema is unavailable.
"""
import copy
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location('bundle_contract', ROOT/'scripts/bundle_contract.py')
contract = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contract)
try:
    import jsonschema
except ImportError:
    jsonschema = None


def constructed_cases():
    fixture = json.loads((ROOT/'tests/fixtures/source-bundle.json').read_text())
    for case in json.loads((ROOT/'tests/fixtures/source-bundle-cases.json').read_text()):
        bundle = copy.deepcopy(fixture)
        for patch in case['patches']:
            target = bundle
            for key in patch['path'][:-1]:
                target = target[int(key)] if isinstance(target, list) else target[key]
            key = patch['path'][-1]
            if patch.get('delete'):
                del target[key]
            elif isinstance(target, list):
                target[int(key)] = patch['value']
            else:
                target[key] = patch['value']
        yield case, bundle


class SourceContractTests(unittest.TestCase):
    def test_browser_pipeline_parity(self):
        cases = list(constructed_cases())
        script = """import { validateBundle } from './src/source-data.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
console.log(JSON.stringify(JSON.parse(input).map(bundle => {
try { validateBundle(bundle); return true; } catch { return false; }
})));"""
        browser = json.loads(subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, input=json.dumps([b for _, b in cases]), text=True, capture_output=True, check=True).stdout)
        for index, (case, bundle) in enumerate(cases):
            with self.subTest(case=case['name']):
                try:
                    contract.validate_bundle_contract(bundle)
                    accepted = True
                except ValueError:
                    accepted = False
                self.assertEqual(accepted, case['accepted'])
                self.assertEqual(browser[index], accepted)

    @unittest.skipIf(jsonschema is None, 'Full JSON Schema validation requires optional jsonschema package')
    def test_published_schema_parity_and_procedural_boundary(self):
        schema = json.loads((ROOT/'schemas/source-bundle.json').read_text())
        jsonschema.Draft202012Validator.check_schema(schema)
        validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
        for case, bundle in constructed_cases():
            with self.subTest(case=case['name']):
                errors = list(validator.iter_errors(bundle))
                self.assertEqual(not errors, case['schemaAccepted'], [e.message for e in errors])
