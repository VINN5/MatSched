// src/components/AdminDashboard.js
import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  MapPin, AlertCircle, CheckCircle, X, Car, Route, Calendar, ArrowRight,
  Loader2, Edit2, Trash2, Plus, Minus, TrendingUp
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const [saccoId, setSaccoId] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [pastSchedules, setPastSchedules] = useState([]);
  const [pastPage, setPastPage] = useState(1);
  const [activeTab, setActiveTab] = useState('today');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // === REVENUE STATE ===
  const [segmentRevenue, setSegmentRevenue] = useState([]);

  // === FORM STATES ===
  const [formRoute, setFormRoute] = useState({
    name: '', from: '', to: '', distance: '', estimatedTime: '',
    stops: [{ name: '', fareFromStart: 0 }]
  });
  const [formVehicle, setFormVehicle] = useState({ plate: '', type: 'matatu', capacity: 14 });
  const [formSchedule, setFormSchedule] = useState({ routeId: '', vehicleId: '', departureTime: '', isRoundTrip: true });

  // === EDIT MODAL STATES ===
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editRouteModalOpen, setEditRouteModalOpen] = useState(false);

  // === SHOW TOAST ===
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // === OPEN EDIT MODAL (VEHICLE) ===
  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setEditModalOpen(true);
  };

  // === OPEN EDIT ROUTE MODAL ===
  const openEditRouteModal = (route) => {
    setEditingRoute({
      ...route,
      stops: route.stops.map(s => ({ name: s.name, fareFromStart: s.fareFromStart }))
    });
    setEditRouteModalOpen(true);
  };

  // === HANDLE EDIT VEHICLE SUBMIT ===
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/vehicles/${editingVehicle._id}`, editingVehicle);
      showToast('Vehicle updated!', 'success');
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update', 'error');
    }
  };

  // === HANDLE EDIT ROUTE SUBMIT ===
  const handleEditRouteSubmit = async (e) => {
    e.preventDefault();
    const { _id, stops, ...rest } = editingRoute;
    if (stops.length < 2 || stops.some(s => !s.name)) {
      showToast('Need at least 2 stops with names', 'error');
      return;
    }
    const price = stops[stops.length - 1].fareFromStart;
    try {
      await api.put(`/admin/routes/${_id}`, {
        ...rest,
        price,
        stops
      });
      showToast('Route updated!', 'success');
      setEditRouteModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update route', 'error');
    }
  };

  // === DELETE ROUTE ===
  const deleteRoute = async (routeId) => {
    if (!window.confirm('Delete this route? All schedules will be affected.')) return;
    try {
      await api.delete(`/admin/routes/${routeId}`);
      showToast('Route deleted', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  // === FETCH DATA ===
  const fetchData = useCallback(async () => {
    if (!saccoId || !token) return;
    setLoading(true);
    setError('');
    try {
      const [routesRes, vehiclesRes, schedulesRes, revenueRes] = await Promise.all([
        api.get('/admin/routes'),
        api.get('/admin/vehicles'),
        api.get('/admin/schedules'),
        api.get('/admin/revenue/today')
      ]);
      setRoutes(routesRes.data);
      setVehicles(vehiclesRes.data);
      setSchedules(schedulesRes.data);
      setSegmentRevenue(revenueRes.data.revenue || []);
    } catch (err) {
      setError('Failed to load data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [saccoId, token]);

  // === LOAD PAST SCHEDULES ===
  const loadPastSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/schedules/past?page=${pastPage}`);
      setPastSchedules(res.data.schedules);
    } catch (err) {
      setError('Failed to load past schedules');
    } finally {
      setLoading(false);
    }
  }, [pastPage]);

  // === LOAD SACCO ID ===
  useEffect(() => {
    if (!token) return;
    const loadSacco = async () => {
      try {
        let id = user?.sacco || (await api.get('/admin/me')).data.saccoId;
        setSaccoId(id);
      } catch (err) {
        setError('Failed to load sacco. Please re-login.');
      }
    };
    loadSacco();
  }, [user, token]);

  // === FETCH TODAY'S DATA ===
  useEffect(() => {
    if (saccoId) fetchData();
  }, [saccoId, fetchData]);

  // === FETCH PAST WHEN TAB OR PAGE CHANGES ===
  useEffect(() => {
    if (activeTab === 'past') loadPastSchedules();
  }, [activeTab, pastPage, loadPastSchedules]);

  // === SOCKET.IO FOR VEHICLE RETURN ===
  useEffect(() => {
    if (!token || !saccoId) return;

    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://matsched.onrender.com', {
      withCredentials: true
    });
    socket.emit('join-sacco', saccoId);

    socket.on('vehicle-returned', (data) => {
      showToast(`${data.plate} is back and available!`, 'success');
      fetchData();
    });

    return () => socket.disconnect();
  }, [saccoId, token, fetchData]);

  // === STOP MANAGEMENT (ADD/EDIT) ===
  const updateStops = (stops, setter) => {
    setter(prev => ({ ...prev, stops }));
  };

  const addStop = (setter, stops) => {
    const lastFare = stops[stops.length - 1]?.fareFromStart || 0;
    updateStops([...stops, { name: '', fareFromStart: lastFare }], setter);
  };

  const updateStop = (index, field, value, stops, setter) => {
    const newStops = [...stops];
    newStops[index][field] = field === 'fareFromStart' ? parseInt(value) || 0 : value;
    updateStops(newStops, setter);
  };

  const removeStop = (index, stops, setter) => {
    updateStops(stops.filter((_, i) => i !== index), setter);
  };

  // === SUBMIT HANDLERS ===
  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/vehicles', formVehicle);
      showToast('Vehicle added successfully!', 'success');
      setFormVehicle({ plate: '', type: 'matatu', capacity: 14 });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add vehicle', 'error');
    }
  };

  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    if (formRoute.stops.length < 2 || formRoute.stops.some(s => !s.name)) {
      showToast('Add at least 2 stops with names', 'error');
      return;
    }
    const price = formRoute.stops[formRoute.stops.length - 1].fareFromStart;
    try {
      await api.post('/admin/routes', {
        ...formRoute,
        price
      });
      showToast('Route added!', 'success');
      setFormRoute({ name: '', from: '', to: '', distance: '', estimatedTime: '', stops: [{ name: '', fareFromStart: 0 }] });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add route', 'error');
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    // === VALIDATE ===
    if (!formSchedule.routeId || !formSchedule.vehicleId || !formSchedule.departureTime) {
      showToast('Please fill all fields', 'error');
      return;
    }

    // === RENAME KEYS TO MATCH BACKEND ===
    const payload = {
      route: formSchedule.routeId,
      vehicle: formSchedule.vehicleId,
      departureTime: formSchedule.departureTime,
      isRoundTrip: formSchedule.isRoundTrip
    };

    try {
      await api.post('/admin/schedules', payload);
      showToast('Schedule created!', 'success');
      setFormSchedule({ routeId: '', vehicleId: '', departureTime: '', isRoundTrip: true });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create schedule', 'error');
    }
  };

  // === RENDER ===
  if (!token) return <div className="p-6 text-center text-red-600">Not authenticated</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (saccoId === null) return <div className="p-6 text-center text-blue-600">Loading sacco...</div>;
  if (loading && activeTab === 'today') return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white transition-all animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-4">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* EDIT VEHICLE MODAL */}
      {editModalOpen && editingVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-bold text-blue-600">Edit Vehicle</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input
                placeholder="Plate No."
                value={editingVehicle.plate}
                onChange={e => setEditingVehicle({ ...editingVehicle, plate: e.target.value.toUpperCase() })}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={editingVehicle.type}
                onChange={e => setEditingVehicle({ ...editingVehicle, type: e.target.value })}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
              >
                <option value="matatu">Matatu (14 seats)</option>
                <option value="bus">Bus (33+ seats)</option>
              </select>
              <input
                type="number"
                placeholder="Capacity"
                value={editingVehicle.capacity}
                onChange={e => setEditingVehicle({ ...editingVehicle, capacity: parseInt(e.target.value) || 14 })}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-blue-500"
                min="14"
                required
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROUTE MODAL */}
      {editRouteModalOpen && editingRoute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-bold text-green-600">Edit Route</h3>
              <button onClick={() => setEditRouteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditRouteSubmit} className="space-y-4">
              <input
                placeholder="Route Name"
                value={editingRoute.name}
                onChange={e => setEditingRoute({ ...editingRoute, name: e.target.value })}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="From"
                  value={editingRoute.from}
                  onChange={e => setEditingRoute({ ...editingRoute, from: e.target.value })}
                  className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
                  required
                />
                <input
                  placeholder="To"
                  value={editingRoute.to}
                  onChange={e => setEditingRoute({ ...editingRoute, to: e.target.value })}
                  className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Distance (km)"
                  value={editingRoute.distance}
                  onChange={e => setEditingRoute({ ...editingRoute, distance: e.target.value })}
                  className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
                />
                <input
                  type="number"
                  placeholder="Est. Time (mins)"
                  value={editingRoute.estimatedTime}
                  onChange={e => setEditingRoute({ ...editingRoute, estimatedTime: e.target.value })}
                  className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl"
                />
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-xs font-medium text-gray-600">Stops & Cumulative Fare</p>
                {editingRoute.stops.map((stop, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      placeholder="Stop Name"
                      value={stop.name}
                      onChange={e => updateStop(i, 'name', e.target.value, editingRoute.stops, setEditingRoute)}
                      className="flex-1 p-2 text-sm border rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Fare from Start"
                      value={stop.fareFromStart}
                      onChange={e => updateStop(i, 'fareFromStart', e.target.value, editingRoute.stops, setEditingRoute)}
                      className="w-24 p-2 text-sm border rounded-lg"
                    />
                    {i > 0 && (
                      <button type="button" onClick={() => removeStop(i, editingRoute.stops, setEditingRoute)} className="p-1 text-red-600">
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addStop(setEditingRoute, editingRoute.stops)} className="text-xs text-blue-600 flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Add Stop
                </button>
              </div>

              <p className="text-xs text-gray-500">Full fare = last stop's fare. +2 KES dev fee per booking.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditRouteModalOpen(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition-all">Save Route</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sacco Control Center
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Multi-stop routes • Segment fares • Real-time revenue</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="font-semibold text-gray-800 dark:text-white">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sacco Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setActiveTab('today')} className={`px-8 py-3 font-semibold text-lg transition-all ${activeTab === 'today' ? 'border-b-3 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>Today ({schedules.length})</button>
          <button onClick={() => setActiveTab('revenue')} className={`px-8 py-3 font-semibold text-lg transition-all ${activeTab === 'revenue' ? 'border-b-3 border-green-600 text-green-600' : 'text-gray-600 hover:text-gray-800'}`}>Revenue</button>
          <button onClick={() => setActiveTab('past')} className={`px-8 py-3 font-semibold text-lg transition-all ${activeTab === 'past' ? 'border-b-3 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}>Past</button>
        </div>
      </div>

      {/* FORMS */}
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6 mb-8">
        {/* Add Route */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
          <h2 className="text-2xl font-bold mb-4 text-green-600 flex items-center gap-2">
            <Route className="h-6 w-6" /> Add Route + Stops
          </h2>
          <form onSubmit={handleRouteSubmit} className="space-y-3">
            <input placeholder="Route Name" value={formRoute.name} onChange={e => setFormRoute({ ...formRoute, name: e.target.value })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="From" value={formRoute.from} onChange={e => setFormRoute({ ...formRoute, from: e.target.value })} className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required />
              <input placeholder="To" value={formRoute.to} onChange={e => setFormRoute({ ...formRoute, to: e.target.value })} className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Distance (km)" value={formRoute.distance} onChange={e => setFormRoute({ ...formRoute, distance: e.target.value })} className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" />
              <input type="number" placeholder="Est. Time (mins)" value={formRoute.estimatedTime} onChange={e => setFormRoute({ ...formRoute, estimatedTime: e.target.value })} className="p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-xs font-medium text-gray-600">Stops & Cumulative Fare</p>
              {formRoute.stops.map((stop, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Stop Name" value={stop.name} onChange={e => updateStop(i, 'name', e.target.value, formRoute.stops, setFormRoute)} className="flex-1 p-2 text-sm border rounded-lg" />
                  <input type="number" placeholder="Fare from Start" value={stop.fareFromStart} onChange={e => updateStop(i, 'fareFromStart', e.target.value, formRoute.stops, setFormRoute)} className="w-24 p-2 text-sm border rounded-lg" />
                  {i > 0 && <button type="button" onClick={() => removeStop(i, formRoute.stops, setFormRoute)} className="p-1 text-red-600"><Minus className="h-4 w-4" /></button>}
                </div>
              ))}
              <button type="button" onClick={() => addStop(setFormRoute, formRoute.stops)} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="h-4 w-4" /> Add Stop</button>
            </div>

            <p className="text-xs text-gray-500">Full fare = last stop's fare. +2 KES dev fee per booking.</p>
            <button type="submit" className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition-all">Add Route</button>
          </form>
        </div>

        {/* Add Vehicle */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
          <h2 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2">
            <Car className="h-6 w-6" /> Add Vehicle
          </h2>
          <form onSubmit={handleVehicleSubmit} className="space-y-3">
            <input placeholder="Plate No. (e.g., KCA 123K)" value={formVehicle.plate} onChange={e => setFormVehicle({ ...formVehicle, plate: e.target.value.toUpperCase() })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required />
            <select value={formVehicle.type} onChange={e => {
              const type = e.target.value;
              const capacity = type === 'bus' ? 33 : 14;
              setFormVehicle({ ...formVehicle, type, capacity });
            }} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl">
              <option value="matatu">Matatu (14 seats)</option>
              <option value="bus">Bus (33 seats)</option>
            </select>
            <input type="number" placeholder="Capacity" value={formVehicle.capacity} onChange={e => setFormVehicle({ ...formVehicle, capacity: parseInt(e.target.value) || 14 })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" min="14" />
            <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition-all">Add Vehicle</button>
          </form>
        </div>

        {/* Create Schedule */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
          <h2 className="text-2xl font-bold mb-4 text-purple-600 flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Create Schedule
          </h2>
          <form onSubmit={handleScheduleSubmit} className="space-y-3">
            <select value={formSchedule.routeId} onChange={e => setFormSchedule({ ...formSchedule, routeId: e.target.value })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required>
              <option value="">Select Route</option>
              {routes.map(r => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.from} to {r.to}) – KES {r.price}
                </option>
              ))}
            </select>
            <select value={formSchedule.vehicleId} onChange={e => setFormSchedule({ ...formSchedule, vehicleId: e.target.value })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required>
              <option value="">Select Vehicle</option>
              {vehicles.map(v => (
                <option key={v._id} value={v._id}>{v.plate} ({v.type} • {v.capacity} seats)</option>
              ))}
            </select>
            <input type="datetime-local" value={formSchedule.departureTime} onChange={e => setFormSchedule({ ...formSchedule, departureTime: e.target.value })} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border rounded-xl" required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formSchedule.isRoundTrip} onChange={e => setFormSchedule({ ...formSchedule, isRoundTrip: e.target.checked })} />
              Round Trip
            </label>
            <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transform hover:scale-105 transition-all">Create Schedule</button>
          </form>
        </div>
      </div>

      {/* CONTENT */}
      {activeTab === 'today' ? (
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6">
          {/* Routes */}
          <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold mb-4 text-green-600 flex items-center gap-2">
              <Route className="h-5 w-5" /> Routes ({routes.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {routes.map(r => (
                <div key={r._id} className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {r.from} <ArrowRight className="h-3 w-3" /> {r.to}
                    </p>
                    <p className="text-xs font-bold text-green-700 dark:text-green-400">
                      KES {r.price} full • {r.stops?.length || 0} stops
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditRouteModal(r)} className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-all">
                      <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    <button onClick={() => deleteRoute(r._id)} className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-all">
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicles */}
          <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">
              <Car className="h-5 w-5" /> Available Vehicles ({vehicles.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {vehicles.map(v => (
                <div key={v._id} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{v.plate}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{v.type} • {v.capacity} seats</p>
                  </div>
                  <button onClick={() => openEditModal(v)} className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-all">
                    <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Schedules */}
          <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold mb-4 text-purple-600 flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Today's Schedules ({schedules.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {schedules.map(s => (
                <div key={s._id} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl">
                  <p className="font-semibold">{s.route?.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {s.vehicle?.plate || 'N/A'} | {new Date(s.departureTime).toLocaleString('en-KE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Africa/Nairobi'
                    })}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    KES {s.route?.price} + 2 KES fee
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'revenue' ? (
        <div className="max-w-7xl mx-auto backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
          <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Revenue by Segment (Today)
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Segment</th>
                  <th>Bookings</th>
                  <th>Sacco Fare</th>
                  <th>Your Cut (KSh 2)</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {segmentRevenue.map(r => (
                  <tr key={`${r.plate}-${r.pickup}-${r.dropoff}`}>
                    <td className="font-bold">{r.plate}</td>
                    <td>{r.pickup} to {r.dropoff}</td>
                    <td>{r.bookings}</td>
                    <td>KSh {r.totalFare.toLocaleString()}</td>
                    <td className="text-success font-bold">KSh {r.devFee}</td>
                    <td>KSh {r.totalRevenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl p-6 border border-white/30">
          <h3 className="text-2xl font-bold mb-6 text-purple-600">Past Schedules</h3>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            </div>
          ) : pastSchedules.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No past schedules</p>
          ) : (
            <>
              <div className="space-y-3">
                {pastSchedules.map(s => (
                  <div key={s._id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <p className="font-semibold">{s.route?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {s.vehicle?.plate} | {new Date(s.departureTime).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-3 mt-6">
                <button onClick={() => setPastPage(p => Math.max(1, p - 1))} disabled={pastPage === 1} className="px-5 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50">Prev</button>
                <span className="px-5 py-2">Page {pastPage}</span>
                <button onClick={() => setPastPage(p => p + 1)} disabled={pastSchedules.length < 20} className="px-5 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50">Next</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}