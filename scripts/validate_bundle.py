import argparse
from report_pipeline import validate
p=argparse.ArgumentParser(); p.add_argument('--input',required=True); p.add_argument('--review',required=True); a=p.parse_args()
validate(a.input,a.review); print('Validated hashes, reviewed source versions and normalization')
