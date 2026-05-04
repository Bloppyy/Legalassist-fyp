const supabase = require('../config/supabase');

/**
 * Insert an in-app notification record into the notifications table.
 *
 * @param {string} userId        - Recipient's user ID
 * @param {string} title
 * @param {string} message
 * @param {string} type          - e.g. 'document_status', 'deadline_reminder'
 * @param {string|null} referenceId   - UUID of the related record
 * @param {string|null} referenceType - Table name of the related record
 */
const createNotification = async (userId, title, message, type, referenceId = null, referenceType = null) => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
    reference_type: referenceType,
    read: false,
  });

  if (error) {
    console.error('[notificationService] Failed to create notification:', error.message);
  }
};

/**
 * Send a push notification via Firebase Cloud Messaging.
 *
 * TODO: To enable FCM push notifications:
 *   1. npm install firebase-admin
 *   2. Add FIREBASE_SERVICE_ACCOUNT=path/to/serviceAccount.json to .env
 *   3. Add fcm_token text column to the users table
 *   4. Uncomment the firebase-admin block below
 *
 * @param {string} fcmToken - Device FCM token stored in users.fcm_token
 * @param {string} title
 * @param {string} body
 * @param {object} data - Extra key/value pairs sent to the device
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  // TODO: Uncomment once firebase-admin is installed and configured.
  //
  // const admin = require('firebase-admin');
  // await admin.messaging().send({
  //   token: fcmToken,
  //   notification: { title, body },
  //   data,
  // });

  console.log(`[FCM stub] To: ${fcmToken} | ${title}: ${body}`);
};

/**
 * Notify a user about a document status change.
 * Creates an in-app notification and optionally sends an FCM push.
 *
 * @param {string} userId
 * @param {string} documentId
 * @param {string} documentTitle
 * @param {string} newStatus
 */
const notifyDocumentStatus = async (userId, documentId, documentTitle, newStatus) => {
  const statusMessages = {
    pending_associate: `Document "${documentTitle}" has been submitted for your review.`,
    pending_partner:   `Document "${documentTitle}" has been escalated for partner approval.`,
    approved:          `Your document "${documentTitle}" has been approved.`,
    rejected:          `Your document "${documentTitle}" was rejected. Please review the comments and resubmit.`,
  };

  const title   = 'Document Update';
  const message = statusMessages[newStatus] || `Document status changed to "${newStatus}".`;

  // In-app notification
  await createNotification(userId, title, message, 'document_status', documentId, 'documents');

  // FCM push — only fires if the user has a token stored
  // TODO: Uncomment once fcm_token column is added to users table and firebase-admin is configured.
  //
  // const { data: userRecord } = await supabase
  //   .from('users')
  //   .select('fcm_token')
  //   .eq('id', userId)
  //   .single();
  //
  // if (userRecord?.fcm_token) {
  //   await sendPushNotification(userRecord.fcm_token, title, message, {
  //     document_id: documentId,
  //     status: newStatus,
  //   });
  // }
};

module.exports = { createNotification, sendPushNotification, notifyDocumentStatus };
