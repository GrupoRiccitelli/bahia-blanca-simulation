// Vessel particulars are sourced; port placement and schedule are hypothetical.
export const LUNA_LINDA = Object.freeze({
 id:'hypothetical-luna-linda',name:'LUNA LINDA',imo:'9792369',length_m:138,beam_m:26,
 type:'Aggregates Carrier',checked_on:'2026-10-06',
 source:'https://www.vesselfinder.com/vessels/details/9792369',
 user_reference:'https://www.marinetraffic.com/en/ais/details/ships/shipid:4037568',
 reference_identity:'MarineTraffic page unavailable; name match to public vessel particulars, not a verified shipid/IMO mapping',
 assumptions:['No confirmed Bahía Blanca call or AIS position.','Illustrative anchorage and berth; no terminal compatibility assessment.','Hypothetical arrival starts one hour after agenda origin and lasts 45 minutes.','No cargo handling, resource allocation or performance metrics inferred.'],
});
export function withLunaLinda(view,animate=true){
 const f=animate?Math.max(0,Math.min(1,(view.time-1)/.75)):0;
 const pose={x:1080+(430-1080)*f,z:420+(38-420)*f,angle:f===0||f===1?0:-Math.atan2(38-420,430-1080),provenance:'hypothetical-luna-linda-route'};
 const entity={id:LUNA_LINDA.id,name:LUNA_LINDA.name,length:138,beam:26,evidence:'assumed',state:f===0?'illustrative-hypothetical-anchorage':f<1?'illustrative-entrada':'illustrative-alongside',pose,details:{terminal:'Muelle hipotético · sin terminal real asignada',length_m:138,beam_m:26,assertion_ids:[],hypothetical:true}};
 const entities=[...view.entities,entity];
 return {...view,datasetId:view.datasetId+'-luna-linda',entities,selected:view.selected===LUNA_LINDA.id?LUNA_LINDA.id:view.selected,additionalVessels:[LUNA_LINDA]};
}
