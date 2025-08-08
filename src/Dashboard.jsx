import React, { useEffect, useState } from 'react';

function Dashboard() {
  const [shifts, setShifts] = useState([]);
  const [loaList, setLoaList] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/shifts', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setShifts(data));

    fetch('http://localhost:3000/api/loa', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setLoaList(data));
  }, []);

  return (
    <div>
      <h2>Shift Planning</h2>
      {shifts.map(s => (
        <div key={s._id}>
          {s.title} on {new Date(s.date).toLocaleDateString()} from {s.startTime} to {
