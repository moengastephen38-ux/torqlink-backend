 import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// 1. Get the OAuth Access Token from Safaricom
const getMpesaToken = async () => {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Mpesa Token Error:", error);
        throw new Error("Failed to get M-Pesa token");
    }
};

// 2. Trigger the STK Push
export const triggerStkPush = async (phoneNumber: string, amount: number) => {
    const token = await getMpesaToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    
    // Password = Base64(Shortcode + Passkey + Timestamp)
    const password = Buffer.from(
        process.env.MPESA_SHORTCODE! + process.env.MPESA_PASSKEY! + timestamp
    ).toString('base64');

    const data = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber, // Format: 2547XXXXXXXX
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "TorqLink",
        TransactionDesc: "Payment for Towing Service"
    };

    const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        data,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
};