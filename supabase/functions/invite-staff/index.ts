import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const origins=['http://127.0.0.1:5173','http://localhost:5173','http://localhost:3000'];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const respond=(status:number,message:string)=>new Response(JSON.stringify({message}),{status,headers});
 if(origin&&!origins.includes(origin))return respond(403,'Origen no autorizado');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond(405,'Método no permitido');
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
 if(!token)return respond(401,'Inicia sesión');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await admin.auth.getUser(token);
 if(authError||!identity.user)return respond(401,'Sesión no válida');
 let body;
 try{body=await req.json()}catch{return respond(400,'Solicitud inválida')}
 if(typeof body.invitation_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.invitation_id))return respond(400,'Invitación inválida');
 const {data:invite,error}=await admin.from('staff_invitations').select('*').eq('id',body.invitation_id).single();
 if(error||!invite)return respond(404,'Invitación no disponible');
 const {data:gym}=await admin.from('gyms').select('owner_id').eq('id',invite.gym_id).single();
 if(!gym||gym.owner_id!==identity.user.id)return respond(403,'Solo el propietario puede invitar personal');
 if(invite.accepted_at||invite.revoked_at||Date.parse(invite.expires_at)<=Date.now())return respond(409,'Esta invitación ya no está pendiente');
 const cutoff=new Date(Date.now()-60000).toISOString();
 const {data:claim,error:claimError}=await admin.from('staff_invitations').update({last_sent_at:new Date().toISOString()}).eq('id',invite.id).or('last_sent_at.is.null,last_sent_at.lt.'+cutoff).select('id').maybeSingle();
 if(claimError)return respond(500,'No se pudo preparar el correo');
 if(!claim)return respond(429,'Espera un minuto antes de reenviar');
 const {error:inviteError}=await admin.auth.admin.inviteUserByEmail(invite.email,{redirectTo:(origin||origins[0])+'/?setup=1'});
 if(inviteError){
  if(['email_exists','user_already_exists'].includes(inviteError.code||'')||/already.*registered/i.test(inviteError.message))return respond(200,'Acceso preparado. Esta persona ya tiene cuenta: podrá aceptar al ingresar con su correo.');
  return respond(502,'La invitación quedó guardada, pero el correo no pudo enviarse. Revisa el servicio de correo de Supabase y usa Reenviar.');
 }
 return respond(200,'Invitación enviada. La persona podrá crear su contraseña desde el correo.');
});
