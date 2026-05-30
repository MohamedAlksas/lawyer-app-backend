import admin from 'firebase-admin';

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
let firebaseInitialized = false;

if (serviceAccountBase64) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 not set — FCM push disabled');
}

export async function sendPushNotification(userId, title, body, data = {}) {
  if (!firebaseInitialized) return;

  try {
    const { supabase } = await import('./supabase.js');
    const { data: tokens } = await supabase
      .from('DeviceToken')
      .select('token')
      .eq('userId', userId);

    if (!tokens || tokens.length === 0) return;

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      tokens: tokens.map((t) => t.token),
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    const failedTokens = [];

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });

      if (failedTokens.length > 0) {
        await supabase
          .from('DeviceToken')
          .delete()
          .in('token', failedTokens);
      }
    }
  } catch (err) {
    console.error('FCM send error:', err.message);
  }
}

export { firebaseInitialized };
