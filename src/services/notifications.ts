import axios from 'axios';

interface PushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: object;
}

export const sendPushNotification = async (
  pushToken: string | null | undefined,
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
    await axios.post('https://exp.host/--/api/v2/push/send', message, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Push notification failed:', error);
  }
};