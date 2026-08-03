// Photo/file storage via Supabase Storage - recommended over a separate AWS
// S3 bucket because it's bundled with the same Supabase project already
// hosting the database, so there's no new account/IAM setup, just two env
// vars from a project you already have open.
//
// Needs these two environment variables (Supabase dashboard -> Settings ->
// API): SUPABASE_URL (Project URL) and SUPABASE_SERVICE_KEY (the
// "service_role" secret key, NOT the public anon key - this lets the backend
// write to a private bucket on the professor's behalf). Add both to your
// local .env AND to Render's environment variables for the live site.
//
// Until those are set, uploads fail with a clear error instead of a crash,
// so the rest of the app keeps working.
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "kyf-uploads";

let client = null;
function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

// Uploads a buffer and returns its public URL. `path` should be unique,
// e.g. `profile-photos/${professorId}-${Date.now()}.jpg`.
async function uploadFile(path, buffer, contentType) {
  const supabase = getClient();
  if (!supabase) {
    const err = new Error(
      "Photo storage isn't configured yet - SUPABASE_URL and SUPABASE_SERVICE_KEY need to be set."
    );
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { uploadFile, BUCKET };
