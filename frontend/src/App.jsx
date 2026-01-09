// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import Home from './components/Home.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import DriverDashboard from './components/DriverDashboard.jsx';
import PassengerDashboard from './components/PassengerDashboard.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

function AppContent() {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  // === LOAD DARK MODE ===
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedTheme);
  }, []);

  // === APPLY DARK MODE ===
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // === REDIRECT LOGIC ===
  const getRedirect = () => {
    if (!user) return '/';
    if (user.role === 'sacco_admin') return '/admin';
    if (user.role === 'driver') return '/driver';
    return '/passenger';
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* NAV BAR */}
      {user && (
        <nav className={`shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-gradient-to-r from-blue-600 to-purple-600'} p-4 sticky top-0 z-50`}>
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">MatSched PSV</h1>
            <div className="flex items-center gap-4">
              <span className="text-white capitalize">{user.role.replace('_', ' ')}</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-white px-4 py-2 rounded hover:bg-white hover:bg-opacity-20 transition"
              >
                {darkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full transition"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* ROUTES */}
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<Home darkMode={darkMode} />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to={getRedirect()} />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to={getRedirect()} />} />

        {/* PASSWORD RESET FLOW */}
        <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to={getRedirect()} />} />
        <Route path="/reset-password/:token" element={!user ? <ResetPassword /> : <Navigate to={getRedirect()} />} />

        {/* PROTECTED DASHBOARDS */}
        <Route 
          path="/admin" 
          element={user?.role === 'sacco_admin' ? <AdminDashboard user={user} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/driver" 
          element={user?.role === 'driver' ? <DriverDashboard user={user} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/passenger" 
          element={user?.role === 'passenger' ? <PassengerDashboard user={user} /> : <Navigate to="/" />} 
        />
      </Routes>
    </div>
  );
}

// === MAIN APP — WRAP IN AuthProvider ===
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;