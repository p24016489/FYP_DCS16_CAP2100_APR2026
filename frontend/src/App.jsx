import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  // --- THE FIX: Check for 'username' the exact millisecond the page loads ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedUser = localStorage.getItem('username');
    // If savedUser exists and isn't empty, stay logged in on refresh!
    return savedUser !== null && savedUser !== '' && savedUser !== 'undefined';
  });
  
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('username') || '';
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('user_role') || '';
  });

  const handleLogin = (loggedUsername, loggedRole) => {
    setIsAuthenticated(true);
    setUsername(loggedUsername);
    setUserRole(loggedRole);
  };

  const handleLogout = () => {
    // Clear all memory so the user stays logged out
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    
    setIsAuthenticated(false);
    setUsername('');
    setUserRole('');
  };

  return (
    <>
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Dashboard 
          onLogout={handleLogout} 
          username={username} 
          userRole={userRole} 
        />
      )}
    </>
  );
}

export default App;