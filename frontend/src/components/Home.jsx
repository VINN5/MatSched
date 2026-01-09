import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Home({ darkMode }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'} flex flex-col`}>
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            className={`text-5xl md:text-7xl font-extrabold mb-6 transition-all duration-1000 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
              MatSched
            </span>
          </h1>
          <p className={`text-xl md:text-2xl mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-700'} transition-all duration-1000 delay-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            Your life, perfectly scheduled.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link 
              to="/register" 
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:scale-105 transition transform shadow-lg"
            >
              Get Started Free
            </Link>
            <Link 
              to="/login" 
              className={`px-8 py-4 rounded-full text-lg font-semibold border-2 transition ${
                darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-800' 
                  : 'border-purple-600 text-purple-600 hover:bg-purple-50'
              }`}
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`${darkMode ? 'bg-gray-800' : 'bg-white'} py-16`}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Why Choose MatSched?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: 'Calendar', title: 'Smart Scheduling', desc: 'Plan your day with drag & drop ease' },
              { icon: 'Lock', title: 'Secure & Private', desc: 'Your data is encrypted and yours only' },
              { icon: 'Zap', title: 'Lightning Fast', desc: 'Built for speed' }
            ].map((feature, i) => (
              <div 
                key={i}
                className={`p-8 rounded-2xl shadow-xl transition-all duration-500 hover:scale-105 ${
                  darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-blue-50 to-purple-50'
                }`}
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100'} py-8 border-t`}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            © 2025 MatSched. Built with <span className="text-red-500">Heart</span> by Vinn.
          </p>
        </div>
      </footer>
    </div>
  );
}