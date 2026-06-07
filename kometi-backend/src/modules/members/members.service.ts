// src/modules/members/members.service.ts
import supabase from "../../config/supabase";
import { emitToUser } from "../../config/socket";

export class MembersService {
  static async listMembers() {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, phone, email, role, kycStatus, createdAt");
    
    if (error) throw error;
    return data;
  }

  static async getMemberById(id: string) {
    const { data: member, error } = await supabase
      .from("users")
      .select("*, kyc_documents(*), wallets(*)")
      .eq("id", id)
      .single();

    if (error || !member) throw new Error("Member not found");
    return member;
  }

  static async updateKyc(userId: string, aadhaarNum?: string, panNum?: string) {
    const { data: kyc, error: kycError } = await supabase
      .from("kyc_documents")
      .upsert({
        userId,
        aadhaarNum,
        panNum,
        status: "SUBMITTED",
        updatedAt: new Date().toISOString(),
      }, { onConflict: "userId" })
      .select()
      .single();

    if (kycError) throw kycError;

    const { error: userError } = await supabase
      .from("users")
      .update({ kycStatus: "SUBMITTED" })
      .eq("id", userId);

    if (userError) throw userError;

    return kyc;
  }

  static async updateKycStatus(userId: string, status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED", rejectedReason?: string) {
    const { error: userError } = await supabase
      .from("users")
      .update({ kycStatus: status })
      .eq("id", userId);

    if (userError) throw userError;

    const { error: kycError } = await supabase
      .from("kyc_documents")
      .update({
        status,
        rejectedReason: status === "REJECTED" ? rejectedReason : null,
        verifiedAt: status === "VERIFIED" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      })
      .eq("userId", userId);

    if (kycError) throw kycError;

    // Real-time notification over socket
    emitToUser(userId, "kyc:status_updated", { userId, status });
  }
}
