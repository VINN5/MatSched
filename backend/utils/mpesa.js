// backend/utils/mpesa.js
const axios = require('axios');

// === MPESA CONFIG ===
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

const BASE_URL = 'https://sandbox.safaricom.co.ke';

// === GET OAUTH TOKEN ===
const getAccessToken = async () => {
  const url = `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('MPesa Token Error:', error.response?.data || error.message);
    throw new Error('Failed to get MPesa access token');
  }
};

// === INITIATE STK PUSH ===
const initiateSTKPush = async (phone, amount, bookingId) => {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: CALLBACK_URL,
    AccountReference: bookingId,
    TransactionDesc: "MatSched Booking Payment"
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log('STK Push Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('STK Push Failed:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

module.exports = {
  initiateSTKPush
};