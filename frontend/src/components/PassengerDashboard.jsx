// src/components/PassengerDashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  MapPin, Clock, Users, Star, Search, X, Navigation,
  DollarSign, ChevronDown, AlertCircle
} from 'lucide-react';

const PassengerDashboard = () => {
  const { user, token } = useAuth();

  // === STATE ===
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [matatus, setMatatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // === STOP MODAL STATE ===
  const [stopModal, setStopModal] = useState({
    open: false,
    scheduleId: null,
    stops: [],
    origin: '',
    destination: '',
    hasBoarded: false
  });
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [segmentFare, setSegmentFare] = useState(0);

  const socketRef = useRef(null);

  // === UTILITIES ===
  const playSound = useCallback(() => {
    new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3')
      .play().catch(() => {});
  }, []);

  const formatTime = useCallback((date) => {
    return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  }, []);

  // === SEARCH MATATUS ===
  const searchMatatus = useCallback(async () => {
    if (!from.trim() || !to.trim()) {
      setMatatus([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/schedules/smart`,
        { from, to },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMatatus(res.data.matatus || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Search failed');
      setMatatus([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, token]);

  // === LIVE CLOCK ===
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // === SOCKET.IO ===
  useEffect(() => {
    if (!token || socketRef.current) return;

    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://matsched.onrender.com', {
      withCredentials: true,
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected (ID:', socket.id, ')');
    });

    socket.on('seat-booked', () => {
      playSound();
      searchMatatus();
    });

    socket.on('seat-released', () => searchMatatus());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, playSound, searchMatatus]);

  // === CALCULATE SEGMENT FARE ===
  useEffect(() => {
    if (!pickup || !dropoff || !Array.isArray(stopModal.stops)) {
      setSegmentFare(0);
      return;
    }

    const pickupStop = stopModal.stops.find(s => s.name === pickup);
    const dropoffStop = stopModal.stops.find(s => s.name === dropoff);

    if (pickupStop && dropoffStop && pickupStop.order < dropoffStop.order) {
      const fare = dropoffStop.fareFromStart - pickupStop.fareFromStart;
      setSegmentFare(fare);
    } else {
      setSegmentFare(0);
    }
  }, [pickup, dropoff, stopModal.stops]);

  // === LOADING SCREEN ===
  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // === OPEN STOP MODAL ===
  const openStopModal = (scheduleId, route, availableSeats, totalSeats) => {
    const stops = Array.isArray(route?.stops) ? route.stops : [];
    if (stops.length < 3) {
      alert('Route must have at least 3 stops');
      return;
    }

    const origin = stops[0].name;
    const destination = stops[stops.length - 1].name;
    const hasBoarded = availableSeats < totalSeats;

    setStopModal({
      open: true,
      scheduleId,
      stops,
      origin,
      destination,
      hasBoarded
    });

    setPickup(hasBoarded ? stops[1].name : origin);
    setDropoff(destination);
    setPhone('');
    setPaymentStatus('');
    setSegmentFare(0);
  };

 // === INITIATE PAYMENT (MPESA DARAJA STK PUSH) ===
const initiateSegmentPayment = async () => {
  if (!phone.match(/^254[0-9]{9}$/)) {
    alert('Enter valid Kenyan number: 2547XXXXXXXXX');
    return;
  }
  if (segmentFare === 0) {
    alert('Please select valid pickup and dropoff stops');
    return;
  }

  const totalAmount = segmentFare + 2; // + KSh 2 fee
  const bookingId = `BOOK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  setPaymentStatus('Sending M-Pesa prompt...');

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/mpesa/stkpush`,
      {
        phone: phone,
        amount: totalAmount,
        bookingId: bookingId
      },
      { withCredentials: true }
    );

    if (response.data.success) {
      setPaymentStatus(`Prompt sent to ${phone}`);
      alert(`M-Pesa prompt sent! Pay KSh ${totalAmount} to complete booking`);
      // Optional: Save temp booking in state or localStorage
      console.log('STK Push initiated:', response.data.data);
    } else {
      throw new Error(response.data.error || 'STK Push failed');
    }
  } catch (err) {
    console.error('MPesa STK Push error:', err);
    setPaymentStatus('');
    alert(err.response?.data?.error || 'Payment failed. Try again.');
  }
};

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      {/* HEADER */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Find Your Matatu
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-purple-500" />
                <span>Nairobi, KE</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>{formatTime(currentTime)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="font-semibold text-gray-800 dark:text-white">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Passenger</p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/90 rounded-2xl shadow-2xl p-6 border border-white/30 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
              <input
                placeholder="From (e.g., CBD)"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
              />
            </div>
            <div className="flex-1 relative">
              <Navigation className="absolute left-4 top-4 h-5 w-5 text-purple-500" />
              <input
                placeholder="To (e.g., Juja)"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-base"
              />
            </div>
            <button
              onClick={searchMatatus}
              disabled={loading || !from.trim() || !to.trim()}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" /> Search Matatus
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div className="max-w-5xl mx-auto space-y-5">
        {matatus.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-700 rounded-full w-28 h-28 mx-auto mb-6 flex items-center justify-center shadow-inner">
              <Search className="h-14 w-14 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              {loading ? 'Searching for matatus...' : 'No matatus found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try: <span className="font-medium">"CBD" to "Juja"</span>
            </p>
          </div>
        ) : (
          matatus.map((m, idx) => {
            const totalSeats = m.vehicle?.capacity || 14;
            const isFull = m.availableSeats === 0;
            const stops = Array.isArray(m.route?.stops) ? m.route.stops : [];
            const hasStops = stops.length > 1;

            return (
              <div
                key={m.scheduleId}
                className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl hover:shadow-2xl transition-all border border-white/30 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-6">
                  {/* ROUTE HEADER */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {m.from} to {m.to}
                        {m.ecoScore > 75 && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-full font-medium">
                            Eco
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {m.from} to <span className="font-semibold text-purple-600 dark:text-purple-400">{m.to}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{m.waitTime}</p>
                      <p className="text-xs text-gray-500">mins</p>
                    </div>
                  </div>

                  {/* INFO GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {m.availableSeats} / {totalSeats} seats left
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Departs {formatTime(new Date(m.departureTime))}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{m.comfortScore}% Comfort</span>
                    </div>
                  </div>

                  {/* VEHICLE INFO */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 px-4 py-2 rounded-full text-sm font-bold text-gray-800 dark:text-white">
                      {m.vehicle?.plate || 'KCA 000X'}
                    </div>
                    <span className="text-xs text-gray-500 capitalize">
                      {m.vehicle?.type || 'matatu'} ({totalSeats} seats)
                    </span>
                  </div>

                  {/* STOPS & PRICES */}
                  {hasStops && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <p className="font-bold text-blue-700 dark:text-blue-300">All Stops & Fares</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {stops.map((stop, i) => {
                          const isOrigin = i === 0;
                          const isFinal = i === stops.length - 1;
                          return (
                            <div
                              key={stop.name}
                              className={`p-3 rounded-lg text-center ${
                                isOrigin
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-bold shadow-sm'
                                  : isFinal
                                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 font-bold shadow-sm'
                                  : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 font-medium'
                              }`}
                            >
                              <div className="font-semibold text-sm truncate">
                                {stop.name}
                                {isOrigin && ' (Origin)'}
                                {!isOrigin && !isFinal && ' (Drop/Pick)'}
                                {isFinal && ' (Final)'}
                              </div>
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                KSh {stop.fareFromStart}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* BOOK BUTTON */}
                  <button
                    onClick={() => openStopModal(m.scheduleId, m.route, m.availableSeats, totalSeats)}
                    disabled={isFull}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-base ${
                      isFull
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg transform hover:scale-105'
                    }`}
                  >
                    {isFull ? (
                      <>Full</>
                    ) : (
                      <>
                        <DollarSign className="h-5 w-5" />
                        {hasStops ? 'Select Stops & Pay' : `Pay KSh ${m.price}`}
                        {m.isSurge && <span className="text-xs text-red-600 ml-1">(Surge)</span>}
                      </>
                    )}
                  </button>
                </div>

                {/* PROGRESS BAR */}
                <div className="h-1 bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                    style={{ width: `${((idx + 1) / matatus.length) * 100}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STOP SELECTION MODAL */}
      {stopModal.open && stopModal.stops.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Select Your Stops</h3>
              <button
                onClick={() => setStopModal({ open: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* PICKUP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pickup Stop
                </label>
                <select
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                >
                  <option value={stopModal.origin}>
                    {stopModal.origin} — KSh 0 (Origin)
                  </option>
                  {stopModal.hasBoarded &&
                    stopModal.stops
                      .filter((_, i) => i > 0 && i < stopModal.stops.length - 1)
                      .map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} — KSh {s.fareFromStart} (Drop-off / Pick-up)
                        </option>
                      ))}
                </select>
              </div>

              {/* DROPOFF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Drop-off Stop
                </label>
                <select
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-base"
                >
                  {stopModal.stops
                    .filter((s) => {
                      const p = stopModal.stops.find((ss) => ss.name === pickup);
                      return p && s.order > p.order;
                    })
                    .map((s) => {
                      const pickupStop = stopModal.stops.find(ss => ss.name === pickup);
                      const segmentPrice = s.fareFromStart - (pickupStop?.fareFromStart || 0);
                      return (
                        <option key={s.name} value={s.name}>
                          {s.name} — KSh {segmentPrice} {s.name === stopModal.destination && '(Final)'}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* FARE */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-5 text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {pickup} to {dropoff}
                </p>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  KSh {segmentFare + 2}
                  <span className="text-sm text-gray-500 ml-2">+ KSh 2 fee</span>
                </p>
              </div>

              {/* PHONE */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="2547XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              {/* PAY */}
              <button
                onClick={initiateSegmentPayment}
                disabled={segmentFare === 0 || !phone.match(/^254[0-9]{9}$/)}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign className="h-5 w-5" />
                Pay KSh {segmentFare + 2}
              </button>

              {/* PAYMENT STATUS */}
              {paymentStatus && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center flex items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{paymentStatus}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerDashboard;