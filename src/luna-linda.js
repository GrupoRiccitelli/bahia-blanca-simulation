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
 const u=1-f,a={x:1500,z:850},b={x:1500,z:200},c={x:430,z:200},d={x:430,z:38};
 const x=u*u*u*a.x+3*u*u*f*b.x+3*u*f*f*c.x+f*f*f*d.x,z=u*u*u*a.z+3*u*u*f*b.z+3*u*f*f*c.z+f*f*f*d.z;
 const dx=3*u*u*(b.x-a.x)+6*u*f*(c.x-b.x)+3*f*f*(d.x-c.x),dz=3*u*u*(b.z-a.z)+6*u*f*(c.z-b.z)+3*f*f*(d.z-c.z);
 const pose={x,z,angle:f===0||f===1?0:-Math.atan2(dz,dx),provenance:'hypothetical-luna-linda-route'};
 const entity={id:LUNA_LINDA.id,name:LUNA_LINDA.name,length:138,beam:26,evidence:'assumed',state:f===0?'illustrative-hypothetical-anchorage':f<1?'illustrative-entrada':'illustrative-alongside',pose,details:{terminal:'Muelle hipotético · sin terminal real asignada',length_m:138,beam_m:26,assertion_ids:[],hypothetical:true}};
 const entities=[...view.entities,entity];
 return {...view,datasetId:view.datasetId+'-luna-linda',entities,selected:view.selected===LUNA_LINDA.id?LUNA_LINDA.id:view.selected,additionalVessels:[LUNA_LINDA]};
}
