"""Offline, fail-closed normalization of the frozen audited report layout (stdlib + Poppler)."""
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

VERSION = '1.0.0'
HASHES = {'position':'66c51b93bfd2d16f5921bd2f3e4ddbb3bb69093f2f4e112189201106ab79570a','vts':'e4acbcc8f666b4fec4551127a9131f87bfb1a1bda71994a6271d76d86d801a3f'}
SCOPE = ['ADM','TBB 9','Cargill']
BLANK_BERTHS = {'Piedrabuena','Sitio 18','Sitio 21','Mega','Dreyfus','Sitio 5','Sitio 2-3','Posta 1','Posta 2','Otamerica 1'}
ALIASES = {'Sitio 9 TBB':'TBB 9','CARGILL':'Cargill','Otamerica 2':'OTA 2'}
def canonical(value): return ALIASES.get(value,value)
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def number(value, quantity=False):
    if not re.fullmatch(r'\d+(?:[.,]\d+)*',value): raise ValueError('Uncertain numeric quantity: '+value)
    return float(value.replace('.','').replace(',','.')) if quantity else float(value.replace(',','.'))
def time_value(value):
    if not value: return None
    match = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})(?: (\d{1,2})[:.](\d{2})(?::(\d{2}))?)?',value)
    if not match: raise ValueError('Unsupported time: '+value)
    day,month,year,hour,minute,second=match.groups(); year=int(year); year=year+2000 if year<100 else year
    if not 2000 <= year <= 2100: raise ValueError('Suspect year: '+value)
    start=dt.datetime(year,int(month),int(day),int(hour or 0),int(minute or 0),int(second or 0),tzinfo=dt.timezone(dt.timedelta(hours=-3)))
    end=start if hour else start+dt.timedelta(days=1)-dt.timedelta(microseconds=1)
    return {'original':value,'precision':'datetime' if hour else 'date','earliest':start.astimezone(dt.timezone.utc).isoformat(),'latest':end.astimezone(dt.timezone.utc).isoformat(),'timezone':'America/Argentina/Buenos_Aires','timezone_evidence':'assumed'}
def sources_from_manifest(path):
    path=Path(path); manifest=json.loads(path.read_text()); rows=manifest if isinstance(manifest,list) else manifest.get('snapshots',[])
    if isinstance(manifest,dict) and manifest.get('errors'): raise ValueError('Required-source acquisition errors')
    sources=[]
    for kind,expected in HASHES.items():
        candidates=[r for r in rows if r.get('source')==kind or r.get('file')==kind+'.pdf']
        if len(candidates)!=1: raise ValueError('Missing or duplicate source '+kind)
        row=dict(candidates[0]); file=path.parent/row['file']; data=file.read_bytes()
        if not data.startswith(b'%PDF-') or 'application/pdf' not in row.get('content_type',''): raise ValueError('Invalid PDF '+kind)
        actual=hashlib.sha256(data).hexdigest()
        if actual!=row.get('sha256') or len(data)!=row.get('bytes'): raise ValueError('Saved-byte hash/size mismatch '+kind)
        if actual!=expected: raise ValueError('Unsupported source version/layout; requires parser review '+kind)
        row.update(id=kind,source=kind,status='verified',report_date='2026-10-06',issued_at=time_value('6/10/2026 06:58:33') if kind=='vts' else None,observed_at=None,observation_validity_bounds=None)
        sources.append(row)
    return sources

def normalize(manifest, output):
    sources=sources_from_manifest(manifest); folder=Path(manifest).parent
    result={'parser_version':VERSION,'schema_version':'1.0','scenario_kind':'published_snapshot','report_date':'2026-10-06','sources':sources,'observations':[],'intentions':[],'assertions':[],'inventory':[],'announcements':[]}
    result['toolchain']={'python':sys.version.split()[0],'poppler':subprocess.run(['pdftotext','-v'],capture_output=True,text=True,check=True).stderr.splitlines()[0]}
    def assertion(source,page,section,line,field,original,value,event_type=None,units=None):
        aid=f'{source}-p{page}-r{line}-{field}'
        result['assertions'].append({'id':aid,'source_id':source,'source_sha256':HASHES[source],'page':page,'section':section,'row':line,'field':field,'original_text':original,'parsed_value':value,'units':units,'precision':value.get('precision') if isinstance(value,dict) else None,'quality_warnings':['Field absent in source; no measurement asserted'] if value is None else [],'evidence':'reported','status':'unknown' if value is None else 'planned' if source=='vts' or section in ('narrative','announcements') else 'observation','event_type':event_type,'observed_at':None,'observation_validity_bounds':None})
        return aid
    for source in sources:
        text=subprocess.run(['pdftotext','-layout',str(folder/source['file']),'-'],capture_output=True,text=True,check=True).stdout
        if not text.strip(): raise ValueError('Empty PDF extraction')
        section='header'
        for page,body in enumerate(text.split('\f'),1):
            for line,raw in enumerate(body.splitlines(),1):
                stripped=raw.strip()
                if not stripped: continue
                if source['id']=='vts': section='vts'
                elif 'BUQUES EN FONDEADERO' in raw: section='anchorage'
                elif stripped=='MOVIMIENTOS PREVISTOS': section='narrative'
                elif 'ANUNCIOS' in raw or stripped in ('CONTENEDORES','CRUDO','VARIOS','CARGA GENERAL','GRANOS Y OLEAGINOSAS','INFLAMABLES Y PETROQUIMICOS'): section='announcements'
                elif 'BUQUES EN REPARACIONES' in raw: section='repairs'
                elif 'SITIO' in raw and 'BUQUE' in raw and page==1 and section=='header': section='berths'
                rid=f"{source['id']}-p{page}-r{line}"
                item={'id':rid,'source_id':source['id'],'page':page,'section':section,'row':line,'original_text':raw,'disposition':'retained-unparsed','review_status':'pending'}
                result['inventory'].append(item)
                cols=re.split(r'\s{2,}',stripped)
                if source['id']=='vts' and len(cols)>=9 and cols[5] in ('ENTRADA','ZARPADA'):
                    name,pilot,length,beam,terminal,direction=cols[:6]; tug_index=next(i for i in range(6,len(cols)) if re.match(r'\d\d/\d\d/\d\d ',cols[i])); tugs=cols[6:tug_index]
                    fields={'name':name,'terminal':canonical(terminal),'length_m':number(length),'beam_m':number(beam),'direction':direction,'pilot_time':time_value(pilot),'tug_time':time_value(cols[tug_index]),'tugs':tugs}
                    refs=[assertion('vts',page,section,line,k,raw,v,'planned_pilot_time' if k=='pilot_time' else 'planned_tug_time' if k=='tug_time' else 'movement_intention','m' if k.endswith('_m') else None) for k,v in fields.items()]
                    result['intentions'].append(dict(id=rid,vessel_id='vessel-'+name.lower().replace(' ','-'),in_scope=fields['terminal'] in SCOPE,assertion_ids=refs,**fields)); item.update(disposition='parsed',record_id=rid)
                elif source['id']=='position' and section in ('berths','anchorage'):
                    if section=='berths' and len(cols)>=7 and re.fullmatch(r'\d+',cols[3]):
                        terminal,name,flag,length=cols[:4]; date_match=re.search(r'(\d{1,2}/\d{1,2}/\d{4})\s+(\d{2}:\d{2})',raw)
                    elif section=='anchorage' and re.match(r'\d{1,2}/',stripped) and len(cols)>=8:
                        arrival,name,flag,length=cols[:4]; terminal=cols[-3]; date_match=None
                    else:
                        if section=='berths' and stripped in BLANK_BERTHS:
                            item.update(disposition='excluded-with-reason',reason='Blank berth row; absence is not a departure event')
                        continue
                    cargo=None; tonnes=None
                    quantity=re.search(r'\b(\d{1,3}(?:\.\d{3})+)\s+([A-Z][A-Z /]+?)\s{2,}',raw)
                    if quantity: tonnes=number(quantity.group(1),True); cargo=quantity.group(2).strip()
                    arrival=time_value(date_match.group(1)+' '+date_match.group(2)) if date_match else time_value(arrival) if section=='anchorage' else None
                    fields={'name':name,'terminal':canonical(terminal),'flag':flag,'length_m':number(length),'beam_m':None,'cargo':cargo,'tonnage':tonnes,'arrival_time':arrival,'state':'reported-alongside' if section=='berths' else 'reported-anchorage'}
                    refs=[assertion('position',page,section,line,k,raw,v,'reported_berth_arrival' if k=='arrival_time' and section=='berths' else 'reported_anchorage_arrival' if k=='arrival_time' else None,'m' if k.endswith('_m') else 'tonnes' if k=='tonnage' else None) for k,v in fields.items()]
                    result['observations'].append(dict(id=rid,vessel_id='vessel-'+name.lower().replace(' ','-'),candidate_call_id=rid,in_scope=fields['terminal'] in SCOPE,assertion_ids=refs,**fields)); item.update(disposition='parsed',record_id=rid)
                elif section=='announcements' and (re.match(r'\d{1,2}/',stripped) or stripped.startswith(('AURIGA STAR','OSSA '))):
                    date=re.match(r'(\d{1,2}/\d{1,2}/\d{4})',stripped); value=time_value(date.group(1)) if date else None
                    ref=assertion('position',page,section,line,'announcement_date',raw,value,'narrative_intention'); result['announcements'].append({'id':rid,'candidate_call_id':rid,'original_text':raw,'time':value,'assertion_ids':[ref],'quantity_units':'unresolved' if '200-200' in raw else 'as published'}); item.update(disposition='parsed',record_id=rid)
                elif section=='narrative' and stripped.startswith('A las '):
                    assertion('position',page,section,line,'narrative',raw,raw,'narrative_intention'); item['disposition']='parsed'
                if section=='berths' and stripped in BLANK_BERTHS:
                    item.update(disposition='excluded-with-reason',reason='Blank berth row; absence is not a departure event')
                if re.fullmatch(r'\d{1,3}(?:\.\d{3})+',stripped):
                    item.update(disposition='excluded-with-reason',reason='Published section total; not a vessel call')
                if '1/9/2206' in raw: item['quality_warnings']=['suspect date preserved; no correction']
                if 'STIO 2-3/TBB 9' in raw: item['quality_warnings']=['ambiguous terminal preserved; no assignment']
    if len(result['intentions'])!=7 or len(result['observations'])!=19 or sum(x['in_scope'] for x in result['observations'])!=8: raise ValueError('Frozen layout coverage mismatch '+str((len(result['intentions']),len(result['observations']),[(x['name'],x['terminal']) for x in result['observations']])))
    result['normalization_hash']=digest(result); Path(output).mkdir(parents=True,exist_ok=True); (Path(output)/'normalized.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    return result

def validate(folder,review):
    data=json.loads((Path(folder)/'normalized.json').read_text()); original=data.pop('normalization_hash'); actual=digest(data); data['normalization_hash']=original
    if actual!=original: raise ValueError('Normalized assertions changed')
    decision=json.loads(Path(review).read_text())
    if decision.get('status')!='approved' or decision.get('source_hashes')!=HASHES: raise ValueError('Missing approved review for source versions')
    if decision.get('normalization_hash') != original: raise ValueError('Review normalization mismatch')
    sources_from_manifest(decision['manifest'])
    if decision.get('parser_version')!=VERSION or decision.get('schema_version')!='1.0': raise ValueError('Review version mismatch')
    if any(s['report_date']!=data['report_date'] for s in data['sources']): raise ValueError('Report-date mismatch requires reconciliation')
    if decision.get('overrides') or decision.get('linked_intentions'): raise ValueError('Overrides/links require a supported explicit reconciliation implementation')
    if decision.get('scope') != SCOPE or decision.get('aliases') != ALIASES: raise ValueError('Unsupported reviewed scope or aliases')
    ids={a['id'] for a in data['assertions']}
    if len(ids)!=len(data['assertions']): raise ValueError('Duplicate assertion IDs')
    for row in data['observations']+data['intentions']+data['announcements']:
        if not set(row['assertion_ids']).issubset(ids): raise ValueError('Broken assertion reference')
    return data,decision

def assemble(folder,review,output):
    data,decision=validate(folder,review)
    for row in data['inventory']: row['review_status']='reviewed' if row.get('record_id') else 'retained-context-reviewed'
    times=[i[k]['earliest'] for i in data['intentions'] for k in ('pilot_time','tug_time')]
    data.update(id='bahia-2026-10-06',selected_terminal_scope=SCOPE,coverage={'start':min(times),'end':max(times),'observation_cutoff':None},assumptions=decision['assumptions'],unresolved_issues=decision['unresolved_issues'],review=decision,metric_eligibility={'reported_vessel_count':True,'plan_count':True,'coverage':True,'actual_waiting':False,'turnaround':False,'berth_utilization':False,'tug_utilization':False,'loading_progress':False})
    data['schema_hash']=hashlib.sha256((Path(__file__).resolve().parent.parent/'schemas/source-bundle.json').read_bytes()).hexdigest()
    data['review_hash']=digest(decision)
    data['bundle_hash']=digest(data); Path(output).parent.mkdir(parents=True,exist_ok=True); Path(output).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n'); return data
