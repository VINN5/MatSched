// frontend/src/components/DriverDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, Clock, DollarSign, AlertCircle, CheckCircle, X, QrCode, Navigation,
  Users, Play, Square, MapPin, Phone, TrendingUp, History, Car, ChevronRight
} from 'lucide-react';
import QrScanner from 'qr-scanner';
import MapView from './MapView';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [earnings, setEarnings] = useState({
    today: 0,
    tripEarnings: 0,
    parcelEarnings: 0,
    tripCount: 0,
    parcelCount: 0,
    passengers: 0
  });
  const [history, setHistory] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [activeTab, setActiveTab] = useState('current'); // current, history, parcels
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const videoRef = useRef(null);
  let qrScanner = null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // === FETCH DATA ===
  const fetchData = async () => {
    try {
      const [schedRes, parcelRes, earnRes, vehicleRes] = await Promise.all([
        api.get('/driver/schedule'),
        api.get('/driver/parcels'),
        api.get('/driver/earnings'),
        api.get('/driver/vehicle').catch(() => ({ data: null }))
      ]);
      setSchedule(schedRes.data);
      setParcels(parcelRes.data);
      setEarnings(earnRes.data);
      setVehicle(vehicleRes.data);
    } catch (err) {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/driver/history');
      setHistory(res.data.history || []);
    } catch (err) {
      console.error('History error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // === GPS TRACKING ===
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('GPS error:', error);
          // Don't show toast on every error, just log it
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      console.log('GPS not supported on this device');
    }
  }, []);

  // === TRIP ACTIONS ===
  const startTrip = async () => {
    try {
      await api.post('/driver/trip/start');
      showToast('Trip started!', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to start trip', 'error');
    }
  };

  const completeTrip = async () => {
    if (!window.confirm('Complete this trip and return to base?')) return;
    try {
      const res = await api.post('/driver/trip/complete');
      showToast(`Trip completed! Earned KES ${res.data.earnings}`, 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to complete trip', 'error');
    }
  };

  const markBoarded = async (bookingId) => {
    try {
      await api.post(`/driver/passenger/board/${bookingId}`);
      showToast('Passenger marked as boarded', 'success');
      fetchData();
    } catch (err) {
      showToast('Failed to mark boarded', 'error');
    }
  };

  // === QR SCANNER ===
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
    if (showScanner) startScanner();
    return () => stopScanner();
  }, [showScanner]);

  const verifyBooking = async (bookingId) => {
    try {
      const res = await api.post('/driver/verify', { bookingId });
      showToast(`${res.data.passenger?.name} verified!`, 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid QR code', 'error');
    }
  };

  // === PARCEL ===
  const markDelivered = async (id) => {
    try {
      const res = await api.post(`/driver/parcel/delivered/${id}`);
      setParcels(parcels.filter(p => p._id !== id));
      showToast(`+KES ${res.data.fee} earned!`, 'success');
      fetchData();
    } catch (err) {
      showToast('Failed', 'error');
    }
  };

  // === SOS ===
  const sendSOS = async () => {
    if (!window.confirm('Send EMERGENCY SOS to Sacco control?')) return;
    try {
      await api.post('/driver/sos', {
        location: currentLocation ? `${currentLocation.latitude}, ${currentLocation.longitude}` : 'GPS unavailable',
        issue: 'Emergency assistance needed'
      });
      showToast('🚨 SOS sent to Sacco!', 'success');
    } catch (err) {
      showToast('Failed to send SOS', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 p-4 md:p-6">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl text-white flex items-center gap-3 shadow-2xl animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Driver Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Welcome back, {user.name}!</p>
          </div>
          {vehicle && (
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg">
              <Car className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="font-bold text-gray-800">{vehicle.plate}</p>
                <p className="text-xs text-gray-500">{vehicle.type} • {vehicle.capacity} seats</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EARNINGS CARD */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="backdrop-blur-xl bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-green-100 text-sm font-medium">Today's Earnings</p>
              <p className="text-5xl font-bold">KES {earnings.today.toLocaleString()}</p>
            </div>
            <DollarSign className="h-16 w-16 text-green-200" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-green-400">
            <div>
              <p className="text-green-100 text-xs">Trips</p>
              <p className="text-2xl font-bold">{earnings.tripCount}</p>
            </div>
            <div>
              <p className="text-green-100 text-xs">Passengers</p>
              <p className="text-2xl font-bold">{earnings.passengers}</p>
            </div>
            <div>
              <p className="text-green-100 text-xs">Trip Earnings</p>
              <p className="text-xl font-bold">KES {earnings.tripEarnings}</p>
            </div>
            <div>
              <p className="text-green-100 text-xs">Parcel Earnings</p>
              <p className="text-xl font-bold">KES {earnings.parcelEarnings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-lg">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'current'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Navigation className="h-5 w-5 inline mr-2" />
            Current Trip
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <History className="h-5 w-5 inline mr-2" />
            History
          </button>
          <button
            onClick={() => setActiveTab('parcels')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'parcels'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package className="h-5 w-5 inline mr-2" />
            Parcels ({parcels.length})
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto">
        {activeTab === 'current' && (
          <div className="space-y-6">
            {/* TRIP CARD */}
            <div className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-xl p-6 border border-white/30">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Navigation className="h-6 w-6 text-indigo-600" />
                Current Trip
              </h2>

              {schedule ? (
                <div className="space-y-6">
                  {/* ROUTE INFO */}
                  <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-indigo-900">{schedule.route?.name}</h3>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                        schedule.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                        schedule.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {schedule.status === 'scheduled' ? '⏱️ Scheduled' :
                         schedule.status === 'in_transit' ? '🚗 In Transit' : '✅ Completed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-gray-700 mb-3">
                      <MapPin className="h-5 w-5 text-indigo-600" />
                      <span className="font-semibold">{schedule.route?.from}</span>
                      <ChevronRight className="h-5 w-5" />
                      <span className="font-semibold">{schedule.route?.to}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          {new Date(schedule.departureTime).toLocaleTimeString('en-KE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Africa/Nairobi'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-bold">
                          {schedule.bookedSeats}/{schedule.totalCapacity} passengers
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TRIP ACTIONS */}
                  <div className="flex gap-3">
                    {schedule.status === 'scheduled' && (
                      <button
                        onClick={startTrip}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-xl transform hover:scale-105 transition-all"
                      >
                        <Play className="h-5 w-5" /> Start Trip
                      </button>
                    )}
                    {schedule.status === 'in_transit' && (
                      <button
                        onClick={completeTrip}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-xl transform hover:scale-105 transition-all"
                      >
                        <Square className="h-5 w-5" /> Complete Trip
                      </button>
                    )}
                    <button
                      onClick={() => setShowScanner(true)}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-xl transform hover:scale-105 transition-all"
                    >
                      <QrCode className="h-5 w-5" /> Scan QR
                    </button>
                  </div>

                  {/* MAP VIEW */}
                  <div className="h-96 md:h-[500px]">
                    <MapView
                      schedule={schedule}
                      currentLocation={currentLocation}
                      onRouteUpdate={(info) => setRouteInfo(info)}
                    />
                  </div>

                  {/* ROUTE INFO FROM MAP */}
                  {routeInfo && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Distance</p>
                        <p className="text-2xl font-bold text-indigo-600">
                          {(routeInfo.distance / 1000).toFixed(1)} km
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Duration</p>
                        <p className="text-2xl font-bold text-indigo-600">
                          {Math.round(routeInfo.duration / 60)} min
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Traffic</p>
                        <p className={`text-2xl font-bold capitalize ${
                          routeInfo.trafficLevel === 'heavy' ? 'text-red-600' :
                          routeInfo.trafficLevel === 'moderate' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {routeInfo.trafficLevel}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PASSENGERS LIST */}
                  {schedule.passengers && schedule.passengers.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        Passengers ({schedule.passengers.length})
                      </h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {schedule.passengers.map((p) => (
                          <div
                            key={p.id}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              p.boarded
                                ? 'bg-green-50 border-green-300'
                                : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="font-bold text-gray-900">{p.name}</p>
                                  {p.boarded && (
                                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-bold">
                                      ✓ Boarded
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{p.phone}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <MapPin className="h-3 w-3" />
                                  <span>{p.pickup} → {p.dropoff}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-indigo-600">KES {p.fare}</p>
                                {!p.boarded && (
                                  <button
                                    onClick={() => markBoarded(p.id)}
                                    className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
                                  >
                                    Board
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ROUTE STOPS */}
                  {schedule.route?.stops && schedule.route.stops.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3">Route Stops</h3>
                      <div className="space-y-2">
                        {schedule.route.stops.map((stop, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                              i === 0 ? 'bg-green-600' :
                              i === schedule.route.stops.length - 1 ? 'bg-red-600' :
                              'bg-indigo-600'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{stop.name}</p>
                              {stop.latitude && stop.longitude && (
                                <p className="text-xs text-gray-500">
                                  {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-bold text-indigo-600">
                              KES {stop.fareFromStart}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Navigation className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">No Trip Assigned</p>
                  <p className="text-gray-500">Wait for Sacco to assign your next trip</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-xl p-6 border border-white/30">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <History className="h-6 w-6 text-indigo-600" />
              Trip History
            </h2>

            {history.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No completed trips yet</p>
            ) : (
              <div className="space-y-3">
                {history.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{trip.route}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(trip.date).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Africa/Nairobi'
                          })}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {trip.passengers} passengers
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          KES {trip.earnings}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'parcels' && (
          <div className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-xl p-6 border border-white/30">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Package className="h-6 w-6 text-indigo-600" />
              Assigned Parcels ({parcels.length})
            </h2>

            {parcels.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No parcels assigned</p>
            ) : (
              <div className="space-y-3">
                {parcels.map((p) => (
                  <div
                    key={p._id}
                    className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-300"
                  >
                    <p className="font-bold text-gray-900 mb-2">{p.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <MapPin className="h-4 w-4" />
                      <span>{p.pickup} → {p.dropoff}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-green-600">+ KES {p.fee}</p>
                      <button
                        onClick={() => markDelivered(p._id)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
                      >
                        Mark Delivered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SOS BUTTON */}
      <div className="max-w-6xl mx-auto mt-8">
        <button
          onClick={sendSOS}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-5 rounded-xl text-xl font-bold flex items-center justify-center gap-3 hover:shadow-2xl transform hover:scale-105 transition-all"
        >
          <AlertCircle className="h-7 w-7" />
          🚨 EMERGENCY SOS
        </button>
      </div>

      {/* QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">Scan Passenger QR</h3>
              <button
                onClick={() => {
                  setShowScanner(false);
                  stopScanner();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="relative">
              <video ref={videoRef} className="w-full rounded-xl" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-red-500 w-64 h-64 rounded-xl opacity-70"></div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600 mt-4">
              Position the QR code within the frame
            </p>
          </div>
        </div>
      )}
    </div>
  );
}