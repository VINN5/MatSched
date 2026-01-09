// frontend/src/components/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';  // ← Use the shared api instance

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'passenger'    // ← Default
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/register', form);  // ← Correct: uses VITE_API_BASE_URL
      const { token, user } = res.data;

      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // REDIRECT BASED ON ROLE
      if (user.role === 'sacco_admin') navigate('/admin');
      else if (user.role === 'driver') navigate('/driver');
      else navigate('/passenger');

    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center">Register for MatSched PSV</h2>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          required
        />
        <input
          type="tel"
          placeholder="Phone (254712345678)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          pattern="254[1-9][0-9]{8}"
          title="Enter phone in format: 254712345678"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          required
        />

        {/* ROLE DROPDOWN */}
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="passenger">Passenger</option>
          <option value="driver">Driver</option>
          <option value="sacco_admin">Sacco Admin</option>
        </select>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-full font-semibold hover:scale-105 transition"
        >
          Register
        </button>
      </form>

      <p className="text-center mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}