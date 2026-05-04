const supabase = require('../config/supabase');

/**
 * Upload a file buffer to a Supabase Storage bucket.
 * Returns the storage path so it can be stored in the DB.
 *
 * @param {string} bucket - 'documents' | 'templates' | 'guidelines'
 * @param {string} path   - Storage path, e.g. 'abc-uuid/v2_filename.docx'
 * @param {Buffer} buffer - File contents
 * @param {string} mimeType
 * @returns {Promise<string>} The storage path saved
 */
const uploadFile = async (bucket, path, buffer, mimeType) => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
};

/**
 * Generate a short-lived signed URL for a private bucket file.
 *
 * @param {string} bucket
 * @param {string} path
 * @param {number} expiresIn - Seconds until expiry (default 1 hour)
 * @returns {Promise<string>} Signed URL
 */
const getSignedUrl = async (bucket, path, expiresIn = 3600) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Could not generate download link: ${error.message}`);
  return data.signedUrl;
};

/**
 * Delete a file from storage. Silently ignores missing files.
 *
 * @param {string} bucket
 * @param {string} path
 */
const deleteFile = async (bucket, path) => {
  await supabase.storage.from(bucket).remove([path]);
};

module.exports = { uploadFile, getSignedUrl, deleteFile };
