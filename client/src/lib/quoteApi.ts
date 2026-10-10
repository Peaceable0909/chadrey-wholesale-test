import { getSupabaseClient } from "@/lib/supabase";
import { buildItemRows, type ContactDetails, type QuoteLine } from "@/lib/quote";

type SubmitInput = {
  userId: string;
  userEmail: string | null;
  lines: QuoteLine[];
  brief: string;
  contact: ContactDetails;
  referenceFile: File | null;
};

/**
 * Creates the quote request, its product lines and the optional reference file.
 * If any step fails, everything created so far is removed so no half-finished request is left behind.
 */
export async function submitQuoteRequest({ userId, userEmail, lines, brief, contact, referenceFile }: SubmitInput): Promise<{ id: string; ref: string }> {
  const client = getSupabaseClient();
  const ref = `WR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const { data: request, error: requestError } = await client
    .from("quote_requests")
    .insert({
      ref,
      customer_id: userId,
      status: "pending",
      notes: brief.trim(),
      requirements: brief.trim(),
      company_name: contact.company.trim() || null,
      contact_email: contact.email.trim() || userEmail,
      contact_phone: contact.phone.trim() || null,
      whatsapp: contact.whatsapp.trim() || null,
      delivery_address: contact.address.trim() || null,
    })
    .select("id,ref")
    .single();
  if (requestError || !request) throw requestError || new Error("The quote request could not be created.");

  const undo = async () => {
    await client.from("quote_requests").delete().eq("id", request.id);
  };

  const { error: itemError } = await client.from("quote_request_items").insert(buildItemRows(request.id, lines));
  if (itemError) {
    await undo();
    throw itemError;
  }

  if (referenceFile) {
    const safeName = referenceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `quote-references/${userId}/${request.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await client.storage.from("quote-references").upload(storagePath, referenceFile, { contentType: referenceFile.type, upsert: false });
    if (uploadError) {
      await undo();
      throw uploadError;
    }
    const { error: fileError } = await client.from("quote_request_files").insert({
      quote_request_id: request.id,
      storage_path: storagePath,
      file_name: referenceFile.name,
      content_type: referenceFile.type || "application/octet-stream",
      size_bytes: referenceFile.size,
    });
    if (fileError) {
      await client.storage.from("quote-references").remove([storagePath]);
      await undo();
      throw fileError;
    }
  }

  return { id: request.id as string, ref: request.ref as string };
}
