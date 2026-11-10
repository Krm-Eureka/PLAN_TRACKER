import "next-auth";
import "next-auth/jwt";

/**
 * ฟิลด์ที่ callback `session` ใน src/app/api/auth/[...nextauth]/route.ts เติมให้
 * ประกาศไว้ที่เดียว เพื่อเลิก cast session เป็น any กระจายทั่วโค้ด
 */
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    id?: string;
    department?: string;
    division?: string;
    role_system?: string;
    name_en?: string;
    name_th?: string;
    nickname?: string;
    emp_id?: string;
    position?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    profileFetchedAt?: number;
    error?: string;
    id?: string;
    department?: string;
    division?: string;
    role_system?: string;
    name_en?: string;
    name_th?: string;
    nickname?: string;
    emp_id?: string;
    position?: string;
  }
}
