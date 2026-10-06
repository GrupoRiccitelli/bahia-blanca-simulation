import argparse
from report_pipeline import normalize
p=argparse.ArgumentParser(); p.add_argument('--manifest',required=True); p.add_argument('--output',required=True); a=p.parse_args()
normalize(a.manifest,a.output)
