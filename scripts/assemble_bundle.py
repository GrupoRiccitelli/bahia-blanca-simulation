import argparse
from report_pipeline import assemble
p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--review',required=True); p.add_argument('--output',required=True); a=p.parse_args()
b=assemble(a.input,a.review,a.output); print(b['bundle_hash'])
