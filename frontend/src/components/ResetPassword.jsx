// src/components/ResetPassword.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await api.get(`/auth/reset-password/${token}`);
        setValidToken(true);
      } catch (err) {
        setValidToken(false);
        setError('Invalid or expired reset link');
      }
    };
    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) {
    return <div className="min-h-screen flex items-center justify-center">Verifying...</div>;
  }

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-indigo-700">Reset Password</h1>
            <p className="text-gray-600 mt-2">Enter your new password</p>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}