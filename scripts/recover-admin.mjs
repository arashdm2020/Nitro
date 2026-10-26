import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
const db = new PrismaClient();
try {
 const username=process.env.ADMIN_USERNAME;
 const password=process.env.ADMIN_PASSWORD;
 if(username!=="admin" || !password || password.length<12 || password.length>128) throw new Error("RECOVERY_CONFIGURATION_INVALID");
 const user=await db.user.findUnique({where:{username}});
 if(!user || user.role!=="ADMIN" || user.status!=="ACTIVE") throw new Error("RECOVERY_ACCOUNT_REQUIRES_REVIEW");
 const key="adminRecovery:2026-10-26";
 if(await db.systemSetting.findUnique({where:{key}})) { console.log("ADMIN_RECOVERY_ALREADY_COMPLETED"); }
 else {
 const matches=await argon2.verify(user.passwordHash,password).catch(()=>false);
 if(matches) { console.log("ADMIN_PASSWORD_ALREADY_MATCHES_ENV"); }
 else {
 const passwordHash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.$transaction(async tx=>{
 await tx.systemSetting.create({data:{key,value:"completed"}});
 const updated=await tx.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash,role:"ADMIN",status:"ACTIVE"},data:{passwordHash,mustResetPassword:true}});
 if(updated.count!==1) throw new Error("RECOVERY_CONCURRENT_CHANGE");
 await tx.session.deleteMany({where:{userId:user.id}});
 await tx.auditLog.create({data:{actorId:user.id,targetType:"User",targetId:user.id,action:"ADMIN_PASSWORD_RECOVERED",metadata:{source:"authorized-operator",sessionsRevoked:true}}});
 });
 const verified=await db.user.findUniqueOrThrow({where:{id:user.id}});
 if(!await argon2.verify(verified.passwordHash,password)) throw new Error("RECOVERY_VERIFY_FAILED");
 console.log("ADMIN_RECOVERY_VERIFIED");
 }
 }
} catch(error) { console.error(error instanceof Error && error.message.startsWith("RECOVERY_") ? error.message : "ADMIN_RECOVERY_FAILED"); process.exitCode=1; }
finally { await db.$disconnect(); }
