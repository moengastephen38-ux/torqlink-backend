 import axios from 'axios';

interface PushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: object;
}

const expo = axios.create({
  baseURL: 'https://exp.host/--/api/v2',
  headers: {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  },
});

export const sendPushNotification = async (
  pushToken: string | null |undefined,
  title: string,
  body: string,
  data?: object
): Promise<void> => {

  if (!pushToken) return;

  const message: PushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  try {
    await expo.post('/push/send', message);
    console.log(`Notification sent to ${pushToken}`);
  } catch (error) {
    console.error('Push notification failed:', error);
  }
};

/* ======================================================
   READY-MADE TORQLINK NOTIFICATIONS
====================================================== */

export const notifyJobAccepted = async (
  pushToken: string,
  mechanicName: string,
  requestId: string
) => {

  return sendPushNotification(
    pushToken,
    '✅ Mechanic Found!',
    `${mechanicName} has accepted your request and is on the way.`,
    {
      type: 'JOB_ACCEPTED',
      requestId,
    }
  );

};

export const notifyMechanicEnRoute = async (
  pushToken: string,
  requestId: string
) => {

  return sendPushNotification(
    pushToken,
    '🚗 Mechanic En Route',
    'Your mechanic is travelling to your location.',
    {
      type: 'MECHANIC_EN_ROUTE',
      requestId,
    }
  );

};

export const notifyJobResolved = async (
  pushToken: string,
  requestId: string
) => {

  return sendPushNotification(
    pushToken,
    '🎉 Job Completed',
    'Your roadside request has been completed.',
    {
      type: 'JOB_RESOLVED',
      requestId,
    }
  );

};