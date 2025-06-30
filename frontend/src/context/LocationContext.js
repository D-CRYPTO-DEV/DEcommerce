import React, { createContext, useState, useContext, useEffect } from 'react';

const LocationContext = createContext();

export const useLocation = () => useContext(LocationContext);

export const LocationProvider = ({ children }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [availableLocations, setAvailableLocations] = useState([
    'New York',
    'Los Angeles',
    'Chicago',
    'Houston',
    'Phoenix',
    'Philadelphia',
    'San Antonio',
    'San Diego',
    'Dallas',
    'San Jose'
  ]);

  // Load saved location from local storage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      setUserLocation(savedLocation);
    }
  }, []);

  // Update location
  const updateLocation = (location) => {
    setUserLocation(location);
    localStorage.setItem('userLocation', location);
  };

  return (
    <LocationContext.Provider value={{ userLocation, availableLocations, updateLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext; 