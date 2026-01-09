// frontend/src/components/DriverDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Package, Clock, DollarSign, AlertCircle, CheckCircle, X, QrCode, Navigation } from 'lucide-react';
import QrScanner from 'qr-scanner';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [earnings, setEarnings] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef(null);
  let qrScanner = null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // === FETCH DATA ===
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, parcelRes, earnRes] = await Promise.all([
          api.get('/driver/schedule'),
          api.get('/driver/parcels'),
          api.get('/driver/earnings')
        ]);
        setSchedule(schedRes.data);
        setParcels(parcelRes.data);
        setEarnings(earnRes.data.today || 0);
      } catch (err) {
        showToast('Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // === QR SCANNER LOGIC ===
  const startScanner = () => {
    if (!videoRef.current) return;
    qrScanner = new QrScanner(
      videoRef.current,
      (result) => {
        verifyBooking(result.data);
        setShowScanner(false);
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );
    qrScanner.start().catch(() => {
      showToast('Camera access denied', 'error');
    });
  };

  const stopScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      qrScanner = null;
    }
  };

  useEffect(() => {
    if (showScanner) {
      startScanner();
    }
    return () => stopScanner();
  }, [showScanner]);

  // === VERIFY BOOKING ===
  const verifyBooking = async (bookingId) => {
    try {
      await api.post('/driver/verify', { bookingId });
      showToast('Passenger verified!', 'success');
    } catch (err) {
      showToast('Invalid QR code', 'error');
    }
  };

  // === SOS ===
  const sendSOS = async () => {
    try {
      await api.post('/driver/sos');
      showToast('SOS sent!', 'success');
    } catch (err) {
      showToast('Failed', 'error');
    }
  };

  // === MARK DELIVERED ===
  const markDelivered = async (id) => {
    try {
      const res = await api.post(`/driver/parcel/delivered/${id}`);
      setParcels(parcels.filter(p => p._id !== id));
      setEarnings(prev => prev + res.data.fee);
      showToast(`+KES ${res.data.fee} earned!`, 'success');
    } catch (err) {
      showToast('Failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-lg animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl text-white flex items-center gap-2 shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-indigo-700">Driver Dashboard</h1>
        <p className="text-gray-600">Welcome, {user.name}!</p>
      </div>

      {/* EARNINGS */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">Today's Earnings</p>
            <p className="text-4xl font-bold text-green-600">KES {earnings}</p>
          </div>
          <DollarSign className="h-12 w-12 text-green-600" />
        </div>
      </div>

      {/* CURRENT TRIP */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Navigation className="h-5 w-5" /> Current Trip
        </h2>
        {schedule ? (
          <div className="space-y-3">
            <p><strong>{schedule.route?.from} to {schedule.route?.to}</strong></p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {new Date(schedule.departureTime).toLocaleTimeString()}
            </p>
            <p>Passengers: {schedule.bookedSeats || 0}/{schedule.vehicle?.capacity || 14}</p>
            <button
              onClick={() => setShowScanner(true)}
              className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
            >
              <QrCode className="h-5 w-5" /> Scan Passenger QR
            </button>
          </div>
        ) : (
          <p className="text-gray-500">No trip assigned yet</p>
        )}
      </div>

      {/* PARCELS */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" /> Parcels ({parcels.length})
        </h2>
        {parcels.length === 0 ? (
          <p className="text-gray-500">No parcels assigned</p>
        ) : (
          <div className="space-y-3">
            {parcels.map(p => (
              <div key={p._id} className="p-3 bg-yellow-50 rounded-xl border border-yellow-300">
                <p className="font-semibold">{p.description}</p>
                <p className="text-sm">{p.pickup} to {p.dropoff}</p>
                <p className="text-sm font-bold text-green-600">+ KES {p.fee}</p>
                <button
                  onClick={() => markDelivered(p._id)}
                  className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 transition"
                >
                  Mark Delivered
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOS */}
      <div className="max-w-4xl mx-auto">
        <button
          onClick={sendSOS}
          className="w-full bg-red-600 text-white py-4 rounded-xl text-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition"
        >
          <AlertCircle className="h-6 w-6" /> EMERGENCY SOS
        </button>
      </div>

      {/* QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Scan Passenger QR</h3>
              <button
                onClick={() => { setShowScanner(false); stopScanner(); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative">
              <video ref={videoRef} className="w-full rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-red-500 w-64 h-64 rounded-lg opacity-70"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}