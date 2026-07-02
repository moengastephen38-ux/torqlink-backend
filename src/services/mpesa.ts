import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const getAccessToken = async (): Promise<string> => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY!;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const url = process.env.MPESA_ENV === 'sandbox'
    ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const response = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  return response.data.access_token;
};

export const stkPush = async (
  phone: string,
  amount: number,
  serviceRequestId: string
): Promise<any> => {
  const accessToken = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const url = process.env.MPESA_ENV === 'sandbox'
    ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  // Format phone number — remove leading 0 and add 254
  const formattedPhone = phone.startsWith('0')
    ? `254${phone.slice(1)}`
    : phone.startsWith('+')
    ? phone.slice(1)
    : phone;

  const response = await axios.post(url, {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount),
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: `TorqLink-${serviceRequestId.slice(0, 8)}`,
    TransactionDesc: 'TorqLink Roadside Assistance Payment',
  }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.data;
};