import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('pipeline',Path(__file__).parents[1]/'scripts/report_pipeline.py')
p=importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
class ParserTests(unittest.TestCase):
    def test_decimal_columns(self):
        self.assertEqual(p.number('228,95'),228.95)
        self.assertEqual(p.number('22.000',True),22000)
        with self.assertRaises(ValueError): p.number('200-200',True)
    def test_date_interval_and_suspect_year(self):
        self.assertIsNone(p.time_value(None))
        date=p.time_value('06/10/2026'); self.assertEqual(date['precision'],'date'); self.assertNotEqual(date['earliest'],date['latest'])
        self.assertEqual(p.time_value('06/10/26 06:30')['earliest'],'2026-10-06T09:30:00+00:00')
        for value in ['1/9/2206 7:21','31/2/2026','not-a-date']:
            with self.assertRaises(ValueError): p.time_value(value)
    def test_manifest_failures(self):
        with tempfile.TemporaryDirectory() as folder:
            f=Path(folder)/'manifest.json'
            for manifest in [{'snapshots':[],'errors':[{'source':'vts'}]},[],{'snapshots':[]}]:
                f.write_text(json.dumps(manifest))
                with self.assertRaises(ValueError): p.sources_from_manifest(f)
            for payload in [b'<html>error</html>',b'%PDF-corrupted']:
                (Path(folder)/'position.pdf').write_bytes(payload)
                f.write_text(json.dumps([{'file':'position.pdf','content_type':'application/pdf','sha256':p.HASHES['position'],'bytes':len(payload)}]))
                with self.assertRaises(ValueError): p.sources_from_manifest(f)
    def test_frozen_optional_integration(self):
        root=Path(__file__).parents[1]; manifest=root/'data/raw/audit-2026-10-06/manifest.json'
        if not manifest.exists(): self.skipTest('Private frozen reports not available')
        with tempfile.TemporaryDirectory() as folder:
            data=p.normalize(manifest,folder)
            self.assertEqual(len(data['intentions']),7)
            excluded=[r for r in data['inventory'] if r['disposition']=='excluded-with-reason']
            self.assertEqual(sum('Blank berth' in r['reason'] for r in excluded),10)
            self.assertEqual(sum('section total' in r['reason'] for r in excluded),4)
            missing_beam=next(a for a in data['assertions'] if a['field']=='beam_m' and a['source_id']=='position')
            self.assertEqual(missing_beam['status'],'unknown')
            self.assertTrue(missing_beam['quality_warnings'])
            self.assertEqual(sum(o['in_scope'] and o['state']=='reported-alongside' for o in data['observations']),3)
            self.assertEqual(sum(o['in_scope'] and o['state']=='reported-anchorage' for o in data['observations']),5)
            self.assertEqual(sum('AS SILJE' in a['original_text'] for a in data['announcements']),4)
            for name in ['AURIGA STAR','OSSA']:
                self.assertIsNone(next(a for a in data['announcements'] if name in a['original_text'])['time'])
            review=json.loads((root/'scenarios/audit-2026-10-06.review.json').read_text()); review['manifest']=str(manifest); rf=Path(folder)/'review.json'; rf.write_text(json.dumps(review))
            a=p.assemble(folder,rf,Path(folder)/'a.json'); b=p.assemble(folder,rf,Path(folder)/'b.json'); self.assertEqual(a,b)
            self.assertIsNone(a['coverage']['observation_cutoff'])
            bad=copy.deepcopy(data); bad['observations'][0]['length_m']=999; (Path(folder)/'normalized.json').write_text(json.dumps(bad))
            with self.assertRaises(ValueError): p.validate(folder,rf)
if __name__=='__main__': unittest.main()
