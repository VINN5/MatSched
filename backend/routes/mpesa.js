// backend/routes/mpesa.js
const express = require('express');
const router = express.Router();
const { initiateSTKPush } = require('../utils/mpesa');

// === STK PUSH ENDPOINT ===
router.post('/stkpush', async (req, res) => {
  const { phone, amount, bookingId } = req.body;

  if (!phone || !amount || !bookingId) {
    return res.status(400).json({ error: 'Phone, amount, and bookingId required' });
  }

  try {
    const result = await initiateSTKPush(phone, amount, bookingId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Payment failed' });
  }
});

// === CALLBACK (FROM MPESA) ===
router.post('/callback', (req, res) => {
  console.log('MPESA CALLBACK RECEIVED:', JSON.stringify(req.body, null, 2));

  const { Body } = req.body;
  if (!Body || !Body.stkCallback) {
    return res.json({ success: false, message: 'Invalid callback' });
  }

  const { ResultCode, CallbackMetadata } = Body.stkCallback;

  if (ResultCode === 0) {
    const items = CallbackMetadata.Items;
    const amount = items.find(i => i.Name === 'Amount')?.Value;
    const mpesaReceipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    const phone = items.find(i => i.Name === 'PhoneNumber')?.Value;

    console.log(`Payment SUCCESS: KSh ${amount} from ${phone} | Receipt: ${mpesaReceipt}`);

    // TODO: Update booking status to "confirmed" in DB
    // Booking.findOneAndUpdate({ bookingId }, { status: 'confirmed', mpesaReceipt })

  } else {
    console.log('Payment FAILED:', Body.stkCallback.ResultDesc);
  }

  res.json({ success: true });
});

module.exports = router;