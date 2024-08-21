import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || "");

  useEffect(() => {
    if (authToken) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [authToken]);

  const login = (token, name) => {
    setAuthToken(token);
    setUserName(name);
    setIsLoggedIn(true);
    localStorage.setItem('authToken', token);
    localStorage.setItem('userName', name);
  };

  const logout = () => {
    setAuthToken("");
    setUserName("");
    setIsLoggedIn(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
  };

  return (
    <AppContext.Provider value={{ isLoggedIn, userName, login, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
