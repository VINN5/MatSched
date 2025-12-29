import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Dashboard({ darkMode }) {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ title: '', date: '', location: '', priority: 'medium' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/schedules');
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`http://localhost:3000/api/schedules/${editing}`, form);
        setEditing(null);
      } else {
        await axios.post('http://localhost:3000/api/schedules', form);
      }
      setForm({ title: '', date: '', location: '', priority: 'medium' });
      fetchSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (s) => {
    setForm({ title: s.title, date: s.date.slice(0, 16), location: s.location, priority: s.priority });
    setEditing(s._id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this schedule?')) {
      await axios.delete(`http://localhost:3000/api/schedules/${id}`);
      fetchSchedules();
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold">Your Schedules</h2>
        <Link to="/profile" className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-full transition">
          Profile
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} mb-10`}>
        <div className="grid md:grid-cols-2 gap-4">
          <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} required />
          <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} required />
          <input type="text" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button type="submit" className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full hover:scale-105 transition">
          {editing ? 'Update' : 'Add'} Schedule
        </button>
        {editing && <button onClick={() => { setEditing(null); setForm({ title: '', date: '', location: '', priority: 'medium' }); }} className="ml-3 text-red-500">Cancel</button>}
      </form>

      {loading ? (
        <p className="text-center">Loading...</p>
      ) : schedules.length === 0 ? (
        <p className="text-center text-gray-500">No schedules yet. Add one!</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((s) => (
            <div key={s._id} className={`p-6 rounded-xl shadow-xl hover:shadow-2xl transition ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-sm opacity-75">Date: {new Date(s.date).toLocaleString()}</p>
              {s.location && <p className="text-sm opacity-75">Location: {s.location}</p>}
              <p className="mt-2">
                Priority: <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  s.priority === 'high' ? 'bg-red-500 text-white' :
                  s.priority === 'low' ? 'bg-green-500 text-white' :
                  'bg-yellow-500 text-white'
                }`}>{s.priority}</span>
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleEdit(s)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition">Edit</button>
                <button onClick={() => handleDelete(s._id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}