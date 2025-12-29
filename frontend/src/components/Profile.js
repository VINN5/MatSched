import { Link } from 'react-router-dom';

export default function Profile() {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center">Your Profile</h2>
      <div className="space-y-4">
        <p><strong>User ID:</strong> <span className="text-purple-600">69022e3244c46e2c08b99ab2</span></p>
        <p><strong>Status:</strong> <span className="text-green-600">Active</span></p>
        <p><strong>App:</strong> MatSched v2</p>
      </div>
      <Link to="/dashboard" className="mt-8 block text-center bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-full transition">
        Back to Dashboard
      </Link>
    </div>
  );
}